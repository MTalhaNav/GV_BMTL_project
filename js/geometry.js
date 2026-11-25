// Helpers about the four dots and the page shape. Nothing in here draws anything.
const Geometry = (() => {
  // A quad smaller than this (photo pixels squared) is not a page yet.
  const MIN_AREA = 2500;

  // The dots must go TL, TR, BR, BL. Walking round them, every corner has to turn
  // the same way (clockwise). Canvas y points down, so clockwise is a positive
  // cross product. This rejects bow-ties, dents and dots placed in the wrong order.
  function quadIsValid(d) {
    let area2 = 0;
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = d[i];
      const [bx, by] = d[(i + 1) % 4];
      const [cx, cy] = d[(i + 2) % 4];
      if ((bx - ax) * (cy - by) - (by - ay) * (cx - bx) <= 0) return false;
      area2 += ax * by - bx * ay; // shoelace formula, doubled
    }
    return area2 / 2 >= MIN_AREA;
  }

  // Smallest upright rectangle around the dots. This is what a plain crop keeps.
  function boundingBox(d) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of d) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // Solves for the 8 numbers (h8 is fixed at 1) that send the four "from" points
  // onto the four "to" points. Returns null if the numbers blow up.
  // engine.js may use either naming, depending on whether the rename has landed.
  // typeof is safe on a name that does not exist, and it also finds functions
  // declared with const.
  function solve(from, to) {
    const buildFn = typeof buildSystem === "function" ? buildSystem : numbers_looker;
    const solveFn = typeof solveLinear === "function" ? solveLinear : solve_numbers;
    const [A, B] = buildFn(from, to);
    const h = solveFn(A, B);
    return h && h.every(Number.isFinite) ? h : null;
  }

  const flatCorners = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];

  // Flat page -> photo. The scan uses this one: each scan pixel asks where to look.
  function solveHomography(dots, flatW, flatH) {
    return solve(flatCorners(flatW, flatH), dots);
  }

  // Photo -> flat page, the opposite direction. Only the forward-mapping demo
  // needs it: each photo pixel asks where it should land.
  function solveForward(dots, flatW, flatH) {
    return solve(dots, flatCorners(flatW, flatH));
  }

  return { quadIsValid, boundingBox, solveHomography, solveForward };
})();