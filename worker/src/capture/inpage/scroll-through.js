// Runs inside the captured page. Scrolls through the page once, a step at a time, so lazy
// content and scroll animations load, then returns to the top. One round trip for the whole
// pass instead of two per step. Returns the page height it scrolled through.
(async function premiereScrollThrough(opts) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const height = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  const limit = Math.min(height, opts.viewport * 10);
  for (let y = opts.viewport * 0.7; y < limit; y += opts.viewport * 0.7) {
    window.scrollTo({ top: Math.round(y), behavior: "instant" });
    await sleep(opts.pause);
  }
  window.scrollTo({ top: 0, behavior: "instant" });
  await sleep(opts.settle);
  return height;
})
