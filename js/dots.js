// The four draggable corner dots. They live on their own canvas on top of the
// photo, so the grid overlay can be cleared and redrawn without touching them.
const Dots = (() => {
  // Colours come from the stylesheet (base.css), so the page has one palette.
  const css = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  // canvas   same pixel size as the photo canvas
  // start    four [fx, fy] fractions of the canvas, ordered TL, TR, BR, BL
  // options  dotRadius and hitRadius in CSS px, isValid(points),
  //          onChange() when a dot moves, onDrag(info) while one is held,
  //          onRelease() when it is let go
  function create(canvas, start, options) {
    const { dotRadius, hitRadius, isValid, onChange, onDrag, onRelease } = options;
    const ctx = canvas.getContext("2d");
    const accent = css("--accent", "#c8ff3d");
    const ink = css("--accent-ink", "#0b0d12");
    const danger = css("--danger", "#ff5c6c");
    const points = [[0, 0], [0, 0], [0, 0], [0, 0]];
    let active = -1; // dot being dragged right now, or -1
    let selected = -1; // dot the keyboard controls, or -1
    let scale = 1; // canvas pixels per CSS pixel
    let showOutline = true;

    const clamp = (v, max) => Math.min(Math.max(v, 0), max);

    // Turn fractions of the canvas into pixel positions. Call again after the
    // canvas has been resized, for example when a new photo is loaded.
    function place(fractions) {
      fractions.forEach(([fx, fy], i) => {
        points[i][0] = fx * canvas.width;
        points[i][1] = fy * canvas.height;
      });
    }

    // The canvas is shown at a different size than its pixel size, so pointer
    // positions have to be scaled. Skipping this is the classic dragging bug.
    // Also refreshes scale, which keeps the dots a constant on-screen size.
    function toCanvas(e) {
      const rect = canvas.getBoundingClientRect();
      scale = rect.width ? canvas.width / rect.width : 1;
      const scaleY = rect.height ? canvas.height / rect.height : 1;
      return [(e.clientX - rect.left) * scale, (e.clientY - rect.top) * scaleY];
    }

    function nearest(x, y) {
      let best = -1;
      let bestDist = (hitRadius * scale) ** 2;
      for (let i = 0; i < 4; i++) {
        const d = (points[i][0] - x) ** 2 + (points[i][1] - y) ** 2;
        if (d <= bestDist) {
          best = i;
          bestDist = d;
        }
      }
      return best;
    }

    // Everything the magnifier needs to know about the dot being held.
    const dragInfo = () => {
      const [x, y] = points[active];
      return { index: active, x, y, cssX: x / scale, cssY: y / scale, scale };
    };

    function draw() {
      const ok = isValid(points);
      const colour = ok ? accent : danger;
      const textColour = ok ? ink : "#ffffff";
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (showOutline) {
        ctx.lineJoin = "round";
        ctx.beginPath();
        points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        // A dark line under the coloured one keeps it readable on any photo.
        ctx.lineWidth = 5 * scale;
        ctx.strokeStyle = "rgba(11, 13, 18, 0.65)";
        ctx.stroke();
        ctx.lineWidth = 2 * scale;
        ctx.strokeStyle = colour;
        ctx.stroke();
      }

      // Show a ring on the keyboard-selected dot, but only for keyboard users.
      const showFocus = selected >= 0 && canvas.matches(":focus-visible");

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      points.forEach(([x, y], i) => {
        const held = i === active;
        const r = dotRadius * scale * (held ? 1.25 : 1); // grows a little when grabbed
        ctx.font = `700 ${Math.round(r * 1.05)}px "Manrope", "Segoe UI", Arial, sans-serif`;

        if ((showFocus && i === selected) || held) {
          ctx.beginPath();
          ctx.arc(x, y, r + 5 * scale, 0, Math.PI * 2);
          ctx.lineWidth = 2 * scale;
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = colour;
        ctx.fill();
        ctx.lineWidth = 2.5 * scale;
        ctx.strokeStyle = "rgba(11, 13, 18, 0.85)";
        ctx.stroke();
        ctx.fillStyle = textColour;
        ctx.fillText(String(i + 1), x, y + scale * 0.5);
      });
    }

    canvas.addEventListener("pointerdown", (e) => {
      const [x, y] = toCanvas(e);
      const hit = nearest(x, y);
      if (hit < 0) return;
      active = selected = hit;
      // Capture keeps the drag alive when the pointer leaves the canvas.
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
      e.preventDefault();
      canvas.focus({ preventScroll: true }); // so the arrow keys work straight away
      draw();
      onDrag(dragInfo());
    });

    canvas.addEventListener("pointermove", (e) => {
      const [x, y] = toCanvas(e);
      if (active < 0) {
        if (e.pointerType === "mouse") canvas.style.cursor = nearest(x, y) >= 0 ? "grab" : "default";
        return;
      }
      // Keep the dot inside the photo, otherwise the page could point at nothing.
      points[active][0] = clamp(x, canvas.width);
      points[active][1] = clamp(y, canvas.height);
      draw();
      onChange();
      onDrag(dragInfo());
    });

    const release = () => {
      if (active < 0) return;
      active = -1;
      canvas.style.cursor = "grab";
      draw();
      onRelease();
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    // Keyboard: press 1 to 4 to pick a dot, then the arrow keys to nudge it.
    // Shift moves ten times further.
    canvas.addEventListener("keydown", (e) => {
      if (e.key >= "1" && e.key <= "4") {
        selected = Number(e.key) - 1;
        draw();
        return;
      }
      const dir = ARROWS[e.key];
      if (!dir || selected < 0) return;
      e.preventDefault();
      const step = (e.shiftKey ? 10 : 1) * scale;
      points[selected][0] = clamp(points[selected][0] + dir[0] * step, canvas.width);
      points[selected][1] = clamp(points[selected][1] + dir[1] * step, canvas.height);
      draw();
      onChange();
    });
    canvas.addEventListener("focus", draw);
    canvas.addEventListener("blur", draw);

    // Redraw when the layout changes size so the dots keep their on-screen size.
    const refresh = () => {
      const rect = canvas.getBoundingClientRect();
      scale = rect.width ? canvas.width / rect.width : 1;
      draw();
    };
    if ("ResizeObserver" in window) new ResizeObserver(refresh).observe(canvas);
    else window.addEventListener("resize", refresh);

    place(start);
    draw();

    return {
      // The live array, so treat it as read-only.
      points: () => points,
      draw,
      reset(fractions) {
        place(fractions);
        selected = -1;
        draw();
      },
      setOutline(on) {
        showOutline = on;
        draw();
      },
    };
  }

  return { create };
})();
