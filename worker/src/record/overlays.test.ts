import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { closeOverlays } from "./recorder";

// A page with an amount field and a token picker that closes on Escape, like Uniswap's.
const PAGE = `<!doctype html><html><body>
<input id="amount" value="0.5">
<div id="picker" role="dialog" aria-modal="true" style="position:fixed;inset:80px;background:#fff;border:1px solid #000">Select a token</div>
<script>
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.getElementById("picker").style.display = "none"; window.escapes = (window.escapes || 0) + 1; });
</script></body></html>`;

test("a dialog left open by the last click is closed before the next shot, and nothing else is touched", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(PAGE);
    await closeOverlays(page);
    assert.equal(await page.locator("#picker").isVisible(), false);
    assert.equal(await page.inputValue("#amount"), "0.5");
    // With nothing open, no key is pressed at all.
    await closeOverlays(page);
    assert.equal(await page.evaluate(() => (window as unknown as { escapes: number }).escapes), 1);
  } finally {
    await browser.close();
  }
});

test("shoots take turns: a second shoot starts only when the first has finished", async () => {
  const { inFilmingSlot } = await import("./recorder");
  const events: string[] = [];
  let waited = false;
  const shoot = (name: string, ms: number) => async () => {
    events.push(`${name} start`);
    await new Promise((r) => setTimeout(r, ms));
    events.push(`${name} end`);
    return name;
  };
  const results = await Promise.all([inFilmingSlot(shoot("a", 60)), inFilmingSlot(shoot("b", 10), () => (waited = true))]);
  assert.deepEqual(results, ["a", "b"]);
  assert.deepEqual(events, ["a start", "a end", "b start", "b end"]);
  assert.equal(waited, true);
  // A failed shoot still frees the slot.
  await assert.rejects(inFilmingSlot(async () => Promise.reject(new Error("boom"))));
  assert.equal(await inFilmingSlot(async () => "after"), "after");
});

// Excalidraw-like: the target is only in the DOM once the main menu opens, and a sign-in dropdown
// comes first in the page and must never be opened.
const MENU_PAGE = `<!doctype html><html><body>
<button id="login" aria-haspopup="menu" aria-expanded="false" onclick="window.loginOpened = true">Log in</button>
<button id="theme" aria-expanded="false" onclick="this.setAttribute('aria-expanded','true')">Theme</button>
<button id="menu" aria-haspopup="menu" aria-expanded="false" onclick="
  this.setAttribute('aria-expanded','true');
  document.body.insertAdjacentHTML('beforeend', '<div role=menu><button>Live collaboration...</button></div>');
">Main menu</button>
<script>document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.getElementById("theme").setAttribute("aria-expanded", "false"); });</script>
</body></html>`;

test("a target shut inside a menu is revealed off camera, without opening sign-in menus", async () => {
  const { reveal } = await import("./recorder");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(MENU_PAGE);
    const element = { id: "e19", kind: "button", text: "Live collaboration...", selector: "#welcome > button:nth-of-type(3)" } as never;
    const found = await reveal(page, element);
    assert.ok(found, "the target should be found once the main menu is open");
    assert.equal(await found!.innerText(), "Live collaboration...");
    assert.equal(await page.evaluate(() => (window as unknown as { loginOpened?: boolean }).loginOpened ?? false), false);
    // A trigger that did not help was closed again.
    assert.equal(await page.getAttribute("#theme", "aria-expanded"), "false");
  } finally {
    await browser.close();
  }
});
