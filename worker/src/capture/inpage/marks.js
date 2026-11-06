// Runs inside the captured page. Draws (or removes) a labelled outline over every element and
// section that extract.js tagged, so the planner can match ids to what it sees. Labels are
// placed greedily so they do not cover each other on dense toolbars.
// Styles go through the CSSOM (style.cssText), which page Content Security Policies allow.
(function premiereMarks(opts) {
  const old = document.getElementById("__premiere_marks");
  if (old) old.remove();
  if (!opts.show) return 0;

  const layer = document.createElement("div");
  layer.id = "__premiere_marks";
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
  document.documentElement.appendChild(layer);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const placed = [];
  let count = 0;

  const overlaps = (a) =>
    placed.some((b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
  const inView = (a) => a.left >= 0 && a.top >= 0 && a.right <= vw && a.bottom <= vh;

  function add(el, label, color) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return;

    const frame = document.createElement("div");
    frame.style.cssText =
      "position:fixed;box-sizing:border-box;border-radius:4px;" +
      "left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;" +
      "border:2px solid " + color + ";";
    layer.appendChild(frame);

    const tag = document.createElement("div");
    tag.textContent = label;
    tag.style.cssText =
      "position:fixed;left:0;top:0;border-radius:4px;padding:0 5px;color:#fff;white-space:nowrap;" +
      "font:700 24px/30px ui-monospace,Menlo,Consolas,monospace;background:" + color + ";";
    layer.appendChild(tag);
    const w = tag.offsetWidth;
    const h = tag.offsetHeight;

    const spots = [
      [r.left, r.top - h - 2], // above
      [r.left + 2, r.top + 2], // inside, top left
      [r.left, r.bottom + 2], // below
      [r.right + 2, r.top], // right
      [r.left - w - 2, r.top], // left
      [r.left + w + 2, r.top - h - 2], // above, shifted right
      [r.left - w - 2, r.top - h - 2], // above, shifted left
      [r.left, r.top - 2 * h - 4], // two rows above
      [r.left, r.bottom + h + 4], // two rows below
    ];
    let chosen = null;
    for (const [x, y] of spots) {
      const box = { left: x, top: y, right: x + w, bottom: y + h };
      if (inView(box) && !overlaps(box)) {
        chosen = box;
        break;
      }
    }
    if (!chosen) {
      const x = Math.max(0, Math.min(r.left, vw - w));
      const y = Math.max(0, Math.min(r.top, vh - h));
      chosen = { left: x, top: y, right: x + w, bottom: y + h };
    }
    placed.push(chosen);
    tag.style.left = chosen.left + "px";
    tag.style.top = chosen.top + "px";
    count++;
  }

  for (const el of document.querySelectorAll("[data-premiere-id]")) add(el, el.getAttribute("data-premiere-id"), "#e11d74");
  for (const el of document.querySelectorAll("[data-premiere-section]")) add(el, el.getAttribute("data-premiere-section"), "#0369a1");
  return count;
})
