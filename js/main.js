// Glue. Owns the app state, decides when to redraw, and connects every control to
// the module that does the real work:
//   photo.js    getting a photo in        geometry.js  checking dots, solving H
//   warp.js     the pixel loops           dots.js      dragging
//   loupe.js    the magnifier             demo.js      the opening animation
//   phase4.js   grid, matrix, tracer      exporter.js  saving the PNG
//   notes.js    the explanation text
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  // Visitors who ask their device for less motion get the result without the animation.
  const reducedMotion = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  // ---- page elements ----
  const photo = $("photo");
  const photoGrid = $("photo-grid");
  const photoDots = $("photo-dots");
  const photoStage = $("photo-stage");
  const scanStage = $("scan-stage");
  const loupeCanvas = $("loupe");
  const flat = $("flat");
  const flatGrid = $("flat-grid");
  const cropView = $("crop-view");

  const statusEl = $("status");
  const noteEl = $("note");
  const matrixEl = $("matrix");
  const matrixTag = $("matrix-tag");
  const liveDots = $("live-dots");
  const livePersp = $("live-persp");

  const fileInput = $("file");
  const uploadBtn = $("upload");
  const demoBtn = $("demo");
  const resetBtn = $("reset");
  const downloadBtn = $("download");

  const shapeSelect = $("shape");
  const customWrap = $("custom-wrap");
  const ratioInput = $("ratio");
  const ratioValue = $("ratio-value");
  const greyInput = $("grey");
  const greyValue = $("grey-value");
  const cutoffInput = $("cutoff");
  const cutoffValue = $("cutoff-value");
  const cropToggle = $("crop-toggle");
  const forwardToggle = $("forward-toggle");
  const enhanceToggle = $("enhance-toggle");
  const loupeToggle = $("loupe-toggle");
  const outlineToggle = $("outline-toggle");

  const flatCtx = flat.getContext("2d");
  const cropCtx = cropView.getContext("2d");
  // Off-screen canvas used to stretch a low-res preview up to the full-size scan.
  const stage = document.createElement("canvas");
  const stageCtx = stage.getContext("2d");

  const MESSAGES = {
    start:
      "Drag the four dots onto the corners of the page. Order: 1 top left, 2 top right, 3 bottom right, 4 bottom left.",
    demo: "Watch the dots slide onto the corners of the page. The scan is rebuilt on every frame of the move.",
    ready: "Your turn. Drag any dot and the grid, the matrix and the scan follow.",
    moved:
      "The grid on the photo and the grid on the scan are the same grid. The photo shows it bent, the scan shows it square.",
    invalid:
      "The dots cross over or fold inward, so there is no flat page to build. Keep the order: 1 top left, 2 top right, 3 bottom right, 4 bottom left.",
    notImage: "That file is not an image. Try a JPG, PNG or WebP photo.",
    unreadable: "That image could not be read. Try a different photo.",
    sampleError: "The sample photo could not be loaded. Check that assets/sample.jpg exists.",
    problem: "Something went wrong while drawing. Reload the page to start again.",
  };
  const WARNINGS = new Set(["invalid", "notImage", "unreadable", "sampleError", "problem"]);

  // ---- state ----
  // Every control writes into settings. The drawing code reads from here, never
  // from the page, so a frame does no DOM lookups.
  const shapeRatio = (id) => CONFIG.pageShapes.find((s) => s.id === id).ratio;
  const DEFAULTS = {
    shape: CONFIG.defaultShape,
    ratio: shapeRatio(CONFIG.defaultShape),
    grey: 0, // percent
    cutoff: 0, // 0 = off
    enhance: true, // scanner look: white paper, vivid ink
    crop: false,
    forward: false,
    loupe: true,
    outline: true,
  };
  const settings = { ...DEFAULTS };

  let dots = null;
  let loupe = null;
  let photoName = CONFIG.sampleName;
  let isSample = false;
  // Where we are in the visit: "start" -> "demo" -> "ready" -> "moved".
  let phase = "start";
  let statusKey = "";
  let noteText = "";
  let lastSize = null; // size of the last warped frame, reused for tone-only redraws

  // Redraw scheduling. Dragging renders a cheap preview, and a timer swaps in the
  // full-size render once things go quiet.
  let pendingWarp = false;
  let pendingTone = false;
  let usePreview = false;
  let previewScale = CONFIG.previewScale;
  let rafId = 0;
  let settleTimer = 0;

  // ---- small helpers ----
  const flatHeight = () => Math.round(CONFIG.flatWidth * settings.ratio);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

  function setStatus(key) {
    if (key === statusKey) return;
    statusKey = key;
    statusEl.textContent = MESSAGES[key];
    statusEl.classList.toggle("is-warning", WARNINGS.has(key));
  }

  // The status line to show when nothing is wrong.
  const calmStatus = () => (phase === "moved" ? "moved" : phase);

  function setNote(text) {
    if (text === noteText) return;
    noteText = text;
    noteEl.textContent = text;
    // Restart the little fade so a change is noticed.
    noteEl.classList.remove("flash");
    void noteEl.offsetWidth;
    noteEl.classList.add("flash");
  }

  // Setting canvas.width wipes the canvas even when the value is unchanged,
  // so only touch it when the size really differs.
  function resize(canvas, w, h) {
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  // Each stage shapes itself to its image through the --ar CSS variable.
  function setAspect(el, w, h) {
    const ar = (w / h).toFixed(4);
    if (el.dataset.ar === ar) return;
    el.dataset.ar = ar;
    el.style.setProperty("--ar", ar);
  }

  // The coloured part of a slider track is driven by a CSS variable.
  function setFill(input) {
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty("--fill", pct + "%");
  }

  // phase4.js also records whether the matrix is a pure rotate-and-shear (h6 and
  // h7 are zero) or a real perspective.
  function showMatrixType() {
    const type = matrixEl.dataset.transformType || "affine";
    setText(matrixTag, type === "perspective" ? "Perspective" : "Rotate and shear only");
    matrixTag.dataset.kind = type;
  }

  const sci = (v) => (Math.abs(v) < 1e-12 ? "0" : v.toExponential(2));

  // Live numbers further down the page, so the explanation reacts to the dots too.
  function showLiveNumbers(matrix) {
    setText(liveDots, dots.points().map(([x, y]) => `(${Math.round(x)}, ${Math.round(y)})`).join("  "));
    setText(livePersp, `h6 = ${sci(matrix[6])}    h7 = ${sci(matrix[7])}`);
  }

  // Returns the 8 numbers for the current dots, or null if the dots do not form a page.
  function currentMatrix(w, h) {
    const points = dots.points();
    return Geometry.quadIsValid(points) ? Geometry.solveHomography(points, w, h) : null;
  }

  // ImageData from a byte view. Very old browsers reject the constructor.
  function toImage(pixels, w, h) {
    try {
      return new ImageData(pixels, w, h);
    } catch (err) {
      const image = flatCtx.createImageData(w, h);
      image.data.set(pixels);
      return image;
    }
  }

  // ---- drawing ----
  function drawFlat() {
    if (!lastSize) return;
    const { width, height } = lastSize;
    const pixels = Warp.tone(width, height, settings.grey / 100, settings.cutoff, settings.enhance);
    const image = toImage(pixels, width, height);

    // Full size: write straight to the visible canvas.
    if (width === flat.width && height === flat.height) {
      flatCtx.putImageData(image, 0, 0);
      return;
    }
    // Preview: write small, then let the browser stretch it up.
    resize(stage, width, height);
    stageCtx.putImageData(image, 0, 0);
    flatCtx.clearRect(0, 0, flat.width, flat.height);
    flatCtx.drawImage(stage, 0, 0, flat.width, flat.height);
  }

  // The crop view: just the upright rectangle around the dots, no stretching.
  // It is fitted inside the same box as the scan so the layout does not jump.
  function drawCrop() {
    const box = Geometry.boundingBox(dots.points());
    cropCtx.clearRect(0, 0, cropView.width, cropView.height);
    if (box.w < 1 || box.h < 1) return;
    const fit = Math.min(cropView.width / box.w, cropView.height / box.h);
    const dw = box.w * fit;
    const dh = box.h * fit;
    cropCtx.drawImage(photo, box.x, box.y, box.w, box.h, (cropView.width - dw) / 2, (cropView.height - dh) / 2, dw, dh);
  }

  // Phones are slower than laptops. Measure how long a preview frame took and nudge
  // the preview size so the next one lands near the time budget. Cost grows with
  // the square of the scale, hence the square root.
  function adaptPreview(ms) {
    const target = previewScale * Math.sqrt(CONFIG.previewBudgetMs / Math.max(ms, 0.5));
    previewScale = clamp(0.6 * previewScale + 0.4 * target, CONFIG.previewMin, CONFIG.previewMax);
  }

  function warpAndDraw() {
    const w = CONFIG.flatWidth;
    const h = flatHeight();
    const matrix = currentMatrix(w, h);
    downloadBtn.disabled = !matrix;
    if (!matrix) {
      setStatus("invalid"); // keep showing the last good result
      return;
    }
    setStatus(calmStatus());

    resize(flat, w, h);
    resize(cropView, w, h);
    setAspect(scanStage, w, h);
    ProofLayers.update({ h: matrix, flatWidth: w, flatHeight: h });
    showMatrixType();
    if (!usePreview) showLiveNumbers(matrix);

    if (settings.crop) {
      drawCrop();
      return;
    }

    const points = dots.points();
    const forward = settings.forward ? Geometry.solveForward(points, w, h) : null;
    if (forward) {
      // Always full size, the gaps need it.
      lastSize = Warp.renderForward(forward, w, h, Geometry.boundingBox(points));
      drawFlat();
    } else {
      // Time the whole preview frame, colour rules (Enhance) included, so the
      // preview shrinks enough to keep dragging smooth on slower devices.
      const started = performance.now();
      lastSize = Warp.render(matrix, w, h, usePreview ? previewScale : 1);
      drawFlat();
      if (usePreview) adaptPreview(performance.now() - started);
    }
  }

  function frame() {
    rafId = 0;
    try {
      if (pendingWarp) {
        pendingWarp = false;
        pendingTone = false;
        warpAndDraw();
      } else if (pendingTone) {
        pendingTone = false;
        if (!settings.crop) drawFlat();
      }
    } catch (err) {
      console.error(err);
      setStatus("problem");
    }
  }

  // Ask for a redraw. Many calls in one frame collapse into a single render.
  //   warp     false for greyscale/cut-off changes, which skip the heavy part
  //   preview  true while the user is actively dragging something
  function invalidate({ warp = true, preview = false } = {}) {
    if (warp) pendingWarp = true;
    else pendingTone = true;
    if (preview) {
      usePreview = true;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        usePreview = false;
        invalidate();
      }, CONFIG.settleDelayMs);
    }
    if (!rafId) rafId = requestAnimationFrame(frame);
  }

  // ---- the opening demo ----
  const toPixels = (fractions) => fractions.map(([fx, fy]) => [fx * photoDots.width, fy * photoDots.height]);

  function playDemo() {
    const corners = CONFIG.sampleCorners;
    if (!corners || !isSample) return;

    dots.reset(CONFIG.startDots);
    phase = "demo";
    setStatus("demo");
    setNote(Notes.demo);

    const finish = () => {
      phase = "ready";
      setStatus("ready");
      invalidate(); // one last full-size render
    };
    // Visitors who asked for less motion get the end result straight away.
    if (reducedMotion.matches) {
      toPixels(corners).forEach((p, i) => ((dots.points()[i][0] = p[0]), (dots.points()[i][1] = p[1])));
      dots.draw();
      finish();
      return;
    }

    invalidate();
    Demo.play(dots.points(), toPixels(corners), {
      ...CONFIG.demo,
      onFrame: () => {
        dots.draw();
        // Skip the odd in-between frame that is not a valid page.
        if (Geometry.quadIsValid(dots.points())) invalidate({ preview: true });
      },
      onDone: finish,
    });
  }

  // The visitor took over: stop the animation and hand control back.
  function stopDemo() {
    if (!Demo.isPlaying()) return;
    Demo.cancel();
    phase = "moved";
  }

  // ---- saving the scan ----
  // The download always uses the normal (backward) scan at full size, whatever the
  // screen is showing at that moment.
  function downloadScan() {
    const w = CONFIG.flatWidth;
    const h = flatHeight();
    const matrix = currentMatrix(w, h);
    if (!matrix) return;

    const size = Warp.render(matrix, w, h, 1);
    const pixels = Warp.tone(size.width, size.height, settings.grey / 100, settings.cutoff, settings.enhance);
    const out = document.createElement("canvas");
    out.width = size.width;
    out.height = size.height;
    out.getContext("2d").putImageData(toImage(pixels, size.width, size.height), 0, 0);
    Exporter.savePng(out, photoName + "-scan.png");

    invalidate(); // the shared buffers now hold the export, so redraw the screen from scratch
  }

  // ---- loading photos ----
  // getSource returns something drawable (an image or a bitmap).
  async function loadPhoto(getSource, name, sample) {
    try {
      const source = await getSource();
      Demo.cancel();
      const pixels = Photo.drawTo(photo, source, CONFIG.maxPhotoEdge);
      for (const canvas of [photoGrid, photoDots]) resize(canvas, photo.width, photo.height);
      setAspect(photoStage, photo.width, photo.height);
      Warp.setSource(pixels);
      dots.reset(CONFIG.startDots);

      photoName = name;
      isSample = sample;
      phase = "start";
      setStatus("start");
      setNote(sample ? Notes.intro : Notes.loaded);
      invalidate();
      return true;
    } catch (err) {
      // A wrong file type is an ordinary mistake, not worth a console error.
      if (err.message !== "not-image") console.error(err);
      setStatus(err.message === "not-image" ? "notImage" : "unreadable");
      return false;
    }
  }

  async function loadSample() {
    const ok = await loadPhoto(() => Photo.fromUrl(CONFIG.sampleSrc), CONFIG.sampleName, true);
    if (ok) playDemo();
    return ok;
  }

  const loadFile = (file) =>
    loadPhoto(() => Photo.fromFile(file), file.name.replace(/\.[^.]+$/, "") || "photo", false);

  function bindUpload() {
    uploadBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      fileInput.value = ""; // lets the same file be picked again later
      if (file) loadFile(file);
    });
    demoBtn.addEventListener("click", () => (isSample ? playDemo() : loadSample()));

    photoStage.addEventListener("dragover", (e) => {
      e.preventDefault();
      photoStage.classList.add("is-dropping");
    });
    photoStage.addEventListener("dragleave", () => photoStage.classList.remove("is-dropping"));
    photoStage.addEventListener("drop", (e) => {
      e.preventDefault();
      photoStage.classList.remove("is-dropping");
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    });
    // A drop that misses the photo should not make the browser open the file.
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => e.preventDefault());

    document.addEventListener("paste", (e) => {
      const file = [...(e.clipboardData ? e.clipboardData.files : [])].find((f) => f.type.startsWith("image/"));
      if (file) loadFile(file);
    });
  }

  // ---- controls ----
  function buildShapeOptions() {
    const options = CONFIG.pageShapes.map((s) => new Option(s.label, s.id));
    options.push(new Option("Custom", "custom"));
    shapeSelect.replaceChildren(...options);

    const r = CONFIG.customRatio;
    Object.assign(ratioInput, { min: r.min, max: r.max, step: r.step });
  }

  // Greyed-out controls in the crop view: they only act on the flattened scan.
  function applyCropState() {
    for (const control of [shapeSelect, ratioInput, greyInput, cutoffInput, forwardToggle, enhanceToggle]) {
      control.disabled = settings.crop;
    }
    ProofLayers.setMode(settings.crop ? "crop" : "warp");
  }

  // Push the current settings into the page controls. Used at start and on reset.
  function syncControls() {
    shapeSelect.value = settings.shape;
    ratioInput.value = settings.ratio;
    greyInput.value = settings.grey;
    cutoffInput.value = settings.cutoff;
    cropToggle.checked = settings.crop;
    forwardToggle.checked = settings.forward;
    enhanceToggle.checked = settings.enhance;
    loupeToggle.checked = settings.loupe;
    outlineToggle.checked = settings.outline;
    updateReadouts();
    applyCropState();
    dots.setOutline(settings.outline);
  }

  function updateReadouts() {
    setText(ratioValue, settings.ratio.toFixed(2));
    setText(greyValue, settings.grey + "%");
    setText(cutoffValue, settings.cutoff === 0 ? "Off" : String(settings.cutoff));
    for (const input of [ratioInput, greyInput, cutoffInput]) setFill(input);

    const custom = settings.shape === "custom";
    customWrap.classList.toggle("is-open", custom);
    customWrap.inert = !custom; // keeps the hidden slider out of the tab order
  }

  // Cards further down the page can drive the controls, so reading about forward
  // mapping is one click away from seeing it.
  function bindShortcuts() {
    for (const button of document.querySelectorAll("[data-action]")) {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        // Plain crop greys out the other controls, so leave it first, unless
        // the button is the one that switches crop itself.
        if (settings.crop && action !== "crop") {
          cropToggle.checked = false;
          cropToggle.dispatchEvent(new Event("change"));
        }
        // Each button switches its effect on, or off again if it is already on.
        if (action === "forward") {
          forwardToggle.checked = !settings.forward;
          forwardToggle.dispatchEvent(new Event("change"));
        } else if (action === "bw") {
          cutoffInput.value = settings.cutoff > 0 ? 0 : 190;
          cutoffInput.dispatchEvent(new Event("input"));
        } else if (action === "grey") {
          greyInput.value = settings.grey > 0 ? 0 : 100;
          greyInput.dispatchEvent(new Event("input"));
        } else if (action === "crop") {
          cropToggle.checked = !settings.crop;
          cropToggle.dispatchEvent(new Event("change"));
        } else if (action === "upload") {
          $("upload").click();
        } else if (action === "sample") {
          $("demo").click();
        }
        // Buttons further down the page bring you back up to see the result.
        if (!button.closest("#tool")) {
          $("tool").scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" });
        }
      });
    }
  }

  function bindControls() {
    shapeSelect.addEventListener("change", () => {
      settings.shape = shapeSelect.value;
      if (settings.shape === "custom") {
        ratioInput.value = settings.ratio; // start from the shape we were on
        settings.ratio = Number(ratioInput.value); // the slider snaps to its own step
      } else {
        settings.ratio = shapeRatio(settings.shape);
      }
      updateReadouts();
      setNote(Notes.shape(CONFIG.flatWidth, flatHeight()));
      invalidate({ preview: true });
    });

    ratioInput.addEventListener("input", () => {
      settings.ratio = Number(ratioInput.value);
      updateReadouts();
      setNote(Notes.shape(CONFIG.flatWidth, flatHeight()));
      invalidate({ preview: true });
    });

    greyInput.addEventListener("input", () => {
      settings.grey = Number(greyInput.value);
      updateReadouts();
      setNote(Notes.grey(settings.grey));
      invalidate({ warp: false });
    });

    cutoffInput.addEventListener("input", () => {
      settings.cutoff = Number(cutoffInput.value);
      updateReadouts();
      setNote(Notes.cutoff(settings.cutoff));
      invalidate({ warp: false });
    });

    cropToggle.addEventListener("change", () => {
      settings.crop = cropToggle.checked;
      applyCropState();
      setNote(Notes.crop(settings.crop));
      invalidate();
    });

    enhanceToggle.addEventListener("change", () => {
      settings.enhance = enhanceToggle.checked;
      setNote(Notes.enhance(settings.enhance));
      invalidate({ warp: false });
    });

    forwardToggle.addEventListener("change", () => {
      settings.forward = forwardToggle.checked;
      setNote(Notes.forward(settings.forward));
      invalidate();
    });

    loupeToggle.addEventListener("change", () => {
      settings.loupe = loupeToggle.checked;
      if (!settings.loupe) loupe.hide();
      setNote(Notes.loupe(settings.loupe));
    });

    outlineToggle.addEventListener("change", () => {
      settings.outline = outlineToggle.checked;
      dots.setOutline(settings.outline);
      setNote(Notes.outline(settings.outline));
    });

    resetBtn.addEventListener("click", () => {
      Demo.cancel();
      Object.assign(settings, DEFAULTS);
      syncControls();
      dots.reset(CONFIG.startDots);
      phase = "start";
      setStatus("start");
      setNote(Notes.intro);
      invalidate();
    });

    downloadBtn.addEventListener("click", downloadScan);
  }

  // ---- startup ----
  async function boot() {
    buildShapeOptions();
    resize(flat, CONFIG.flatWidth, flatHeight());
    resize(cropView, CONFIG.flatWidth, flatHeight());
    setAspect(scanStage, CONFIG.flatWidth, flatHeight());
    Warp.reserve(CONFIG.flatWidth * Math.round(CONFIG.flatWidth * CONFIG.customRatio.max));

    loupe = Loupe.create(loupeCanvas, photo, CONFIG.loupe);
    dots = Dots.create(photoDots, CONFIG.startDots, {
      dotRadius: CONFIG.dotRadius,
      hitRadius: CONFIG.hitRadius,
      isValid: Geometry.quadIsValid,
      onChange: () => {
        stopDemo();
        phase = "moved";
        setNote(Notes.dots);
        invalidate({ preview: true });
      },
      onDrag: (info) => {
        stopDemo();
        if (settings.loupe) loupe.show(info);
      },
      onRelease: () => loupe.hide(),
    });

    // The crop view is switched with a checkbox handled above, so no toggle button
    // is passed to the proof layers.
    ProofLayers.init({
      sourceCanvas: photo,
      flatCanvas: flat,
      sourceOverlay: photoGrid,
      flatOverlay: flatGrid,
      cropCanvas: cropView,
      matrixEl,
      tracerInfoEl: $("tracer"),
      mode: "warp",
    });

    bindControls();
    bindUpload();
    bindShortcuts();
    syncControls();
    setNote(Notes.intro);

    // For swapping the sample photo: Scanner.corners() prints the dot positions in
    // the form config.js wants.
    window.Scanner = {
      corners: () =>
        JSON.stringify(dots.points().map(([x, y]) => [+(x / photo.width).toFixed(4), +(y / photo.height).toFixed(4)])),
    };

    if (!(await loadSample())) setStatus("sampleError");
  }

  boot().catch((err) => {
    console.error(err);
    setStatus("sampleError");
  });
})();
