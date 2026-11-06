// Runs inside the captured page. Plain JavaScript on purpose: it is sent to the browser as text,
// so it cannot use anything from the Node side (and no build step can inject helpers into it).
// Collects page metadata, interactive elements and section headings, and tags the chosen
// elements with data-premiere-id / data-premiere-section so screenshots can be labelled.
(function premiereExtract(opts) {
  const MAX_ELEMENTS = opts.maxElements || 60;
  const MAX_SECTIONS = opts.maxSections || 20;
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  const here = new URL(location.href);
  const root = document.documentElement;
  const body = document.body || root;
  const pageHeight = Math.max(root.scrollHeight, body.scrollHeight, VH);

  const clean = (value, max) =>
    String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  const meta = (selector) => {
    const el = document.querySelector(selector);
    return el ? clean(el.getAttribute("content"), 400) : "";
  };

  // Hosting platforms where each subdomain is a different site.
  const SHARED_HOSTS = [
    "vercel.app", "netlify.app", "github.io", "pages.dev", "workers.dev", "lovable.app", "replit.app",
    "repl.co", "onrender.com", "fly.dev", "herokuapp.com", "web.app", "firebaseapp.com", "glitch.me",
    "surge.sh", "framer.website", "framer.app", "webflow.io", "carrd.co", "notion.site", "bolt.host",
  ];
  const siteOf = (hostname) => {
    const host = hostname.replace(/^www\./, "").toLowerCase();
    const parts = host.split(".");
    if (parts.length <= 2) return host;
    const shared = SHARED_HOSTS.find((s) => host.endsWith("." + s));
    if (shared) return parts.slice(-(shared.split(".").length + 1)).join(".");
    const sld = parts[parts.length - 2];
    const tld = parts[parts.length - 1];
    const keep = tld.length === 2 && /^(co|com|org|net|gov|ac|edu|ne|or)$/.test(sld) ? 3 : 2;
    return parts.slice(-keep).join(".");
  };

  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    if (
      typeof el.checkVisibility === "function" &&
      !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true })
    ) {
      return false;
    }
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none" || Number(st.opacity) < 0.05) return false;
    if (r.right <= 0 || r.left >= VW) return false;
    const top = r.top + window.scrollY;
    return top + r.height > 0 && top < pageHeight;
  }

  const INTERACTIVE = [
    "a[href]", "button", 'input:not([type="hidden"])', "textarea", "select", "summary",
    '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]', '[role="switch"]',
    '[role="checkbox"]', '[role="radio"]', '[role="option"]', '[contenteditable=""]', '[contenteditable="true"]',
    "[onclick]",
  ].join(", ");

  const candidates = new Set(document.querySelectorAll(INTERACTIVE));
  // Generated apps often make plain divs clickable. Take the outermost element with a pointer cursor.
  let scanned = 0;
  for (const el of body.querySelectorAll("div, span, li, img, svg, p, section, article")) {
    if (++scanned > 6000) break;
    if (el.closest(INTERACTIVE)) continue;
    if (getComputedStyle(el).cursor !== "pointer") continue;
    const parent = el.parentElement;
    if (parent && getComputedStyle(parent).cursor === "pointer") continue;
    candidates.add(el);
  }

  function kindOf(el) {
    const tag = el.tagName.toLowerCase();
    const role = (el.getAttribute("role") || "").toLowerCase();
    if (tag === "a") return "link";
    if (tag === "button" || role === "button" || tag === "summary") return "button";
    if (tag === "input") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "checkbox" || type === "radio") return "checkbox";
      if (["submit", "button", "reset", "image"].includes(type)) return "button";
      return "input";
    }
    if (tag === "textarea") return "textarea";
    if (tag === "select") return "select";
    if (role === "tab") return "tab";
    if (role === "link" || role === "menuitem") return "link";
    if (role === "checkbox" || role === "switch" || role === "radio") return "checkbox";
    if (el.isContentEditable) return "textarea";
    return "other";
  }

  function labelOf(el) {
    const tag = el.tagName.toLowerCase();
    const aria = el.getAttribute("aria-label") || "";
    const labelledBy = (el.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => {
        const ref = document.getElementById(id);
        return ref ? ref.textContent : "";
      })
      .join(" ");
    if (tag === "input" || tag === "textarea" || tag === "select") {
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (["submit", "button", "reset"].includes(type)) return clean(el.value || aria, 80);
      const label = el.labels && el.labels[0] ? el.labels[0].innerText : "";
      return clean(
        aria || labelledBy || label || el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("name"),
        80,
      );
    }
    const text = clean(typeof el.innerText === "string" ? el.innerText : el.textContent, 80);
    const img = el.querySelector("img[alt]");
    const svgTitle = el.querySelector("svg title");
    const named = clean(
      aria || labelledBy || el.getAttribute("title") || (img && img.getAttribute("alt")) || (svgTitle && svgTitle.textContent),
      80,
    );
    // Icon buttons often contain only a shortcut letter or a symbol; their real name is in aria-label or title.
    if (text.length <= 3 && named) return named;
    return text || named;
  }

  function regionOf(el) {
    if (el.closest('dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]')) return "dialog";
    if (el.closest('nav, [role="navigation"]')) return "nav";
    if (el.closest('header, [role="banner"]')) return "header";
    if (el.closest('footer, [role="contentinfo"]')) return "footer";
    if (el.closest('aside, [role="complementary"]')) return "aside";
    if (el.closest('main, [role="main"]')) return "main";
    return "other";
  }

  function isSensitive(el) {
    const tag = el.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA") return false;
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (["password", "email", "tel"].includes(type)) return true;
    const autocomplete = (el.getAttribute("autocomplete") || "").toLowerCase();
    if (/cc-|password|one-time-code|email|tel|username/.test(autocomplete)) return true;
    const hint = [el.getAttribute("name"), el.id, el.getAttribute("placeholder"), el.getAttribute("aria-label")]
      .join(" ")
      .toLowerCase();
    return /pass(word)?|card|cvc|cvv|iban|ssn|e-?mail|phone|otp|seed|mnemonic|private key|secret|api key|token/.test(hint);
  }

  const goodId = (id) => /^[A-Za-z][\w-]{0,60}$/.test(id) && !/\d{4,}/.test(id) && !/^(radix|headlessui|react-aria|mui)/i.test(id);
  const unique = (selector) => {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (e) {
      return false;
    }
  };

  function cssPath(el) {
    if (el.id && goodId(el.id) && unique("#" + CSS.escape(el.id))) return "#" + CSS.escape(el.id);
    for (const attr of ["data-testid", "data-test", "data-cy"]) {
      const v = el.getAttribute(attr);
      if (v) {
        const sel = "[" + attr + '="' + CSS.escape(v) + '"]';
        if (unique(sel)) return sel;
      }
    }
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== body && node !== root) {
      if (node !== el && node.id && goodId(node.id) && unique("#" + CSS.escape(node.id))) {
        parts.unshift("#" + CSS.escape(node.id));
        return parts.join(" > ");
      }
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (same.length > 1) part += ":nth-of-type(" + (same.indexOf(node) + 1) + ")";
      }
      parts.unshift(part);
      node = parent;
    }
    return ["body"].concat(parts).join(" > ");
  }

  const items = [];
  const seen = new Set();
  for (const el of candidates) {
    if (!(el instanceof Element)) continue;
    if (el.closest('[aria-hidden="true"], [inert]')) continue;
    if (el.disabled || el.getAttribute("aria-disabled") === "true") continue;
    if (!visible(el)) continue;
    const kind = kindOf(el);
    const text = labelOf(el);
    if (!text && kind !== "input" && kind !== "textarea") continue;

    let href = null;
    let navigates = false;
    let external = false;
    const rawHref = el.getAttribute("href");
    if (rawHref) {
      try {
        const target = new URL(rawHref, location.href);
        href = target.href.slice(0, 300);
        if (target.protocol === "http:" || target.protocol === "https:") {
          const sameDocument =
            target.origin === here.origin && target.pathname === here.pathname && target.search === here.search;
          navigates = !sameDocument;
          external = siteOf(target.hostname) !== siteOf(here.hostname);
        }
      } catch (e) {
        href = null;
      }
    }

    const r = el.getBoundingClientRect();
    const box = {
      x: Math.round(r.left + window.scrollX),
      y: Math.round(r.top + window.scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
    const key = kind + "|" + text.toLowerCase() + "|" + (href || "");
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      el,
      kind,
      text,
      role: el.getAttribute("role"),
      inputType: el.tagName === "INPUT" ? (el.getAttribute("type") || "text").toLowerCase() : null,
      href,
      navigates,
      external,
      region: regionOf(el),
      box,
      aboveFold: box.y < VH,
      sensitive: isSensitive(el),
      score: 0,
    });
  }

  for (const it of items) {
    let s = 0;
    if (it.region === "main" || it.region === "other") s += 3;
    else if (it.region === "header" || it.region === "nav" || it.region === "dialog") s += 2;
    else if (it.region === "footer") s -= 3;
    if (it.aboveFold) s += 3;
    s += Math.min(3, (it.box.w * it.box.h) / 15000);
    if (["button", "input", "textarea", "tab", "select", "checkbox"].includes(it.kind)) s += 2;
    if (it.external) s -= 2;
    if (/privacy|terms|cookie|legal|imprint|careers|jobs|status|sitemap|press kit|copyright/i.test(it.text)) s -= 4;
    it.score = s;
  }

  const chosen = items
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ELEMENTS)
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);

  for (const old of document.querySelectorAll("[data-premiere-id]")) old.removeAttribute("data-premiere-id");
  const elements = chosen.map((it, i) => {
    const id = "e" + (i + 1);
    const selector = cssPath(it.el);
    it.el.setAttribute("data-premiere-id", id);
    return {
      id,
      kind: it.kind,
      text: it.text,
      role: it.role,
      inputType: it.inputType,
      href: it.href,
      navigates: it.navigates,
      external: it.external,
      region: it.region,
      box: it.box,
      aboveFold: it.aboveFold,
      selector,
      sensitive: it.sensitive,
    };
  });

  const found = [];
  const seenHeadings = new Set();
  for (const h of document.querySelectorAll("h1, h2, h3")) {
    if (found.length >= MAX_SECTIONS) break;
    if (!visible(h)) continue;
    const heading = clean(h.innerText, 120);
    if (!heading || seenHeadings.has(heading.toLowerCase())) continue;
    seenHeadings.add(heading.toLowerCase());
    let text = "";
    let sib = h.nextElementSibling;
    for (let hops = 0; sib && hops < 4 && text.length < 200; hops++, sib = sib.nextElementSibling) {
      if (/^H[1-3]$/.test(sib.tagName)) break;
      text += " " + (sib.innerText || "");
    }
    if (!clean(text, 10) && h.parentElement) {
      text = (h.parentElement.innerText || "").replace(h.innerText, "");
      if (!clean(text, 10) && h.parentElement.nextElementSibling) {
        text = h.parentElement.nextElementSibling.innerText || "";
      }
    }
    const r = h.getBoundingClientRect();
    found.push({ el: h, heading, level: Number(h.tagName[1]), text: clean(text, 220), y: Math.round(r.top + window.scrollY) });
  }
  found.sort((a, b) => a.y - b.y);
  for (const old of document.querySelectorAll("[data-premiere-section]")) old.removeAttribute("data-premiere-section");
  const sections = found.map((s, i) => {
    const id = "s" + (i + 1);
    s.el.setAttribute("data-premiere-section", id);
    return { id, heading: s.heading, level: s.level, text: s.text, y: s.y };
  });

  let ogImage = meta('meta[property="og:image"]') || null;
  if (ogImage) {
    try {
      ogImage = new URL(ogImage, location.href).href;
    } catch (e) {
      ogImage = null;
    }
  }
  // Visible text, one line per block, without repeated lines (animated sites often duplicate copy).
  const main = document.querySelector('main, [role="main"]') || body;
  const textLines = [];
  const seenLines = new Set();
  for (const raw of (main.innerText || "").split(/\n+/)) {
    const lineText = clean(raw, 400);
    if (!lineText || seenLines.has(lineText.toLowerCase())) continue;
    seenLines.add(lineText.toLowerCase());
    textLines.push(lineText);
  }

  return {
    title: clean(document.title, 200),
    description:
      meta('meta[name="description"]') || meta('meta[property="og:description"]') || meta('meta[name="twitter:description"]'),
    siteName:
      meta('meta[property="og:site_name"]') || meta('meta[name="application-name"]') || meta('meta[name="apple-mobile-web-app-title"]'),
    ogImage,
    themeColor: meta('meta[name="theme-color"]') || null,
    lang: clean(root.getAttribute("lang"), 20),
    pageHeight,
    textExcerpt: textLines.join("\n").slice(0, 2500),
    loginWall: Array.from(document.querySelectorAll('input[type="password"]')).some(visible),
    elements,
    sections,
  };
})
