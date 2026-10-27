// Card faces for the rooftop scene, drawn in code (no image downloads).
// drawBack: a classic bicycle-style back in the star's denim (white border, lattice, scrollwork, the star medallion).
// drawFront: aged cream card: a picture or an emblem, the name, and what clicking does.

const INK = '#2a2f3a', CREAM = '#f5efe3', NAVY = '#1b2744';

// a seeded random so each card's wobble is the same every visit
function rng(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

function star(x, cx, cy, r, inner = 0.42) {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * inner : r;
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
}

// ── back: a classic bicycle-style back in denim: white border, a fine lattice, mirrored scrollwork, the star ──
const RIM = 22;                                                       // the white border
const FIELD = '#2c4677', LINE = '#c8d6f0';                            // the star's denim, a shade darker; its palest blue

function curl(x, cx, cy, r, rot, flip = 1) {                          // one scroll: a spiral with a sweeping tail
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(flip, 1); x.beginPath();
  for (let t = 0; t <= 1.0001; t += 0.025) { const a = t * Math.PI * 2.3, rr = r * (1 - t * 0.82); t ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  x.moveTo(r, 0); x.bezierCurveTo(r * 1.6, r * 0.5, r * 2.4, -r * 0.2, r * 3, -r * 1.1);
  x.stroke(); x.restore();
}
function leaf(x, cx, cy, s, rot) {                                    // a small leaf
  x.save(); x.translate(cx, cy); x.rotate(rot); x.beginPath();
  x.moveTo(0, 0); x.quadraticCurveTo(s * 0.5, -s * 0.35, s, 0); x.quadraticCurveTo(s * 0.5, s * 0.35, 0, 0); x.fill(); x.restore();
}
function medallion(x, cx, cy, R) {                                    // the blue star in a pale double ring
  x.fillStyle = FIELD; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
  x.strokeStyle = LINE; x.lineWidth = 3; x.stroke(); x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, R - 7, 0, Math.PI * 2); x.stroke();
  const g = x.createRadialGradient(cx - R * 0.18, cy - R * 0.22, 2, cx, cy, R * 0.7);
  g.addColorStop(0, '#c8d6f0'); g.addColorStop(0.45, '#7d97c9'); g.addColorStop(1, '#3e5b94');
  star(x, cx, cy, R * 0.66, 0.44); x.fillStyle = g; x.fill();
}

function wear(x, W, H, r) {
  const v = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
  v.addColorStop(0, 'rgba(60,40,15,0)'); v.addColorStop(1, 'rgba(70,45,15,.58)'); x.fillStyle = v; x.fillRect(0, 0, W, H);   // darker, handled edges
  for (let i = 0; i < 1400; i++) { x.fillStyle = r() < 0.6 ? `rgba(40,28,12,${r() * 0.18})` : `rgba(255,245,220,${r() * 0.12})`; x.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
  x.lineWidth = 0.8;
  for (let i = 0; i < 30; i++) {                                      // faint scratches
    x.strokeStyle = `rgba(255,240,210,${0.06 + r() * 0.1})`; const sx = r() * W, sy = r() * H, a = r() * Math.PI, l = 20 + r() * 90;
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); x.stroke();
  }
  for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]]) {        // rubbed corners
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, 46); g.addColorStop(0, 'rgba(250,235,200,.35)'); g.addColorStop(1, 'rgba(250,235,200,0)');
    x.fillStyle = g; x.fillRect(cx - 46, cy - 46, 92, 92);
  }
}

export function drawBack(x, W, H) {
  const r = rng(77), fx = RIM, fy = RIM, fw = W - RIM * 2, fh = H - RIM * 2;
  x.clearRect(0, 0, W, H);
  x.save();
  x.beginPath(); x.roundRect(0, 0, W, H, 24); x.clip();
  x.fillStyle = '#f6f3ec'; x.fillRect(0, 0, W, H);
  x.save(); x.beginPath(); x.roundRect(fx, fy, fw, fh, 6); x.clip();
  x.fillStyle = FIELD; x.fillRect(fx, fy, fw, fh);
  x.strokeStyle = 'rgba(200,214,240,.28)'; x.lineWidth = 1;          // the fine diagonal lattice
  for (let d = -H; d < W + H; d += 12) {
    x.beginPath(); x.moveTo(d, 0); x.lineTo(d + H, H); x.moveTo(d, H); x.lineTo(d + H, 0); x.stroke();
  }
  x.strokeStyle = LINE; x.lineWidth = 1.5;                            // a double frame inside the field
  x.strokeRect(fx + 9, fy + 9, fw - 18, fh - 18); x.strokeRect(fx + 14, fy + 14, fw - 28, fh - 28);
  x.lineWidth = 2; x.fillStyle = LINE;                                // scrollwork drawn once, mirrored into all four corners
  const orn = [];
  for (let i = 0; i < 14; i++) orn.push([30 + r() * (W / 2 - 60), 34 + r() * (H / 2 - 70), 10 + r() * 12, r() * Math.PI * 2]);
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    x.save(); x.beginPath(); x.rect(fx + 17, fy + 17, fw - 34, fh - 34); x.clip();   // inside the frame
    x.translate(W / 2, H / 2); x.scale(sx, sy); x.translate(-W / 2, -H / 2);
    for (const [cx, cy, s2, rot] of orn) {
      if (Math.hypot(cx - W / 2, cy - H / 2) < W * 0.34) continue;   // keep clear of the medallion
      x.strokeStyle = LINE; curl(x, cx, cy, s2, rot); leaf(x, cx + s2, cy - s2, s2 * 0.9, rot);
    }
    star(x, fx + 34, fy + 34, 9); x.fill();                           // corner stars
    x.restore();
  }
  x.lineWidth = 2; x.beginPath(); x.arc(W / 2, H / 2, W * 0.31, 0, Math.PI * 2); x.stroke();
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; leaf(x, W / 2 + Math.cos(a) * W * 0.31, H / 2 + Math.sin(a) * W * 0.31, 13, a); }
  medallion(x, W / 2, H / 2, W * 0.25);
  x.restore();
  wear(x, W, H, r);
  x.restore();
}

// ── front: the real thing — a screenshot, the name, one line of impact, what clicking does ──
// emblems drawn in code, in the star's denim blue on the plain cream face: LinkedIn's "in" monogram, GitHub's mark
// (the path from Simple Icons, CC0; 24 × 24), and this site's denim star ringed by the name
const GITHUB = new Path2D('M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12');
function arcText(x, text, cx, cy, r, top) {                         // letters round a circle: over the top, or under it
  const ws = [...text].map((c) => x.measureText(c).width), total = ws.reduce((a, b) => a + b, 0) / r;
  let a = top ? -Math.PI / 2 - total / 2 : Math.PI / 2 + total / 2;
  [...text].forEach((c, k) => {
    const step = ws[k] / r, m = a + (top ? step / 2 : -step / 2);
    x.save(); x.translate(cx + Math.cos(m) * r, cy + Math.sin(m) * r); x.rotate(top ? m + Math.PI / 2 : m - Math.PI / 2);
    x.fillText(c, -ws[k] / 2, 0); x.restore();
    a += top ? step : -step;
  });
}
const denim = (x, cx, cy, R) => {                                   // the star's blue: light top-left, deep bottom-right
  const g = x.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  g.addColorStop(0, '#7d97c9'); g.addColorStop(1, '#3e5b94'); return g;
};
function panel(x, art, ix, iy, iw, ih, img) {                       // plain cream, the emblem in denim
  x.fillStyle = CREAM; x.fillRect(ix, iy, iw, ih);
  const cx = ix + iw / 2, cy = iy + ih / 2;
  if (art === 'linkedin') {
    const s = ih * 0.62;
    x.fillStyle = denim(x, cx, cy, s / 2); x.beginPath(); x.roundRect(cx - s / 2, cy - s / 2, s, s, s * 0.17); x.fill();
    x.fillStyle = CREAM; x.font = `700 ${s * 0.64}px "Instrument Sans", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('in', cx, cy + s * 0.04); x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  } else if (art === 'github') {
    const s = ih * 0.66 / 24;
    x.save(); x.translate(cx - 12 * s, cy - 12 * s); x.scale(s, s); x.fillStyle = denim(x, 12, 12, 12); x.fill(GITHUB); x.restore();
  } else if (art === 'website') {
    const R = ih * 0.3;                                       // the name hugs the star
    if (img) { const s = ih * 0.46; x.drawImage(img, cx - s / 2, cy - s / 2, s, s); }
    x.fillStyle = '#3e5b94'; x.font = '600 30px Fraunces, Georgia, serif'; x.textBaseline = 'middle';
    if ('letterSpacing' in x) x.letterSpacing = '3px';
    arcText(x, 'NEHEMIAS', cx, cy, R, true); arcText(x, 'LANDAVERDE', cx, cy, R, false);
    if ('letterSpacing' in x) x.letterSpacing = '0px';
    x.textBaseline = 'alphabetic';
  }
}
// simple faces: the picture (or emblem), the title, and what clicking does
export function drawFront(x, W, H, { name, img, fit = 'cover', resume, link, art, fade }, seed) {
  const r = rng(seed + 1);
  x.clearRect(0, 0, W, H);
  x.save();
  x.beginPath(); x.roundRect(0, 0, W, H, 24); x.clip();
  x.fillStyle = CREAM; x.fillRect(0, 0, W, H);
  const ix = 24, iy = 26, iw = W - 48, ih = H * 0.68;                 // the picture window
  x.save(); x.beginPath(); x.roundRect(ix, iy, iw, ih, 10); x.clip();
  x.fillStyle = '#e9e1cf'; x.fillRect(ix, iy, iw, ih);
  if (art) panel(x, art, ix, iy, iw, ih, img);
  else if (img) {
    const s2 = Math.max(iw / img.width, ih / img.height), w = img.width * s2, h = img.height * s2;
    x.drawImage(img, fit === 'right' ? ix + (iw - w) * 0.85 : ix + (iw - w) / 2, fit === 'top' ? iy : iy + (ih - h) / 2, w, h);
  }
  if (fade) for (const [x0, y0, x1, y1] of [[ix, 0, ix + 46, 0], [ix + iw, 0, ix + iw - 46, 0], [0, iy, 0, iy + 46], [0, iy + ih, 0, iy + ih - 70]]) {
    const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, CREAM); g.addColorStop(1, 'rgba(245,239,227,0)');   // edges melt into the card
    x.fillStyle = g; x.fillRect(ix, iy, iw, ih);
  }
  x.restore();
  if (!fade && !art) { x.strokeStyle = 'rgba(42,47,58,.35)'; x.lineWidth = 2; x.beginPath(); x.roundRect(ix, iy, iw, ih, 10); x.stroke(); }
  x.fillStyle = INK; x.font = '600 46px Fraunces, Georgia, serif'; x.fillText(name, 28, iy + ih + 66);
  x.fillStyle = resume ? '#a23a22' : NAVY; x.font = '500 18px "IBM Plex Mono", ui-monospace, monospace';
  x.fillText(resume ? 'DOWNLOAD ↓' : link ? 'VISIT ↗' : 'OPEN →', 28, H - 32);
  x.strokeStyle = denim(x, W / 2, H / 2, H / 2); x.lineWidth = 2.5;   // a denim line tracing just inside the edge
  x.beginPath(); x.roundRect(11, 11, W - 22, H - 22, 15); x.stroke();
  wear(x, W, H, r);
  x.restore();
}
