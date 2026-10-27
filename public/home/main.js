// The rooftop home page: Neo on the ledge at golden hour, Manhattan across the river, cards fanned round him.
// Clicking a card glides the camera over, stands Neo up, flies the card up front and slides in its info panel;
// LinkedIn and GitHub open the profiles, the Résumé downloads.
//
// This file is the page logic: camera poses, opening/closing a card, input, the opening reveal and the frame loop.
// The scene itself lives in the other modules in this folder:
//   stage.js     renderer, scene, camera, shared constants and easing
//   look.js      the cinematic pass (bloom, depth of field, grade)
//   sky.js       the sunset sky and the lights
//   river.js     the cliff, the river and the paper boats
//   city.js      the baked rooftop, Manhattan's shore and the skyline
//   neo.js       Neo: loading, standing up and sitting down
//   cards.js     the cards: meshes, layout, hover and fly-in
//   card-art.js  drawing the card faces
// Debugging: ?perf shows fps / draw calls / memory; ?look=off renders without the cinematic pass.
import * as THREE from 'three';
import { renderer, scene, camera, still, params, SUN, NEO, ease, easeIO, clamp01 } from './stage.js';
import { resizeLook, renderWithLook } from './look.js';
import { updateSky } from './sky.js';
import { updateRiver } from './river.js';
import { cityReady } from './city.js';
import { neoReady, stand, updateNeo } from './neo.js';
import { buttons, cards, layoutCards, pickCard, updateCards, CARD_WIDTH } from './cards.js';

const info = document.getElementById('info'), infoBody = document.getElementById('d-body'), backButton = document.getElementById('back');

// ── camera poses: start (the reveal begins here), home (Neo centred, the arc round him), focus (Neo left, card up front,
// info on the right); set per screen shape in size() ──
const pose = { start: { p: new THREE.Vector3(), l: new THREE.Vector3(), fov: 50 },   // p: position, l: look-at point
  home: { p: new THREE.Vector3(), l: new THREE.Vector3(), fov: 55 }, focus: { p: new THREE.Vector3(), l: new THREE.Vector3(), fov: 40 } };
let phone = false, sitYaw = 0;

function size() {
  renderer.setSize(innerWidth, innerHeight, false);
  resizeLook();
  camera.aspect = innerWidth / innerHeight; phone = camera.aspect < 0.8;
  if (phone) {                                                      // portrait: Neo and his cards centred, the city behind
    pose.home.p.set(2.0, 1.85, 0.3); pose.home.l.set(0.55, 1.0, -4.4); pose.home.fov = 60;
    pose.focus.p.set(1.9, 1.75, -1.0); pose.focus.l.set(0.95, 1.4, -4.6); pose.focus.fov = 55;
  } else {
    pose.home.p.set(2.3, 1.95, -1.3); pose.home.l.set(-0.5, 0.75, -10.5); pose.home.fov = 55;   // high, behind him: river + city below the sun
    pose.focus.p.set(2.3, 1.4, -2.0); pose.focus.l.set(1.35, 1.15, -4.7); pose.focus.fov = 40; // Neo ends up left of frame
  }
  // the cards scale with how much width the camera sees at Neo's distance: same shape everywhere, smaller on narrow screens
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(pose.home.fov / 2)) * camera.aspect);
  const viewW = 2 * pose.home.p.distanceTo(NEO) * Math.tan(hfov / 2);
  sitYaw = Math.atan2(pose.home.p.x - NEO.x, pose.home.p.z - NEO.z);   // sitting, Neo (and the arc) face you
  layoutCards(sitYaw, Math.min(0.7, (viewW * (phone ? 0.12 : 0.09)) / CARD_WIDTH));   // bigger on phones, so the titles read
  // the reveal starts higher, further back and looking up toward the sun over the skyline, then cranes down to him
  pose.start.p.copy(pose.home.p).add(phone ? new THREE.Vector3(2.5, 3.5, 6) : new THREE.Vector3(4, 3.2, 7));
  pose.start.l.copy(SUN).multiplyScalar(700).add(new THREE.Vector3(0, 30, 0)); pose.start.fov = phone ? 66 : 48;
}
// where the opened card floats: in front of the focus camera, a bit right of centre (high on phones, clear of the sheet)
const focusSpot = () => {
  const p = pose.focus.p, fwd = pose.focus.l.clone().sub(p).normalize(), right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
  return p.clone().addScaledVector(fwd, 1.8).addScaledVector(right, phone ? 0 : -0.1).addScaledVector(camera.up, phone ? 0.34 : 0.02);
};

// ── opening reveal: black until the world, Neo and the shaders are ready (no pop-in), then the camera cranes down and
// the cards pop in (skipped under reduced motion) ──
const REVEAL = 4.6, POP_AT = REVEAL * 0.72;                         // seconds: the whole reveal, when the cards start arriving
const fade = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'fade' }));
document.body.classList.add('arriving');
let revealT = still ? REVEAL + 9 : 0, revealing = false, begun = false;
function begin() {
  if (begun) return;
  begun = true;
  renderer.compileAsync(scene, camera).catch(() => {}).then(() => { revealing = true; fade.classList.add('out'); });
}
Promise.all([cityReady, neoReady]).then(begin, () => {});
setTimeout(begin, 8000);                                            // a slow or failed download never leaves you on black
function skipReveal() { if (revealing && revealT < REVEAL + 1) revealT = REVEAL + 1; }
for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, skipReveal, { passive: true });

// ── opening and closing a card ──
let hovered = -1, keyboard = -1, focused = -1;                      // card indices (-1: none)
let t01 = 0, dir = 0;                                               // camera move: 0 home … 1 focus; dir +1 / -1 while moving
const flyFrom = new THREE.Vector3();
function open(i) {
  skipReveal();
  if (focused >= 0 && focused !== i) { focused = i; fillInfo(i); return; }   // already up: just swap the card
  focused = i; dir = 1; flyFrom.copy(cards[i].position);
  fillInfo(i); stand(true);
  document.body.classList.add('focused');
  info.hidden = false;
  setTimeout(() => backButton.focus({ preventScroll: true }), 50);
}
function fillInfo(i) {                                              // the card's <template id="d-…"> from index.html
  infoBody.replaceChildren(document.getElementById(`d-${buttons[i].dataset.d}`).content.cloneNode(true));
  const mail = infoBody.querySelector('[data-mail]');
  if (mail) mail.href = `mailto:${['nehe.landav', 'gmail.com'].join('@')}`;   // assembled here, so it's not in the page for harvesters
}
function close() {
  if (focused < 0 || dir === -1) return;
  dir = -1; stand(false);
  document.body.classList.remove('focused');
  info.hidden = true;
  buttons[focused].focus({ preventScroll: true });
}
const follow = (attrs) => Object.assign(document.createElement('a'), attrs).click();
function act(i) {                                                   // what clicking a card does
  const b = buttons[i];
  if (b.dataset.href) { skipReveal(); follow({ href: b.dataset.href, target: '_blank', rel: 'noopener' }); return; }   // LinkedIn, GitHub
  if (b.dataset.d === 'resume') { skipReveal(); follow({ href: 'Nehemias-Landaverde-Resume.pdf', download: 'Nehemias-Landaverde-Resume.pdf' }); return; }
  open(i);
}

// ── input ──
backButton.addEventListener('click', close);
addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
buttons.forEach((b, i) => {
  b.addEventListener('click', () => act(i));
  b.addEventListener('focus', () => (keyboard = i)); b.addEventListener('blur', () => (keyboard = -1));
});
const pick = (e) => (revealT < POP_AT ? -1 : pickCard(e));          // no clicking cards before they've arrived
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  hovered = pick(e); renderer.domElement.style.cursor = hovered >= 0 ? 'pointer' : '';
});
renderer.domElement.addEventListener('click', (e) => { const i = pick(e); if (i >= 0) act(i); else close(); });
const drift = new THREE.Vector2(), driftNow = new THREE.Vector2();  // the camera drifts a little with the mouse
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') drift.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5); });

// ── ?perf readout ──
const perfEl = document.getElementById('perf'), PERF = params.has('perf');
perfEl.hidden = !PERF;
let frames = 0, perfTime = 0;
function showPerf(dt) {
  frames++; perfTime += dt;
  if (perfTime < 0.5) return;
  const r = renderer.info, mem = performance.memory ? ` · heap ${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB` : '';
  perfEl.textContent = `${Math.round(frames / perfTime)} fps · ${r.render.calls} calls · ${(r.render.triangles / 1000).toFixed(0)}k tris\n` +
    `${r.memory.geometries} geometries · ${r.memory.textures} textures${mem}`;
  frames = 0; perfTime = 0;
}

// ── each frame ──
const homeP = new THREE.Vector3(), homeL = new THREE.Vector3(), lookAt = new THREE.Vector3();
function placeCamera(dt, t, k) {
  // home pose + a gentle drift with the mouse and a slow breath; during the reveal, blended in from the start pose
  homeP.copy(pose.home.p); homeL.copy(pose.home.l);
  if (!still) {
    driftNow.lerp(drift, 1 - Math.exp(-dt * 2.5));
    homeP.x += driftNow.x * 0.35; homeP.y += -driftNow.y * 0.18 + Math.sin(t * 0.35) * 0.025;
  }
  let fov = pose.home.fov;
  if (revealT < REVEAL) {
    const r = revealT / REVEAL, e = easeIO(r), e2 = easeIO(clamp01((r - 0.18) / 0.82));   // position leads, the tilt down follows
    homeP.lerpVectors(pose.start.p, homeP.clone(), e); homeL.lerpVectors(pose.start.l, homeL.clone(), e2);
    fov = pose.start.fov + (fov - pose.start.fov) * e;
  }
  camera.position.lerpVectors(homeP, pose.focus.p, k);              // then toward the focus pose as a card opens
  camera.fov = fov + (pose.focus.fov - fov) * k; camera.updateProjectionMatrix();
  camera.lookAt(lookAt.lerpVectors(homeL, pose.focus.l, k));
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  renderer.info.reset();
  if (dir) {                                                        // the camera move between home and an open card
    t01 = clamp01(t01 + dir * dt / (still ? 0.01 : 1.2));
    if (t01 === 0 || t01 === 1) { if (t01 === 0) focused = -1; dir = 0; }
  }
  const k = ease(t01);
  if (revealing) revealT += dt;
  if (revealT >= REVEAL) document.body.classList.remove('arriving');

  placeCamera(dt, t, k);
  updateSky(still ? 0 : t, k);
  updateRiver(dt, t, !still);
  updateNeo(dt, k, sitYaw, Math.atan2(pose.focus.p.x - NEO.x, pose.focus.p.z - NEO.z));   // standing, he turns to face you
  updateCards(dt, { revealT, popAt: POP_AT, highlighted: focused < 0 ? (hovered >= 0 ? hovered : keyboard) : -1,
    focused, flyFrom, dir, t01, k, spot: focusSpot(), phone });
  renderWithLook(dt, t, k, phone);
  if (PERF) showPerf(dt);
});
size();
addEventListener('resize', size);
