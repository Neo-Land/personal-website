// Card faces for the rooftop scene, drawn in code (no image downloads).
// drawBack: one original playing-card back (navy + gold, the denim star in a medallion), symmetric like a real deck.
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

export function drawBack(x, W, H) {
  x.clearRect(0, 0, W, H);
  x.save();
  x.beginPath(); x.roundRect(0, 0, W, H, 26); x.clip();
  x.fillStyle = CREAM; x.fillRect(0, 0, W, H);                          // white rim like a real card
  x.fillStyle = NAVY; x.beginPath(); x.roundRect(16, 16, W - 32, H - 32, 16); x.fill();
  // fine gold lattice inside a double frame
  x.save(); x.beginPath(); x.roundRect(30, 30, W - 60, H - 60, 10); x.clip();
  x.strokeStyle = 'rgba(217,178,95,.28)'; x.lineWidth = 1.5;
  for (let d = -H; d < W + H; d += 22) {
    x.beginPath(); x.moveTo(d, 0); x.lineTo(d + H, H); x.stroke();
    x.beginPath(); x.moveTo(d, H); x.lineTo(d + H, 0); x.stroke();
  }
  x.restore();
  x.strokeStyle = GOLD; x.lineWidth = 3; x.beginPath(); x.roundRect(30, 30, W - 60, H - 60, 10); x.stroke();
  x.lineWidth = 1.2; x.beginPath(); x.roundRect(40, 40, W - 80, H - 80, 7); x.stroke();
  // centre medallion with the denim star
  const cx = W / 2, cy = H / 2, R = W * 0.26;
  x.fillStyle = NAVY; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
  x.strokeStyle = GOLD; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, R - 9, 0, Math.PI * 2); x.stroke();
  for (let i = 0; i < 24; i++) {                                        // tick marks round the ring
    const a = i * Math.PI / 12; x.beginPath();
    x.moveTo(cx + Math.cos(a) * (R - 9), cy + Math.sin(a) * (R - 9)); x.lineTo(cx + Math.cos(a) * (R - 18), cy + Math.sin(a) * (R - 18)); x.stroke();
  }
  const g = x.createRadialGradient(cx - R * 0.15, cy - R * 0.2, 2, cx, cy, R * 0.6);
  g.addColorStop(0, '#a9bbd6'); g.addColorStop(0.5, DENIM); g.addColorStop(1, '#1c3560');
  star(x, cx, cy, R * 0.6); x.fillStyle = g; x.fill(); x.strokeStyle = GOLD; x.lineWidth = 2; x.stroke();
  // little stars top and bottom, mirrored
  for (const y of [H * 0.17, H * 0.83]) { star(x, cx, y, 16); x.fillStyle = GOLD; x.fill(); }
  for (const [px, py] of [[62, 62], [W - 62, 62], [62, H - 62], [W - 62, H - 62]]) { star(x, px, py, 8); x.fillStyle = GOLD; x.fill(); }
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
  x.restore();
}
