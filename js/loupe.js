// A round magnifier that shows the photo around the dot being dragged, so the
// corner can be placed precisely. It floats a little away from the dot so a finger
// never covers it.
const Loupe = (() => {
  // canvas   a canvas inside the same positioned box as the photo
  // photo    the photo canvas to magnify
  // options  size (CSS px), zoom (times), gap (CSS px away from the dot)
  function create(canvas, photo, { size, zoom, gap }) {
    const ctx = canvas.getContext("2d");
    const pixels = canvas.width; // the canvas is square
    canvas.style.width = canvas.style.height = size + "px";

    // info comes from Dots: x, y in photo pixels, cssX, cssY on screen, and scale
    function show({ x, y, cssX, cssY, scale }) {
      // How many photo pixels fit in the circle at this zoom.
      const side = (size / zoom) * scale;
      ctx.clearRect(0, 0, pixels, pixels);
      ctx.drawImage(photo, x - side / 2, y - side / 2, side, side, 0, 0, pixels, pixels);

      // Crosshair: a dark line under a light one so it shows on any photo.
      const mid = pixels / 2;
      for (const [width, colour] of [[3, "rgba(0,0,0,0.55)"], [1, "rgba(255,255,255,0.95)"]]) {
        ctx.lineWidth = width;
        ctx.strokeStyle = colour;
        ctx.beginPath();
        ctx.moveTo(mid, 0);
        ctx.lineTo(mid, pixels);
        ctx.moveTo(0, mid);
        ctx.lineTo(pixels, mid);
        ctx.stroke();
      }

      // Float above the dot, or below it when there is no room at the top.
      const half = size / 2;
      const boxWidth = canvas.parentElement.clientWidth;
      const left = Math.min(Math.max(cssX, half), boxWidth - half);
      let top = cssY - half - gap;
      if (top < half) top = cssY + half + gap;
      canvas.style.left = left + "px";
      canvas.style.top = top + "px";
      canvas.hidden = false;
    }

    function hide() {
      canvas.hidden = true;
    }

    return { show, hide };
  }

  return { create };
})();
