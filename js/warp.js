// Pixel work only: flatten the photo through H, then optionally grey it or
// threshold it. No DOM in here, so it can be tested on plain arrays.
const Warp = (() => {
  let src = null; // RGBA bytes of the photo
  let srcW = 0;
  let srcH = 0;

  // Two scratch buffers are reused for every frame instead of allocating new ones.
  // warped holds the raw flattened colours, toned holds the grey/threshold version.
  let warped = new Uint8ClampedArray(0);
  let toned = new Uint8ClampedArray(0);

  function setSource(imageData) {
    src = imageData.data;
    srcW = imageData.width;
    srcH = imageData.height;
  }

  // Grow the scratch buffers if needed. Call once with the biggest size you expect
  // so they rarely get reallocated mid-drag.
  function reserve(pixels) {
    const bytes = pixels * 4;
    if (warped.length < bytes) {
      warped = new Uint8ClampedArray(bytes);
      toned = new Uint8ClampedArray(bytes);
    }
  }

  // BACKWARD mapping (what real scanners do): walk over the OUTPUT pixels and ask
  // H where each one came from in the photo. Every output pixel gets exactly one
  // value, so there are never any gaps.
  //
  // h       the 8 numbers, built for a flat page of outW x outH
  // scale   1 for full size, less for a quick preview. H stays the same, we just
  //         take bigger steps across the flat page.
  // Returns the size actually rendered.
  function render(h, outW, outH, scale) {
    if (!src) return null;
    const rw = Math.max(1, Math.round(outW * scale));
    const rh = Math.max(1, Math.round(outH * scale));
    reserve(rw * rh);

    const [h0, h1, h2, h3, h4, h5, h6, h7] = h;
    const stepX = outW / rw; // flat-page distance covered by one output pixel
    const stepY = outH / rh;
    const maxX = srcW - 1;
    const maxY = srcH - 1;
    const s = src;
    const out = warped;

    // How much each numerator and the denominator change per output pixel.
    // This replaces three multiplications per pixel with three additions.
    const dNx = h0 * stepX;
    const dNy = h3 * stepX;
    const dDen = h6 * stepX;
    const q0 = 0.5 * stepX; // sample at pixel centres, not corners

    let o = 0;
    for (let py = 0; py < rh; py++) {
      const v = (py + 0.5) * stepY;
      let nx = h0 * q0 + h1 * v + h2;
      let ny = h3 * q0 + h4 * v + h5;
      let den = h6 * q0 + h7 * v + 1;

      for (let px = 0; px < rw; px++, o += 4) {
        const inv = 1 / den;
        const sx = nx * inv; // where this pixel lives in the photo
        const sy = ny * inv;
        nx += dNx;
        ny += dNy;
        den += dDen;

        // Outside the photo (or a NaN from a bad matrix): leave it transparent.
        if (!(sx >= 0 && sx <= srcW && sy >= 0 && sy <= srcH)) {
          out[o + 3] = 0;
          continue;
        }

        // Photo pixel i has its centre at i + 0.5, so shift before interpolating.
        let fx = sx - 0.5;
        let fy = sy - 0.5;
        if (fx < 0) fx = 0; else if (fx > maxX) fx = maxX;
        if (fy < 0) fy = 0; else if (fy > maxY) fy = maxY;

        const x0 = fx | 0;
        const y0 = fy | 0;
        const x1 = x0 < maxX ? x0 + 1 : x0;
        const y1 = y0 < maxY ? y0 + 1 : y0;
        const tx = fx - x0;
        const ty = fy - y0;

        // Bilinear: blend the four surrounding photo pixels by how close we are.
        const w11 = tx * ty;
        const w10 = tx - w11;
        const w01 = ty - w11;
        const w00 = 1 - tx - ty + w11;
        const i00 = (y0 * srcW + x0) * 4;
        const i10 = (y0 * srcW + x1) * 4;
        const i01 = (y1 * srcW + x0) * 4;
        const i11 = (y1 * srcW + x1) * 4;

        out[o] = s[i00] * w00 + s[i10] * w10 + s[i01] * w01 + s[i11] * w11;
        out[o + 1] = s[i00 + 1] * w00 + s[i10 + 1] * w10 + s[i01 + 1] * w01 + s[i11 + 1] * w11;
        out[o + 2] = s[i00 + 2] * w00 + s[i10 + 2] * w10 + s[i01 + 2] * w01 + s[i11 + 2] * w11;
        out[o + 3] = 255;
      }
    }
    return { width: rw, height: rh };
  }

  // FORWARD mapping (the demo of what goes wrong): walk over the PHOTO pixels and
  // push each one to where the matrix says it lands in the scan. Some scan pixels
  // get hit twice and some never, and the ones never hit stay transparent. Those
  // are the gaps.
  //
  // hf    photo -> flat numbers (Geometry.solveForward)
  // box   upright box around the dots, so we only visit photo pixels that can matter
  function renderForward(hf, outW, outH, box) {
    if (!src) return null;
    reserve(outW * outH);
    const out = warped;
    out.fill(0, 0, outW * outH * 4); // everything starts as a gap

    const [g0, g1, g2, g3, g4, g5, g6, g7] = hf;
    const x0 = Math.max(0, Math.floor(box.x));
    const y0 = Math.max(0, Math.floor(box.y));
    const x1 = Math.min(srcW, Math.ceil(box.x + box.w));
    const y1 = Math.min(srcH, Math.ceil(box.y + box.h));
    const s = src;

    for (let y = y0; y < y1; y++) {
      const py = y + 0.5;
      let nx = g0 * (x0 + 0.5) + g1 * py + g2;
      let ny = g3 * (x0 + 0.5) + g4 * py + g5;
      let den = g6 * (x0 + 0.5) + g7 * py + 1;
      let i = (y * srcW + x0) * 4;

      for (let x = x0; x < x1; x++, i += 4) {
        const inv = 1 / den;
        const u = nx * inv; // where this photo pixel lands on the flat page
        const v = ny * inv;
        // A positive denominator keeps us on the near side of the page. Beyond
        // that the maths wraps around and would paint pixels in the wrong place.
        const facingUs = den > 0;
        nx += g0;
        ny += g3;
        den += g6;

        if (facingUs && u >= 0 && u < outW && v >= 0 && v < outH) {
          const o = ((v | 0) * outW + (u | 0)) * 4;
          out[o] = s[i];
          out[o + 1] = s[i + 1];
          out[o + 2] = s[i + 2];
          out[o + 3] = 255;
        }
      }
    }
    return { width: outW, height: outH };
  }

  // Greyscale and threshold are one rule per pixel, applied to the flattened image.
  //   grey       0..1, how far to pull the colours towards grey
  //   threshold  0 means off. Anything above is a cut-off level, and pixels become
  //              pure black or pure white around it. Wins over grey.
  // Returns a byte view that is ready to wrap in an ImageData.
  // Scratch space for Enhance: the paper brightness, measured on a coarse grid.
  let grid = new Float32Array(0);
  let grid2 = new Float32Array(0);
  const hist = new Uint32Array(256);
  let colX0 = new Int32Array(0);
  let colX1 = new Int32Array(0);
  let colFx = new Float32Array(0);

  // ENHANCE, the "scanner look" (like the Enhance option in phone scanner apps):
  // 1. Cut the scan into small blocks. In each block, the paper is the brightest
  //    thing there, so take a bright value (the 95th percentile, which ignores a
  //    few noisy pixels) as that block's paper brightness.
  // 2. A block that sits completely inside a dark area (a coloured chart bar, a
  //    photo) would get the wrong answer, so each block borrows the brightest
  //    paper from its neighbours, then the grid is smoothed.
  // 3. Every pixel is divided by the paper brightness where it sits, blended
  //    between the four nearest blocks. Shadows and uneven light cancel out and
  //    the paper turns white, while ink keeps its true colour.
  // 4. Colours are pushed a little further from grey so they look vivid.
  function enhance(a, b, width, height) {
    const { blocks, saturation, whitePoint } = CONFIG.enhance;
    const bs = Math.max(8, Math.round(Math.min(width, height) / blocks));
    const gw = Math.ceil(width / bs);
    const gh = Math.ceil(height / bs);
    if (grid.length < gw * gh) {
      grid = new Float32Array(gw * gh);
      grid2 = new Float32Array(gw * gh);
    }

    // 1. Paper brightness per block.
    for (let by = 0; by < gh; by++) {
      for (let bx = 0; bx < gw; bx++) {
        hist.fill(0);
        let count = 0;
        const yEnd = Math.min(height, (by + 1) * bs);
        const xEnd = Math.min(width, (bx + 1) * bs);
        for (let y = by * bs; y < yEnd; y++) {
          for (let x = bx * bs, i = (y * width + x) * 4; x < xEnd; x++, i += 4) {
            if (a[i + 3] === 0) continue; // a gap in the forward view: no colour to read
            hist[(77 * a[i] + 150 * a[i + 1] + 29 * a[i + 2]) >> 8]++;
            count++;
          }
        }
        let v = 0;
        if (count) {
          let seen = 0;
          const target = count * 0.05;
          for (v = 255; v > 0; v--) {
            seen += hist[v];
            if (seen >= target) break;
          }
        }
        grid[by * gw + bx] = v;
      }
    }

    // 2. Borrow the brightest paper within 2 blocks, then smooth with a 3x3 average.
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let m = 0;
        for (let dy = -2; dy <= 2; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= gh) continue;
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx;
            if (xx >= 0 && xx < gw && grid[yy * gw + xx] > m) m = grid[yy * gw + xx];
          }
        }
        grid2[y * gw + x] = m;
      }
    }
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy >= 0 && yy < gh && xx >= 0 && xx < gw) { sum += grid2[yy * gw + xx]; n++; }
          }
        }
        grid[y * gw + x] = Math.max(40, sum / n);
      }
    }

    // 3 and 4. Divide by the local paper brightness, then lift the colours.
    // The horizontal blend weights are the same on every row, so work them out once.
    if (colX0.length < width) {
      colX0 = new Int32Array(width);
      colX1 = new Int32Array(width);
      colFx = new Float32Array(width);
    }
    for (let x = 0; x < width; x++) {
      const gx = Math.min(gw - 1, Math.max(0, (x + 0.5) / bs - 0.5));
      colX0[x] = Math.floor(gx);
      colX1[x] = Math.min(gw - 1, colX0[x] + 1);
      colFx[x] = gx - colX0[x];
    }
    const sat = saturation;
    const keep = 1 - sat; // lum * (1 - sat) is the same for all three channels
    for (let y = 0; y < height; y++) {
      const gy = Math.min(gh - 1, Math.max(0, (y + 0.5) / bs - 0.5));
      const r0 = Math.floor(gy) * gw;
      const r1 = Math.min(gh - 1, Math.floor(gy) + 1) * gw;
      const fy = gy - Math.floor(gy);
      let i = y * width * 4;
      for (let x = 0; x < width; x++, i += 4) {
        const x0 = colX0[x];
        const x1 = colX1[x];
        const fx = colFx[x];
        const top = grid[r0 + x0] + (grid[r0 + x1] - grid[r0 + x0]) * fx;
        const bot = grid[r1 + x0] + (grid[r1 + x1] - grid[r1 + x0]) * fx;
        const gain = whitePoint / (top + (bot - top) * fy);

        const rr = a[i] * gain;
        const gg = a[i + 1] * gain;
        const bb = a[i + 2] * gain;
        const base = (0.3 * rr + 0.59 * gg + 0.11 * bb) * keep;
        const r2 = base + rr * sat;
        const g2 = base + gg * sat;
        const b2 = base + bb * sat;
        // Near-white becomes clean white; everything else gets a touch more contrast.
        b[i] = r2 > 238 ? 255 : r2 * 1.05 - 5;
        b[i + 1] = g2 > 238 ? 255 : g2 * 1.05 - 5;
        b[i + 2] = b2 > 238 ? 255 : b2 * 1.05 - 5;
        b[i + 3] = a[i + 3];
      }
    }

    // 5. White balance: photos indoors are often a little yellow. Find the average
    //    colour of the paper (the near-white pixels) and scale each channel so that
    //    colour becomes pure white.
    let sr = 0, sg = 0, sb = 0, cnt = 0;
    const n = width * height * 4;
    for (let i = 0; i < n; i += 16) { // every 4th pixel is plenty for an average
      const lum = 0.3 * b[i] + 0.59 * b[i + 1] + 0.11 * b[i + 2];
      if (lum > 215 && b[i + 3] !== 0) { sr += b[i]; sg += b[i + 1]; sb += b[i + 2]; cnt++; }
    }
    if (cnt > 50) {
      const kr = (255 * cnt) / sr;
      const kg = (255 * cnt) / sg;
      const kb = (255 * cnt) / sb;
      for (let i = 0; i < n; i += 4) {
        b[i] *= kr;
        b[i + 1] *= kg;
        b[i + 2] *= kb;
      }
    }
  }

  // Colour rules per pixel, in order: Enhance first, then greyscale or the black
  // and white cut-off on top. None of them moves a pixel, so the shape never changes.
  function tone(width, height, grey, threshold, enhanceOn = false) {
    const n = width * height * 4;
    if (!enhanceOn && grey === 0 && threshold === 0) return warped.subarray(0, n);

    let a = warped;
    const b = toned;
    if (enhanceOn) {
      enhance(warped, toned, width, height);
      if (grey === 0 && threshold === 0) return toned.subarray(0, n);
      a = toned; // the next rule works on the enhanced colours, in place
    }
    if (threshold > 0) {
      for (let i = 0; i < n; i += 4) {
        // Integer luminance, weights 77/150/29 out of 256 (about 0.30/0.59/0.11).
        const lum = (77 * a[i] + 150 * a[i + 1] + 29 * a[i + 2]) >> 8;
        const v = lum > threshold ? 255 : 0;
        b[i] = v;
        b[i + 1] = v;
        b[i + 2] = v;
        b[i + 3] = a[i + 3];
      }
    } else {
      const k = Math.round(grey * 256); // mix amount in 0..256, avoids float maths
      for (let i = 0; i < n; i += 4) {
        const r = a[i];
        const g = a[i + 1];
        const bl = a[i + 2];
        const lum = (77 * r + 150 * g + 29 * bl) >> 8;
        b[i] = r + (((lum - r) * k) >> 8);
        b[i + 1] = g + (((lum - g) * k) >> 8);
        b[i + 2] = bl + (((lum - bl) * k) >> 8);
        b[i + 3] = a[i + 3];
      }
    }
    return toned.subarray(0, n);
  }

  return { setSource, reserve, render, renderForward, tone };
})();
