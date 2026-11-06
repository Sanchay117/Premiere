// Runs inside the captured page (or a consent iframe). Finds the buttons that would close a
// cookie or consent banner, best choice first: a known reject button, a reject button by its
// words, a known accept button, then an accept button by its words. Each candidate is tagged
// with data-premiere-consent="<n>" for the caller to click, and the labels are returned. One
// round trip instead of one per selector, which matters on pages that keep their main thread busy.
(function premiereFindConsent(opts) {
  for (const old of document.querySelectorAll("[data-premiere-consent]")) old.removeAttribute("data-premiere-consent");

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (typeof el.checkVisibility === "function") return el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none";
  };
  const found = [];
  const add = (el) => {
    if (el && found.length < 6 && !found.includes(el) && visible(el)) found.push(el);
  };
  const bySelector = (list) => {
    for (const selector of list) {
      try {
        add(document.querySelector(selector));
      } catch {
        // a selector this page's engine rejects
      }
    }
  };
  const byText = (pattern) => {
    let banners = [];
    try {
      banners = document.querySelectorAll(opts.banner);
    } catch {
      return;
    }
    let seen = 0;
    for (const banner of banners) {
      for (const button of banner.querySelectorAll(opts.buttons)) {
        if (++seen > 300) return;
        const text = (button.innerText || button.value || "").replace(/\s+/g, " ").trim();
        if (text && pattern.test(text)) add(button);
      }
    }
  };

  bySelector(opts.rejectSelectors);
  byText(new RegExp(opts.rejectText, "i"));
  bySelector(opts.acceptSelectors);
  byText(new RegExp(opts.acceptText, "i"));

  return found.map((el, i) => {
    el.setAttribute("data-premiere-consent", String(i));
    return (el.innerText || el.value || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 40);
  });
})
