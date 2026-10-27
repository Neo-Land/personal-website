// The playing cards fanned round Neo. One per <button class="card"> in index.html (the buttons are the keyboard and
// screen-reader version); faces are drawn by card-art.js. They arrive back-up after the reveal, turn over, grow
// toward you on hover, and the opened one flies up in front of the camera.
//
// Layout: all the same size on a half circle round him, each pointing outward with its bottom edge on the circle, the cards a recruiter wants (data-main: LinkedIn, Résumé, GitHub)
// across the top, the rest split down the two sides.
import * as THREE from 'three';
import { scene, camera, still, NEO, ease, easeIO, easeOutBack, clamp01 } from './stage.js';
import { drawBack, drawFront } from './card-art.js';

export const buttons = [...document.querySelectorAll('#cards .card')];

const CW = 400, CH = 560, CARD = 0.5;                               // canvas size and card width (m): poker-card proportions (5:7)
const ARC = 140;                                                    // degrees of the arc (less than a half circle: flatter)
const GAP = 0.04;                                                   // space between neighbouring cards' bottom corners (m)
const FAN = 1;                                                      // how far each card leans with the curve (1 = fully radial)
const HOVER = 1.15, LIFT = 0.1;                                     // a hovered card: bigger, and a little toward you
const CARD_LAG = 0.3;                                               // share of the camera move before the opened card sets off
const POP_GAP = 0.08, POP_LEN = 0.5;                                // seconds between cards arriving, and each arrival

// ── the card meshes ──
const faceTex = (draw) => {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const x = c.getContext('2d'); draw(x);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.redraw = () => { draw(x); t.needsUpdate = true; };
  return t;
};
const backTex = faceTex((x) => drawBack(x, CW, CH));                // one back design, shared
const cardGeo = new THREE.PlaneGeometry(CARD, CARD * CH / CW);

export const cards = buttons.map((b, i) => {
  const card = new THREE.Group(), flip = new THREE.Group(); card.add(flip);
  const face = { name: b.textContent, fit: b.dataset.fit, resume: b.dataset.d === 'resume', link: !!b.dataset.href, art: b.dataset.art, fade: 'fade' in b.dataset, img: null };
  const tex = faceTex((x) => drawFront(x, CW, CH, face, i));
  if (b.dataset.img) { const im = new Image(); im.onload = () => { face.img = im; tex.redraw(); }; im.src = b.dataset.img; }   // drawn in once it's here
  const front = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false }));
  const back = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: backTex, transparent: true, fog: false }));
  back.rotation.y = Math.PI;                                        // on the other side: what you see while it arrives
  flip.add(front, back);
  card.userData = { s: 1, flip, faces: [front, back], redraw: tex.redraw };   // s: current size (hover / opened)
  scene.add(card);
  return card;
});
// canvas text doesn't wait for web fonts, so draw the faces again once the page's fonts are in
Promise.all(['600 44px Fraunces', '400 22px "Instrument Sans"', '500 22px "IBM Plex Mono"'].map((f) => document.fonts.load(f)))
  .then(() => cards.forEach((c) => c.userData.redraw())).catch(() => {});

// Hover targets: one invisible plane per card, fixed at its resting place and a little larger, so hovering doesn't
// flicker when the card itself lifts toward you (the pointer used to slip off and back)
const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
const hits = cards.map((c, i) => { const h = new THREE.Mesh(cardGeo, hitMat); h.userData.i = i; scene.add(h); return h; });

// ── the arc: an upright ring behind him facing the camera, one slot per card ──
const ring = new THREE.Object3D(); ring.rotation.order = 'YXZ'; scene.add(ring);
ring.position.copy(NEO).add(new THREE.Vector3(0, 0.1, -0.15));      // centred low on him: the arc rises round him, ends clear of the headline
const slots = cards.map(() => { const s = new THREE.Object3D(); ring.add(s); return s; });

const isMain = buttons.map((b) => 'main' in b.dataset);
const rest = buttons.map((b, i) => i).filter((i) => !isMain[i]), half = Math.ceil(rest.length / 2);
const leftToRight = [...rest.slice(0, half), ...buttons.map((b, i) => i).filter((i) => isMain[i]), ...rest.slice(half)];
const slotAngle = [], slotDepth = [];                               // angle on the arc (0 = far left, π/2 = top); depth
leftToRight.forEach((i, k) => {
  slotAngle[i] = Math.PI / 2 - THREE.MathUtils.degToRad(ARC / 2) + THREE.MathUtils.degToRad(ARC) * k / (leftToRight.length - 1);
  slotDepth[i] = -0.015 * Math.abs(k - (leftToRight.length - 1) / 2);   // the top card nearest: overlaps never share a plane (no flicker)
});

let scale = 1;                                                      // card size for this screen
// facing: the ring's yaw toward the camera. The circle's radius follows from the card size: just big enough that
// neighbouring bottom edges sit GAP apart, so the cards never overlap
export function layoutCards(facing, cardScale) {
  const r = (CARD * cardScale + GAP) / THREE.MathUtils.degToRad(ARC / (cards.length - 1));
  slots.forEach((s, i) => s.position.set(-Math.cos(slotAngle[i]) * r, Math.sin(slotAngle[i]) * r, slotDepth[i]));
  ring.rotation.set(-0.12, facing, -0.1);                           // top leaning back a touch; rolled so it reads level from the camera
  scale = cardScale;
}
export const CARD_WIDTH = CARD;

// which card the pointer is over (-1: none)
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
export function pickCard(e) {
  ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  return ray.intersectObjects(hits)[0]?.object.userData.i ?? -1;
}

// ── each frame ──
// s: { revealT, popAt (seconds), highlighted (card index or -1), focused (-1 or index), flyFrom (where it left),
//      dir (+1 opening, -1 closing), t01 (camera move 0 … 1), k (eased t01), spot (where the opened card floats), phone }
const ringQ = new THREE.Quaternion(), rollQ = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), tmp = new THREE.Vector3();
const HALF_H = CARD * CH / CW / 2;                                  // half a card's height (m), before scaling
export function updateCards(dt, s) {
  ring.getWorldQuaternion(ringQ);
  cards.forEach((m, i) => {
    const u = m.userData;
    slots[i].updateMatrixWorld(); slots[i].getWorldPosition(m.position);
    m.quaternion.copy(ringQ).multiply(rollQ.setFromAxisAngle(Z, (Math.PI / 2 - slotAngle[i]) * FAN));   // fanned along the curve
    m.position.addScaledVector(tmp.set(0, 1, 0).applyQuaternion(m.quaternion), HALF_H * scale);   // its bottom edge on the circle
    hits[i].position.copy(m.position); hits[i].quaternion.copy(m.quaternion); hits[i].scale.setScalar(1.15 * scale);
    u.flip.rotation.y = Math.PI * (1 - easeIO(clamp01((s.revealT - s.popAt - i * POP_GAP - 0.3) / 0.6)));   // arrives back-up, then turns
    if (i === s.focused) {                                          // fly from its place on the arc to the spot up front, upright
      const kc = ease(clamp01((s.t01 - CARD_LAG) / (1 - CARD_LAG)));  // it waits a beat so you see Neo start to stand
      m.position.lerpVectors(s.dir === -1 ? m.position : s.flyFrom, s.spot, kc);
      m.quaternion.slerp(camera.quaternion, kc);
      u.s = 1 + kc * (s.phone ? 0.25 : 0.4);
    } else {
      u.s += ((i === s.highlighted ? HOVER : 1) - u.s) * Math.min(1, still ? 1 : dt * 10);
      m.position.addScaledVector(tmp.subVectors(camera.position, m.position).normalize(), LIFT * (u.s - 1) / (HOVER - 1));
    }
    const pop = easeOutBack(clamp01((s.revealT - s.popAt - i * POP_GAP) / POP_LEN));   // arriving one by one after the reveal
    m.scale.setScalar(u.s * Math.max(pop, 0.0001) * (i === s.focused ? 1 : scale));   // the opened one keeps its full size
    const opacity = s.focused >= 0 && i !== s.focused ? 1 - 0.7 * s.k : 1;           // the others dim behind it
    for (const f of u.faces) f.material.opacity = opacity;
  });
}
