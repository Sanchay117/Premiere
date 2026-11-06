// Runs inside the captured page. Last resort when no cookie button could be clicked:
// hides large fixed or sticky overlays that talk about cookies or consent.
(function premiereHideCookieOverlays() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let hidden = 0;
  let scanned = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (++scanned > 8000) break;
    const st = getComputedStyle(el);
    if (st.position !== "fixed" && st.position !== "sticky") continue;
    if (st.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height < vw * vh * 0.04) continue;
    const text = (el.innerText || "").slice(0, 2000);
    if (text.length > 1500 || !/cookie|consent|gdpr|privacy preferences/i.test(text)) continue;
    el.style.setProperty("display", "none", "important");
    hidden++;
  }
  if (hidden) {
    document.documentElement.style.setProperty("overflow", "auto", "important");
    if (document.body) document.body.style.setProperty("overflow", "auto", "important");
  }
  return hidden;
})
