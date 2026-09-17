/* Build the site logo set from the official Silvershell asset pack.
   Source: "WORDMARK without Black Square - Orange". The pack reads
   "silvershell consulting"; we re-set line 2 to "energy" using the logo's own
   glyphs (e, n, r, g) and a "y" built by extending the v's strokes, so the
   result is pixel-identical in weight and rendering to the original.
   Outputs: logo (orange), logo-white, -sm variants, the shell mark, favicons. */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const PACK = process.argv[2] ||
  path.join(process.env.HOME, "Documents/O+ Connect/SILVERSHELL Consulting Logo  ASSETS");
const SRC_ORANGE = path.join(PACK, "SILVERSHELL Consulting Logo - WORDMARK without Black Square - Orange.png");

const IMG = path.join(__dirname, "..", "public/images");
const LOGO = path.join(IMG, "silvershell-logo.png");
const LOGO_SM = path.join(IMG, "silvershell-logo-sm.png");
const WHITE = path.join(IMG, "silvershell-logo-white.png");
const WHITE_SM = path.join(IMG, "silvershell-logo-white-sm.png");
const MARK = path.join(IMG, "silvershell-mark.png");
const ICO = path.join(__dirname, "..", "public/favicon.ico");
const ICON_PNG = path.join(__dirname, "..", "public/icon.png");
const APPLE = path.join(__dirname, "..", "public/apple-touch-icon.png");

const SM_WIDTH = 640;
const ALPHA_MIN = 40;

// ---------- raster helpers ----------
// `wall` (optional) blocks vertical adjacency between rows wall.y and wall.y+1 for x < wall.xMax,
// so glyphs on different lines that touch (an ascender under a baseline) are labelled separately.
function labelComponents(px, W, H, wall) {
  const label = new Int32Array(W * H).fill(-1);
  const comps = [];
  const opaque = (i) => px[i * 4 + 3] > ALPHA_MIN;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i0 = y * W + x;
    if (!opaque(i0) || label[i0] >= 0) continue;
    const id = comps.length;
    const c = { id, x0: x, x1: x, y0: y, y1: y, n: 0 };
    const stack = [i0];
    while (stack.length) {
      const i = stack.pop();
      if (label[i] >= 0 || !opaque(i)) continue;
      label[i] = id; c.n++;
      const cx = i % W, cy = (i - cx) / W;
      if (cx < c.x0) c.x0 = cx; if (cx > c.x1) c.x1 = cx; if (cy < c.y0) c.y0 = cy; if (cy > c.y1) c.y1 = cy;
      if (cx > 0) stack.push(i - 1); if (cx < W - 1) stack.push(i + 1);
      const blockUp = wall && cy === wall.y + 1 && cx < wall.xMax;
      const blockDown = wall && cy === wall.y && cx < wall.xMax;
      if (cy > 0 && !blockUp) stack.push(i - W); if (cy < H - 1 && !blockDown) stack.push(i + W);
    }
    comps.push(c);
  }
  return { label, comps };
}

// Component whose bbox contains (x, y), preferring the one with the largest pixel count.
function compAt(comps, x, y) {
  return comps.filter((c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1).sort((a, b) => b.n - a.n)[0];
}

// Copy one component's pixels into a fresh RGBA buffer (its bbox), returns {buf, w, h}.
function cutGlyph(px, label, W, c) {
  const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1;
  const buf = Buffer.alloc(w * h * 4);
  for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) {
    if (label[y * W + x] !== c.id) continue;
    px.copy(buf, ((y - c.y0) * w + (x - c.x0)) * 4, (y * W + x) * 4, (y * W + x) * 4 + 4);
  }
  return { buf, w, h };
}

// Least-squares line x = a*y + b through points [[x,y],...].
function fitLine(pts) {
  const n = pts.length;
  let sx = 0, sy = 0, sxy = 0, syy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxy += x * y; syy += y * y; }
  const a = (n * sxy - sx * sy) / (n * syy - sy * sy);
  return { a, b: (sx - a * sy) / n, at: (y) => a * y + (sx - a * sy) / n };
}

// Sutherland–Hodgman clip of a polygon against half-plane f(p) <= 0.
function clipPoly(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length];
    const fp = f(P), fq = f(Q);
    if (fp <= 0) out.push(P);
    if ((fp <= 0) !== (fq <= 0)) {
      const t = fp / (fp - fq);
      out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]);
    }
  }
  return out;
}

// ---------- build ----------
async function main() {
  const { data: px, info } = await sharp(SRC_ORANGE).trim().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  // Glyph components, located by a point inside each (from the measured layout).
  // First pass finds the line-1 baseline and the shell; second pass re-labels with a wall on
  // that baseline so line-2 ascenders that touch line-1 letters are separate components.
  const pass1 = labelComponents(px, W, H);
  const line1Base = compAt(pass1.comps, 710, 250).y1; // flat-bottomed r sits on line 1 baseline
  const shellX0 = compAt(pass1.comps, W - 5, 300).x0;
  const { label, comps } = labelComponents(px, W, H, { y: line1Base, xMax: shellX0 });
  const g = {
    v: compAt(comps, 380, 250), e: compAt(comps, 560, 250), r: compAt(comps, 710, 250),
    n: compAt(comps, 480, 480), gee: compAt(comps, 1430, 480),
  };
  const shell = compAt(comps, W - 5, 300);
  const line2Base = g.n.y1;   // flat-bottomed n sits on line 2 baseline
  const descBottom = g.gee.y1; // g descender depth
  const lineShift = line2Base - line1Base;

  // Solid brand colour, sampled from the middle of the n's stem.
  const ci = (g.n.y0 + 100) * W + g.n.x0 + 20;
  const orange = `rgb(${px[ci * 4]},${px[ci * 4 + 1]},${px[ci * 4 + 2]})`;

  // 1. Erase line 2 ("consulting"): every component that reaches well below line 1's
  //    baseline (ascenders of l/t/i start a pixel above it, so a row cut won't do), plus the
  //    faint anti-aliasing halo around those glyphs, which sits below the ALPHA_MIN threshold.
  const out = Buffer.from(px);
  const isLine2 = (id) => id >= 0 && id !== shell.id &&
    (comps[id].y1 > line1Base + 10 ||                       // the glyph proper
     (comps[id].y0 > line1Base - 40 && comps[id].y1 <= line1Base)); // t-top / i-dot cut off by the wall
  const isKept = (id) => id >= 0 && !isLine2(id);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (out[i * 4 + 3] === 0) continue;
    let erase = isLine2(label[i]);
    if (label[i] < 0) {
      // Unlabelled = halo pixel. Keep it only if it hugs a glyph we keep.
      let nearKept = false;
      for (let dy = -2; dy <= 2 && !nearKept; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && isKept(label[ny * W + nx])) { nearKept = true; break; }
      }
      erase = !nearKept;
    }
    if (erase) out.writeUInt32LE(0, i * 4);
  }

  // 2. Fit the v's four stroke edges (sub-pixel, alpha-weighted) in rows where
  //    the two strokes are separate, to extend them into a y.
  const edges = { lOut: [], lIn: [], rIn: [], rOut: [] };
  for (let y = g.v.y0 + 20; y <= g.v.y0 + 130; y++) {
    const runs = [];
    let run = null;
    for (let x = g.v.x0; x <= g.v.x1 + 1; x++) {
      const on = x <= g.v.x1 && label[y * W + x] === g.v.id;
      if (on && !run) run = { s: x };
      if (!on && run) { run.e = x - 1; runs.push(run); run = null; }
    }
    if (runs.length !== 2) continue;
    const A = (x) => px[(y * W + x) * 4 + 3] / 255;
    const sub = (r) => [r.s + 1 - A(r.s), r.e + A(r.e)]; // [left edge, right edge (exclusive)]
    const [l0, l1] = sub(runs[0]), [r0, r1] = sub(runs[1]);
    edges.lOut.push([l0, y]); edges.lIn.push([l1, y]); edges.rIn.push([r0, y]); edges.rOut.push([r1, y]);
  }
  const L = { lOut: fitLine(edges.lOut), lIn: fitLine(edges.lIn), rIn: fitLine(edges.rIn), rOut: fitLine(edges.rOut) };

  // 3. Compose "energy" on line 2. Letter gaps are the logo's own measured pairs.
  const seq = [["e", 15], ["n", 16], ["e", 16], ["r", 12], ["gee", 14], ["y", 0]];
  const glyph = {};
  for (const k of ["e", "n", "r", "gee", "v"]) glyph[k] = cutGlyph(px, label, W, g[k]);
  let cursor = 0;
  const tailPolys = [];
  for (const [k, gap] of seq) {
    const src = k === "y" ? g.v : g[k];
    const cut = k === "y" ? glyph.v : glyph[k];
    const dy = src.y0 <= line1Base ? lineShift : 0;
    const dx = cursor - src.x0;
    for (let y = 0; y < cut.h; y++) for (let x = 0; x < cut.w; x++) {
      const s = (y * cut.w + x) * 4;
      if (cut.buf[s + 3] === 0) continue;
      const tx = src.x0 + x + dx, ty = src.y0 + y + dy;
      cut.buf.copy(out, (ty * W + tx) * 4, s, s + 4);
    }
    if (k === "y") {
      // Tail: the right stroke continued to the descender depth (flat cut, like the v's base).
      const yTop = line1Base - 12, yBot = descBottom + 1; // in line-1 coords; overlap the v to hide the seam
      const P = (line, y) => [line.at(y) + dx, y + dy];
      tailPolys.push([P(L.rIn, yTop), P(L.rOut, yTop), P(L.rOut, yBot), P(L.rIn, yBot)]);
      // Left stroke continued until it is absorbed by the tail (clipped by the tail's outer edge),
      // so the crotch under the y closes cleanly instead of leaving a notch.
      let left = [P(L.lOut, yTop), P(L.lIn, yTop), P(L.lIn, yBot), P(L.lOut, yBot)];
      left = clipPoly(left, ([x, y]) => x - (L.rOut.at(y - dy) + dx));
      tailPolys.push(left);
    }
    cursor += cut.w + gap;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    tailPolys.map((p) => `<polygon fill="${orange}" points="${p.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}"/>`).join("") +
    `</svg>`;

  const composed = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png({ compressionLevel: 9 }).toBuffer();
  await sharp(composed).trim().png({ compressionLevel: 9 }).toFile(LOGO);
  await sharp(LOGO).resize({ width: SM_WIDTH }).png({ compressionLevel: 9 }).toFile(LOGO_SM);
  console.log(`line2 "energy" set at baseline ${line2Base}, width ${cursor}px (was ${g.gee.x1 + 1}px)`);

  // 4. White variant: same alpha over solid white.
  const o = await sharp(LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const wpx = Buffer.from(o.data);
  for (let i = 0; i < wpx.length; i += 4) { wpx[i] = 255; wpx[i + 1] = 255; wpx[i + 2] = 255; }
  await sharp(wpx, { raw: { width: o.info.width, height: o.info.height, channels: 4 } })
    .png({ compressionLevel: 9 }).toFile(WHITE);
  await sharp(WHITE).resize({ width: SM_WIDTH }).png({ compressionLevel: 9 }).toFile(WHITE_SM);

  // 5. Shell mark: the component containing the rightmost opaque pixel of the final logo.
  const fin = labelComponents(o.data, o.info.width, o.info.height);
  const mk = compAt(fin.comps, o.info.width - 5, 300);
  const cut = cutGlyph(o.data, fin.label, o.info.width, mk);
  await sharp(cut.buf, { raw: { width: cut.w, height: cut.h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(MARK);

  // 6. Favicons: square, padded, transparent background.
  function squareIcon(size) {
    const pad = Math.round(size * 0.08);
    const content = size - pad * 2;
    return sharp(MARK)
      .resize(content, content, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png();
  }
  await squareIcon(512).toFile(ICON_PNG);
  await squareIcon(180).toFile(APPLE);
  const sizes = [16, 32, 48];
  const buffers = [];
  for (const s of sizes) buffers.push(await squareIcon(s).toBuffer());
  const headerSize = 6, dirSize = 16 * sizes.length;
  const ico = Buffer.alloc(headerSize + dirSize);
  ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(sizes.length, 4);
  let offset = headerSize + dirSize;
  sizes.forEach((size, i) => {
    const e = headerSize + i * 16, b = buffers[i];
    ico.writeUInt8(size, e); ico.writeUInt8(size, e + 1); ico.writeUInt8(0, e + 2); ico.writeUInt8(0, e + 3);
    ico.writeUInt16LE(1, e + 4); ico.writeUInt16LE(32, e + 6);
    ico.writeUInt32LE(b.length, e + 8); ico.writeUInt32LE(offset, e + 12);
    offset += b.length;
  });
  fs.writeFileSync(ICO, Buffer.concat([ico, ...buffers]));
  console.log("wrote", [LOGO, LOGO_SM, WHITE, WHITE_SM, MARK, ICON_PNG, APPLE, ICO].map((p) => path.relative(process.cwd(), p)).join("\n      "));
}

main().catch((e) => { console.error(e); process.exit(1); });
