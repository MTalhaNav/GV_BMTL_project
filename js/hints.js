// Added by Syed Ibraheem (25 Nov 2026)
// Two first-time hints, shown every time the page loads:
// 1. A bubble next to dot 1 on the photo: "Drag any corner…". It fades away as
//    soon as a dot is grabbed.
// 2. Then a bubble next to the little "i" on the Matrix heading, saying the "i"
//    buttons explain hard words. It fades away once any "i" is tapped.
// This file only shows and hides the bubbles; it does not touch the scanner.
(() => {
  const dragHint = document.getElementById("drag-hint");
  const infoHint = document.getElementById("info-hint");
  const dotsLayer = document.getElementById("photo-dots");
  if (!dragHint || !infoHint || !dotsLayer) return;

  function hide(el) {
    if (el.hidden || el.classList.contains("is-leaving")) return;
    el.classList.add("is-leaving");
    setTimeout(() => { el.hidden = true; el.classList.remove("is-leaving"); }, 600);
  }

  // 1. Drag hint: placed at dot 1's starting spot (top left corner of the page).
  const [x, y] = CONFIG.sampleCorners[0];
  dragHint.style.left = x * 100 + "%";
  dragHint.style.top = y * 100 + "%";
  // Wait for the opening demo to settle the dots before showing it.
  setTimeout(() => { if (!dragDone) dragHint.hidden = false; }, 2200);

  let dragDone = false;
  dotsLayer.addEventListener("pointerdown", () => {
    if (dragDone) return;
    dragDone = true;
    hide(dragHint);
    // 2. Then point out the "i" buttons, once the visitor has tried dragging.
    setTimeout(() => { if (!infoDone) infoHint.hidden = false; }, 900);
  });

  // 2. Info hint: goes away when any "i" button is tapped.
  let infoDone = false;
  for (const button of document.querySelectorAll(".info")) {
    button.addEventListener("click", () => {
      infoDone = true;
      hide(infoHint);
    });
  }
})();
