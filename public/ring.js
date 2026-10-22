// Ring: the cards orbit sitting Neo, and the inner ring names each card at the same angle (flipped on the lower
// half so it never reads upside down). Drag, scroll or arrow keys spin it; it drifts slowly on its own unless the
// visitor prefers reduced motion. Clicking a card opens its details from the matching <template>.
const ring = document.getElementById('ring'), svg = ring.querySelector('.labels');
const cards = [...ring.querySelectorAll('.card')], items = cards.map((c) => c.parentElement);
const N = cards.length, STEP = 360 / N, NS = 'http://www.w3.org/2000/svg';
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const R_CARD = 0.4, R_LABEL = 270, ARC = 40;          // card orbit (× ring size); label track (viewBox units); half-arc per label (deg)
const DRIFT = still ? 0 : 5;                            // deg/s when nobody is touching it
const rad = (d) => d * Math.PI / 180, norm = (d) => ((d % 360) + 540) % 360 - 180;   // → (-180, 180]

// inner ring: a faint dotted track + one text-on-a-path per card
svg.innerHTML = `<circle r="${R_LABEL}"/>` + cards.map((c, i) =>
  `<path id="lp${i}" fill="none"/><text><textPath href="#lp${i}" startOffset="50%" text-anchor="middle">${c.dataset.label}</textPath></text>`).join('');
const paths = [...svg.querySelectorAll('path')], texts = [...svg.querySelectorAll('text')];
for (const c of cards) c.setAttribute('aria-label', c.dataset.label);

let D = 0, rot = 0, spin = DRIFT, target = null, hover = -1, drag = null, last = performance.now();
function size() {
  const phone = innerWidth <= 700;
  D = phone ? Math.min(innerWidth - 24, innerHeight * 0.62)
    : Math.min(innerWidth * (innerWidth <= 1100 ? 0.56 : 0.62), innerHeight - 110);   // narrower: leave room for the intro (CSS moves it right)
  ring.style.setProperty('--D', `${D}px`);
}
function place() {
  for (let i = 0; i < N; i++) {
    const a = rot + i * STEP, s = Math.sin(rad(a)), c = Math.cos(rad(a));
    items[i].style.transform = `translate(-50%, -50%) translate(${s * R_CARD * D}px, ${-c * R_CARD * D}px) rotate(${s * 8}deg)`;
    // label arc: clockwise over the top half; on the bottom half run it the other way, a little further out,
    // so the letters stay upright and still sit on the same track
    const top = c >= 0, r = top ? R_LABEL - 8 : R_LABEL + 14, p = (t) => `${(r * Math.sin(rad(t))).toFixed(1)} ${(-r * Math.cos(rad(t))).toFixed(1)}`;
    paths[i].setAttribute('d', top ? `M ${p(a - ARC)} A ${r} ${r} 0 0 1 ${p(a + ARC)}` : `M ${p(a + ARC)} A ${r} ${r} 0 0 0 ${p(a - ARC)}`);
  }
}
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (!drag) {
    if (target !== null) {                              // gliding a focused card to the top
      rot += still ? target - rot : (target - rot) * Math.min(1, dt * 6);
      if (Math.abs(target - rot) < 0.05) target = null;
    } else {
      const want = hover >= 0 ? 0 : DRIFT;              // pause under the pointer, otherwise ease back to the drift
      spin += (want - spin) * Math.min(1, dt * (still ? 20 : 1.5));
      rot += spin * dt;
    }
  }
  place();
  requestAnimationFrame(frame);
}
function light(i) {
  hover = i;
  cards.forEach((c, j) => c.classList.toggle('lit', j === i));
  texts.forEach((t, j) => t.classList.toggle('lit', j === i));
}

// drag to spin (by the angle swept around the centre), with a little momentum on release
const angleAt = (e) => { const b = ring.getBoundingClientRect(); return Math.atan2(e.clientX - b.left - b.width / 2, -(e.clientY - b.top - b.height / 2)) * 180 / Math.PI; };
ring.addEventListener('pointerdown', (e) => {
  drag = { a: angleAt(e), t: performance.now(), moved: 0, id: e.pointerId };
  target = null;
});
addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const a = angleAt(e), d = norm(a - drag.a), now = performance.now();
  if (Math.abs(d) > 0 && (drag.moved += Math.abs(d)) > 3 && !ring.hasPointerCapture(e.pointerId)) ring.setPointerCapture(e.pointerId);
  rot += d; spin = still ? 0 : d / Math.max((now - drag.t) / 1000, 0.008);
  drag.a = a; drag.t = now;
});
addEventListener('pointerup', () => { if (drag) setTimeout(() => (drag = null)); });   // after the click handler has seen it
addEventListener('pointercancel', () => (drag = null));
ring.addEventListener('wheel', (e) => { e.preventDefault(); target = null; spin += e.deltaY * (still ? 0 : 0.8); if (still) rot += e.deltaY * 0.1; }, { passive: false });

for (const [i, c] of cards.entries()) {
  c.addEventListener('pointerenter', () => light(i));
  c.addEventListener('pointerleave', () => light(-1));
  c.addEventListener('focus', () => { light(i); target = rot + norm(-(rot + i * STEP)); });   // bring it to the top
  c.addEventListener('blur', () => light(-1));
  c.addEventListener('keydown', (e) => {
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (k) { e.preventDefault(); cards[(i + k + N) % N].focus(); }
  });
  c.addEventListener('click', () => { if (!drag || drag.moved <= 3) open(c.dataset.d); });
}

// details
const dialog = document.getElementById('detail'), body = document.getElementById('d-body');
function open(id) {
  body.replaceChildren(document.getElementById(`d-${id}`).content.cloneNode(true));
  const mail = body.querySelector('[data-mail]');
  if (mail) mail.href = `mailto:${['nehe.landav', 'gmail.com'].join('@')}`;   // assembled here so harvesters scanning the HTML miss it
  dialog.showModal();
}
dialog.querySelector('.x').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });   // backdrop

ring.classList.add('on');
size(); place();
addEventListener('resize', size);
requestAnimationFrame(frame);
