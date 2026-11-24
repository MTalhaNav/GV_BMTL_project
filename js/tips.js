// Short word definitions. Each little "i" button opens its definition just under
// the button. The definition closes when you tap elsewhere, press Esc, scroll or
// resize, so it never floats over the wrong part of the page.
(() => {
  const tips = [...document.querySelectorAll(".tip[popover]")];
  if (!tips.length || !HTMLElement.prototype.showPopover) return;

  let opener = null;

  // Remember which button opened the tip, so we know where to place it.
  for (const button of document.querySelectorAll("[popovertarget^='tip-']")) {
    button.addEventListener("click", () => { opener = button; });
  }

  const place = (tip) => {
    if (!opener) return;
    const r = opener.getBoundingClientRect();
    const gap = 8;
    const width = tip.offsetWidth;
    // Centre under the button, but keep it inside the screen.
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    let top = r.bottom + gap;
    // Not enough room below: open above the button instead.
    if (top + tip.offsetHeight > window.innerHeight - 12) top = r.top - tip.offsetHeight - gap;
    tip.style.left = left + "px";
    tip.style.top = Math.max(12, top) + "px";
  };

  for (const tip of tips) {
    tip.addEventListener("toggle", (e) => { if (e.newState === "open") place(tip); });
  }

  const closeAll = () => {
    for (const tip of tips) {
      if (tip.matches(":popover-open")) tip.hidePopover();
    }
  };
  window.addEventListener("scroll", closeAll, { passive: true });
  window.addEventListener("resize", closeAll);
})();
