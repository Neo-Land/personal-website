// Void: sitting Neo on the intro's ripple floor in the dark, under one spotlight with dust in its beam, and a half
// ring of floating cards behind him. Hover (or keyboard focus on the hidden buttons) lifts a card and shows a HUD
// readout; clicking opens the same detail panel as the ring page. The HTML poster + button grid stay as the fallback.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt/meshopt_decoder.js';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const buttons = [...document.querySelectorAll('#cards .card')], N = buttons.length;
const hud = document.getElementById('hud');
let ripple = () => {};                                 // floor ring on click; real once the scene exists

// ── details (also used by the fallback grid, so set up before anything 3D can fail) ──
const dialog = document.getElementById('detail'), body = document.getElementById('d-body');
function openCard(i) {
  body.replaceChildren(document.getElementById(`d-${buttons[i].dataset.d}`).content.cloneNode(true));
  const mail = body.querySelector('[data-mail]');
  if (mail) mail.href = `mailto:${['nehe.landav', 'gmail.com'].join('@')}`;   // assembled here so harvesters scanning the HTML miss it
  dialog.showModal();
  ripple(0, 0);
}
dialog.querySelector('.x').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
buttons.forEach((b, i) => b.addEventListener('click', () => openCard(i)));

let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { /* no WebGL: the poster + grid stay */ }
if (renderer) {
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setClearColor(0x000000);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.11);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
const target = new THREE.Vector3(), camBase = new THREE.Vector3();

// ── light: one warm spotlight straight down, a cool rim from behind, almost nothing else ──
const SPOT_H = 4.2, SPOT_A = 0.36;
const spot = new THREE.SpotLight(0xfff0dc, 38, 0, SPOT_A, 0.6, 2);
spot.position.set(0, SPOT_H, 0); spot.target.position.set(0, 0, 0);
spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004;
scene.add(spot, spot.target);
const rim = new THREE.DirectionalLight(0x8fb4ff, 1.6); rim.position.set(-2, 2, -3); scene.add(rim);
scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x000000, 0.12));

// the beam: an open cone, brightest at the lamp and where you look straight through it
const beam = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(SPOT_A) * SPOT_H, SPOT_H, 48, 1, true), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      vY = position.y; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vN; varying vec3 vV; varying float vY;
    void main(){ float f = pow(abs(dot(vN, vV)), 2.5); float h = smoothstep(${(-SPOT_H / 2).toFixed(2)}, ${(SPOT_H / 2).toFixed(2)}, vY);
      gl_FragColor = vec4(vec3(1., .93, .82) * f * (.03 + .09 * h), 1.); }`,
}));
beam.position.y = SPOT_H / 2; scene.add(beam);

// floor: near-black, catches the spot's pool of light and Neo's shadow; the intro's ripple rings drawn on top
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x0c0d11, roughness: 0.82 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const MAX_RIPPLES = 8, RIPPLE_LIFE = 3.2;
const ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector3(0, 0, -100));
let rippleIdx = 0;
const rippleMat = new THREE.ShaderMaterial({                     // same rings as the intro's floor in app.js
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uRip: { value: ripples } },
  vertexShader: `varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position,1.); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `
    uniform float uTime; uniform vec3 uRip[${MAX_RIPPLES}]; varying vec2 vP;
    void main(){
      float c = 0.;
      for (int i = 0; i < ${MAX_RIPPLES}; i++) {
        float age = uTime - uRip[i].z;
        if (age < 0. || age > ${RIPPLE_LIFE.toFixed(1)}) continue;
        float d = length(vP - uRip[i].xy);
        float fade = pow(1. - age / ${RIPPLE_LIFE.toFixed(1)}, 2.);
        for (int k = 0; k < 3; k++) {
          float r = age * 0.42 - float(k) * 0.07;
          if (r < 0.) continue;
          float w = 0.006 + age * 0.012;
          c += exp(-pow((d - r) / w, 2.)) * fade * (1. - float(k) * 0.3);
        }
      }
      gl_FragColor = vec4(vec3(0.55, 0.72, 1.0) * c * 0.6, 1.);
    }`,
});
const rippleFloor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), rippleMat);
rippleFloor.rotation.x = -Math.PI / 2; rippleFloor.position.y = 0.002; scene.add(rippleFloor);
const clock = new THREE.Clock();
ripple = (x, z) => { ripples[rippleIdx].set(x, z, clock.elapsedTime); rippleIdx = (rippleIdx + 1) % MAX_RIPPLES; };

// dust in the beam
const DUST = still ? 0 : 260, dustGeo = new THREE.BufferGeometry(), dp = new Float32Array(DUST * 3);
for (let i = 0; i < DUST; i++) {
  const y = Math.random() * SPOT_H * 0.85, r = Math.sqrt(Math.random()) * Math.tan(SPOT_A) * (SPOT_H - y) * 0.9, a = Math.random() * 6.283;
  dp.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
const dot = document.createElement('canvas'); dot.width = dot.height = 32;
{ const x = dot.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); }
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.014, map: new THREE.CanvasTexture(dot), transparent: true,
  opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xfff1dc }));
scene.add(dust);

// ── Neo ──
let mixer, ready = false;
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('neo.glb', (g) => {
  g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  scene.add(g.scene);
  mixer = new THREE.AnimationMixer(g.scene);
  mixer.clipAction(g.animations.find((a) => a.name === 'neo_sit')).play();
  ready = true;
});

// ── cards: drawn once onto canvases from each button's data-* ──
const CW = 360, CH = 480;
const cardMeshes = buttons.map((b, i) => {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const draw = (img) => {
    const x = c.getContext('2d'), { bg = '#0f131c', ink = '#ffffff', fit = 'cover' } = b.dataset;
    x.clearRect(0, 0, CW, CH); x.save();
    x.beginPath(); x.roundRect(2, 2, CW - 4, CH - 4, 26); x.clip();
    x.fillStyle = bg; x.fillRect(0, 0, CW, CH);
    if (img) {
      if (fit === 'contain') {
        const s = Math.min(CW * 0.74 / img.width, CH * 0.6 / img.height);
        x.drawImage(img, (CW - img.width * s) / 2, CH * 0.38 - img.height * s / 2, img.width * s, img.height * s);
      } else {
        const s = Math.max(CW / img.width, CH / img.height), w = img.width * s, h = img.height * s;
        const ox = fit === 'right' ? (CW - w) * 0.85 : (CW - w) / 2, oy = fit === 'top' ? 0 : (CH - h) / 2;
        x.drawImage(img, ox, oy, w, h);
      }
      const g = x.createLinearGradient(0, CH * 0.5, 0, CH); g.addColorStop(0, 'rgba(6,8,14,0)'); g.addColorStop(1, 'rgba(6,8,14,.92)');
      x.fillStyle = g; x.fillRect(0, CH * 0.5, CW, CH * 0.5);
      x.fillStyle = '#fff'; x.font = '600 38px "Iowan Old Style", Palatino, Georgia, serif'; x.fillText(b.textContent, 24, CH - 34);
    } else {                                                  // type-only card
      x.fillStyle = ink; x.font = '600 64px "Iowan Old Style", Palatino, Georgia, serif';
      b.textContent.replace('Stack', '\nStack').split('\n').forEach((line, k) => x.fillText(line, 26, 92 + k * 66));
    }
    x.fillStyle = img ? '#f0c36a' : ink; x.globalAlpha = img ? 1 : 0.7;
    x.font = '700 17px ui-monospace, Menlo, monospace'; x.fillText(b.dataset.cat.toUpperCase(), 24, img ? CH - 84 : CH - 34);
    x.restore();
    x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2; x.beginPath(); x.roundRect(2, 2, CW - 4, CH - 4, 26); x.stroke();
    tex.needsUpdate = true;
  };
  draw();
  if (b.dataset.img) { const im = new Image(); im.onload = () => draw(im); im.src = b.dataset.img; }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, CH / CW), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  m.userData = { i, home: new THREE.Vector3(), s: 1 };
  scene.add(m);
  return m;
});

// ── layout: a half ring behind him on wide screens; on phones two shallow arcs above his head ──
let phone = false, CARD = 0.36;
function layout() {
  const aspect = innerWidth / innerHeight;
  phone = aspect < 0.8;
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = aspect; camera.fov = phone ? 52 : 38;
  if (phone) {
    CARD = 0.36;
    cardMeshes.forEach((m, i) => {
      const row = i < 4 ? 0 : 1, k = (i % 4) - 1.5, x = k * 0.44;
      m.userData.home.set(x, 1.78 - row * 0.62 - Math.abs(k) * 0.06, -0.45 - 0.25 * (k / 1.5) ** 2);
    });
    target.set(0, 0.95, 0);
    const d = Math.max(0.88 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect), 2.2);
    camBase.set(0, 1.05, d);
  } else {
    CARD = 0.36;
    const R = 1.5;
    cardMeshes.forEach((m, i) => {
      const th = THREE.MathUtils.degToRad(-100 + 200 * i / (N - 1));
      m.userData.home.set(R * Math.sin(th), 0.62 + 0.2 * Math.cos(th), -R * 0.85 * Math.cos(th));
    });
    target.set(0, 0.6, 0);
    const d = Math.max((R + 0.35) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect) + 0.4, 3.1);
    camBase.set(0, 1.15, d);
  }
  camera.updateProjectionMatrix();
}

// ── hover / focus / click ──
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), par = new THREE.Vector2();
let active = -1, hovered = -1;
const pick = (e) => {
  ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  return ray.intersectObjects(cardMeshes)[0]?.object.userData.i ?? -1;
};
addEventListener('pointermove', (e) => {
  par.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
  if (dialog.open) return;
  hovered = pick(e); renderer.domElement.style.cursor = hovered >= 0 ? 'pointer' : '';
});
renderer.domElement.addEventListener('click', (e) => { const i = pick(e); if (i >= 0) openCard(i); });
buttons.forEach((b, i) => { b.addEventListener('focus', () => (active = i)); b.addEventListener('blur', () => (active = -1)); });

function showHud(i) {
  if (i < 0) { hud.classList.remove('on'); return; }
  const m = cardMeshes[i], b = buttons[i], p = new THREE.Vector3(CARD * 0.5, CARD * CH / CW * 0.5, 0).applyMatrix4(m.matrixWorld).project(camera);
  const name = Object.assign(document.createElement('b'), { textContent: b.textContent });
  const cat = Object.assign(document.createElement('i'), { textContent: b.dataset.cat });
  hud.replaceChildren(`CARD_0${i + 1}\n`, name, '\n', cat, ' · open ↗');
  const x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight;
  const flip = x > innerWidth - 230;                         // near the right edge: put it on the card's left side
  hud.style.left = `${flip ? x - 230 : x + 40}px`; hud.style.top = `${y - 62}px`;
  hud.classList.add('on');
}

let nextRipple = 0.6, shown = false;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  rippleMat.uniforms.uTime.value = t;
  if (ready && t > nextRipple) { ripple(0, 0); nextRipple = t + 3.4; }
  mixer?.update(dt);

  // camera: a little parallax with the mouse
  camera.position.copy(camBase);
  if (!still) camera.position.x += par.x * 0.35, camera.position.y -= par.y * 0.18;
  camera.lookAt(target);

  const on = hovered >= 0 ? hovered : active;
  cardMeshes.forEach((m, i) => {
    const u = m.userData, lit = i === on;
    u.s += ((lit ? 1.16 : 1) - u.s) * Math.min(1, dt * 10);
    m.position.copy(u.home);
    if (!still) m.position.y += Math.sin(t * 0.9 + i * 1.7) * 0.025;
    m.lookAt(camera.position);
    if (lit) m.position.addScaledVector(m.getWorldDirection(new THREE.Vector3()), 0.12);
    m.scale.setScalar(CARD * u.s);
    m.material.opacity += ((on < 0 || lit ? 1 : 0.5) - m.material.opacity) * Math.min(1, dt * 8);
  });
  if (DUST) {
    for (let i = 0; i < DUST; i++) { const k = i * 3; dp[k + 1] += dt * 0.03; dp[k] += Math.sin(t * 0.3 + i) * dt * 0.01; if (dp[k + 1] > SPOT_H * 0.85) dp[k + 1] = 0; }
    dustGeo.attributes.position.needsUpdate = true;
  }
  renderer.render(scene, camera);
  showHud(dialog.open ? -1 : on);
  if (ready && !shown) { shown = true; document.documentElement.classList.add('live'); }
});
layout();
addEventListener('resize', layout);
}
