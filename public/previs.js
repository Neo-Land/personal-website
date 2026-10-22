// Phase 1 previs (grey blockout) of the rooftop scene. Everything here is a stand-in to agree on layout and motion:
// grey boxes for the roof, the Palisades and Manhattan; sitting Neo; the cards orbiting him like an aura. Clicking a
// card glides the camera so Neo sits left of frame, flies the card up front, crossfades Neo sit → idle (the real
// stand-up clip comes in phase 3) and slides in the card's info. ?perf shows fps / draw calls / memory.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt/meshopt_decoder.js';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const buttons = [...document.querySelectorAll('#cards .card')], N = buttons.length;
const info = document.getElementById('info'), body = document.getElementById('d-body');
const ease = (t) => t * t * (3 - 2 * t);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
// Dusk (after the reference stills): the sun just above the skyline behind Neo, warm haze that turns the far
// towers into layered silhouettes, and Neo lit mostly from behind so he reads as a rim-lit shape on the ledge.
const SUN = new THREE.Vector3(-0.25, 0.05, -1).normalize();
scene.fog = new THREE.FogExp2(0xb4806e, 0.0013);                // = the sky's colour just above the horizon
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 3000);
const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: SUN } },
  vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform vec3 uSun; varying vec3 vD;
    void main(){
      float h = vD.y;
      vec3 top = vec3(.09,.1,.24), mid = vec3(.43,.26,.41), hor = vec3(1.,.6,.36);
      vec3 c = mix(hor, mid, smoothstep(0., .16, h)); c = mix(c, top, smoothstep(.16, .6, h));
      c = mix(c, vec3(.42,.3,.3), smoothstep(0., -.06, h));                       // below the horizon: haze
      float s = max(dot(vD, uSun), 0.);
      c += vec3(1., .55, .25) * pow(s, 10.) * .55 + vec3(1., .88, .65) * pow(s, 900.) * 2.5;   // glow + sun disc
      gl_FragColor = vec4(c, 1.);
    }`,
}));
scene.add(sky);

scene.add(new THREE.HemisphereLight(0xffb08a, 0x1a1c28, 0.75));
const sun = new THREE.DirectionalLight(0xffa063, 3.2); sun.position.copy(SUN).multiplyScalar(50); scene.add(sun);   // rim from behind
const bounce = new THREE.DirectionalLight(0x6f86c8, 0.45); bounce.position.set(4, 3, 3); scene.add(bounce);               // cool bounce from the roof side
const warm = new THREE.PointLight(0xffc27a, 4, 7, 1.5); warm.position.set(0, 2.2, -1.6); scene.add(warm);   // string lights' spill

// ── blockout: roof, parapet, water tower, vents, string lights; building + cliff below; river; skyline ──
const grey = new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 1 });
const dark = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 1 });
const box = (w, h, d, x, y, z, m = grey) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); scene.add(o); return o; };
const cyl = (r1, r2, h, x, y, z, m = grey, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); scene.add(o); return o; };
box(12, 0.3, 8, 0, -0.15, -0.5);                                  // roof deck
box(12, 0.5, 0.9, 0, 0.25, -4.25);                               // the wide ledge on the river side Neo sits on
box(0.2, 0.45, 8, -6, 0.225, -0.5); box(0.2, 0.45, 8, 6, 0.225, -0.5);
box(12, 30, 8, 0, -15.3, -0.5, dark);                            // the building
box(60, 70, 40, 0, -50, 0, dark);                                // the Palisades cliff it stands on
for (const [x, z] of [[-3.3, -2.6], [-2.5, -2.6], [-3.3, -1.8], [-2.5, -1.8]]) cyl(0.04, 0.04, 2, x, 1, z, dark, 6);   // tower legs
cyl(0.62, 0.62, 1.1, -2.9, 2.55, -2.2); cyl(0.05, 0.7, 0.45, -2.9, 3.33, -2.2);        // tank + conical roof
box(0.6, 0.5, 0.6, 2.6, 0.25, -2.0); box(0.4, 0.8, 0.4, 3.4, 0.4, -1.2); box(1.2, 0.35, 0.7, -3.8, 0.17, 1.2);
cyl(0.03, 0.03, 1.9, -4.5, 0.95, 2.6, dark, 6); cyl(0.03, 0.03, 1.9, 4.5, 0.95, 2.6, dark, 6);   // string lights: behind the camera, spill only
const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd38a }), 24);
for (let i = 0; i < 24; i++) {                                    // a sagging string between the two poles
  const u = i / 23, x = -4.5 + 9 * u;
  bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 1.85 - Math.sin(u * Math.PI) * 0.45, 2.6));
}
scene.add(bulbs);
const river = new THREE.Mesh(new THREE.PlaneGeometry(4000, 1400), new THREE.MeshStandardMaterial({ color: 0x141a2c, roughness: 0.35 }));
river.rotation.x = -Math.PI / 2; river.position.set(0, -84, -720); scene.add(river);
// Manhattan: one instanced draw call of boxes along the far shore, a taller cluster in the middle (Midtown)
const SKY = 240, rnd = (a, b) => a + Math.random() * (b - a);
const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x262a3c, roughness: 1 }), SKY);
const tall = [];
for (let i = 0; i < SKY; i++) {
  const x = rnd(-1100, 1100), mid = Math.exp(-(((x + 120) / 380) ** 2)), h = rnd(30, 90) + mid * rnd(40, 260) * (Math.random() < 0.5 ? 1 : 0.4);
  const w = rnd(18, 45), z = rnd(-1700, -850);                     // spread in depth so the haze layers them
  towers.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, -84 + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, rnd(18, 45))));
  if (h > 200) tall.push([x, -84 + h, z, w]);
}
scene.add(towers);
const spires = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 1, 4), towers.material, tall.length);   // pointed tops on the tallest
tall.forEach(([x, y, z, w], i) => spires.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y + w * 0.6, z), new THREE.Quaternion(), new THREE.Vector3(w * 0.9, w * 1.2, w * 0.9))));
scene.add(spires);

// ── Neo ──
const NEO = new THREE.Vector3(0.6, 0.5, -4.25), SIT_YAW = Math.PI * 0.74;   // on the ledge, looking out over the river
let mixer, sit, idle, ready = false, neo;
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('neo.glb', (g) => {
  g.scene.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  neo = g.scene; neo.position.copy(NEO); neo.rotation.y = SIT_YAW;
  scene.add(neo);
  mixer = new THREE.AnimationMixer(g.scene);
  const clip = (n) => mixer.clipAction(g.animations.find((a) => a.name === n));
  sit = clip('neo_sit'); idle = clip('neo_idle');
  sit.play(); ready = true;
});
function stand(up) {                                              // placeholder for phase 3's stand-up clip
  if (!ready) return;
  const [from, to] = up ? [sit, idle] : [idle, sit];
  to.reset().play(); from.crossFadeTo(to, 0.9, false);
}

// ── cards: grey stand-ins with their name, orbiting him on a tilted ring ──
const CW = 240, CH = 320, CARD = 0.3;
const cards = buttons.map((b, i) => {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const x = c.getContext('2d');
  x.fillStyle = '#a7adb8'; x.beginPath(); x.roundRect(0, 0, CW, CH, 18); x.fill();
  x.fillStyle = '#2a2f3a'; x.font = '700 15px ui-monospace, Menlo, monospace'; x.fillText(b.dataset.cat.toUpperCase(), 18, 34);
  x.font = '600 30px Georgia, serif'; x.fillText(b.textContent, 18, CH - 26);
  x.strokeStyle = '#2a2f3a'; x.lineWidth = 3; x.beginPath(); x.moveTo(18, CH / 2); x.lineTo(CW - 18, CH / 2); x.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(CARD, CARD * CH / CW), new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false }));
  m.userData = { i, s: 1 };
  scene.add(m);
  return m;
});
// the ring: a near-upright oval around him (like the orbs in the reference), bottom tucked behind him, slanted a little
const ring = new THREE.Object3D(); ring.position.copy(NEO).add(new THREE.Vector3(0, 0.36, -0.1)); ring.rotation.order = 'YXZ'; scene.add(ring);
const RX = 1.1, RY = 0.62, FLOOR_Y = NEO.y + 0.22, slot = cards.map(() => new THREE.Object3D());
slot.forEach((s) => ring.add(s));
let spin = 0;

// ── camera poses: home (Neo centred, ring around him) and focus (Neo left, card up front, info on the right) ──
const pose = { home: { p: new THREE.Vector3(), l: new THREE.Vector3() }, focus: { p: new THREE.Vector3(), l: new THREE.Vector3() } };
let phone = false;
function size() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; phone = camera.aspect < 0.8;
  camera.fov = phone ? 55 : 40; camera.updateProjectionMatrix();
  if (phone) {
    pose.home.p.set(2.1, 1.5, -0.4); pose.home.l.set(0.5, 1.05, -4.4);
    pose.focus.p.set(1.6, 1.6, -1.3); pose.focus.l.set(0.9, 1.45, -4.4);
  } else {
    pose.home.p.set(2.6, 1.7, -1.5); pose.home.l.set(0.1, 1.2, -5.0);   // behind and to the right of him, city beyond
    pose.focus.p.set(2.3, 1.4, -2.0); pose.focus.l.set(1.35, 1.15, -4.7);   // Neo ends up left of frame
  }
  ring.rotation.set(0.7, Math.atan2(pose.home.p.x - NEO.x, pose.home.p.z - NEO.z), -0.18);   // the ring faces the camera
}
// where the focused card floats: in front of the focus camera, a bit right of centre (above centre on phones)
const focusSpot = () => {
  const p = pose.focus.p, l = pose.focus.l, fwd = l.clone().sub(p).normalize(), right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
  return p.clone().addScaledVector(fwd, 1.8).addScaledVector(right, phone ? 0 : -0.1).addScaledVector(camera.up, phone ? 0.2 : 0.02);
};

// ── state: hover, focus in/out (tweens run in the loop) ──
let hovered = -1, kbd = -1, focused = -1, t01 = 0, dir = 0;    // t01: 0 = home … 1 = focus; dir: +1 / -1 while moving
const flyFrom = new THREE.Vector3(), tmp = new THREE.Vector3();
function open(i) {
  if (focused >= 0 && focused !== i) { focused = i; fill(i); return; }   // already up: just swap the card
  focused = i; dir = 1; cards[i].getWorldPosition(flyFrom);
  fill(i); stand(true);
  document.body.classList.add('focused');
  info.hidden = false;
  setTimeout(() => document.getElementById('back').focus({ preventScroll: true }), 50);
}
function fill(i) {
  body.replaceChildren(document.getElementById(`d-${buttons[i].dataset.d}`).content.cloneNode(true));
  const mail = body.querySelector('[data-mail]');
  if (mail) mail.href = `mailto:${['nehe.landav', 'gmail.com'].join('@')}`;
}
function close() {
  if (focused < 0 || dir === -1) return;
  dir = -1; stand(false);
  document.body.classList.remove('focused');
  info.hidden = true;
  buttons[focused].focus({ preventScroll: true });
}
document.getElementById('back').addEventListener('click', close);
addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
buttons.forEach((b, i) => {
  b.addEventListener('click', () => open(i));
  b.addEventListener('focus', () => (kbd = i)); b.addEventListener('blur', () => (kbd = -1));
});
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
const pick = (e) => { ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera); return ray.intersectObjects(cards)[0]?.object.userData.i ?? -1; };
renderer.domElement.addEventListener('pointermove', (e) => { hovered = pick(e); renderer.domElement.style.cursor = hovered >= 0 ? 'pointer' : ''; });
renderer.domElement.addEventListener('click', (e) => { const i = pick(e); if (i >= 0) open(i); else close(); });

// ── perf readout (?perf) ──
const perfEl = document.getElementById('perf'), PERF = new URLSearchParams(location.search).has('perf');
perfEl.hidden = !PERF;
let frames = 0, acc = 0;

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  mixer?.update(dt);
  if (dir) { t01 = Math.min(Math.max(t01 + dir * dt / (still ? 0.01 : 1.2), 0), 1); if (t01 === 0 || t01 === 1) { if (t01 === 0) focused = -1; dir = 0; } }
  const k = ease(t01);
  camera.position.lerpVectors(pose.home.p, pose.focus.p, k);
  tmp.lerpVectors(pose.home.l, pose.focus.l, k); camera.lookAt(tmp);
  sky.position.copy(camera.position);
  if (neo) {                                                      // standing: he turns from the city to face you
    const face = Math.atan2(pose.focus.p.x - NEO.x, pose.focus.p.z - NEO.z);
    neo.rotation.y = SIT_YAW + Math.atan2(Math.sin(face - SIT_YAW), Math.cos(face - SIT_YAW)) * k;
  }

  const on = focused < 0 ? (hovered >= 0 ? hovered : kbd) : -1;
  if (on < 0 && focused < 0 && !still) spin += dt * 0.16;        // the aura drifts round unless you're pointing at it
  cards.forEach((m, i) => {
    const a = spin + i * Math.PI * 2 / N, s = slot[i];
    s.position.set(Math.cos(a) * RX, Math.sin(a) * RY, 0); s.updateMatrixWorld();
    s.getWorldPosition(m.position);
    m.position.y = Math.max(m.position.y, FLOOR_Y);              // skim over the roof instead of sinking into it
    if (!still) m.position.y += Math.sin(t * 1.1 + i * 1.9) * 0.015;
    const u = m.userData;
    if (i === focused) {                                          // fly from its place in the ring to the spot up front
      m.position.lerpVectors(dir === -1 ? m.position : flyFrom, focusSpot(), k);
      u.s = 1 + k * (phone ? 0.9 : 0.8);
    } else u.s += ((i === on ? 1.2 : 1) - u.s) * Math.min(1, dt * 10);
    m.scale.setScalar(u.s);
    m.quaternion.copy(camera.quaternion);                         // always facing you
    m.material.opacity = focused >= 0 && i !== focused ? 1 - 0.7 * k : 1;
  });
  renderer.render(scene, camera);

  if (PERF && (frames++, (acc += dt) >= 0.5)) {
    const r = renderer.info, mem = performance.memory ? ` · heap ${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB` : '';
    perfEl.textContent = `${Math.round(frames / acc)} fps · ${r.render.calls} calls · ${(r.render.triangles / 1000).toFixed(0)}k tris\n` +
      `${r.memory.geometries} geometries · ${r.memory.textures} textures${mem}`;
    frames = 0; acc = 0;
  }
});
size();
addEventListener('resize', size);
