const ProofLayers = (() => {
  const state = {
    h: null,
    flatWidth: 0,
    flatHeight: 0,
    sourceCanvas: null,
    flatCanvas: null,
    sourceOverlay: null,
    flatOverlay: null,
    cropCanvas: null,
    mode: "warp",
    matrixEl: null,
    toggleBtn: null,
    tracerInfoEl: null
  };

  const isValidH = (h) =>
    Array.isArray(h) && h.length >= 8 && h.slice(0, 8).every((n) => Number.isFinite(n));

  const mapPixel = (h, q, v) => {
    if (!isValidH(h) || typeof position_of_pixel !== "function") return null;
    const pt = position_of_pixel(h, q, v);
    if (!Array.isArray(pt) || pt.length < 2) return null;
    if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) return null;
    const w = h[6] * q + h[7] * v + 1;
    return { x: pt[0], y: pt[1], w };
  };

  const toCanvasPoint = (canvas, clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) * canvas.width) / rect.width,
      y: ((clientY - rect.top) * canvas.height) / rect.height
    };
  };

  // h6 and h7 are tiny numbers, so they are shown in scientific notation.
  const formatCell = (val, i) => {
    if (i === 8) return "1";
    if (i === 6 || i === 7) return Math.abs(val) < 1e-12 ? "0" : Number(val).toExponential(2);
    return Number(val).toFixed(5);
  };

  const renderMatrix = () => {
    if (!state.matrixEl) return;
    const h = state.h;
    const cells = isValidH(h) ? [...h.slice(0, 8), 1] : Array(9).fill(0);
    const hasPersp =
      isValidH(h) && (Math.abs(h[6]) > 1e-7 || Math.abs(h[7]) > 1e-7);

    // Build the nine cells once, then only change their text.
    if (state.matrixEl.children.length !== 9) {
      state.matrixEl.innerHTML = cells
        .map((_, i) => {
          const cls = i === 6 || i === 7 ? "h-cell h-perspective" : "h-cell";
          return `<div class="${cls}" title="${i < 8 ? "h" + i : "fixed scale"}"></div>`;
        })
        .join("");
    }
    cells.forEach((val, i) => {
      const text = formatCell(val, i);
      const cell = state.matrixEl.children[i];
      if (cell.textContent !== text) cell.textContent = text;
    });

    state.matrixEl.dataset.transformType = hasPersp ? "perspective" : "affine";
  };

  const drawGrids = () => {
    const { flatOverlay, sourceOverlay, flatCanvas, flatWidth, flatHeight, h } = state;
    if (!flatOverlay || !sourceOverlay) return;
    const w = flatWidth || (flatCanvas ? flatCanvas.width : 0);
    const hgt = flatHeight || (flatCanvas ? flatCanvas.height : 0);

    const fCtx = flatOverlay.getContext("2d");
    const sCtx = sourceOverlay.getContext("2d");
    fCtx.clearRect(0, 0, flatOverlay.width, flatOverlay.height);
    sCtx.clearRect(0, 0, sourceOverlay.width, sourceOverlay.height);

    if (!isValidH(h) || w <= 0 || hgt <= 0) return;

    const steps = 8;
    fCtx.strokeStyle = "rgba(37, 99, 235, 0.35)";
    sCtx.strokeStyle = "rgba(37, 99, 235, 0.45)";
    fCtx.lineWidth = 1;
    sCtx.lineWidth = 1;

    const drawMappedLine = (x1, y1, x2, y2) => {
      const a = mapPixel(h, x1, y1);
      const b = mapPixel(h, x2, y2);
      if (!a || !b) return;
      sCtx.beginPath();
      sCtx.moveTo(a.x, a.y);
      sCtx.lineTo(b.x, b.y);
      sCtx.stroke();
    };

    for (let i = 0; i <= steps; i++) {
      const x = (i * w) / steps;
      fCtx.beginPath();
      fCtx.moveTo(x, 0);
      fCtx.lineTo(x, hgt);
      fCtx.stroke();
      drawMappedLine(x, 0, x, hgt);

      const y = (i * hgt) / steps;
      fCtx.beginPath();
      fCtx.moveTo(0, y);
      fCtx.lineTo(w, y);
      fCtx.stroke();
      drawMappedLine(0, y, w, y);
    }
  };

  const renderTracerInfo = (q, v, hit) => {
    if (!state.tracerInfoEl) return;
    if (!hit) {
      state.tracerInfoEl.textContent = "Hover the flattened scan to trace pixel math.";
      return;
    }
    state.tracerInfoEl.textContent =
      `flat(${q.toFixed(0)}, ${v.toFixed(0)}) -> w=${hit.w.toFixed(4)} -> photo(${hit.x.toFixed(1)}, ${hit.y.toFixed(1)})`;
  };

  const drawTracer = (pt) => {
    drawGrids();
    if (!pt || !state.sourceOverlay || !isValidH(state.h)) {
      renderTracerInfo(0, 0, null);
      return;
    }
    const hit = mapPixel(state.h, pt.x, pt.y);
    if (!hit) {
      renderTracerInfo(0, 0, null);
      return;
    }
    const ctx = state.sourceOverlay.getContext("2d");
    ctx.beginPath();
    ctx.arc(hit.x, hit.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#dc2626";
    ctx.fill();
    renderTracerInfo(pt.x, pt.y, hit);
  };

  const applyMode = () => {
    const showCrop = state.mode === "crop";
    if (state.flatCanvas) state.flatCanvas.style.display = showCrop ? "none" : "block";
    if (state.flatOverlay) state.flatOverlay.style.display = showCrop ? "none" : "block";
    if (state.cropCanvas) state.cropCanvas.style.display = showCrop ? "block" : "none";
    if (state.toggleBtn) {
      state.toggleBtn.textContent = showCrop ? "Mode: Crop" : "Mode: Warp";
    }
  };

  // Setting canvas.width wipes the canvas even when the value is unchanged,
  // so only resize when the size really differs.
  const matchSize = (target, source) => {
    if (target.width !== source.width) target.width = source.width;
    if (target.height !== source.height) target.height = source.height;
  };

  const syncOverlaySizes = () => {
    if (state.sourceCanvas && state.sourceOverlay) matchSize(state.sourceOverlay, state.sourceCanvas);
    if (state.flatCanvas && state.flatOverlay) matchSize(state.flatOverlay, state.flatCanvas);
  };

  const update = (next = {}) => {
    if (next.h !== undefined) state.h = next.h;
    if (next.flatWidth !== undefined) state.flatWidth = next.flatWidth;
    if (next.flatHeight !== undefined) state.flatHeight = next.flatHeight;
    syncOverlaySizes();
    renderMatrix();
    drawGrids();
  };

  const setMode = (mode) => {
    state.mode = mode === "crop" ? "crop" : "warp";
    applyMode();
  };

  const init = (config = {}) => {
    Object.assign(state, config);
    if (state.flatOverlay) {
      // pointerdown as well as pointermove, so a tap traces a pixel on touch screens.
      const trace = (e) => drawTracer(toCanvasPoint(state.flatOverlay, e.clientX, e.clientY));
      state.flatOverlay.addEventListener("pointermove", trace);
      state.flatOverlay.addEventListener("pointerdown", trace);
      state.flatOverlay.addEventListener("pointerleave", () => drawTracer(null));
    }
    if (state.toggleBtn) {
      state.toggleBtn.addEventListener("click", () => {
        setMode(state.mode === "warp" ? "crop" : "warp");
      });
    }
    update(config);
    setMode(state.mode || "warp");
  };

  return { init, update, setMode };
})();