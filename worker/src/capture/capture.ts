// Step 1 of a job (no AI): open the URL in a fresh browser, collect what the planner needs,
// and take labelled screenshots. Treats the page as hostile: public hosts only, no downloads,
// no popups, no permissions, and hard time limits.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import sharp from "sharp";
import { launchSafeBrowser, newSafeContext, type SafeBrowser } from "../safety/browser";
import { assertPublicHost, assertPublicUrl } from "../safety/url-guard";
import { dismissCookieBanners } from "./cookies";
import { inpageScript } from "./inpage-scripts";
import {
  CAPTURE_VERSION,
  type Capture,
  type CapturedElement,
  type CapturedScreenshot,
  type CapturedSection,
} from "./types";

export const VIEWPORT = { width: 1920, height: 1080 } as const;
const PLANNER_IMAGE_WIDTH = 1024;

export class CaptureError extends Error {
  constructor(
    message: string,
    readonly code: "nav_timeout" | "nav_failed" | "blocked" | "dns" | "timeout",
  ) {
    super(message);
    this.name = "CaptureError";
  }
}

export interface CaptureOptions {
  /** Directory for capture.json and screenshots. Must exist. */
  outDir: string;
  maxElements?: number;
  maxScreenshots?: number;
  navTimeoutMs?: number;
  totalTimeoutMs?: number;
}

interface Extracted {
  title: string;
  description: string;
  siteName: string;
  ogImage: string | null;
  themeColor: string | null;
  lang: string;
  pageHeight: number;
  textExcerpt: string;
  loginWall: boolean;
  elements: CapturedElement[];
  sections: CapturedSection[];
}

const BOT_WALL = /just a moment|attention required|access denied|verify you are human|are you a robot|captcha|request blocked/i;

/** Scroll positions for the planner's screenshots: consecutive screens, or spread out on long pages. */
export function screenshotPositions(pageHeight: number, viewportHeight: number, max = 4): number[] {
  const maxY = Math.max(0, pageHeight - viewportHeight);
  if (maxY < viewportHeight * 0.5) return [0];
  const step = viewportHeight * 0.9;
  if (maxY <= step * (max - 1)) {
    const ys: number[] = [];
    for (let y = 0; y < maxY - viewportHeight * 0.5; y += step) ys.push(Math.round(y));
    ys.push(Math.round(maxY));
    return ys;
  }
  return Array.from({ length: max }, (_, i) => Math.round((maxY * i) / (max - 1)));
}

async function scrollTo(page: Page, y: number): Promise<number> {
  await page.evaluate(`window.scrollTo({ top: ${Math.round(y)}, behavior: "instant" })`);
  return (await page.evaluate("Math.round(window.scrollY)")) as number;
}

/** Scrolls through the page once so lazy content and scroll animations load before extraction. */
async function scrollThrough(page: Page): Promise<void> {
  const height = (await page.evaluate(
    "Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)",
  )) as number;
  const limit = Math.min(height, VIEWPORT.height * 10);
  for (let y = VIEWPORT.height * 0.7; y < limit; y += VIEWPORT.height * 0.7) {
    await scrollTo(page, y);
    await page.waitForTimeout(120);
  }
  await scrollTo(page, 0);
  await page.waitForTimeout(400);
}

function navigationError(err: unknown): CaptureError {
  const message = err instanceof Error ? err.message : String(err);
  if (/ERR_TUNNEL_CONNECTION_FAILED|ERR_BLOCKED_BY_CLIENT/.test(message)) {
    return new CaptureError("That link leads to a private or blocked address.", "blocked");
  }
  if (/ERR_NAME_NOT_RESOLVED/.test(message)) return new CaptureError("That domain could not be found.", "dns");
  if (/timeout/i.test(message)) return new CaptureError("The page took too long to load.", "nav_timeout");
  const code = message.match(/net::[A-Z_]+/)?.[0] ?? message.split("\n")[0]?.slice(0, 120);
  return new CaptureError(`Could not open the page (${code}).`, "nav_failed");
}

async function run({ browser, proxy }: SafeBrowser, url: URL, options: Required<CaptureOptions>): Promise<Capture> {
  const context = await newSafeContext(browser, { viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  context.on("page", (popup) => {
    if (popup !== page) popup.close().catch(() => {});
  });
  page.on("dialog", (dialog) => {
    dialog.dismiss().catch(() => {});
  });

  const notes: string[] = [];
  const warnings: string[] = [];

  let status = 0;
  try {
    const response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: options.navTimeoutMs });
    status = response?.status() ?? 0;
  } catch (err) {
    throw navigationError(err);
  }
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);

  const finalUrl = page.url();
  const finalHost = new URL(finalUrl).hostname;
  const finalIsPublic = await assertPublicHost(finalHost).then(
    () => true,
    () => false,
  );
  if (!/^https?:/i.test(finalUrl) || proxy.blocked.has(finalHost) || !finalIsPublic) {
    throw new CaptureError("That link leads to a private or blocked address.", "blocked");
  }
  if (status >= 400) warnings.push(`The page answered with HTTP ${status}.`);

  const cookieNote = await dismissCookieBanners(page);
  if (cookieNote) notes.push(cookieNote);
  await page.keyboard.press("Escape").catch(() => {});

  await scrollThrough(page);
  const lateCookieNote = await dismissCookieBanners(page);
  if (lateCookieNote) notes.push(lateCookieNote);

  const extracted = (await page.evaluate(inpageScript("extract", { maxElements: options.maxElements }))) as Extracted;

  const botWall = BOT_WALL.test(`${extracted.title} ${extracted.textExcerpt.slice(0, 300)}`);
  if (botWall) warnings.push("The site showed a bot check or access-denied page instead of the app.");
  if (extracted.loginWall) notes.push("The page shows a login form; the trailer stays on public content.");
  if (extracted.elements.length === 0) warnings.push("No interactive elements were found.");

  const screenshots: CapturedScreenshot[] = [];
  const positions = screenshotPositions(extracted.pageHeight, VIEWPORT.height, options.maxScreenshots);
  let lastScrollY = -1;
  for (const y of positions) {
    const scrollY = await scrollTo(page, y);
    if (scrollY === lastScrollY) continue; // the page scrolls inside a container, not the window
    lastScrollY = scrollY;
    await page.waitForTimeout(350);

    const n = screenshots.length + 1;
    const file = `shot-${n}.jpg`;
    const markedFile = `shot-${n}-marked.jpg`;
    const clean = await page.screenshot({ type: "jpeg", quality: 85 });
    await page.evaluate(inpageScript("marks", { show: true }));
    const marked = await page.screenshot({ type: "jpeg", quality: 90 });
    await page.evaluate(inpageScript("marks", { show: false }));

    const small = await sharp(marked).resize({ width: PLANNER_IMAGE_WIDTH }).jpeg({ quality: 75 }).toBuffer();
    await writeFile(path.join(options.outDir, file), clean);
    await writeFile(path.join(options.outDir, markedFile), small);
    screenshots.push({
      file,
      markedFile,
      scrollY,
      width: PLANNER_IMAGE_WIDTH,
      height: Math.round((VIEWPORT.height * PLANNER_IMAGE_WIDTH) / VIEWPORT.width),
    });
  }

  await context.close();
  if (proxy.blocked.size) {
    warnings.push(`Blocked requests to ${proxy.blocked.size} private or unknown host(s): ${[...proxy.blocked].slice(0, 3).join(", ")}.`);
  }

  return {
    version: CAPTURE_VERSION,
    url: url.href,
    finalUrl,
    capturedAt: new Date().toISOString(),
    title: extracted.title,
    description: extracted.description,
    siteName: extracted.siteName,
    lang: extracted.lang,
    ogImage: extracted.ogImage,
    themeColor: extracted.themeColor,
    textExcerpt: extracted.textExcerpt,
    pageHeight: extracted.pageHeight,
    viewport: { ...VIEWPORT },
    loginWall: extracted.loginWall,
    botWall,
    elements: extracted.elements,
    sections: extracted.sections,
    screenshots,
    notes,
    warnings,
  };
}

/** Captures one URL into options.outDir (capture.json plus screenshots). */
export async function capturePage(rawUrl: string, opts: CaptureOptions): Promise<Capture> {
  const options: Required<CaptureOptions> = {
    maxElements: 60,
    maxScreenshots: 4,
    navTimeoutMs: 20_000,
    totalTimeoutMs: 60_000,
    ...opts,
  };
  const url = await assertPublicUrl(rawUrl);
  await mkdir(options.outDir, { recursive: true });

  const safe = await launchSafeBrowser();
  let timer: NodeJS.Timeout | undefined;
  try {
    const job = run(safe, url, options);
    job.catch(() => {}); // the deadline below may win; avoid an unhandled rejection
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new CaptureError("The page took too long to capture.", "timeout")),
        options.totalTimeoutMs,
      );
    });
    const capture = await Promise.race([job, deadline]);
    await writeFile(path.join(options.outDir, "capture.json"), JSON.stringify(capture, null, 2));
    return capture;
  } finally {
    clearTimeout(timer);
    await safe.close();
  }
}
