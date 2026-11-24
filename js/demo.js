// The opening animation: the four dots glide from where they start onto the
// corners of the page. It moves the dots only. Rebuilding the scan on each frame
// is main.js's job, which it does through the onFrame callback.
const Demo = (() => {
  let raf = 0;

  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  // Slow start, quick middle, slow finish.
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // points   the live dot array (it is changed in place)
  // targets  four [x, y] pixel positions to glide to
  // options  delayMs, durationMs, staggerMs (each dot starts a little later than
  //          the one before), onFrame() after every step, onDone() at the end
  function play(points, targets, { delayMs, durationMs, staggerMs, onFrame, onDone }) {
    cancel();
    const from = points.map((p) => [p[0], p[1]]);
    const total = delayMs + durationMs + staggerMs * 3;
    const start = performance.now();

    const step = (now) => {
      const elapsed = now - start - delayMs;
      for (let i = 0; i < 4; i++) {
        const e = ease(clamp01((elapsed - i * staggerMs) / durationMs));
        points[i][0] = from[i][0] + (targets[i][0] - from[i][0]) * e;
        points[i][1] = from[i][1] + (targets[i][1] - from[i][1]) * e;
      }
      onFrame();
      if (now - start < total) {
        raf = requestAnimationFrame(step);
      } else {
        raf = 0;
        onDone();
      }
    };
    raf = requestAnimationFrame(step);
  }

  function cancel() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  return { play, cancel, isPlaying: () => raf !== 0 };
})();
