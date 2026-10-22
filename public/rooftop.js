// The rooftop scene, phase 2: the roof, ledge, props and the rooftops below are baked in Blender
// (rooftop/build_rooftop.py); the Manhattan skyline is modelled there too but its windows are drawn live here.
// Sitting Neo with the cards orbiting him like an aura (still grey stand-ins). Clicking a
// card glides the camera so Neo sits left of frame, flies the card up front, crossfades Neo sit → idle (the real
// stand-up clip comes in phase 3) and slides in the card's info. ?perf shows fps / draw calls / memory.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt/meshopt_decoder.js';
import { drawBack, drawFront } from './card-art.js';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const buttons = [...document.querySelectorAll('#cards .card')], N = buttons.length;
const info = document.getElementById('info'), body = document.getElementById('d-body');
const ease = (t) => t * t * (3 - 2 * t);
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2), clamp01 = (t) => Math.min(Math.max(t, 0), 1);
const easeOutBack = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
// black until the world, Neo and the shaders are ready (no pop-in), then the opening reveal (skipped under reduced motion)
const fade = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'fade' }));
document.body.classList.add('arriving');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
// Golden-hour haze (after the mood reference): the sun high-left behind streaky clouds, everything washed in one
// orange-gold, the far skyline barely darker than the sky, the river doing half the work with a live sun streak.
const SUN = new THREE.Vector3(-0.45, 0.12, -1).normalize();
scene.fog = new THREE.FogExp2(0xd99a6c, 0.0016);                // ≈ the sky just above the horizon
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 3000);
const NOISE = `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
  float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= .5; } return s; }`;
const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: SUN }, uTime: { value: 0 } },
  vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform vec3 uSun; uniform float uTime; varying vec3 vD;
    ${NOISE}
    void main(){
      float h = vD.y, s = max(dot(vD, uSun), 0.);
      vec3 top = vec3(.45,.22,.24), mid = vec3(.86,.46,.36), hor = vec3(1.,.74,.46);
      vec3 c = mix(hor, mid, smoothstep(0., .14, h)); c = mix(c, top, smoothstep(.14, .65, h));
      c = mix(c, vec3(.86,.6,.42), smoothstep(0., -.05, h));                     // below the horizon: haze
      vec2 cp = vD.xz / max(h, .03) * vec2(.5, 1.7);                             // a cloud layer, stretched into streaks
      float cl = smoothstep(.52, .82, fbm(cp * 1.2 + vec2(uTime * .006, 0.))) * smoothstep(.03, .14, h) * (1. - smoothstep(.4, .75, h));
      c = mix(c, mix(vec3(.82,.42,.36), vec3(1.,.86,.58), pow(s, 3.)), cl * .8);
      c += vec3(1., .62, .3) * pow(s, 6.) * .45 + vec3(1., .92, .7) * pow(s, 700.) * 2.;   // glow + sun disc
      gl_FragColor = vec4(c, 1.);
    }`,
}));
scene.add(sky);

scene.add(new THREE.HemisphereLight(0xffc49a, 0x3a2a26, 0.95));
const sun = new THREE.DirectionalLight(0xffb070, 2.6); sun.position.copy(SUN).multiplyScalar(50); scene.add(sun);   // rim from behind
const bounce = new THREE.DirectionalLight(0x8a90b8, 0.4); bounce.position.set(4, 3, 3); scene.add(bounce);               // cool bounce from the roof side
const warm = new THREE.PointLight(0xffc27a, 3, 7, 1.5); warm.position.set(0, 2.2, -1.6); scene.add(warm);   // string lights' spill

// ── the world: near (baked in Blender), mid (live: the cliff, the river, ferries), far (skyline on its waterfront) ──
// the Palisades: the cliff drops from under the building straight into the river, so the view over the ledge is open water
const cliffFace = new THREE.Mesh(new THREE.PlaneGeometry(600, 72), new THREE.MeshBasicMaterial({ color: 0x3a2722 }));
cliffFace.position.set(0, -50, -5.2); scene.add(cliffFace);
// the river: live — a few travelling waves tilt the normal; the sky reflects by angle and the sun leaves a streak
const river = new THREE.Mesh(new THREE.PlaneGeometry(5000, 2000), new THREE.ShaderMaterial({
  fog: true, toneMapped: false,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uSun: { value: SUN } }]),
  vertexShader: `varying vec3 vW;
    #include <common>
    #include <fog_pars_vertex>
    void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `uniform float uTime; uniform vec3 uSun; varying vec3 vW;
    #include <common>
    #include <fog_pars_fragment>
    void main(){
      vec2 p = vW.xz, g = vec2(0.);
      g += vec2(.8, .6) * cos(dot(p, vec2(.8, .6)) * .05 + uTime * .9) * .5;
      g += vec2(-.5, .86) * cos(dot(p, vec2(-.5, .86)) * .13 + uTime * 1.4) * .3;
      g += vec2(.2, -.98) * cos(dot(p, vec2(.2, -.98)) * .31 + uTime * 2.1) * .2;
      vec3 n = normalize(vec3(-g.x * .1, 1., -g.y * .1)), v = normalize(cameraPosition - vW), r = reflect(-v, n);
      float fres = pow(1. - max(v.y, 0.), 4.), s = max(dot(r, uSun), 0.);
      vec3 c = mix(vec3(.36, .22, .16), vec3(1., .7, .46), .3 + .55 * fres);
      c += vec3(1., .82, .52) * (pow(s, 70.) * 1.3 + pow(s, 9.) * .22);
      gl_FragColor = vec4(c, 1.);
      #include <fog_fragment>
    }`,
}));
river.rotation.x = -Math.PI / 2; river.position.set(0, -84, -900); scene.add(river);
// ferries: cream hull + cabin, a fading wake behind, crossing slowly
const wakeTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 8; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(255,240,215,0)'); g.addColorStop(1, 'rgba(255,240,215,.55)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 8); return new THREE.CanvasTexture(c); })();
const hullMat = new THREE.MeshBasicMaterial({ color: 0xe8d8c2 }), cabinMat = new THREE.MeshBasicMaterial({ color: 0xcfbfa8 });
const ferries = [[-200, -330, 6], [150, -560, -4.5], [-420, -780, 3.5]].map(([x, z, v]) => {
  const f = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(22, 2.4, 6), hullMat); hull.position.y = 1.2;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(13, 2.6, 5), cabinMat); cabin.position.y = 3.6;
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(90, 7), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false }));
  wake.rotation.x = -Math.PI / 2; wake.position.set(-Math.sign(v) * 56, 0.1, 0); if (v < 0) wake.rotation.z = Math.PI;
  f.add(hull, cabin, wake); f.position.set(x, -84, z); f.userData.v = v; scene.add(f); return f;
});
// Manhattan's ground: a low slab the skyline stands on, a seawall facing us, piers, and low buildings along the
// waterfront so the towers rise out of a city instead of the water. All instanced, coloured to sink into the haze.
const SKY_X = 280;                                               // = the skyline's shift in the loader below
const land = new THREE.Mesh(new THREE.BoxGeometry(2500, 4, 1000), new THREE.MeshBasicMaterial({ color: 0x5a4640 }));
land.position.set(SKY_X, -84, -1290); scene.add(land);           // top at y -82, front (the seawall) at z -790
const lowMat = new THREE.MeshBasicMaterial({ color: 0x4a3a3c });
const PIERS = 34, piers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lowMat, PIERS);
for (let i = 0; i < PIERS; i++) {
  const x = SKY_X - 1200 + i * 72 + (Math.random() - 0.5) * 20, len = 40 + Math.random() * 50;
  piers.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, -83, -790 + len / 2), new THREE.Quaternion(), new THREE.Vector3(10 + Math.random() * 10, 2.5, len)));
}
scene.add(piers);
const LOW = 260, low = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lowMat, LOW);
for (let i = 0; i < LOW; i++) {
  const h = 6 + Math.random() * 28, x = SKY_X - 1220 + Math.random() * 2440, z = -800 - Math.random() * 90;
  low.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, -82 + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(14 + Math.random() * 24, h, 12 + Math.random() * 20)));
}
scene.add(low);
// far-left industrial shore: a few stacks fading into the haze
const stackMat = new THREE.MeshBasicMaterial({ color: 0x3a3036 });
for (const [x, h, z] of [[-820, 120, -1250], [-780, 95, -1270], [-735, 140, -1240], [-690, 80, -1300], [-900, 60, -1220]]) {
  const st = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, h, 10), stackMat); st.position.set(x, -84 + h / 2, z); scene.add(st);
}

// windows: a grid in the skyline's metre UVs (3.2 m bays, 3.6 m floors), ~28% lit warm or cool; far away, where a
// window is smaller than a pixel, the grid fades to its average so it doesn't shimmer
const windows = new THREE.ShaderMaterial({
  fog: true, toneMapped: false,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uWall: { value: new THREE.Color(0x232636) } }]),
  vertexShader: `varying vec2 vUv; varying vec3 vN;
    #include <common>
    #include <fog_pars_vertex>
    void main(){ vUv = uv; vN = normal; vec4 mvPosition = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `uniform vec3 uWall; varying vec2 vUv; varying vec3 vN;
    #include <common>
    #include <fog_pars_fragment>
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec3 c = uWall;
      if (abs(vN.y) < .5) {
        vec2 cell = vUv / vec2(3.2, 3.6), f = fract(cell), id = floor(cell);
        float win = step(.25, f.x) * step(f.x, .75) * step(.3, f.y) * step(f.y, .8);
        float on = step(.72, h(id));
        vec3 lit = mix(vec3(1., .74, .42), vec3(.7, .82, 1.), step(.65, h(id + 7.))) * (.55 + .5 * h(id + 3.));
        vec3 near = mix(c, lit, win * on) + uWall * .35 * win * (1. - on);
        vec3 far = c + vec3(1., .78, .5) * .28 * .25 * .8;                     // the grid's average glow
        c = mix(near, far, clamp(length(fwidth(cell)) * 1.5 - .5, 0., 1.));
      }
      gl_FragColor = vec4(c, 1.);
      #include <fog_fragment>
    }`,
});
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('rooftop.glb', (g) => {
  g.scene.getObjectByName('below')?.removeFromParent();          // the rooftops under the ledge: dropped, the view stays open
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name.startsWith('skyline')) { o.material = windows; o.position.x += SKY_X; return; }   // skyline to the right of the river
    const map = o.material.map; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    o.material = new THREE.MeshBasicMaterial({ map, toneMapped: false });   // the bake already is the final light
  });
  scene.add(g.scene);
  worldReady = true; begin();
});

// ── Neo ──
const NEO = new THREE.Vector3(0.6, 0.5, -4.25), SIT_YAW = Math.PI * 0.74;   // on the ledge, looking out over the river
let mixer, sit, idle, ready = false, neo, worldReady = false;
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('neo.glb', (g) => {
  g.scene.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  neo = g.scene; neo.position.copy(NEO); neo.rotation.y = SIT_YAW;
  scene.add(neo);
  mixer = new THREE.AnimationMixer(g.scene);
  const clip = (n) => mixer.clipAction(g.animations.find((a) => a.name === n));
  sit = clip('neo_sit'); idle = clip('neo_idle');
  sit.play(); ready = true; begin();
});
// swashbuckler Neo (the loft's swordsman outfit): sitting on the roof-side edge of the ledge, legs over the roof,
// turned to face the camera. His slouch was keyfamed for a chair with a 0.25 m seat, so he sits 0.25 below the coping.
const SWORD = new THREE.Vector3(2.05, 0.5 - 0.25, -3.85);
let swordMixer;
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('swordsman.glb', (g) => {
  g.scene.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  g.scene.position.copy(SWORD);
  scene.add(g.scene);
  // soft warm fill from the camera side so his face reads against the sunset (the baked world ignores scene lights)
  const fill = new THREE.DirectionalLight(0xffe2c8, 1.7); fill.position.copy(SWORD).add(new THREE.Vector3(0.6, 1.4, 3)); fill.target = g.scene;
  scene.add(fill);
  swordMixer = new THREE.AnimationMixer(g.scene);
  swordMixer.clipAction(g.animations[0]).play();
  faceCamera = () => { g.scene.rotation.y = Math.atan2(pose.home.p.x - SWORD.x, pose.home.p.z - SWORD.z); };
  faceCamera();
});
let faceCamera = () => {};
function stand(up) {                                              // placeholder for phase 3's stand-up clip
  if (!ready) return;
  const [from, to] = up ? [sit, idle] : [idle, sit];
  to.reset().play(); from.crossFadeTo(to, 0.9, false);
}

// ── cards: playing cards fanned along the curve, back up; hovering flips one to its hand-drawn topic sketch ──
const CW = 400, CH = 560, CARD = 0.4;                                 // poker-card proportions (5:7)
const faceTex = (draw) => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const backTex = faceTex((x) => drawBack(x, CW, CH));                  // one back shared by every card
const cardGeo = new THREE.PlaneGeometry(CARD, CARD * CH / CW);
const cards = buttons.map((b, i) => {
  const card = new THREE.Group(), flip = new THREE.Group(); card.add(flip);
  const back = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: backTex, transparent: true, fog: false }));
  const front = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: faceTex((x) => drawFront(x, CW, CH, { d: b.dataset.d, name: b.textContent, cat: b.dataset.cat }, i)), transparent: true, fog: false }));
  front.rotation.y = Math.PI;                                          // on the other side, shown once the card turns over
  back.userData.i = front.userData.i = i;
  flip.add(back, front);
  card.userData = { i, s: 1, f: 0, flip, faces: [back, front] };
  scene.add(card);
  return card;
});
const faces = cards.flatMap((c) => c.userData.faces);
// the half ring: an upright arch behind him, facing the camera, from his right side over his head to his left.
// The cards stay put; the one you point at grows toward you.
const ring = new THREE.Object3D(); ring.position.copy(NEO).add(new THREE.Vector3(0, 0.3, -0.15)); ring.rotation.order = 'YXZ'; scene.add(ring);
const slot = cards.map(() => { const s = new THREE.Object3D(); ring.add(s); return s; });
// a sweep rather than a full half ring: from his right at ledge height, over his head, ending high on his left side of
// the frame (0 … 148°) so the last card clears swashbuckler Neo's head
const SWEEP = Math.PI * 0.82;
function arch(rx, ry) {
  slot.forEach((s, i) => { const a = SWEEP * i / (N - 1); s.position.set(-Math.cos(a) * rx, Math.sin(a) * ry, 0); });
}
const HOVER = 1.25, LIFT = 0.12;                                              // hovered card: bigger, a little toward you
const ringQ = new THREE.Quaternion(), rollQ = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);

// ── camera poses: home (Neo centred, ring around him) and focus (Neo left, card up front, info on the right) ──
const pose = { start: { p: new THREE.Vector3(), l: new THREE.Vector3(), fov: 50 }, home: { p: new THREE.Vector3(), l: new THREE.Vector3(), fov: 55 }, focus: { p: new THREE.Vector3(), l: new THREE.Vector3(), fov: 40 } };
let phone = false;
function size() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; phone = camera.aspect < 0.8;
  if (phone) {
    arch(1.05, 1.45);                                                         // portrait: a taller, narrower arch
    pose.home.p.set(2.3, 2.1, 1.2); pose.home.l.set(0.35, 1.25, -4.6); pose.home.fov = 62;
    pose.focus.p.set(1.9, 1.75, -1.0); pose.focus.l.set(0.95, 1.4, -4.6); pose.focus.fov = 55;
  } else {
    arch(1.75, 1.6);                                                          // tall enough that the low cards don't stack
    pose.home.p.set(2.35, 2.05, -0.55); pose.home.l.set(-0.5, 0.75, -10.5); pose.home.fov = 55;   // high, behind him: river + city below the sun
    pose.focus.p.set(2.3, 1.4, -2.0); pose.focus.l.set(1.35, 1.15, -4.7); pose.focus.fov = 40; // Neo ends up left of frame
  }
  // the reveal starts higher, further back and looking up toward the sun over the skyline, then cranes down to him
  pose.start.p.copy(pose.home.p).add(phone ? new THREE.Vector3(2.5, 3.5, 6) : new THREE.Vector3(4, 3.2, 7));
  pose.start.l.copy(SUN).multiplyScalar(700).add(new THREE.Vector3(0, 30, 0)); pose.start.fov = phone ? 66 : 48;
  faceCamera();
  ring.rotation.set(-0.12, Math.atan2(pose.home.p.x - NEO.x, pose.home.p.z - NEO.z), 0);   // faces the camera, top leaning back a touch
}
// where the focused card floats: in front of the focus camera, a bit right of centre (above centre on phones)
const focusSpot = () => {
  const p = pose.focus.p, l = pose.focus.l, fwd = l.clone().sub(p).normalize(), right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
  return p.clone().addScaledVector(fwd, 1.8).addScaledVector(right, phone ? 0 : -0.1).addScaledVector(camera.up, phone ? 0.2 : 0.02);
};

// ── state: hover, focus in/out (tweens run in the loop) ──
let hovered = -1, kbd = -1, focused = -1, t01 = 0, dir = 0;    // t01: 0 = home … 1 = focus; dir: +1 / -1 while moving
const flyFrom = new THREE.Vector3(), tmp = new THREE.Vector3();
// ── opening reveal ──
const REVEAL = 4.6, POP_AT = REVEAL * 0.72, POP_GAP = 0.08, POP_LEN = 0.5;   // seconds
let revealT = still ? REVEAL + 9 : 0, revealing = false, begun = false;
function begin(force) {
  if (begun || !(force || (worldReady && ready))) return;
  begun = true;
  renderer.compileAsync(scene, camera).catch(() => {}).then(() => { revealing = true; fade.classList.add('out'); });
}
setTimeout(() => begin(true), 8000);                              // a slow or failed download never leaves you on black
function skipReveal() { if (revealing && revealT < REVEAL + 1) revealT = REVEAL + 1; }
for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, skipReveal, { passive: true });
const par = new THREE.Vector2(), parS = new THREE.Vector2(), hp = new THREE.Vector3(), hl = new THREE.Vector3();
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') par.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5); });

function open(i) {
  skipReveal();
  if (focused >= 0 && focused !== i) { focused = i; fill(i); return; }   // already up: just swap the card
  focused = i; dir = 1; flyFrom.copy(cards[i].position);
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
// what a card does: the résumé downloads straight away; the rest open their info
function act(i) {
  if (buttons[i].dataset.d === 'resume') {
    skipReveal();
    Object.assign(document.createElement('a'), { href: 'Nehemias-Landaverde-Resume.pdf', download: 'Nehemias-Landaverde-Resume.pdf' }).click();
    return;
  }
  open(i);
}
buttons.forEach((b, i) => {
  b.addEventListener('click', () => act(i));
  b.addEventListener('focus', () => (kbd = i)); b.addEventListener('blur', () => (kbd = -1));
});
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
const pick = (e) => { if (revealT < POP_AT) return -1; ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera); return ray.intersectObjects(faces)[0]?.object.userData.i ?? -1; };
renderer.domElement.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; hovered = pick(e); renderer.domElement.style.cursor = hovered >= 0 ? 'pointer' : ''; });
// touch has no hover: the first tap turns a card over, a second tap on it acts
let tapFlip = false;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  const i = pick(e); tapFlip = i >= 0 && i !== hovered && focused < 0; if (tapFlip) hovered = i;
});
renderer.domElement.addEventListener('click', (e) => { if (tapFlip) { tapFlip = false; return; } const i = pick(e); if (i >= 0) act(i); else close(); });

// ── perf readout (?perf) ──
const perfEl = document.getElementById('perf'), PERF = new URLSearchParams(location.search).has('perf');
perfEl.hidden = !PERF;
let frames = 0, acc = 0;

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  mixer?.update(dt); swordMixer?.update(dt);
  if (dir) { t01 = Math.min(Math.max(t01 + dir * dt / (still ? 0.01 : 1.2), 0), 1); if (t01 === 0 || t01 === 1) { if (t01 === 0) focused = -1; dir = 0; } }
  const k = ease(t01);
  if (revealing) revealT += dt;
  if (revealT >= REVEAL && document.body.classList.contains('arriving')) document.body.classList.remove('arriving');
  // home pose + a gentle drift with the mouse and a slow breath; during the reveal, blended in from the start pose
  hp.copy(pose.home.p); hl.copy(pose.home.l);
  if (!still) {
    parS.lerp(par, 1 - Math.exp(-dt * 2.5));
    hp.x += parS.x * 0.35; hp.y += -parS.y * 0.18 + Math.sin(t * 0.35) * 0.025;
  }
  let fov = pose.home.fov;
  if (revealT < REVEAL) {
    const r = revealT / REVEAL, e = easeIO(r), e2 = easeIO(clamp01((r - 0.18) / 0.82));   // position leads, the tilt down follows
    hp.lerpVectors(pose.start.p, hp.clone(), e); hl.lerpVectors(pose.start.l, hl.clone(), e2);
    fov = pose.start.fov + (fov - pose.start.fov) * e;
  }
  camera.position.lerpVectors(hp, pose.focus.p, k);
  camera.fov = fov + (pose.focus.fov - fov) * k; camera.updateProjectionMatrix();
  tmp.lerpVectors(hl, pose.focus.l, k); camera.lookAt(tmp);
  sky.position.copy(camera.position);
  sky.material.uniforms.uTime.value = river.material.uniforms.uTime.value = still ? 0 : t;
  if (!still) for (const f of ferries) { f.position.x += f.userData.v * dt; if (Math.abs(f.position.x) > 900) f.position.x = -Math.sign(f.position.x) * 900; }
  if (neo) {                                                      // standing: he turns from the city to face you
    const face = Math.atan2(pose.focus.p.x - NEO.x, pose.focus.p.z - NEO.z);
    neo.rotation.y = SIT_YAW + Math.atan2(Math.sin(face - SIT_YAW), Math.cos(face - SIT_YAW)) * k;
  }

  const on = focused < 0 ? (hovered >= 0 ? hovered : kbd) : -1;
  ring.getWorldQuaternion(ringQ);
  cards.forEach((m, i) => {
    const u = m.userData, a = SWEEP * i / (N - 1);
    slot[i].updateMatrixWorld(); slot[i].getWorldPosition(m.position);
    m.quaternion.copy(ringQ).multiply(rollQ.setFromAxisAngle(Z, Math.PI / 2 - a));   // fanned: each card's top points out along the curve
    const lit = i === on || i === focused;
    u.f += ((lit ? 1 : 0) - u.f) * Math.min(1, still ? 1 : dt * 7);   // 0 = back up, 1 = turned over
    u.flip.rotation.y = Math.PI * u.f;
    if (i === focused) {                                          // fly from its place on the curve to the spot up front, upright
      m.position.lerpVectors(dir === -1 ? m.position : flyFrom, focusSpot(), k);
      m.quaternion.slerp(camera.quaternion, k);
      u.s = 1 + k * (phone ? 0.9 : 0.8);
    } else {
      u.s += ((i === on ? HOVER : 1) - u.s) * Math.min(1, still ? 1 : dt * 10);
      m.position.addScaledVector(tmp.subVectors(camera.position, m.position).normalize(), LIFT * (u.s - 1) / (HOVER - 1));
    }
    const pop = easeOutBack(clamp01((revealT - POP_AT - i * POP_GAP) / POP_LEN));   // cards arrive one by one after the reveal
    m.scale.setScalar(u.s * Math.max(pop, 0.0001));
    const op = focused >= 0 && i !== focused ? 1 - 0.7 * k : 1;
    for (const f of u.faces) f.material.opacity = op;
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
