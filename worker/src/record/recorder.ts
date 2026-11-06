// Step 3 (no AI): replay the shot list in a hardened browser and film it. Frames come from the
// Chrome DevTools screencast as high-quality JPEGs with timestamps; the render step later picks
// the frame for each moment. Each shot gets a short lead-in, its action, then a hold that lasts as
// long as its narration line. A step that fails is marked and skipped, never faked.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Locator, Page } from "playwright";
import { dismissCookieBanners } from "../capture/cookies";
import type { Capture, CapturedElement } from "../capture/types";
import type { Plan, Shot } from "../planner/schema";
import { launchSafeBrowser, newSafeContext } from "../safety/browser";
import { assertPublicUrl } from "../safety/url-guard";

export const FRAME = { width: 1920, height: 1080 } as const;
/** Device pixels per CSS pixel in the footage (frames are 2880x1620; boxes stay in CSS pixels). */
export const PIXEL_DENSITY = 1.5;
const LEAD_IN = 0.7;
const STEP_TIMEOUT = 4000;
const NAV_SETTLE = 6000;

export interface RecordedFrame {
  /** Seconds since recording started. */
  t: number;
  file: string;
}

export interface RecordedShot {
  index: number;
  ok: boolean;
  error: string | null;
  /** Seconds since recording started. */
  start: number;
  actionAt: number;
  end: number;
  /** Target's position in the frame at action time, in CSS pixels. */
  box: { x: number; y: number; w: number; h: number } | null;
  typed: string | null;
  url: string;
}

export interface Recording {
  width: number;
  height: number;
  frames: RecordedFrame[];
  shots: RecordedShot[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Finds a captured element again on the live page, checking it still says the same thing. */
async function locate(page: Page, el: CapturedElement): Promise<Locator | null> {
  const name = el.text.slice(0, 60);
  const bySelector = page.locator(el.selector).first();
  if (await bySelector.isVisible().catch(() => false)) {
    const label = await bySelector
      .evaluate((node) => (node as HTMLElement).innerText || node.getAttribute("aria-label") || node.getAttribute("placeholder") || "")
      .catch(() => "");
    const isField = el.kind === "input" || el.kind === "textarea";
    if (isField || !name || norm(label).includes(norm(name).slice(0, 20))) return bySelector;
  }
  if (!name) return null;
  const candidates: Locator[] = [];
  if (el.kind === "link") candidates.push(page.getByRole("link", { name }).first());
  if (el.kind === "button") candidates.push(page.getByRole("button", { name }).first());
  if (el.kind === "tab") candidates.push(page.getByRole("tab", { name }).first());
  if (el.kind === "input" || el.kind === "textarea") candidates.push(page.getByPlaceholder(name).first(), page.getByLabel(name).first());
  candidates.push(page.getByText(name, { exact: false }).first());
  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

async function boxOf(locator: Locator): Promise<RecordedShot["box"]> {
  const b = await locator.boundingBox().catch(() => null);
  return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
}

/**
 * Clicks or hovers like a person would. Playwright's actionability checks can refuse an element
 * that a real user clicks without trouble (an overlay on top of a toolbar button), so after a
 * short normal attempt it dispatches a real mouse event at the element's center.
 */
async function pointerAction(locator: Locator, kind: "click" | "hover"): Promise<void> {
  try {
    if (kind === "click") await locator.click({ timeout: 1800 });
    else await locator.hover({ timeout: 1800 });
  } catch {
    if (kind === "click") await locator.click({ timeout: STEP_TIMEOUT, force: true });
    else await locator.hover({ timeout: STEP_TIMEOUT, force: true });
  }
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded", { timeout: NAV_SETTLE }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
}

export interface RecordOptions {
  /** Seconds of footage wanted per shot, normally the narration length plus padding. */
  holds: number[];
  outDir: string;
  onProgress?: (detail: string) => void;
  /** Hard cap for the whole recording. */
  maxSeconds?: number;
}

export async function recordPlan(capture: Capture, plan: Plan, options: RecordOptions): Promise<Recording> {
  const landing = (await assertPublicUrl(capture.finalUrl)).href;
  const framesDir = path.join(options.outDir, "frames");
  await mkdir(framesDir, { recursive: true });
  const elements = new Map(capture.elements.map((e) => [e.id, e]));
  const sections = new Map(capture.sections.map((s) => [s.id, s]));
  const progress = options.onProgress ?? (() => {});
  const budgetMs = (options.maxSeconds ?? options.holds.reduce((a, b) => a + b, 0) + 75) * 1000;
  const deadline = Date.now() + budgetMs;

  const safe = await launchSafeBrowser();
  const frames: RecordedFrame[] = [];
  const shots: RecordedShot[] = [];
  let writes: Promise<unknown> = Promise.resolve();
  let keyframe: () => Promise<void> = async () => {};
  try {
    // Filmed at 1.5x pixel density so the render can zoom toward a target without going soft.
    const context: BrowserContext = await newSafeContext(safe.browser, { viewport: FRAME, deviceScaleFactor: PIXEL_DENSITY });
    const page = await context.newPage();
    context.on("page", (popup) => {
      if (popup !== page) popup.close().catch(() => {});
    });
    page.on("dialog", (d) => {
      d.dismiss().catch(() => {});
    });

    progress("Opening the app for the shoot");
    await page.goto(landing, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await settle(page);
    await dismissCookieBanners(page);
    await page.keyboard.press("Escape").catch(() => {});

    // Start filming. The screencast only sends frames when the page repaints, so a static page
    // produces none; keyframes (real screenshots) cover the start of every shot.
    const cdp = await context.newCDPSession(page);
    const t0 = Date.now() / 1000;
    const now = () => Date.now() / 1000 - t0;
    const addFrame = (t: number, base64: string) => {
      const file = `f${String(frames.length).padStart(5, "0")}.jpg`;
      frames.push({ t, file });
      writes = writes.then(() => writeFile(path.join(framesDir, file), Buffer.from(base64, "base64")));
    };
    cdp.on("Page.screencastFrame", (event) => {
      cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
      addFrame((event.metadata.timestamp ?? Date.now() / 1000) - t0, event.data);
    });
    keyframe = async () => {
      const t = now();
      const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 86 }).catch(() => null);
      if (shot) addFrame(t, shot.data);
    };
    const startScreencast = () =>
      cdp
        .send("Page.startScreencast", { format: "jpeg", quality: 86, maxWidth: FRAME.width * PIXEL_DENSITY, maxHeight: FRAME.height * PIXEL_DENSITY, everyNthFrame: 2 })
        .catch(() => {});
    await startScreencast();
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) void startScreencast();
    });
    await keyframe();
    await sleep(300);

    for (const [i, shot] of plan.shots.entries()) {
      const hold = options.holds[i] ?? 4;
      if (Date.now() + hold * 1000 > deadline) {
        shots.push({ index: i, ok: false, error: "recording time limit reached", start: now(), actionAt: now(), end: now(), box: null, typed: null, url: page.url() });
        continue;
      }
      progress(`Filming shot ${i + 1} of ${plan.shots.length}: ${shot.action}`);
      shots.push(await filmShot(page, shot, i, hold));
    }

    await keyframe();
    await cdp.send("Page.stopScreencast").catch(() => {});
    await writes;
    await context.close();
    frames.sort((a, b) => a.t - b.t);
    return { width: FRAME.width, height: FRAME.height, frames, shots };

    // One shot: setup off camera, lead-in, action, hold.
    async function filmShot(p: Page, shot: Shot, index: number, hold: number): Promise<RecordedShot> {
      const el = shot.target ? elements.get(shot.target) : undefined;
      const section = shot.target ? sections.get(shot.target) : undefined;
      let locator: Locator | null = null;
      let error: string | null = null;

      if (el) {
        locator = await locate(p, el);
        if (!locator && p.url() !== landing) {
          // A previous click moved to another page; come back for this shot.
          await p.goto(landing, { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
          await settle(p);
          await dismissCookieBanners(p);
          locator = await locate(p, el);
        }
        if (!locator) error = `could not find "${el.text}"`;
        else if (shot.action !== "scroll") {
          await locator.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" })).catch(() => {});
          await sleep(250);
        }
      }

      const start = now();
      await keyframe();
      await sleep(LEAD_IN * 1000 - (now() - start) * 1000);
      const actionAt = now();
      let box = locator && shot.action !== "scroll" ? await boxOf(locator) : null;
      let typed: string | null = null;

      if (!error) {
        try {
          switch (shot.action) {
            case "click": {
              const before = p.url();
              await pointerAction(locator!, "click");
              await sleep(300);
              if (p.url() !== before) {
                await settle(p);
                await dismissCookieBanners(p);
              }
              break;
            }
            case "hover":
              await pointerAction(locator!, "hover");
              break;
            case "type":
              await pointerAction(locator!, "click");
              typed = shot.text ?? "";
              await locator!.pressSequentially(typed, { delay: 60, timeout: STEP_TIMEOUT + typed.length * 80 });
              break;
            case "scroll": {
              if (locator) {
                await locator.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "smooth" }));
                await sleep(900);
                box = await boxOf(locator);
              } else if (section) {
                // The heading lands about a fifth of the way down, clear of sticky headers, with
                // the section's content filling the frame below it.
                const heading = p.getByRole("heading", { name: section.heading.slice(0, 60) }).first();
                if (await heading.isVisible().catch(() => false)) {
                  await heading.evaluate((node) => {
                    const top = node.getBoundingClientRect().top + window.scrollY;
                    window.scrollTo({ top: Math.max(0, top - window.innerHeight * 0.22), behavior: "smooth" });
                  });
                } else {
                  await p.evaluate((y) => window.scrollTo({ top: Math.max(0, y - window.innerHeight * 0.22), behavior: "smooth" }), section.y);
                }
                await sleep(900);
                box = (await heading.isVisible().catch(() => false)) ? await boxOf(heading) : null;
              } else {
                await p.evaluate(() => window.scrollBy({ top: window.innerHeight * 0.75, behavior: "smooth" }));
              }
              break;
            }
            case "wait":
              break;
          }
        } catch (err) {
          error = err instanceof Error ? err.message.split("\n")[0]!.slice(0, 160) : String(err);
        }
      }

      await sleep((start + hold - now()) * 1000);
      return { index, ok: !error, error, start, actionAt, end: now(), box, typed, url: p.url() };
    }
  } finally {
    await writes.catch(() => {});
    await safe.close();
  }
}
