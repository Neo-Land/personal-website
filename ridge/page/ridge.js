// Ridge proof scene. The terrain, far peaks and campfire come pre-lit from a Cycles bake (ridge/build_ridge.py) and
// are shown unlit; only Neo, the flames, the fire's light on him, snow and embers are live. Scroll drives the camera
// along a path from a wide shot of the ridge down to Neo by the fire.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt/meshopt_decoder.js';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FIRE = new THREE.Vector3(0.15, 0, 0.75);              // must match FIRE in build_ridge.py (axes converted)
const FOG = 0x8e9bb3;                                      // = the CSS sky's horizon colour

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG, 0.022);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 400);

// live light for Neo only (the baked world ignores it): cool sky, low warm sun from behind-left, the fire
scene.add(new THREE.HemisphereLight(0x8fa4c8, 0x2a2f3a, 1.1));
const sun = new THREE.DirectionalLight(0xffb48a, 1.6); sun.position.set(-10, 1.8, -6); scene.add(sun);
const fireLight = new THREE.PointLight(0xff7a2a, 3, 4, 1.6); fireLight.position.copy(FIRE).setY(0.25); scene.add(fireLight);

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
loader.load('ridge.glb', (g) => {
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    const map = o.material.map; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    o.material = new THREE.MeshBasicMaterial({ map, toneMapped: false });   // the bake already is the final light
  });
  scene.add(g.scene);
});
let mixer;
loader.load('neo.glb', (g) => {
  g.scene.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  g.scene.rotation.y = -0.35;                                              // turned a little toward the fire
  scene.add(g.scene);
  mixer = new THREE.AnimationMixer(g.scene);
  mixer.clipAction(g.animations.find((a) => a.name === 'neo_sit')).play();
});

// flames: three additive cones that flicker, plus a soft glow sprite
const dot = (inner, outer) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), r = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, inner); r.addColorStop(1, outer); x.fillStyle = r; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
};
const flames = [0xffd27a, 0xff8a2a, 0xff4a10].map((color, i) => {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.07 - i * 0.012, 0.32 - i * 0.05, 8, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.copy(FIRE).setY(0.16 - i * 0.02); scene.add(m); return m;
});
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot('rgba(255,170,80,.9)', 'rgba(255,90,20,0)'), blending: THREE.AdditiveBlending, depthWrite: false }));
glow.position.copy(FIRE).setY(0.18); glow.scale.setScalar(0.9); scene.add(glow);

// snow: a box of flakes around the camp, falling and drifting, wrapped at the bottom
const SNOW = still ? 600 : 2200, BOX = 18;
const snowGeo = new THREE.BufferGeometry(), sp = new Float32Array(SNOW * 3);
for (let i = 0; i < SNOW; i++) sp.set([(Math.random() - 0.5) * BOX, Math.random() * 8, (Math.random() - 0.5) * BOX], i * 3);
snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.045, map: dot('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
  transparent: true, depthWrite: false, fog: true }));
scene.add(snow);
// embers: a few sparks rising off the fire
const EMB = 40, embGeo = new THREE.BufferGeometry(), ep = new Float32Array(EMB * 3), life = new Float32Array(EMB);
embGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3));
const embers = new THREE.Points(embGeo, new THREE.PointsMaterial({ size: 0.025, color: 0xffa040, map: dot('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(embers);
const resetEmber = (i) => { ep.set([FIRE.x + (Math.random() - 0.5) * 0.15, 0.1, FIRE.z + (Math.random() - 0.5) * 0.15], i * 3); life[i] = Math.random(); };
for (let i = 0; i < EMB; i++) resetEmber(i);

// camera path: wide over the ridge → down along it → settled by Neo and the fire
const camPath = new THREE.CatmullRomCurve3([[16, 7, 20], [9, 3.4, 11], [4.2, 1.6, 5.2], [1.9, 0.9, 2.6], [0.95, 0.62, 1.75]].map((p) => new THREE.Vector3(...p)));
const lookPath = new THREE.CatmullRomCurve3([[0, 0, 0], [0, 0.2, 0], [0.05, 0.3, 0.2], [0.1, 0.35, 0.35], [0.05, 0.38, 0.3]].map((p) => new THREE.Vector3(...p)));
const look = new THREE.Vector3(), readout = document.getElementById('readout');
let p = 0;
const progress = () => Math.min(Math.max(scrollY / (document.documentElement.scrollHeight - innerHeight), 0), 1);

function size() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.8 ? 52 : 38;                               // phones: wider so the camp still fits
  camera.updateProjectionMatrix();
}
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  const want = progress();
  p += still ? want - p : (want - p) * Math.min(1, dt * 3);              // eased: the camera glides after your scroll
  const e = p * p * (3 - 2 * p);
  camPath.getPointAt(e, camera.position); lookPath.getPointAt(e, look); camera.lookAt(look);
  readout.textContent = `RIDGE_01 · ${String(Math.round(want * 100)).padStart(2, '0')}%`;

  mixer?.update(dt);
  const f = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
  flames.forEach((m, i) => { m.scale.set(1, f + i * 0.04 * Math.sin(t * 9 + i), 1); m.rotation.y = t * (0.6 + i * 0.3); });
  fireLight.intensity = 3 * f; glow.material.opacity = 0.75 + (f - 1) * 1.5;

  for (let i = 0; i < SNOW; i++) {                                        // fall + a slow sideways sway
    const k = i * 3;
    sp[k + 1] -= dt * (0.35 + (i % 7) * 0.05);
    sp[k] += Math.sin(t * 0.7 + i) * dt * 0.08;
    if (sp[k + 1] < -0.5) sp[k + 1] += 8.5;
  }
  snowGeo.attributes.position.needsUpdate = true;
  for (let i = 0; i < EMB; i++) {
    life[i] += dt * 0.6;
    if (life[i] > 1) resetEmber(i);
    ep[i * 3 + 1] += dt * 0.5; ep[i * 3] += Math.sin(t * 3 + i) * dt * 0.05;
  }
  embGeo.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
});
size();
addEventListener('resize', size);
