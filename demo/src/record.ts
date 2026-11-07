// npx tsx demo/src/record.ts
// Drives the real site (npm run dev must be running) through one order and one recut, filming the
// browser with the DevTools screencast. Headless Chrome draws no pointer, so every mouse move and
// click is logged and the edit draws the cursor. Marks note where each beat of the narration
// starts; boxes note where things sit on screen, for the camera.

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { OUT } from "./paths";

const SITE = process.env.DEMO_SITE ?? "http://localhost:3000";
const APP = "fundable.vibestarter.xyz";
const NEW_HOOK = "Will your app get funded? Ask Fundable.";
const VIEWPORT = { width: 1440, height: 810 };
const SCALE = 2;

export type RecEvent =
  | { kind: "mark"; t: number; name: string }
  | { kind: "move"; t: number; until: number; x: number; y: number }
  | { kind: "click"; t: number; x: number; y: number }
  | { kind: "box"; t: number; name: string; x: number; y: number; w: number; h: number };

const dir = path.join(OUT, "rec");
const framesDir = path.join(dir, "frames");
await rm(dir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--hide-scrollbars", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
  // A visitor of its own, so the demo's two trailers do not spend the day's free ones for localhost.
  extraHTTPHeaders: { "x-forwarded-for": "198.51.100.24" },
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

const frames: { t: number; file: string }[] = [];
let last = 0;
let writes = Promise.resolve();
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  const t = metadata.timestamp ?? Date.now() / 1000;
  if (t - last < 1 / 30) return; // 30 frames a second is plenty
  last = t;
  const file = `f${String(frames.length).padStart(5, "0")}.jpg`;
  frames.push({ t, file });
  writes = writes.then(() => writeFile(path.join(framesDir, file), Buffer.from(data, "base64")));
});

const events: RecEvent[] = [];
const now = () => Date.now() / 1000;
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const mark = (name: string) => {
  events.push({ kind: "mark", t: now(), name });
  console.log(`${new Date().toISOString().slice(11, 19)} ${name}`);
};
let pointer = { x: 1080, y: 520 };
events.push({ kind: "move", t: now(), until: now(), ...pointer });

async function box(name: string, target: Locator) {
  const b = await target.boundingBox();
  if (b) events.push({ kind: "box", t: now(), name, x: b.x, y: b.y, w: b.width, h: b.height });
}

/** Glides the pointer to a spot on the element (fx, fy as fractions of its box), scrolling it into
 *  view first if it is off screen. */
async function moveTo(target: Locator, fx = 0.5, fy = 0.5, seconds = 0.7) {
  const seen = await target.boundingBox();
  if (seen && (seen.y < 60 || seen.y + seen.height > VIEWPORT.height - 20)) await scrollToTop(target, 220, 1.0);
  const b = await target.boundingBox();
  if (!b) throw new Error("nothing to move to");
  const to = { x: Math.round(b.x + b.width * fx), y: Math.round(b.y + b.height * fy) };
  const t = now();
  await page.mouse.move(to.x, to.y, { steps: Math.max(8, Math.round(seconds * 40)) });
  events.push({ kind: "move", t, until: Math.max(now(), t + seconds), x: to.x, y: to.y });
  if (now() < t + seconds) await sleep(t + seconds - now());
  pointer = to;
}

async function click(target: Locator, fx = 0.5, fy = 0.5) {
  await moveTo(target, fx, fy);
  await sleep(0.12);
  events.push({ kind: "click", t: now(), ...pointer });
  await page.mouse.down();
  await sleep(0.06);
  await page.mouse.up();
}

/** An eased scroll to a page position, run in the page. Plain JS in a string: the TypeScript loader
 *  would wrap named functions in a helper the page does not have. */
const SMOOTH_SCROLL = `(function (y, ms) {
  return new Promise(function (done) {
    var start = window.scrollY, delta = y - start, t0 = performance.now();
    function step(time) {
      var p = Math.min(1, (time - t0) / ms);
      var eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      window.scrollTo(0, start + delta * eased);
      if (p < 1) requestAnimationFrame(step); else done();
    }
    requestAnimationFrame(step);
  });
})`;

/** Wheel events would go through the site's smooth scrolling, which multiplies them, so the page is
 *  scrolled frame by frame instead. */
async function scrollTo(y: number, seconds = 1.2) {
  await page.evaluate(`${SMOOTH_SCROLL}(${Math.round(y)}, ${Math.round(seconds * 1000)})`);
  await sleep(0.35);
}

/** Scrolls so the element's top sits offset pixels below the top of the window. */
async function scrollToTop(target: Locator, offset = 90, seconds = 1.4) {
  const top = await target.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await scrollTo(Math.max(0, top - offset), seconds);
}

async function waitForJob(id: string, onStep: (key: string, status: string) => void): Promise<void> {
  const seen = new Map<string, string>();
  for (;;) {
    const job = (await fetch(`${SITE}/api/jobs/${id}`).then((r) => r.json())) as {
      status: string;
      error: string | null;
      steps: { key: string; status: string }[];
    };
    for (const step of job.steps) {
      if (seen.get(step.key) !== step.status) {
        seen.set(step.key, step.status);
        onStep(step.key, step.status);
      }
    }
    if (job.status === "done") return;
    if (job.status === "failed") throw new Error(`job ${id} failed: ${job.error}`);
    await sleep(0.4);
  }
}

const jobIdOf = (p: Page) => p.url().match(/\/jobs\/([0-9a-f-]{36})/)?.[1] ?? null;

/** Waits for the client-side route change to a job page other than \`not\`; on a miss, says what the
 *  page shows. */
async function waitForJobPage(not: string | null, seconds = 30): Promise<string> {
  const until = now() + seconds;
  while (now() < until) {
    const id = jobIdOf(page);
    if (id && id !== not) return id;
    await sleep(0.25);
  }
  await page.screenshot({ path: path.join(dir, "stuck.png") });
  const text = (await page.locator("form").first().innerText().catch(() => "")).slice(0, 600);
  throw new Error(`No job page after ${seconds} s. The form says: ${text}`);
}

await cdp.send("Page.startScreencast", { format: "jpeg", quality: 82, maxWidth: VIEWPORT.width * SCALE, maxHeight: VIEWPORT.height * SCALE });
const started = now();

// The box office.
mark("home");
await page.goto(SITE, { waitUntil: "load" });
await sleep(5.5);
const ticket = page.locator("form#make");
await box("ticket", ticket);
await box("marquee", page.locator("h1").first());

mark("url");
const field = page.locator('input[placeholder="yourapp.xyz"]');
await click(field, 0.3, 0.5);
await sleep(0.3);
await page.keyboard.type(APP, { delay: 85 });
await sleep(1.6);

mark("options");
await scrollToTop(page.locator("fieldset").first(), 150, 1.2);
await box("options", ticket);
// Down the ticket in order, so the page only ever scrolls one way: the cut, the running time, the
// screen, the narrator, the captions.
await moveTo(page.locator("label:has(input[name=style][value=hype])"), 0.3, 0.5);
await sleep(0.5);
await moveTo(page.locator('label:has(input[name=length][value="45"])'), 0.3, 0.5);
await sleep(0.4);
await moveTo(page.locator("label:has(input[name=format][value=landscape])"), 0.3, 0.5);
await sleep(0.5);
await click(page.getByRole("radio", { name: "Pandora" }));
await sleep(0.9);
await click(page.locator("label:has(input[name=captions][value=karaoke])"));
await sleep(0.7);

mark("roll");
const roll = page.locator("form#make button[type=submit]");
await scrollToTop(ticket, 110, 1.0);
await click(roll);
const first = await waitForJobPage(null);
await sleep(1.5);
const strip = page.locator("ol.grid-cols-5").first();
await box("strip", strip);

// The shoot, step by step. Once the script is written, a look at the storyboard below the film
// strip, then back up to watch the last steps.
const marked = (name: string) => events.some((e) => e.kind === "mark" && e.name === name);
const director = (async () => {
  while (!marked("plan:done")) await sleep(0.3);
  await sleep(1.2);
  const heading = page.getByText("the storyboard").first();
  await heading.waitFor({ timeout: 10_000 });
  mark("storyboard");
  await scrollToTop(heading, 120, 1.6);
  await box("storyboard", page.locator("section").filter({ has: heading }).first());
  await sleep(9);
  mark("back-to-strip");
  await scrollToTop(strip, 170, 1.6);
})();
await waitForJob(first, (key, status) => mark(`${key}:${status}`));
await director;
mark("done");
await sleep(1.5);
await page.locator("video").first().waitFor({ timeout: 20_000 });
const player = page.locator("video").first();
await scrollToTop(page.getByText("Now showing").first(), 100, 1.0);
await box("player", player);
mark("player");
await sleep(9);

mark("ready");
const ready = page.locator("section").filter({ has: page.getByText("Now showing") }).first();
const downloads = ready.locator('a:has-text("Trailer")').first();
await moveTo(downloads, 0.5, 0.5, 0.8);
await box("downloads", downloads.locator(".."));
await sleep(1.2);
await moveTo(ready.locator('a:has-text("Poster")').first(), 0.5, 0.5, 0.6);
await sleep(0.8);
await moveTo(ready.locator('a:has-text("Subtitles")').first(), 0.5, 0.5, 0.6);
await sleep(1.2);

// The cutting room.
mark("recut");
await scrollToTop(page.getByText("The cutting room").first(), 110, 1.8);
await click(page.getByRole("button", { name: "Mark up the script" }));
await sleep(1.0);
const hook = page.locator('textarea[aria-label="Opening line"]');
await scrollToTop(page.locator("form.paper"), 100, 1.0);
await box("pages", page.locator("form.paper"));
await click(hook, 0.6, 0.5);
await page.keyboard.press("Control+A");
await sleep(0.2);
await page.keyboard.type(NEW_HOOK, { delay: 55 });
await sleep(0.6);
const atlas = page.getByRole("radio", { name: "Atlas" });
await click(atlas);
await sleep(0.8);
const recutButton = page.getByRole("button", { name: "RECUT IT" });
await click(recutButton);
const second = await waitForJobPage(first);
mark("recut-job");
await waitForJob(second, (key, status) => mark(`recut-${key}:${status}`));
mark("recut-done");
await sleep(1.5);
await scrollToTop(page.getByText("Now showing").first(), 100, 0.8).catch(() => {});
await box("player2", page.locator("video").first());
await sleep(5);
mark("end");

await cdp.send("Page.stopScreencast");
await writes;
await browser.close();
await writeFile(
  path.join(dir, "recording.json"),
  JSON.stringify({ started, viewport: VIEWPORT, scale: SCALE, jobs: { first, recut: second }, frames, events }, null, 1),
);
console.log(`${frames.length} frames over ${(now() - started).toFixed(0)} s; first take ${first}, recut ${second}`);
