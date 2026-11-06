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
