// Added by Syed Ibraheem (24 Nov 2026)
// The controls under the scanner are split into three tabs: Adjust, Look and
// Compare. Only one tab's controls show at a time, so the page never shows a wall
// of buttons. Arrow keys move between tabs, like any tab bar.
(() => {
  const tabs = [...document.querySelectorAll(".dock-tab")];
  if (!tabs.length) return;

  function select(tab, focus = false) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    }
    if (focus) tab.focus();
  }

  for (const tab of tabs) {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      const i = tabs.indexOf(tab);
      let next = null;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === "Home") next = tabs[0];
      if (e.key === "End") next = tabs[tabs.length - 1];
      if (next) {
        e.preventDefault();
        select(next, true);
      }
    });
  }

  // Buttons further down the page ("Try greyscale", "Show me the gaps" and so on)
  // switch a control on. Open the tab that holds it, so you can see what changed.
  const tabFor = { grey: "tab-look", bw: "tab-look", crop: "tab-compare", forward: "tab-compare" };
  for (const button of document.querySelectorAll("[data-action]")) {
    const id = tabFor[button.dataset.action];
    if (id) button.addEventListener("click", () => select(document.getElementById(id)));
  }
})();
