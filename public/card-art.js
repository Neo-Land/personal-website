// Card faces for the rooftop scene, drawn in code (no image downloads).
// drawBack: five original, aged playing-card backs in one family (cream rim, worn navy, gold engraving, the blue star).
// drawFront: cream paper with a small hand-drawn sketch of the topic, its category on top and its name below.

const INK = '#2a2f3a', GOLD = '#d9b25f', CREAM = '#f5efe3', NAVY = '#1b2744', DENIM = '#5b77a3';

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

// ── backs: five designs in one family (worn cream rim, navy, gold engraving, the blue star) ──
export const BACKS = 5;
const RIM = 20;                                                       // the cream border

function suit(x, kind, cx, cy, s) {                                   // card suits as filled paths, size s
  x.save(); x.translate(cx, cy); x.scale(s, s); x.beginPath();
  if (kind === 'heart') { x.moveTo(0, 0.38); x.bezierCurveTo(-0.62, -0.08, -0.36, -0.62, 0, -0.24); x.bezierCurveTo(0.36, -0.62, 0.62, -0.08, 0, 0.38); }
  else if (kind === 'diamond') { x.moveTo(0, -0.5); x.lineTo(0.34, 0); x.lineTo(0, 0.5); x.lineTo(-0.34, 0); x.closePath(); }
  else if (kind === 'spade') {
    x.moveTo(0, -0.46); x.bezierCurveTo(-0.62, 0.02, -0.34, 0.46, 0, 0.16); x.bezierCurveTo(0.34, 0.46, 0.62, 0.02, 0, -0.46);
    x.moveTo(0, 0.08); x.lineTo(0.14, 0.48); x.lineTo(-0.14, 0.48); x.closePath();
  } else {                                                            // club
    for (const [a, b] of [[0, -0.22], [-0.22, 0.08], [0.22, 0.08]]) { x.moveTo(a + 0.2, b); x.arc(a, b, 0.2, 0, Math.PI * 2); }
    x.moveTo(0, 0.05); x.lineTo(0.13, 0.48); x.lineTo(-0.13, 0.48); x.closePath();
  }
  x.fill(); x.restore();
}
function curl(x, cx, cy, r, rot, flip = 1) {                          // one engraved scroll: a spiral with a sweeping tail
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(flip, 1); x.beginPath();
  for (let t = 0; t <= 1.0001; t += 0.025) { const a = t * Math.PI * 2.3, rr = r * (1 - t * 0.82); t ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  x.moveTo(r, 0); x.bezierCurveTo(r * 1.6, r * 0.5, r * 2.4, -r * 0.2, r * 3, -r * 1.1);
  x.stroke(); x.restore();
}
function leaf(x, cx, cy, s, rot) {                                    // a small engraved leaf
  x.save(); x.translate(cx, cy); x.rotate(rot); x.beginPath();
  x.moveTo(0, 0); x.quadraticCurveTo(s * 0.5, -s * 0.35, s, 0); x.quadraticCurveTo(s * 0.5, s * 0.35, 0, 0); x.fill(); x.restore();
}
function flourish(x, cx, cy, s, rot, flip = 1) {                      // corner ornament: curls + leaves
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(flip, 1);
  curl(x, 0, 0, s * 0.32, 0); curl(x, s * 0.55, s * 0.7, s * 0.22, Math.PI * 0.6, -1);
  for (let i = 0; i < 4; i++) leaf(x, s * (0.25 + i * 0.22), -s * (0.1 + i * 0.12), s * 0.22, -0.6 + i * 0.25);
  x.restore();
}
function medallion(x, cx, cy, R, fill) {                              // the blue star in a gold ring
  x.fillStyle = fill; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
  x.strokeStyle = GOLD; x.lineWidth = 3; x.stroke(); x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, R - 7, 0, Math.PI * 2); x.stroke();
  const g = x.createRadialGradient(cx - R * 0.18, cy - R * 0.22, 2, cx, cy, R * 0.7);
  g.addColorStop(0, '#c8d6f0'); g.addColorStop(0.45, '#7d97c9'); g.addColorStop(1, '#3e5b94');
  star(x, cx, cy, R * 0.66, 0.44); x.fillStyle = g; x.fill();
}

// the shared card: yellowed rim, a navy field, then wear over everything (grime, rubbed edges, scratches)
function cardBase(x, W, H, r) {
  x.fillStyle = '#dcc596'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {                                      // mottled, uneven ageing on the rim
    const gx = r() * W, gy = r() * H, gr = 10 + r() * 50, g = x.createRadialGradient(gx, gy, 0, gx, gy, gr);
    g.addColorStop(0, `rgba(${120 + r() * 40},${90 + r() * 30},${40 + r() * 20},${0.05 + r() * 0.12})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }
  x.fillStyle = NAVY; x.beginPath(); x.roundRect(RIM, RIM, W - RIM * 2, H - RIM * 2, 12); x.fill();
  for (let i = 0; i < 40; i++) {                                      // worn, lighter blotches in the navy
    const gx = RIM + r() * (W - RIM * 2), gy = RIM + r() * (H - RIM * 2), gr = 20 + r() * 70, g = x.createRadialGradient(gx, gy, 0, gx, gy, gr);
    g.addColorStop(0, `rgba(150,160,190,${0.03 + r() * 0.05})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }
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

const DESIGNS = [
  function panel(x, W, H, r) {                                        // gold corner flourishes, little suits, a gold fleur panel
    x.fillStyle = GOLD; x.strokeStyle = GOLD; x.lineWidth = 2.2;
    flourish(x, RIM + 34, RIM + 40, 70, 0); flourish(x, W - RIM - 34, RIM + 40, 70, 0, -1);
    flourish(x, RIM + 34, H - RIM - 40, 70, 0, 1); x.save(); x.translate(W, H); x.rotate(Math.PI); flourish(x, RIM + 34, RIM + 40, 70, 0); x.restore();
    star(x, RIM + 28, RIM + 30, 14); x.fillStyle = '#7d97c9'; x.fill();
    x.fillStyle = GOLD; suit(x, 'heart', W - RIM - 30, RIM + 30, 26); suit(x, 'club', RIM + 30, H - RIM - 30, 26);
    const px = W * 0.22, py = H * 0.2, pw = W * 0.56, ph = H * 0.6;
    const g = x.createLinearGradient(px, py, px + pw, py + ph); g.addColorStop(0, '#d9b766'); g.addColorStop(0.5, '#c7a050'); g.addColorStop(1, '#a9843e');
    x.fillStyle = g; x.fillRect(px, py, pw, ph);
    x.fillStyle = 'rgba(120,85,30,.45)';
    for (let yy = py + 22; yy < py + ph - 10; yy += 34) for (let xx = px + 20 + ((yy - py) / 34 % 2) * 18; xx < px + pw - 10; xx += 36) suit(x, 'spade', xx, yy, 14);   // fleur-ish pattern
    x.strokeStyle = '#f0d898'; x.lineWidth = 2; x.strokeRect(px, py, pw, ph);
  },
  function ornate(x, W, H, r) {                                        // dense scrollwork round a big star medallion
    x.strokeStyle = GOLD; x.fillStyle = GOLD; x.lineWidth = 2;
    for (let i = 0; i < 26; i++) {                                    // mirrored left/right
      const cx = RIM + 20 + r() * (W / 2 - RIM - 30), cy = RIM + 30 + r() * (H - RIM * 2 - 60), s = 12 + r() * 16, rot = r() * Math.PI * 2;
      if (Math.hypot(cx - W / 2, cy - H / 2) < W * 0.3) continue;
      curl(x, cx, cy, s, rot); curl(x, W - cx, cy, s, Math.PI - rot, -1);
      leaf(x, cx + s, cy - s, s * 0.9, rot); leaf(x, W - cx - s, cy - s, s * 0.9, Math.PI - rot);
    }
    x.lineWidth = 2.5; x.beginPath(); x.arc(W / 2, H / 2, W * 0.3, 0, Math.PI * 2); x.stroke();
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; leaf(x, W / 2 + Math.cos(a) * W * 0.3, H / 2 + Math.sin(a) * W * 0.3, 14, a); }
    medallion(x, W / 2, H / 2, W * 0.25, NAVY);
    for (const [px, py] of [[RIM + 24, RIM + 24], [W - RIM - 24, RIM + 24], [RIM + 24, H - RIM - 24], [W - RIM - 24, H - RIM - 24]]) { star(x, px, py, 10); x.fillStyle = GOLD; x.fill(); }
  },
  function ace(x, W, H, r) {                                           // plain worn navy, an ace index, the gold coin
    x.fillStyle = GOLD; x.font = '600 50px Georgia, serif'; x.textAlign = 'center';
    x.fillText('A', RIM + 30, RIM + 56); star(x, RIM + 30, RIM + 84, 13); x.fill();
    x.save(); x.translate(W - RIM - 30, H - RIM - 56); x.rotate(Math.PI); x.fillText('A', 0, 0); x.restore();
    suit(x, 'spade', W - RIM - 30, H - RIM - 98, 26); x.textAlign = 'left';
    x.strokeStyle = GOLD; x.lineWidth = 2;
    curl(x, W / 2 - 70, H / 2 - 66, 16, Math.PI * 0.9); curl(x, W / 2 + 70, H / 2 + 66, 16, -Math.PI * 0.1);
    curl(x, W / 2 + 64, H / 2 - 70, 12, Math.PI * 1.3, -1); curl(x, W / 2 - 64, H / 2 + 70, 12, Math.PI * 0.3, -1);
    const g = x.createRadialGradient(W / 2 - 18, H / 2 - 22, 6, W / 2, H / 2, 72);
    g.addColorStop(0, '#f2d98c'); g.addColorStop(0.6, '#d0a648'); g.addColorStop(1, '#8a6a2a');
    medallion(x, W / 2, H / 2, 68, g);
  },
  function sunburst(x, W, H, r) {                                      // a radial burst from one corner, rings of suits, a star disc
    const cx = W * 0.72, cy = H * 0.7;
    x.save(); x.beginPath(); x.roundRect(RIM, RIM, W - RIM * 2, H - RIM * 2, 12); x.clip();
    x.strokeStyle = GOLD; x.fillStyle = GOLD;
    for (let i = 0; i < 96; i++) { const a = i * Math.PI * 2 / 96; x.lineWidth = i % 4 ? 0.8 : 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70); x.lineTo(cx + Math.cos(a) * 640, cy + Math.sin(a) * 640); x.stroke(); }
    for (const [rad, n, kinds] of [[150, 18, ['heart', 'spade']], [250, 28, ['club', 'diamond']], [360, 40, ['spade', 'heart', 'club', 'diamond']]]) {
      x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, rad - 26, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(cx, cy, rad + 26, 0, Math.PI * 2); x.stroke();
      for (let i = 0; i < n; i++) {
        const a = i * Math.PI * 2 / n, px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
        x.fillStyle = NAVY; x.beginPath(); x.arc(px, py, 19, 0, Math.PI * 2); x.fill(); x.strokeStyle = GOLD; x.lineWidth = 1.5; x.stroke();
        x.fillStyle = GOLD; suit(x, kinds[i % kinds.length], px, py, 22);
      }
    }
    x.restore();
    medallion(x, cx, cy, 66, NAVY);
  },
  function crown(x, W, H, r) {                                         // a court card: mirrored crowns, engraved swirls, star medallions
    const half = (flipIt) => {
      x.save(); if (flipIt) { x.translate(W, H); x.rotate(Math.PI); }
      x.fillStyle = GOLD; x.strokeStyle = GOLD; x.lineWidth = 2;
      const cx = W / 2, cy = H * 0.3;
      x.beginPath(); x.moveTo(cx - 70, cy + 30); x.lineTo(cx - 80, cy - 34); x.lineTo(cx - 40, cy - 4); x.lineTo(cx, cy - 52); x.lineTo(cx + 40, cy - 4); x.lineTo(cx + 80, cy - 34); x.lineTo(cx + 70, cy + 30); x.closePath(); x.fill();
      x.fillStyle = NAVY; x.fillRect(cx - 70, cy + 12, 140, 8);
      for (const dx of [-80, 0, 80]) { x.fillStyle = GOLD; x.beginPath(); x.arc(cx + dx, dx ? cy - 40 : cy - 58, 7, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#7d97c9'; for (const dx of [-36, 0, 36]) { x.beginPath(); x.arc(cx + dx, cy + 18, 5, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = GOLD;
      for (let i = 0; i < 7; i++) { curl(x, cx - 120 + i * 40, cy + 70 + (i % 2) * 18, 13, i * 0.9); }
      medallion(x, RIM + 52, RIM + 52, 34, NAVY);
      x.restore();
    };
    half(false); half(true);
    x.strokeStyle = GOLD; x.lineWidth = 2; x.beginPath(); x.moveTo(RIM + 16, H / 2); x.lineTo(W - RIM - 16, H / 2); x.stroke();
    x.fillStyle = GOLD; suit(x, 'diamond', W / 2, H / 2, 30);
  },
];

export function drawBack(x, W, H, variant = 0) {
  const r = rng(77 + variant * 13);
  x.clearRect(0, 0, W, H);
  x.save();
  x.beginPath(); x.roundRect(0, 0, W, H, 24); x.clip();
  cardBase(x, W, H, r);
  x.save(); x.beginPath(); x.roundRect(RIM, RIM, W - RIM * 2, H - RIM * 2, 12); x.clip();
  DESIGNS[variant % DESIGNS.length](x, W, H, r);
  x.restore();
  x.strokeStyle = 'rgba(217,178,95,.7)'; x.lineWidth = 1.5; x.beginPath(); x.roundRect(RIM + 6, RIM + 6, W - RIM * 2 - 12, H - RIM * 2 - 12, 9); x.stroke();
  wear(x, W, H, r);
  x.restore();
}

// ── front: paper + sketch ──
function pen(x, r) {
  // a wobbly pen: every stroke drawn twice, slightly offset, like a quick ink sketch
  const jit = (v) => v + (r() - 0.5) * 3.2;
  const path = (pts, close) => {
    for (let pass = 0; pass < 2; pass++) {
      x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(jit(px), jit(py)) : x.moveTo(jit(px), jit(py))));
      if (close) x.closePath(); x.stroke();
    }
  };
  return {
    line: (a, b, c, d) => path([[a, b], [(a + c) / 2, (b + d) / 2], [c, d]]),
    rect: (a, b, w, h) => path([[a, b], [a + w, b], [a + w, b + h], [a, b + h]], true),
    circle: (cx, cy, rad, fill) => {
      const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20 * Math.PI * 2; pts.push([cx + Math.cos(t) * rad, cy + Math.sin(t) * rad]); }
      if (fill) { x.save(); x.fillStyle = fill; x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.fill(); x.restore(); }
      path(pts);
    },
    poly: (pts, fill) => { if (fill) { x.save(); x.fillStyle = fill; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.fill(); x.restore(); } path(pts, true); },
    path,
  };
}

const SKETCH = {
  resume(x, p, W) {                                                     // a tiny scribbled résumé page with a download arrow
    p.poly([[W * 0.3, 150], [W * 0.7, 150], [W * 0.7, 420], [W * 0.3, 420]], '#ffffff');
    x.lineWidth = 7; p.line(W * 0.35, 182, W * 0.6, 182); x.lineWidth = 2.5;
    for (let y = 214; y < 400; y += 26) {
      if ((y / 26) % 3 < 1) { x.lineWidth = 4; p.line(W * 0.35, y, W * 0.5, y); x.lineWidth = 2.5; continue; }
      p.circle(W * 0.37, y, 3); p.line(W * 0.41, y, W * (0.55 + ((y * 7) % 10) / 100), y);
    }
    x.strokeStyle = '#c0492f'; x.lineWidth = 4; p.line(W * 0.78, 330, W * 0.78, 420); p.path([[W * 0.73, 400], [W * 0.78, 425], [W * 0.83, 400]]);
  },
  hobitual(x, p, W) {                                                   // a sprout in a pot + a habit checklist
    p.poly([[W * 0.2, 330], [W * 0.42, 330], [W * 0.38, 420], [W * 0.24, 420]], '#d98a4e');
    x.strokeStyle = '#3f7a3a'; x.lineWidth = 4; p.path([[W * 0.31, 330], [W * 0.31, 240]]);
    p.poly([[W * 0.31, 270], [W * 0.2, 240], [W * 0.27, 285]], '#6fae5a'); p.poly([[W * 0.31, 255], [W * 0.44, 220], [W * 0.36, 270]], '#6fae5a');
    x.strokeStyle = INK; x.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      const y = 200 + i * 70; p.rect(W * 0.55, y, 34, 34); p.line(W * 0.55 + 46, y + 17, W * 0.85, y + 17);
      x.strokeStyle = '#3f7a3a'; x.lineWidth = 4; p.path([[W * 0.55 + 6, y + 18], [W * 0.55 + 15, y + 28], [W * 0.55 + 32, y + 2]]); x.strokeStyle = INK; x.lineWidth = 2.5;
    }
  },
  gamify(x, p, W) {                                                     // a game controller + an XP bar
    p.poly([[W * 0.22, 210], [W * 0.78, 210], [W * 0.86, 320], [W * 0.66, 320], [W * 0.6, 280], [W * 0.4, 280], [W * 0.34, 320], [W * 0.14, 320]], '#e8e2f2');
    x.lineWidth = 6; p.line(W * 0.3, 250, W * 0.3, 290); p.line(W * 0.26, 270, W * 0.34, 270); x.lineWidth = 2.5;
    p.circle(W * 0.66, 252, 9, '#c0492f'); p.circle(W * 0.74, 274, 9, '#3b6fd0');
    p.rect(W * 0.18, 370, W * 0.64, 30); x.save(); x.fillStyle = GOLD; x.fillRect(W * 0.18 + 3, 373, W * 0.42, 24); x.restore();
    x.fillStyle = INK; x.font = '700 22px ui-monospace, Menlo, monospace'; x.fillText('XP', W * 0.18, 362);
  },
  loft(x, p, W) {                                                       // a browser window with a little 3D cube and a star
    p.poly([[W * 0.16, 170], [W * 0.84, 170], [W * 0.84, 420], [W * 0.16, 420]], '#ffffff'); p.line(W * 0.16, 205, W * 0.84, 205);
    [0.21, 0.26, 0.31].forEach((f) => p.circle(W * f, 188, 5));
    const c = [W * 0.46, 330], s = 52;
    p.poly([[c[0], c[1] - s], [c[0] + s, c[1] - s / 2], [c[0], c[1]], [c[0] - s, c[1] - s / 2]], '#cfd9ee');
    p.poly([[c[0] - s, c[1] - s / 2], [c[0], c[1]], [c[0], c[1] + s], [c[0] - s, c[1] + s / 2]], '#9fb2d6');
    p.poly([[c[0], c[1]], [c[0] + s, c[1] - s / 2], [c[0] + s, c[1] + s / 2], [c[0], c[1] + s]], '#7d93bf');
    star(x, W * 0.72, 260, 22); x.fillStyle = GOLD; x.fill(); x.stroke();
  },
  award(x, p, W) {                                                      // a medal: ribbon + "3rd"
    p.poly([[W * 0.4, 150], [W * 0.5, 150], [W * 0.46, 260], [W * 0.36, 260]], '#c0492f');
    p.poly([[W * 0.5, 150], [W * 0.6, 150], [W * 0.64, 260], [W * 0.54, 260]], '#3b6fd0');
    p.circle(W * 0.5, 320, 76, '#e7bf5a'); p.circle(W * 0.5, 320, 58);
    x.fillStyle = INK; x.font = '700 48px Georgia, serif'; x.textAlign = 'center'; x.fillText('3rd', W * 0.5, 336); x.textAlign = 'left';
  },
  about(x, p, W) {                                                      // a little self-portrait: hair, shades, a hello
    p.circle(W * 0.42, 290, 70, '#f1d6c0');
    x.save(); x.fillStyle = '#6b4a30'; x.beginPath(); x.ellipse(W * 0.42, 236, 82, 38, 0, Math.PI, 0); x.fill(); x.restore();
    p.path([[W * 0.33, 236], [W * 0.38, 214], [W * 0.44, 238], [W * 0.5, 212], [W * 0.54, 240]]);
    p.poly([[W * 0.3, 282], [W * 0.4, 282], [W * 0.39, 300], [W * 0.31, 300]], '#1d1f26'); p.poly([[W * 0.45, 282], [W * 0.55, 282], [W * 0.54, 300], [W * 0.46, 300]], '#1d1f26');
    p.path([[W * 0.38, 330], [W * 0.43, 338], [W * 0.48, 330]]);
    p.poly([[W * 0.62, 170], [W * 0.88, 170], [W * 0.88, 230], [W * 0.7, 230], [W * 0.64, 254], [W * 0.66, 230], [W * 0.62, 230]], '#ffffff');
    x.fillStyle = INK; x.font = '700 30px "Marker Felt", "Chalkboard SE", "Segoe Print", cursive'; x.fillText('hi!', W * 0.68, 212);
  },
  colorstack(x, p, W) {                                                 // stacked colour blocks + </>
    [['#e2574c', 0], ['#f2a93b', 1], ['#4fa36a', 2], ['#3b6fd0', 3]].forEach(([c, i]) => p.poly([[W * (0.24 + i * 0.03), 380 - i * 52], [W * (0.62 + i * 0.03), 380 - i * 52], [W * (0.62 + i * 0.03), 424 - i * 52], [W * (0.24 + i * 0.03), 424 - i * 52]], c));
    x.fillStyle = INK; x.font = '700 40px ui-monospace, Menlo, monospace'; x.fillText('</>', W * 0.6, 200);
  },
  contact(x, p, W) {                                                    // an envelope with a star stamp
    p.poly([[W * 0.16, 210], [W * 0.84, 210], [W * 0.84, 400], [W * 0.16, 400]], '#ffffff');
    p.path([[W * 0.16, 210], [W * 0.5, 320], [W * 0.84, 210]]);
    p.rect(W * 0.68, 222, 44, 52); star(x, W * 0.68 + 22, 248, 15); x.fillStyle = '#c0492f'; x.fill();
    x.fillStyle = INK; x.font = '700 34px ui-monospace, Menlo, monospace'; x.fillText('@', W * 0.2, 390);
  },
};

export function drawFront(x, W, H, { d, name, cat }, seed) {
  const r = rng(seed + 1), p = pen(x, r);
  x.clearRect(0, 0, W, H);
  x.save();
  x.beginPath(); x.roundRect(0, 0, W, H, 26); x.clip();
  x.fillStyle = CREAM; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(120,100,70,${r() * 0.08})`; x.fillRect(r() * W, r() * H, 2, 2); }   // paper speckle
  x.strokeStyle = INK; x.lineWidth = 2; x.lineJoin = x.lineCap = 'round';
  p.rect(22, 22, W - 44, H - 44);
  x.fillStyle = '#9a6b1f'; x.font = '700 19px ui-monospace, Menlo, monospace'; x.fillText(cat.toUpperCase(), 40, 66);
  x.lineWidth = 2.5; x.strokeStyle = INK;
  (SKETCH[d] || (() => {}))(x, p, W, H);
  x.fillStyle = INK; x.font = '700 40px "Marker Felt", "Chalkboard SE", "Segoe Print", cursive';
  x.fillText(name, 40, H - 52);
  wear(x, W, H, r);                                                   // same handled look as the backs
  x.restore();
}
