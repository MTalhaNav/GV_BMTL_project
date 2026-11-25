// The proof layers: a grid drawn on both images, the matrix display, and the pixel
// tracer. It needs the global position_of_pixel(h, q, v) from engine.js.
const ProofLayers = (() => {
  const GRID_STEPS = 8;
  const TRACER_HINT = "Hover the flattened scan to trace pixel math.";
  // Colours of what is drawn over the images.
  const GRID_ON_SCAN = "rgba(37, 99, 235, 0.35)";
  const GRID_ON_PHOTO = "rgba(37, 99, 235, 0.45)";
  const TRACER_DOT = "#dc2626";

  const state = {
    h: null, // the 8 numbers, flat page -> photo
    flatWidth: 0,
    flatHeight: 0,
    sourceCanvas: null,
    flatCanvas: null,
    sourceOverlay: null,
    flatOverlay: null,
    cropCanvas: null,
    matrixEl: null,
    tracerInfoEl: null,
    mode: "warp",
  };

  // The canvases are drawn at a different size than their pixel size, so line widths
  // and dot sizes are scaled to stay the same on screen.
  const cssScale = (canvas) => canvas.width / (canvas.clientWidth || canvas.width);

  // Where a point on the flat page lands in the photo. w is the shrink factor.
  function mapPixel(q, v) {
    const h = state.h;
    const [x, y] = position_of_pixel(h, q, v);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y, w: h[6] * q + h[7] * v + 1 };
  }

  // Mouse or finger position in canvas pixels.
  function toCanvasPoint(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  // h6 and h7 are tiny numbers, so they are shown in scientific notation.
  function formatCell(val, i) {
    if (i === 8) return "1";
    if (i === 6 || i === 7) return Math.abs(val) < 1e-12 ? "0" : val.toExponential(2);
    return val.toFixed(5);
  }

  function renderMatrix() {
    const el = state.matrixEl;
    const h = state.h;
    const cells = h ? [...h.slice(0, 8), 1] : Array(9).fill(0);

    // Build the nine cells once, then only change their text.
    if (el.children.length !== 9) {
      el.innerHTML = cells
        .map((_, i) => {
          const cls = i === 6 || i === 7 ? "h-cell h-perspective" : "h-cell";
          return `<div class="${cls}" title="${i < 8 ? "h" + i : "fixed scale"}"></div>`;
        })
        .join("");
    }
    cells.forEach((val, i) => {
      const text = formatCell(val, i);
      if (el.children[i].textContent !== text) el.children[i].textContent = text;
    });

    const perspective = h && (Math.abs(h[6]) > 1e-7 || Math.abs(h[7]) > 1e-7);
    el.dataset.transformType = perspective ? "perspective" : "affine";
  }

  // Add one straight line of the flat page to the photo's path. A straight line stays
  // straight under this matrix, so its two end points are enough.
  function addMappedLine(ctx, x1, y1, x2, y2) {
    const a = mapPixel(x1, y1);
    const b = mapPixel(x2, y2);
    if (!a || !b) return;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }

  function drawGrids() {
    const { flatOverlay, sourceOverlay, flatWidth: w, flatHeight: hgt } = state;
    const flatCtx = flatOverlay.getContext("2d");
    const photoCtx = sourceOverlay.getContext("2d");
    flatCtx.clearRect(0, 0, flatOverlay.width, flatOverlay.height);
    photoCtx.clearRect(0, 0, sourceOverlay.width, sourceOverlay.height);
    if (!state.h || w <= 0 || hgt <= 0) return;

    flatCtx.strokeStyle = GRID_ON_SCAN;
    photoCtx.strokeStyle = GRID_ON_PHOTO;
    flatCtx.lineWidth = 1.5 * cssScale(flatOverlay);
    photoCtx.lineWidth = 1.5 * cssScale(sourceOverlay);

    // All the lines of a grid go into one path, so each canvas is stroked once.
    flatCtx.beginPath();
    photoCtx.beginPath();
    for (let i = 0; i <= GRID_STEPS; i++) {
      const x = (i * w) / GRID_STEPS;
      const y = (i * hgt) / GRID_STEPS;
      flatCtx.moveTo(x, 0);
      flatCtx.lineTo(x, hgt);
      flatCtx.moveTo(0, y);
      flatCtx.lineTo(w, y);
      addMappedLine(photoCtx, x, 0, x, hgt);
      addMappedLine(photoCtx, 0, y, w, y);
    }
    flatCtx.stroke();
    photoCtx.stroke();
  }

  // point is a spot on the flat scan, or null when the pointer has left it.
  function drawTracer(point) {
    drawGrids();
    const hit = point && state.h ? mapPixel(point.x, point.y) : null;
    if (!hit) {
      state.tracerInfoEl.textContent = TRACER_HINT;
      return;
    }
    const ctx = state.sourceOverlay.getContext("2d");
    ctx.beginPath();
    ctx.arc(hit.x, hit.y, 5 * cssScale(state.sourceOverlay), 0, Math.PI * 2);
    ctx.fillStyle = TRACER_DOT;
    ctx.fill();
    state.tracerInfoEl.textContent =
      `flat(${point.x.toFixed(0)}, ${point.y.toFixed(0)}) -> w=${hit.w.toFixed(4)} -> photo(${hit.x.toFixed(1)}, ${hit.y.toFixed(1)})`;
  }

  // Warp mode shows the flattened scan, crop mode shows the plain crop instead.
  function applyMode() {
    const crop = state.mode === "crop";
    state.flatCanvas.style.display = crop ? "none" : "block";
    state.flatOverlay.style.display = crop ? "none" : "block";
    state.cropCanvas.style.display = crop ? "block" : "none";
  }

  // Setting canvas.width wipes the canvas even when the value is unchanged,
  // so only resize when the size really differs.
  function matchSize(target, source) {
    if (target.width !== source.width) target.width = source.width;
    if (target.height !== source.height) target.height = source.height;
  }

  function refresh() {
    matchSize(state.sourceOverlay, state.sourceCanvas);
    matchSize(state.flatOverlay, state.flatCanvas);
    renderMatrix();
    drawGrids();
  }

  // next: any of h, flatWidth, flatHeight
  function update(next) {
    Object.assign(state, next);
    refresh();
  }

  function setMode(mode) {
    state.mode = mode === "crop" ? "crop" : "warp";
    applyMode();
  }

  // config: sourceCanvas, flatCanvas, sourceOverlay, flatOverlay, cropCanvas,
  // matrixEl, tracerInfoEl, mode
  function init(config) {
    Object.assign(state, config);

    // pointerdown as well as pointermove, so a tap traces a pixel on touch screens.
    const trace = (e) => drawTracer(toCanvasPoint(state.flatOverlay, e));
    state.flatOverlay.addEventListener("pointermove", trace);
    state.flatOverlay.addEventListener("pointerdown", trace);
    state.flatOverlay.addEventListener("pointerleave", () => drawTracer(null));

    // Redraw when the layout changes size so the lines keep their on-screen width.
    const resizeObserver = new ResizeObserver(drawGrids);
    resizeObserver.observe(state.flatOverlay);
    resizeObserver.observe(state.sourceOverlay);

    setMode(state.mode);
    refresh();
  }

  return { init, update, setMode };
})();