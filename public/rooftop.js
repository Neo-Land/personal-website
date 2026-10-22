// The rooftop scene, phase 2: the roof, ledge, props and the rooftops below are baked in Blender
// (rooftop/build_rooftop.py); the Manhattan skyline is modelled there too but its windows are drawn live here.
// Sitting Neo with the cards orbiting him like an aura (still grey stand-ins). Clicking a
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

// ── the world: near (baked in Blender), mid (live, low-poly: slope, trees, shore road, ferries), far (skyline) ──
// the Palisades: on the left a wooded slope down to a shore road; on the right the cliff drops straight into the river
const earth = new THREE.MeshBasicMaterial({ color: 0x4a3226 });
const slope = new THREE.Mesh(new THREE.PlaneGeometry(260, 100), earth);
slope.position.set(-140, -49, -75); slope.rotation.x = -Math.PI / 2 + Math.atan2(67, 70); scene.add(slope);
const road = new THREE.Mesh(new THREE.PlaneGeometry(260, 7), new THREE.MeshBasicMaterial({ color: 0x6b5a50 }));
road.rotation.x = -Math.PI / 2; road.position.set(-140, -83.4, -113); scene.add(road);
const cliffFace = new THREE.Mesh(new THREE.PlaneGeometry(300, 72), new THREE.MeshBasicMaterial({ color: 0x3a2722 }));   // under the façade
cliffFace.position.set(140, -50, -5.2); scene.add(cliffFace);
// autumn trees on the slope: one instanced draw, faceted icosahedra in five autumn colours
const TREES = 900, trees = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true }), TREES);
const leaf = [0xc4502a, 0xd97b2e, 0xa8361f, 0x7a6a2a, 0xe0a040].map((c) => new THREE.Color(c));
for (let i = 0; i < TREES; i++) {
  const sz = 2.5 + Math.random() * 3, u = Math.random(), x = -10 - Math.random() * 260;   // the wooded slope, left of the building
  const y = -16 - u * 67 + sz * 0.6, z = -40 - u * 70;
  trees.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().random(), new THREE.Vector3(sz, sz * 0.85, sz)));
  trees.setColorAt(i, leaf[i % leaf.length]);
}
scene.add(trees);
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
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name.startsWith('skyline')) { o.material = windows; o.position.x += 280; return; }   // skyline to the right of the river
    const map = o.material.map; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    o.material = new THREE.MeshBasicMaterial({ map, toneMapped: false });   // the bake already is the final light
  });
  scene.add(g.scene);
});

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

// ── cards: grey stand-ins with their name, fixed on a half ring arching over him ──
const CW = 240, CH = 320, CARD = 0.4;
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
// the half ring: an upright arch behind him, facing the camera, from his right side over his head to his left.
// The cards stay put; the one you point at grows toward you.
const ring = new THREE.Object3D(); ring.position.copy(NEO).add(new THREE.Vector3(0, 0.3, -0.15)); ring.rotation.order = 'YXZ'; scene.add(ring);
const slot = cards.map(() => { const s = new THREE.Object3D(); ring.add(s); return s; });
function arch(rx, ry) {                                                       // 0 … 180°: right to left over the top
  slot.forEach((s, i) => { const a = Math.PI * i / (N - 1); s.position.set(-Math.cos(a) * rx, Math.sin(a) * ry, 0); });
}
const HOVER = 1.35, LIFT = 0.12;                                              // hovered card: bigger, a little toward you

// ── camera poses: home (Neo centred, ring around him) and focus (Neo left, card up front, info on the right) ──
const pose = { home: { p: new THREE.Vector3(), l: new THREE.Vector3(), fov: 55 }, focus: { p: new THREE.Vector3(), l: new THREE.Vector3(), fov: 40 } };
let phone = false;
function size() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; phone = camera.aspect < 0.8;
  if (phone) {
    arch(1.05, 1.45);                                                         // portrait: a taller, narrower arch
    pose.home.p.set(2.3, 2.1, 1.2); pose.home.l.set(0.35, 1.25, -4.6); pose.home.fov = 62;
    pose.focus.p.set(1.9, 1.75, -1.0); pose.focus.l.set(0.95, 1.4, -4.6); pose.focus.fov = 55;
  } else {
    arch(1.65, 1.3);
    pose.home.p.set(2.3, 1.95, -1.3); pose.home.l.set(-0.5, 0.75, -10.5); pose.home.fov = 55;   // high, behind him: river + city below the sun
    pose.focus.p.set(2.3, 1.4, -2.0); pose.focus.l.set(1.35, 1.15, -4.7); pose.focus.fov = 40; // Neo ends up left of frame
  }
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
  camera.fov = pose.home.fov + (pose.focus.fov - pose.home.fov) * k; camera.updateProjectionMatrix();
  tmp.lerpVectors(pose.home.l, pose.focus.l, k); camera.lookAt(tmp);
  sky.position.copy(camera.position);
  sky.material.uniforms.uTime.value = river.material.uniforms.uTime.value = still ? 0 : t;
  if (!still) for (const f of ferries) { f.position.x += f.userData.v * dt; if (Math.abs(f.position.x) > 900) f.position.x = -Math.sign(f.position.x) * 900; }
  if (neo) {                                                      // standing: he turns from the city to face you
    const face = Math.atan2(pose.focus.p.x - NEO.x, pose.focus.p.z - NEO.z);
    neo.rotation.y = SIT_YAW + Math.atan2(Math.sin(face - SIT_YAW), Math.cos(face - SIT_YAW)) * k;
  }

  const on = focused < 0 ? (hovered >= 0 ? hovered : kbd) : -1;
  cards.forEach((m, i) => {
    slot[i].updateMatrixWorld(); slot[i].getWorldPosition(m.position);
    const u = m.userData;
    if (i === focused) {                                          // fly from its place in the ring to the spot up front
      m.position.lerpVectors(dir === -1 ? m.position : flyFrom, focusSpot(), k);
      u.s = 1 + k * (phone ? 0.9 : 0.8);
    } else {
      u.s += ((i === on ? HOVER : 1) - u.s) * Math.min(1, still ? 1 : dt * 10);
      m.position.addScaledVector(tmp.subVectors(camera.position, m.position).normalize(), LIFT * (u.s - 1) / (HOVER - 1));
    }
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
