// Runs inside the page. Resolves once the page stops growing: the count of clickable elements and
// the page height hold still for quietMs, or maxMs passes. Returns the milliseconds it waited.
(async function premiereWaitStable(opts) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const signature = () =>
    `${document.querySelectorAll("a, button, input, select, textarea, [role='button'], [role='tab'], [onclick]").length}:${document.documentElement.scrollHeight}`;
  const start = performance.now();
  let last = signature();
  let since = start;
  while (performance.now() - start < opts.maxMs) {
    await sleep(opts.interval);
    const now = signature();
    if (now !== last) {
      last = now;
      since = performance.now();
    } else if (performance.now() - since >= opts.quietMs) {
      break;
    }
  }
  return Math.round(performance.now() - start);
})
