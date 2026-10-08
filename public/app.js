import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from './vendor/meshopt/meshopt_decoder.js';
// every .glb is meshopt-compressed (geometry + animation) with WebP textures — see README "Model compression"
const gltfLoader = () => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// the loft's models, fetched once: started early (as soon as Neo is tapped) so the room is complete when it appears
const LOFT_MODELS = ['car.glb', 'mechanic.glb', 'suit.glb', 'mask.glb', 'swordsman.glb'], models = {};
const loadModel = (name) => models[name] ??= gltfLoader().loadAsync(name);

// Tuning knobs
let rx = 1.3, rz = 0.5;       // walk path: an ellipse, long left↔right (rx) and shallow front↔back (rz); set in resize()
const WALK_SPEED = 0.177;    // m/s, measured from Mixamo slow "Walking" (With Skin) root motion — keeps feet from sliding
const RIPPLE_LIFE = 2.6;     // s
// Foot plants in the slow-walk clip (s into the 2.33 s cycle), measured in Blender where each foot stops
// swinging forward. His feet barely lift in this shuffle, so height-based detection misses steps.
const FOOT_PLANTS = [{ t: 0.08, side: 'Right' }, { t: 1.27, side: 'Left' }];
const MAX_RIPPLES = 16;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
const lookAt = new THREE.Vector3(0, 0.75, 0);   // aimed above Neo so the circle sits low, clear of the greeting

scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x000000, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(1.5, 3, 2.5); scene.add(key);
const rim = new THREE.DirectionalLight(0x8fb4ff, 2.5); rim.position.set(-2, 2, -3); scene.add(rim);

// Ripple floor: black, rings drawn additively where feet land
const ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector3(0, 0, -100));
let rippleIdx = 0;
const floorMat = new THREE.ShaderMaterial({
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
        for (int k = 0; k < 3; k++) {             // 3 trailing rings per step
          float r = age * 0.32 - float(k) * 0.07;
          if (r < 0.) continue;
          float w = 0.006 + age * 0.012;
          c += exp(-pow((d - r) / w, 2.)) * fade * (1. - float(k) * 0.3);
        }
      }
      gl_FragColor = vec4(vec3(0.55, 0.72, 1.0) * c * 0.7, 1.);
    }`
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

function addRipple(x, z, t) {
  ripples[rippleIdx].set(x, z, t);
  rippleIdx = (rippleIdx + 1) % MAX_RIPPLES;
}

// Neo
// The hackathon-winner coin (Tripo model slimmed in Blender: diameter 1, face toward +Z) lies at his feet; tapping him
// plays a Mixamo "Lifting" clip (lift.glb, skeleton + animation only) in which he picks it up with his right hand and
// holds it out. A flick sends it up like a shooting star that slices the screen open into the loft, where it lands.
const COIN_D = 0.16, COIN_FLOOR = [-0.06, 0.24];                // diameter (big enough to read "HACKATHON WINNER"); where it lies (his right, his forward)
const COIN_SMALL = 0.45;                                        // its scale lying on the floor; grows to 1 as he lifts it
const APPROACH_SPEED = 1.7;                                     // walk faster (clip + ground speed) when heading to the coin
const LIFT_GRAB = 43 / 30, LIFT_HOLD = 88 / 30;                 // s into the clip: hand on the floor / coin held up
const PALM_TURN = [57 / 30, 83 / 30];                            // s: his hand turns palm-up (keyed in Blender)
const CHEST_Y = 0.68;                                           // camera aims between his chest and the coin in his hand
const CLOSE_W = 0.67;                                           // close-up: metres across the smaller screen side
const COIN_ENV = 0.35;                                          // studio reflection strength in the intro (was 1.4: looked flat)
const LAUNCH_T = 1.25;                                          // s from the flick to full white
let coinEnv;
const coin = new THREE.Group(), coinSpin = new THREE.Group();  // coin = where it is, coinSpin = sway / flip
coin.add(coinSpin); scene.add(coin);
// from the start it lies small and flat at the centre of his walk; he circles it until you tap him
coin.scale.setScalar(COIN_SMALL); coin.position.set(0, COIN_D * COIN_SMALL * 0.12, 0); coin.rotation.x = -Math.PI / 2;
const ripEl = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'rip' }));   // the screen tearing open
gltfLoader().load('coin.glb', (g) => {
  const env = coinEnv = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;   // gold needs something to reflect
  // just a little studio reflection so the gold reads as metal; the intro's own key + blue rim lights do the shaping, like on Neo
  g.scene.traverse((o) => { if (o.isMesh) { o.material.envMap = env; o.material.envMapIntensity = COIN_ENV; } });
  g.scene.scale.setScalar(COIN_D);
  coinSpin.add(g.scene);
});
const coinGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(160,205,255,.85)'); r.addColorStop(1, 'rgba(40,110,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 }));
coin.add(coinGlow);
// Shooting-star trail: a camera-facing ribbon through the coin's recent positions, wide + white at the head,
// thin + blue at the tail (additive, so it glows on the black)
const TRAIL_N = 48;
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 6), 3));
trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 6), 3));
trailGeo.setIndex(Array.from({ length: TRAIL_N - 1 }, (_, i) => [i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2]).flat());
const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
trail.frustumCulled = false; trail.visible = false; scene.add(trail);
const tDir = new THREE.Vector3(), tSide = new THREE.Vector3(), tView = new THREE.Vector3(), tP = new THREE.Vector3();
function updateTrail(tail, cam) {                                   // straight streak from `tail` up to the coin
  const pos = trailGeo.attributes.position, col = trailGeo.attributes.color;
  tDir.subVectors(coin.position, tail);
  if (tDir.lengthSq() < 1e-10) tDir.set(0, 1, 0);
  for (let i = 0; i < TRAIL_N; i++) {
    const f = 1 - i / (TRAIL_N - 1);                                  // 1 at the head → 0 at the tail
    tP.lerpVectors(tail, coin.position, f);
    tSide.crossVectors(tDir, tView.subVectors(cam.position, tP)).normalize().multiplyScalar(COIN_D * (0.03 + 0.12 * f ** 2));
    pos.setXYZ(i * 2, ...tmp.copy(tP).add(tSide).toArray());
    pos.setXYZ(i * 2 + 1, ...tmp.copy(tP).sub(tSide).toArray());
    const k = 0.25 + 0.75 * f ** 2, r = (0.2 + 0.8 * f ** 6) * k, g = (0.5 + 0.5 * f ** 3) * k, b = k;
    col.setXYZ(i * 2, r, g, b); col.setXYZ(i * 2 + 1, r, g, b);
  }
  pos.needsUpdate = col.needsUpdate = true;
}
// Night sky that fades in as the coin climbs
const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(Float32Array.from(
  { length: 900 * 3 }, (_, k) => { const i = Math.floor(k / 3), th = (i * 2.399963) % (Math.PI * 2), u = (i / 900) * 1.15 - 0.15;   // golden-angle spiral: even spread
    return [14 * Math.sqrt(1 - u * u) * Math.cos(th), 14 * u, 14 * Math.sqrt(1 - u * u) * Math.sin(th)][k % 3]; }), 3)),
  new THREE.PointsMaterial({ color: 0xcfe0ff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
stars.visible = false; scene.add(stars);

let neo, mixer, walk, idle, lift, hit, hand, finger, neoClips;
let launchT = 0, landT = -1, liftUsed = false, faceYaw = 0, drag = null;   // launchT / landT time the flight
const standAt = new THREE.Vector3();                                       // where he stops to pick the coin up
const whiteEl = document.getElementById('white'), hintEl = document.getElementById('hint');
const startEl = document.getElementById('start');                 // "click anywhere to begin", shown once he's walking
startEl.textContent = matchMedia('(hover: none)').matches ? 'Tap anywhere to begin' : 'Click anywhere to begin';

// ══ YOUR CONTENT — edit everything in SITE; the panel is built from it ═══════════════════
const SITE = {
  name: 'Nehemias Landaverde',
  role: 'Computer Science Student · Montclair State University · NJ',
  bio: [
    'I’m a CS undergrad at Montclair State University (GPA 3.66). I write code in Python, Java and C, and I build full-stack web apps and interactive 3D with AI coding tools like Claude Code: I design how the pieces fit together, direct and review the code, and handle deployment, domains and security myself.',
    'This summer I joined Podium Education’s Global Career Accelerator (Web Development track), shipping deadline-driven front-end projects from wireframe to deployment and earning partner-designed certificates with Intel, L’Oréal, OpenAI and UNESCO. In October my team placed 3rd of 197 hackers at GirlHacks 2026. I’m also the founding tech lead bringing a ColorStack chapter to Montclair State, and since 2023 I’ve led shifts as a lifeguard and swim instructor for the City of Union City.',
    'Bilingual in English and Spanish, intermediate Italian (NJ Seal of Biliteracy in both). Looking for software engineering internships and early-career roles.',
  ],
  skills: ['Python', 'Java', 'C', 'AI-assisted development (Claude Code)', 'JavaScript / TypeScript (AI-assisted)', 'SQL',
    'REST APIs', 'React', 'Next.js', 'PostgreSQL', 'three.js', 'Azure', 'Cloudflare', 'Git', 'Blender', 'Mixamo'],
  projects: [                                         // strongest first
    { title: 'Hobitual', blurb: 'Placed 3rd of 197 hackers at GirlHacks 2026 (24-hour hackathon, team of three). A mobile-first app that makes hobbies a habit: starter plans, one-tap tiny wins, XP and levels, and Gemini hobby research kept server-side. I led the 3D character showcase (teammates as Tripo models, rigged and animated by a Blender Python pipeline I built with Claude Code), the per-hobby level views and the profile stage. Live on Azure with email sign-in codes and Azure SQL.',
      tags: ['Claude Code', 'three.js', 'Blender', 'Azure', 'Gemini'], live: 'https://hobitual.club', code: 'https://github.com/Alvaro-bit-stack/Hobitual', image: '' },
    { title: 'Gamify.Life', blurb: 'A full-stack app that turns real-life hobbies into an RPG: 121 skills across 10 hobbies as prerequisite graphs, an XP ledger, quests and achievements, inside a retro desktop-OS interface. Server-authoritative progression validated with Zod and committed with Postgres advisory locks, row-level security, and 125+ Vitest/Playwright tests with axe accessibility checks.',
      tags: ['Next.js', 'TypeScript', 'Supabase', 'PostgreSQL', 'Pixi.js'], live: 'https://gamify-life-amber.vercel.app', code: 'https://github.com/Neo-Land/Gamify-Life', image: '' },
    { title: 'This website', blurb: 'An interactive three.js portfolio: a rigged 3D character, a hackathon-winner coin you flick into a shooting star, and a shadow-lit loft with a pinned globe. Character pipeline from AI image-to-3D (Tripo) through Mixamo rigging and Blender cleanup. Static on Cloudflare with self-hosted dependencies, a strict CSP, HSTS and no trackers.',
      tags: ['three.js', 'WebGL', 'Blender', 'Cloudflare'], live: '', code: '', image: '' },
    { title: 'ColorStack @ Montclair State', blurb: 'Chapter website and recognition proposal for a new ColorStack chapter, growing the pipeline of Black and Latinx students in computing on campus.',
      tags: ['Web', 'Leadership'], live: '', code: 'https://github.com/Neo-Land/colorstack-msu', image: '' },
  ],
  email: ['nehe.landav', 'gmail.com'].join('@'),   // split so email-harvesting bots scanning this file don't match it
  linkedin: 'https://www.linkedin.com/in/nehemiaslandaverde/',
  github: 'https://github.com/Neo-Land',
  resume: 'Nehemias-Landaverde-Resume.pdf',           // phone-free copy of the résumé (named so it's findable in Downloads)
  cta: 'Open to internships and early-career software roles — the fastest way to reach me is email.',
};
// ═══════════════════════════════════════════════════════════════════════════════════════

const folio = document.getElementById('folio'), navEl = document.getElementById('nav'), skipEl = document.getElementById('skip');
(function fillFolio() {
  const el = (tag, props = {}, kids = []) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  const link = (href, text, cls = 'btn') => el('a', { href, className: cls, textContent: text, ...(href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {}) });
  document.getElementById('f-name').textContent = SITE.name;
  document.getElementById('f-role').textContent = SITE.role;
  document.getElementById('f-bio').append(...SITE.bio.map((t) => el('p', { textContent: t })));
  document.getElementById('f-skills').append(...SITE.skills.map((t) => el('li', { textContent: t })));
  document.getElementById('f-projects').append(...SITE.projects.map((p) => el('article', { className: 'card' }, [
    ...(p.image ? [el('img', { src: p.image, alt: '', loading: 'lazy' })] : []),
    el('div', { className: 'body' }, [
      el('h3', { textContent: p.title }),
      el('p', { textContent: p.blurb }),
      el('ul', { className: 'chips' }, p.tags.map((t) => el('li', { textContent: t }))),
      el('div', { className: 'links' }, [...(p.live ? [link(p.live, 'Live ↗', 'ui')] : []), ...(p.code ? [link(p.code, 'Code ↗', 'ui')] : [])]),
    ]),
  ])));
  document.getElementById('f-cta').textContent = SITE.cta;
  document.getElementById('f-links').append(...[
    SITE.email && link(`mailto:${SITE.email}`, 'Email me', 'btn primary'),
    SITE.linkedin && link(SITE.linkedin, 'LinkedIn ↗'),
    SITE.github && link(SITE.github, 'GitHub ↗'),
    SITE.resume && Object.assign(link(SITE.resume, 'Résumé (PDF) ↓'), { download: '' }),
  ].filter(Boolean));
  document.getElementById('f-foot').textContent = `© ${new Date().getFullYear()} ${SITE.name}`;
})();
function openFolio(id) {
  if (!folio.open) folio.showModal();
  document.getElementById(id).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
document.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => openFolio(b.dataset.open));
document.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => openFolio(b.dataset.go));
folio.querySelector('[data-close]').onclick = () => folio.close();
folio.addEventListener('click', (e) => { if (e.target === folio) folio.close(); });   // click outside the panel closes it
let skipWanted = false;
skipEl.onclick = () => skipIntro();
function skipIntro() {                     // straight to the loft (for visitors in a hurry)
  startEl.remove();
  if (!neo) { skipWanted = true; skipEl.textContent = 'Loading…'; return; }
  if (state === 'launch' || state === 'white') return;
  state = 'white'; drag = null;
  whiteEl.style.transition = 'opacity .5s'; whiteEl.style.opacity = 1;
  introEl.classList.add('gone'); skipEl.classList.add('hide'); navEl.classList.remove('hide');
  setTimeout(enterRoom, 500);
}

// ── Typed greeting (starts on page load) ──────────────────────────
const GREETINGS = [
  [['en', 'This is Nehemias'], ['it', 'Questo è Nehemias'], ['es', 'Este es Nehemias'], ['ja', 'こちらはネヘミアスです']],
];
const introEl = document.getElementById('intro');
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const quick = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const caret = document.createElement('span'); caret.className = 'caret';
  const lines = GREETINGS[0].map(([lang]) => {
    const div = document.createElement('div'); div.lang = lang;
    const txt = div.appendChild(document.createElement('span'));
    introEl.appendChild(div); return txt;
  });
  const put = (i) => lines[i].parentNode.appendChild(caret);
  async function type(set) {
    for (let i = 0; i < set.length; i++) {
      put(i);
      if (quick) { lines[i].textContent = set[i][1]; continue; }
      for (const ch of set[i][1]) {
        lines[i].appendChild(document.createElement('i')).textContent = ch;
        await wait(45 + Math.random() * 60);
      }
      await wait(260);
    }
  }
  await wait(500);
  await type(GREETINGS[0]);
})();

// ── White room + globe (beat 7) ───────────────────────────────────
// Your places: edit freely (lat/lng from any map). Each one becomes a pin in the globe.
const PLACES = [
  { name: 'Reykjavík', country: 'Iceland', lat: 64.15, lng: -21.94, note: 'Hot springs in the cold.' },
  { name: 'Cusco', country: 'Peru', lat: -13.53, lng: -71.97, note: 'Four days on the Inca Trail.' },
  { name: 'Amalfi', country: 'Italy', lat: 40.63, lng: 14.6, note: 'Cliff jumps and lemon everything.' },
  { name: 'Tokyo', country: 'Japan', lat: 35.68, lng: 139.65, note: 'Came home with a suitcase full of clothes.' },
  { name: 'Cape Town', country: 'South Africa', lat: -33.92, lng: 18.42, note: 'Up Lion’s Head for sunrise.' },
];
const PIN_HEIGHT = 0.07;                         // how far the pins poke out (fraction of the globe's radius)
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const roomEl = document.getElementById('room'), cardEl = document.getElementById('card');
// Earth textures for the globe (NASA Blue Marble + topology bump, WebP): fetched early, like the loft models
let earthTex;
let pageTex;
const loadPage = () => pageTex ??= new THREE.TextureLoader().loadAsync('resume-page.webp').then((t) => {
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  walls.page.material.map = t; walls.page.material.needsUpdate = true;
}).catch(() => {});
const loadEarth = () => earthTex ??= Promise.all(['vendor/earth-blue-marble.webp', 'vendor/earth-topology.webp']
  .map((u) => new THREE.TextureLoader().loadAsync(u)));
// The loft (after the reference photo): exposed brick, dark glossy hardwood, tall steel windows on the right with
// brick piers, black ceiling beams. Moody + warm: a low amber sun through the windows throws light streaks and grid
// shadows; dim warm ambient; the globe's blue glow is the cool contrast.
const GLOBE_R = 0.33, GLOBE_AT = new THREE.Vector3(0, 0.95, 0);  // globe size + centre in the room (Neo's head tops out at 0.45)
const loft = new THREE.Scene(), loftCam = new THREE.PerspectiveCamera(45, 1, 0.05, 40);
const BACK = -3.4, CEIL = 3, WIN_TOP = 2.45, SILL = 0.12;
const BAYS = [[-2.9, -2.1], [-1.9, -1.1], [-0.9, -0.1], [0.1, 0.9]];            // window z-ranges on the right wall; brick piers between
const BRICK_TILE = 1.7;                                          // metres per brick texture tile (bigger = larger bricks)
let roomHalf = 2.8, walls;

function canvasTex(w, h, draw, color = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const rand = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// UVs in world units (one texture tile = `tile` m) so bricks and planks are the same size on every surface
function worldUV(geo, sx, sy, tile) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx / tile, uv.getY(i) * sy / tile); }
function boxUV(geo, w, h, d, tile) {
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // BoxGeometry face order ±x, ±y, ±z
  for (let f = 0; f < 6; f++) for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
}
// Fine grit: n tiny specks between two grey/colour values, for surface texture in maps and bump maps
function grit(g, W, H, n, seed, dark, light, max = 3) {
  const r = rand(seed);
  for (let i = 0; i < n; i++) { g.fillStyle = r() < 0.5 ? dark(r()) : light(r()); g.fillRect(r() * W, r() * H, 1 + r() * max, 1 + r() * max); }
}
function pair(S) {                                          // a colour canvas + a bump canvas drawn in lockstep
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; };
  const [cm, gm] = mk(), [cb, gb] = mk();
  const tex = (c, color) => {
    const t = new THREE.CanvasTexture(c);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  return { gm, gb, done: () => ({ map: tex(cm, true), bump: tex(cb, false) }) };
}
// Dark hardwood: long planks with grain, slightly uneven boards, recessed seams, fine scratches
function woodTex() {
  const S = 1024, rowH = 48, r = rand(11), { gm, gb, done } = pair(S);
  for (let y = 0; y < S; y += rowH) {
    const x0 = r() * 500;
    let x = x0;
    while (x < S + x0) {                                   // row ends exactly where it started, one tile later
      const len = Math.min(420 + r() * 520, S + x0 - x);
      const col = `hsl(${20 + r() * 8}, ${32 + r() * 15}%, ${13 + r() * 9}%)`, h = 150 + r() * 50;
      const grain = Array.from({ length: 16 }, () => [r() < 0.6, 0.04 + r() * 0.07, 1 + r() * 2, y + r() * rowH, (r() - 0.5) * 6, (r() - 0.5) * 6, (r() - 0.5) * 4]);
      for (const ox of [0, S]) {                           // draw twice so planks wrap across the tile edge (no seam)
        const px = x - ox;
        gm.fillStyle = col; gm.fillRect(px, y, len, rowH);
        gb.fillStyle = `rgb(${h},${h},${h})`; gb.fillRect(px, y, len, rowH);
        for (const [dark, a, w, gy, d1, d2, d3] of grain) {
          const line = (g, style) => { g.strokeStyle = style; g.lineWidth = w; g.beginPath(); g.moveTo(px, gy);
            g.bezierCurveTo(px + len / 3, gy + d1, px + len * 2 / 3, gy + d2, px + len, gy + d3); g.stroke(); };
          line(gm, `rgba(${dark ? '0,0,0' : '200,150,110'},${a})`);
          line(gb, `rgba(${dark ? '0,0,0' : '255,255,255'},${a * 3})`); // grain you can see in the light
        }
        for (const g of [gm, gb]) { g.fillStyle = '#000'; g.fillRect(px, y, 3, rowH); }   // recessed plank end
      }
      x += len;
    }
    for (const g of [gm, gb]) { g.fillStyle = '#000'; g.fillRect(0, y, S, 3); }         // recessed seam between rows
  }
  grit(gm, S, S, 14000, 4, (v) => `rgba(0,0,0,${v * 0.18})`, (v) => `rgba(255,220,180,${v * 0.06})`, 2);
  grit(gb, S, S, 26000, 4, (v) => `rgba(0,0,0,${v * 0.35})`, (v) => `rgba(255,255,255,${v * 0.3})`, 2);
  const rs = rand(9);                                      // faint scratches
  for (let i = 0; i < 160; i++) {
    const x = rs() * S, y = rs() * S, a = rs() * Math.PI, l = 20 + rs() * 90;
    gm.strokeStyle = `rgba(255,225,190,${0.03 + rs() * 0.05})`; gm.lineWidth = 1;
    gm.beginPath(); gm.moveTo(x, y); gm.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); gm.stroke();
    gb.strokeStyle = 'rgba(0,0,0,.35)'; gb.lineWidth = 1;
    gb.beginPath(); gb.moveTo(x, y); gb.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); gb.stroke();
  }
  return done();
}
// Running-bond brick, 1 tile: colour + bump. Uneven, pitted faces, chipped edges, gritty recessed mortar.
// Worn navy: ink-dark to faded slate-blue bricks, some with a chalky white bloom (seen where the plaster is gone).
function brickTex() {
  const ROWS = 22, COLS = 8, S = 1024, rowH = S / ROWS, bw = S / COLS, m = 6;
  const bricks = [], r = rand(3), { gm, gb, done } = pair(S);
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const t = r();                                          // mostly mid navy, a few near-black and a few sun-faded slate ones
    const l = t < 0.1 ? 11 + r() * 5 : t > 0.88 ? 38 + r() * 10 : 18 + r() * 14;
    bricks.push({ x: i * bw + (j % 2) * bw / 2, y: j * rowH, h: 212 + r() * 16, s: t > 0.88 ? 12 + r() * 14 : 24 + r() * 26, l, bloom: r() < 0.3, seed: r() * 1e9 | 0 });
  }
  const each = (fn) => { for (const b of bricks) for (const ox of [0, -S]) fn(b, b.x + ox); };
  gm.fillStyle = '#7d7266'; gm.fillRect(0, 0, S, S);       // mortar
  gb.fillStyle = '#2a2a2a'; gb.fillRect(0, 0, S, S);
  grit(gm, S, S, 30000, 2, (v) => `rgba(40,35,30,${v * 0.4})`, (v) => `rgba(200,190,175,${v * 0.4})`, 2);
  grit(gb, S, S, 30000, 2, (v) => `rgba(0,0,0,${v * 0.6})`, (v) => `rgba(110,110,110,${v * 0.6})`, 2);
  each((b, x) => {
    const x1 = x + m / 2, y1 = b.y + m / 2, w = bw - m, h = rowH - m, v = 185 + (b.seed % 50);
    gm.fillStyle = `hsl(${b.h}, ${b.s}%, ${b.l}%)`; gm.fillRect(x1, y1, w, h);
    const tilt = gb.createLinearGradient(x1, y1, x1 + w, y1 + h);      // faces aren't perfectly flat
    tilt.addColorStop(0, `rgb(${v - 18},${v - 18},${v - 18})`); tilt.addColorStop(1, `rgb(${v + 12},${v + 12},${v + 12})`);
    gb.fillStyle = tilt; gb.fillRect(x1, y1, w, h);
    const rr = rand(b.seed);
    if (b.bloom) for (let k = 0; k < 6; k++) {               // chalky efflorescence: soft white patches
      const bx = x1 + rr() * w, by = y1 + rr() * h, br = 6 + rr() * 22, gr = gm.createRadialGradient(bx, by, 0, bx, by, br);
      gr.addColorStop(0, `rgba(225,230,235,${0.12 + rr() * 0.2})`); gr.addColorStop(1, 'rgba(225,230,235,0)');
      gm.fillStyle = gr; gm.fillRect(x1, y1, w, h);
    }
    for (let k = 0; k < 60; k++) {                          // colour speckle + soot
      gm.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '255,230,200'},${rr() * 0.2})`;
      gm.fillRect(x1 + rr() * (w - 4), y1 + rr() * (h - 4), 1 + rr() * 6, 1 + rr() * 4);
    }
    for (let k = 0; k < 30; k++) {                          // a few pits and pores
      const px = x1 + rr() * w, py = y1 + rr() * h, pr = 0.5 + rr() * 1.6;
      gb.fillStyle = `rgba(0,0,0,${0.18 + rr() * 0.27})`; gb.beginPath(); gb.arc(px, py, pr, 0, 7); gb.fill();
      gm.fillStyle = `rgba(30,15,10,${0.06 + rr() * 0.1})`; gm.beginPath(); gm.arc(px, py, pr, 0, 7); gm.fill();
    }
    for (let k = 0; k < 5; k++) {                           // chipped edges: bites of mortar into the brick outline
      const side = rr() * 4 | 0, along = rr();
      const cx = side < 2 ? x1 + along * w : side === 2 ? x1 : x1 + w, cy = side < 2 ? (side ? y1 + h : y1) : y1 + along * h;
      const cr = 2 + rr() * 5;
      gm.fillStyle = '#6f655a'; gm.beginPath(); gm.ellipse(cx, cy, cr * 1.6, cr, 0, 0, 7); gm.fill();
      gb.fillStyle = '#3a3a3a'; gb.beginPath(); gb.ellipse(cx, cy, cr * 1.6, cr, 0, 0, 7); gb.fill();
    }
  });
  grit(gb, S, S, 40000, 7, (v) => `rgba(0,0,0,${v * 0.25})`, (v) => `rgba(255,255,255,${v * 0.2})`, 1.5);   // fine sand grain
  return done();
}
const WALL_TILE = BRICK_TILE * 2;                                  // the plaster texture spans 2×2 brick tiles
const wrapDraw = (S, x, y, r, fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) if (x + ox > -r && x + ox < S + r && y + oy > -r && y + oy < S + r) fn(x + ox, y + oy); };
// Worn lime plaster over the brick: warm and mottled, hairline cracks, chipped away in patches where brick shows
function plasterTex({ map, bump }) {
  const S = 2048, r = rand(Math.random() * 1e9 | 0), { gm, gb, done } = pair(S);   // new wear on every visit              // covers 2×2 brick tiles (WALL_TILE) so it repeats less
  for (const x of [0, 1024]) for (const y of [0, 1024]) { gm.drawImage(map.image, x, y); gb.drawImage(bump.image, x, y); }
  gb.fillStyle = 'rgba(0,0,0,.5)'; gb.fillRect(0, 0, S, S);                       // the brick sits deeper than the plaster
  const holes = new Path2D();
  for (let i = 0, n = 5 + r() * 5 | 0; i < n; i++) {                               // ragged patches of bare brick, big and small
    const big = r() < 0.4, cx = r() * S, cy = r() * S, rx = (big ? 200 : 60) + r() * (big ? 300 : 140), ry = rx * (0.5 + r() * 0.4), pts = [];
    let j = 1; for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; j = Math.min(1.25, Math.max(0.35, j + (r() - 0.5) * 0.28)); pts.push([Math.cos(a) * rx * j, Math.sin(a) * ry * j]); }
    wrapDraw(S, cx, cy, Math.max(rx, ry) * 1.2, (x, y) => { holes.moveTo(x + pts[0][0], y + pts[0][1]); for (const [px, py] of pts) holes.lineTo(x + px, y + py); holes.closePath(); });
  }
  gm.strokeStyle = 'rgba(25,15,8,.55)'; gm.lineWidth = 14; gm.stroke(holes);        // shadow of the plaster lip inside each hole
  const plaster = new Path2D(); plaster.rect(0, 0, S, S); plaster.addPath(holes);
  for (const g of [gm, gb]) { g.save(); g.clip(plaster, 'evenodd'); }
  gm.fillStyle = 'hsl(34, 22%, 70%)'; gm.fillRect(0, 0, S, S);
  gb.fillStyle = 'rgb(205,205,205)'; gb.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {                                                    // mottling: soft darker / lighter clouds
    const x = r() * S, y = r() * S, rad = 30 + r() * 160, dark = r() < 0.6, a = 0.03 + r() * 0.08;
    wrapDraw(S, x, y, rad, (px, py) => { const gr = gm.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, dark ? `rgba(120,95,70,${a})` : `rgba(255,245,225,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      gm.fillStyle = gr; gm.fillRect(px - rad, py - rad, rad * 2, rad * 2); });
  }
  grit(gm, S, S, 100000, 31, (v) => `rgba(70,55,40,${v * 0.12})`, (v) => `rgba(255,250,235,${v * 0.1})`, 2);
  grit(gb, S, S, 120000, 32, (v) => `rgba(0,0,0,${v * 0.25})`, (v) => `rgba(255,255,255,${v * 0.25})`, 2);
  for (let i = 0; i < 40; i++) {                                                    // hairline cracks
    let x = r() * S, y = r() * S, a = r() * Math.PI * 2;
    gm.beginPath(); gb.beginPath(); gm.moveTo(x, y); gb.moveTo(x, y);
    for (let k = 0; k < 14; k++) { a += (r() - 0.5) * 1.1; x += Math.cos(a) * 9; y += Math.sin(a) * 9; gm.lineTo(x, y); gb.lineTo(x, y); }
    gm.strokeStyle = 'rgba(60,45,30,.35)'; gm.lineWidth = 1; gm.stroke(); gb.strokeStyle = 'rgba(0,0,0,.6)'; gb.lineWidth = 1.5; gb.stroke();
  }
  gm.strokeStyle = 'rgba(255,248,235,.35)'; gm.lineWidth = 5; gm.stroke(holes);     // raised, light-catching plaster lip
  gb.strokeStyle = 'rgb(235,235,235)'; gb.lineWidth = 6; gb.stroke(holes);
  for (const g of [gm, gb]) g.restore();
  return done();
}
// Steel window grid: black bars on transparent (cols × rows panes); also casts the grid shadow
function mullionTex(cols, rows) {
  return canvasTex(512, 1024, (g, W, H) => {
    g.fillStyle = '#000'; const f = 22, b = 9;
    g.fillRect(0, 0, W, f); g.fillRect(0, H - f, W, f); g.fillRect(0, 0, f, H); g.fillRect(W - f, 0, f, H);
    for (let i = 1; i < cols; i++) g.fillRect(i * W / cols - b / 2, 0, b, H);
    for (let j = 1; j < rows; j++) g.fillRect(0, j * H / rows - b / 2, W, b);
  });
}
// Golden-hour city outside the windows
function skyTex() {
  return canvasTex(2048, 1024, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#3d4a66'); gr.addColorStop(0.45, '#c98a5a'); gr.addColorStop(0.75, '#f3b877'); gr.addColorStop(1, '#ffd9a3');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const r = rand(21);
    for (let x = 0; x < W;) {                               // skyline + a few lit windows
      const w = 40 + r() * 120, h = H * (0.18 + r() * 0.38), top = H - h;
      g.fillStyle = `rgba(${28 + r() * 20},${24 + r() * 16},${30 + r() * 20},${0.85 + r() * 0.15})`; g.fillRect(x, top, w, h);
      for (let k = 0; k < w * h / 900; k++) if (r() < 0.25) { g.fillStyle = `rgba(255,${190 + r() * 50},120,${0.4 + r() * 0.5})`; g.fillRect(x + 4 + r() * (w - 10), top + 6 + r() * (h - 12), 3, 4); }
      x += w + r() * 10;
    }
  });
}
function buildLoft() {
  const { map: brick, bump } = brickTex();
  const steel = new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.5, metalness: 0.6 });
  const plane = (w, h, mat, tile) => { const geo = new THREE.PlaneGeometry(w, h); if (tile) worldUV(geo, w, h, tile); const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; return m; };
  const box = (w, h, d, mat, tile) => { const geo = new THREE.BoxGeometry(w, h, d); if (tile) boxUV(geo, w, h, d, tile); const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; };

  // worn plaster walls over the navy brick; a warm wooden ceiling and beams
  const p = plasterTex({ map: brick, bump });
  const wallMat = new THREE.MeshStandardMaterial({ map: p.map, bumpMap: p.bump, bumpScale: 3, roughness: 0.92 });
  const w = woodTex();
  const ceilMat = new THREE.MeshStandardMaterial({ map: w.map, bumpMap: w.bump, bumpScale: 1, roughness: 0.7, color: new THREE.Color(2.4, 2, 1.6) });
  const beamMat = new THREE.MeshStandardMaterial({ map: w.map, roughness: 0.6, color: new THREE.Color(1.9, 1.55, 1.25) });
  const wood = woodTex();
  const floor = plane(12, 12, new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 1.6, roughness: 0.42 }), 1.6);
  floor.rotation.x = -Math.PI / 2;
  const back = plane(12, CEIL, wallMat, WALL_TILE); back.position.set(0, CEIL / 2, BACK);
  const left = plane(6 - BACK, CEIL, wallMat, WALL_TILE); left.rotation.y = Math.PI / 2;   // from the back wall forward, not out into the view
  const ceiling = plane(12, 12, ceilMat, BRICK_TILE); ceiling.rotation.x = Math.PI / 2; ceiling.position.y = CEIL;
  loft.add(floor, back, left, ceiling);
  for (const z of [-1.5, -0.3, 0.9, 2.1]) { const b = box(12, 0.16, 0.1, beamMat); b.position.set(0, CEIL - 0.08, z); loft.add(b); }
  const duct = box(0.3, 0.22, 12, steel); duct.position.set(-0.7, CEIL - 0.3, 0);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 12, 12), steel); pipe.rotation.x = Math.PI / 2; pipe.position.set(0.55, CEIL - 0.24, 0);
  loft.add(duct, pipe);

  // Right wall: brick piers between tall steel windows, a sill below and a header above (all cast shadows)
  const right = new THREE.Group(), T = 0.22, L = 8, zc = BACK + L / 2;
  const add = (m, x, y, z) => { m.position.set(x, y, z); right.add(m); };
  add(box(T, SILL, L, wallMat, WALL_TILE), T / 2, SILL / 2, zc);
  add(box(T, CEIL - WIN_TOP, L, wallMat, WALL_TILE), T / 2, (WIN_TOP + CEIL) / 2, zc);
  const piers = [[BACK, BAYS[0][0]], ...BAYS.slice(1).map((b, i) => [BAYS[i][1], b[0]]), [BAYS.at(-1)[1], BACK + L]];
  for (const [z0, z1] of piers) add(box(T + 0.06, WIN_TOP - SILL, z1 - z0, wallMat, WALL_TILE), T / 2 - 0.03, (SILL + WIN_TOP) / 2, (z0 + z1) / 2);
  const grid = new THREE.MeshStandardMaterial({ map: mullionTex(3, 6), color: 0x0d0e10, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6 });
  for (const [z0, z1] of BAYS) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, WIN_TOP - SILL), grid);
    w.rotation.y = -Math.PI / 2; w.castShadow = true;
    add(w, T * 0.4, (SILL + WIN_TOP) / 2, (z0 + z1) / 2);
  }
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: skyTex(), toneMapped: false }));
  sky.rotation.y = -Math.PI / 2;
  add(sky, 4, 2.4, -0.5);
  walls = { left, right, back, floor, ceiling, car: new THREE.Group(), nook: new THREE.Group() };
  loft.add(walls.car, walls.nook);
  // Résumé corner: a tiny campfire between the swordsman's chair and the suit rack, the résumé page floating above it
  // in the firelight (placed in layoutRoom). Once you're there, a tap on the page opens the PDF in a new tab.
  const camp = walls.camp = new THREE.Group(); loft.add(camp);
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3b2414, roughness: 0.9 }), stoneMat = new THREE.MeshStandardMaterial({ color: 0x5f5b57, roughness: 0.95 });
  for (let i = 0; i < 3; i++) {                                         // three logs crossed in a star
    const g = new THREE.Group(), log = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.3, 8), logMat);
    log.rotation.z = Math.PI / 2; log.position.y = 0.024 + i * 0.016; log.castShadow = true; g.rotation.y = i * Math.PI / 3; g.add(log); camp.add(g);
  }
  for (let i = 0; i < 10; i++) {                                        // ring of stones
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.03 + (i * 7 % 3) * 0.006), stoneMat), a = i / 10 * Math.PI * 2;
    st.position.set(Math.cos(a) * 0.19, 0.022, Math.sin(a) * 0.19); st.rotation.set(i, i * 2, 0); st.scale.y = 0.7; camp.add(st);
  }
  camp.flames = [[0xff5a1a, 0.06, 0.2], [0xff9a2a, 0.045, 0.16], [0xffd65a, 0.028, 0.11]].map(([color, r, h]) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    f.position.y = 0.06 + h / 2; f.userData.h = h; camp.add(f); return f;
  });
  camp.light = new THREE.PointLight(0xff8a3d, 1.4, 2.6, 2); camp.light.position.y = 0.3; camp.add(camp.light);
  const page = walls.page = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62 * 1811 / 1400), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide, transparent: true, opacity: PAGE_DIM }));
  camp.add(page);
  loft.add(right);

  // Lighting: moody and warm
  const pmrem = new THREE.PMREMGenerator(renderer);
  loft.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;  // soft reflections so the floor reads glossy
  loft.environmentIntensity = 0.16;
  loadCarCorner(walls.car);
  buildNook(walls.nook);
  // invisible click targets for the sections (generous, so they're easy to hit on phones)
  const hotspot = (geo) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
  walls.globeHit = hotspot(new THREE.SphereGeometry(GLOBE_R * 1.3)); walls.globeHit.position.copy(GLOBE_AT); loft.add(walls.globeHit);
  walls.carHit = hotspot(new THREE.BoxGeometry(1.4, 1.2, 3.4)); walls.carHit.position.set(0, 0.6, 0.2); walls.car.add(walls.carHit);
  walls.nookHit = hotspot(new THREE.BoxGeometry(1.5, 1.45, 1.0)); walls.nookHit.position.set(-0.75, 0.72, 0.15); walls.nook.add(walls.nookHit);
  loft.add(new THREE.HemisphereLight(0xffc896, 0x140c08, 0.35));
  const fill = new THREE.DirectionalLight(0xffa860, 0.4);                  // faint warm front fill so Neo isn't a silhouette
  fill.position.set(-1.5, 2, 4);
  loft.add(fill);
  const sun = new THREE.DirectionalLight(0xffae62, 5);                     // low amber sun through the windows
  sun.position.set(6, 2.6, 2.2); sun.target.position.set(-0.6, 0, -1.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 16 });
  loft.add(sun, sun.target);
  const glow = new THREE.PointLight(0x4d8dff, 2.6, 3.2, 1.8);             // the globe's blue light spilling onto Neo and the floor
  glow.position.copy(GLOBE_AT); walls.glow = glow;
  loft.add(glow);
}
// The car corner: a Tripo coupe (cabin flattened in Blender, hood up) with mechanic Neo bent over the engine
// turning a wrench (keyframed in Blender on Neo's skeleton). Loaded after the loft is up so entering never waits.
const CAR_SCALE = 2.45;                                           // car.glb is modelled ~1 m long; Neo is ~1 unit tall
const MECH_AT = [-0.15, 0, 1.42];                                // at the front bumper, leaning into the open engine bay
const mixers = [];                                                // the loft's extra animated characters
function loadCarCorner(group) {
  loadModel('car.glb').then((g) => {
    g.scene.scale.setScalar(CAR_SCALE);
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.material.envMap = loft.environment; o.material.envMapIntensity = 0.5; } });
    group.add(g.scene);
  });
  loadModel('mechanic.glb').then((g) => {
    const mech = g.scene;
    mech.position.set(...MECH_AT); mech.rotation.y = Math.PI;        // facing the car
    mech.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    group.add(mech);
    const m = new THREE.AnimationMixer(mech); m.clipAction(g.animations[0]).play(); mixers.push(m);
  });
}
// The hobby nook — a homage, not a replica: the yellow zoot suit (mannequin stripped out in Blender) hangs from a
// wooden coat tree with the fedora on top and an original carved green mask on a side peg. Local layout: chair on the
// left, coat tree on the right, everything facing +z.
const NOOK = { x: -0.4, top: 1.3, peg: 1.08 };                       // coat tree position, post height, upper peg tier
function buildNook(group) {
  const { x, top, peg } = NOOK;
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3822, roughness: 0.55 });
  const tree = new THREE.MeshStandardMaterial({ color: 0x4a1f16, roughness: 0.45 });   // dark cherry, like the reference
  const add = (geo, mat, px, py, pz, rx = 0, rz = 0, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.set(rx, ry, rz, 'YXZ'); m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  const add2 = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  // coat tree: turned post with collars, four splayed feet, two tiers of upturned pegs with round tips, a finial
  add(new THREE.CylinderGeometry(0.02, 0.026, top - 0.1, 14), tree, x, 0.1 + (top - 0.1) / 2, 0);
  for (const y of [0.18, 0.46, 0.78]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.035, 14), tree, x, y, 0);
  add(new THREE.SphereGeometry(0.026, 14, 10), tree, x, top, 0);
  const pegAt = (y, a, len = 0.15, tilt = 0.95) => {     // a = heading around the post (0 = +z), tilt = angle from vertical
    const dir = new THREE.Vector3(Math.sin(a) * Math.sin(tilt), Math.cos(tilt), Math.cos(a) * Math.sin(tilt));
    const tip = new THREE.Vector3(x, y, 0).addScaledVector(dir, len);
    add(new THREE.CylinderGeometry(0.009, 0.011, len, 8), tree, x + dir.x * len / 2, y + dir.y * len / 2, dir.z * len / 2, tilt, 0, a);
    add(new THREE.SphereGeometry(0.014, 10, 8), tree, tip.x, tip.y, tip.z);
    return tip;
  };
  const tips = [];
  for (let i = 0; i < 4; i++) {
    add(new THREE.BoxGeometry(0.03, 0.03, 0.3), tree, x + Math.sin(i * Math.PI / 2 + Math.PI / 4) * 0.12, 0.075, Math.cos(i * Math.PI / 2 + Math.PI / 4) * 0.12, 0.5, 0, i * Math.PI / 2 + Math.PI / 4);
    tips.push(pegAt(peg, i * Math.PI / 2, i ? 0.13 : 0.16));
  }
  const maskPeg = tips[3];                                                       // upper left peg, just behind the suit
  for (const a of [0.8, 1.9, 3.4, 5.2]) pegAt(peg - 0.26, a, 0.13);
  const dress = (o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; };
  loadModel('suit.glb').then((g) => {
    g.scene.traverse(dress);
    // wrap each piece: its own node transform holds the compression's dequantisation, so it must not be overwritten
    const hold = (name) => { const h = new THREE.Group(); h.add(g.scene.getObjectByName(name)); return h; };
    const suit = hold('suit'), hat = hold('hat');
    suit.scale.setScalar(1.08); suit.position.set(x, peg + 0.08, 0.14);              // collar hooked on the front peg
    hat.scale.setScalar(1.08); hat.position.set(x, top - 0.03 - 0.12 * 1.08, 0);   /* the hat node sits 0.12 up inside suit.glb */ hat.rotation.set(-0.1, 0.3, 0.12);  // tipped on the finial
    group.add(suit, hat);
  });
  loadModel('mask.glb').then((g) => {                                               // hung by its strap, peeking out over the left shoulder
    g.scene.scale.setScalar(0.16); g.scene.position.set(maskPeg.x - 0.05, maskPeg.y - 0.09, -0.06);
    g.scene.rotation.set(0.06, -0.3, 0);                                         // face turned toward the room
    g.scene.traverse(dress); group.add(g.scene);
  });
  // swashbuckler Neo slouched on a wooden chair (pose keyframed in Blender), gripping his rapier (modelled in
  // Blender and parented to his hand bone, so it moves with him)
  const seat = walls.seat = new THREE.Group(); group.add(seat);                    // placed in layoutRoom
  add2(seat, new THREE.BoxGeometry(0.29, 0.03, 0.27), wood, 0, 0.235, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add2(seat, new THREE.BoxGeometry(0.03, 0.235, 0.03), wood, sx * 0.12, 0.1175, sz * 0.115);
  const back = new THREE.Group(); back.position.set(0, 0.25, -0.125); back.rotation.x = -0.17; seat.add(back);
  for (const sx of [-1, 1]) add2(back, new THREE.BoxGeometry(0.03, 0.34, 0.03), wood, sx * 0.12, 0.17, 0);
  for (const y of [0.2, 0.3]) add2(back, new THREE.BoxGeometry(0.22, 0.05, 0.018), wood, 0, y, 0);
  loadModel('swordsman.glb').then((g) => {
    const man = g.scene;
    man.traverse((o) => {
      dress(o); if (!o.isMesh) return;
      o.frustumCulled = false;
      if (o.material.name.startsWith('rapier')) { o.material.envMap = loft.environment; o.material.envMapIntensity = 1.2; }   // steel catches the light
    });
    seat.add(man);
    const m = new THREE.AnimationMixer(man); m.clipAction(g.animations[0]).play(); m.update(0); mixers.push(m);
  });
}
const PAGE_Y = 0.86, PAGE_DIM = 0.5, CAMP_FORWARD = 0.9;                                     // page centre height; its opacity until opened
let cvOpen = false;                                                     // résumé zoomed in to read
// Campfire flicker + the page bobbing gently above it (idle animation: the 30 fps idle render is plenty)
function updateCamp(dt, t) {
  const c = walls.camp, k = c.userData.op ?? 1;                        // fades with the rest of the corner
  const pm = walls.page.material, want = cvOpen ? 1 : PAGE_DIM;        // see-through until "Open résumé", then solid
  c.userData.pageOp = calm ? want : THREE.MathUtils.lerp(c.userData.pageOp ?? PAGE_DIM, want, 1 - Math.exp(-dt * 5));
  pm.opacity = c.userData.pageOp * k;
  c.light.intensity = 1.4 * k * (calm ? 1 : 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3));
  if (calm) return;
  c.flames.forEach((f, i) => { f.scale.set(1 + 0.08 * Math.sin(t * 9 + i), 0.85 + 0.25 * Math.abs(Math.sin(t * (6 + i * 1.7) + i)), 1); f.position.y = 0.06 + f.userData.h * f.scale.y / 2; f.rotation.y = t * (0.6 + i * 0.3); });
  walls.page.position.y = PAGE_Y + (cvOpen ? 0 : Math.sin(t * 1.3) * 0.015);   // holds still while you read
}
const pageAt = (e) => (ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), ray.setFromCamera(ptr, loftCam), ray.intersectObject(walls.page).length > 0);
// Room width + camera adapt to the screen; places the walls and the globe overlay
function layoutRoom() {
  const a = innerWidth / innerHeight, t = Math.tan(THREE.MathUtils.degToRad(loftCam.fov / 2));
  roomHalf = a < 1 ? 1.6 : 2.8;                                        // narrower loft on phones so the windows stay in view
  const d = Math.max(3, (roomHalf + 0.05) / (t * a) - 0.7);            // far enough back to see the window wall
  const turn = a < 1 ? 0.35 : 0;                                      // on phones, angle the view toward the windows
  overview.pos.set(-turn, 0.8, d); overview.look.set(turn * 0.6, 0.62, 0);
  loftCam.aspect = a; loftCam.updateProjectionMatrix();
  walls.left.position.set(-roomHalf, CEIL / 2, (6 + BACK) / 2);
  walls.right.position.x = roomHalf;
  for (const m of [walls.back, walls.floor, walls.ceiling]) m.position.x = roomHalf - 6;   // stop at the window wall (12 m wide)
  // parked in the back-left corner, nose angled out (nearly head-on on phones, where the room is narrow)
  walls.car.position.set(-roomHalf + (a < 1 ? 0.7 : 1.1), 0, BACK + (a < 1 ? 1.5 : 1.15));
  walls.car.rotation.y = Math.PI / 2 - (a < 1 ? 1.2 : 0.7);
  walls.car.updateMatrixWorld();
  // narrow screens: seated Neo + globe shift a little left, opening a gap so the hobby nook shows beside them
  GLOBE_AT.x = a < 1 ? -0.22 : 0;
  walls.globeHit.position.copy(GLOBE_AT); walls.glow.position.copy(GLOBE_AT);
  // the globe turns its face to the "About me" camera (spin + tilt happen inside)
  const [eye] = viewOf('globe');
  globe.root.rotation.y = Math.atan2(eye.x - GLOBE_AT.x, eye.z - GLOBE_AT.z);
  if (neo.parent === loft) neo.position.x = GLOBE_AT.x;
  // hobby nook by the windows, turned most of the way toward the camera
  walls.nook.position.set(roomHalf - 0.75, 0, -1.8);
  walls.nook.rotation.y = 0.75 * Math.atan2(overview.pos.x - walls.nook.position.x, overview.pos.z - walls.nook.position.z);
  // the swordsman's chair, left of the coat tree
  walls.seat.position.set(-1.12, 0, 0.3); walls.seat.rotation.y = 0;
  walls.nook.updateMatrixWorld();
  if (a < 1) {   // phones: coat tree tucked into the back-right corner, the swordsman's chair almost against the back wall,
    // both turned to face the camera
    walls.nook.rotation.y = Math.atan2(overview.pos.x - (roomHalf - 0.32), overview.pos.z - (BACK + 0.32));
    walls.nook.updateMatrixWorld();
    const tree = walls.nook.localToWorld(new THREE.Vector3(NOOK.x, 0, 0));
    walls.nook.position.x += roomHalf - 0.32 - tree.x; walls.nook.position.z += BACK + 0.32 - tree.z;
    walls.nook.updateMatrixWorld();
    walls.seat.position.copy(walls.nook.worldToLocal(new THREE.Vector3(0.5, 0, BACK + 0.4)));
    walls.seat.rotation.y = Math.atan2(overview.pos.x - 0.5, overview.pos.z - BACK - 0.4) - walls.nook.rotation.y;
  }
  // campfire out in front of the swordsman's chair and the suit rack (toward the viewer); the page floats above it,
  // turned to the résumé view
  const mid = walls.seat.localToWorld(new THREE.Vector3()).lerp(walls.nook.localToWorld(new THREE.Vector3(NOOK.x, 0, 0)), 0.5).setY(0);
  walls.camp.position.copy(mid).add(overview.pos.clone().sub(mid).setY(0).setLength(CAMP_FORWARD));
  const cvEye = viewOf('resume', false)[0], toEye = cvEye.clone().sub(walls.camp.position).setY(0).setLength(0.15);
  walls.page.position.set(toEye.x, PAGE_Y, toEye.z);
  walls.camp.updateMatrixWorld(true);
  walls.page.lookAt(cvEye);
  if (!fly) { globeK = globeKFor(focus); setCam(...viewOf(focus)); }
}
function setCam(pos, look) {
  loftCam.position.copy(pos); camLook.copy(look); loftCam.lookAt(look);
  loftCam.updateMatrixWorld();                                          // project() (signs) needs the new view
}

// Loft sections. The overview shows them all; picking one (its hanging sign, or clicking it in the room) flies the
// camera in, and only then does that section respond (the globe only spins once you've zoomed to it).
const SECTIONS = [
  { id: 'globe', sign: 'About me!', burst: '#ffd400', ink: '#e8282b', tip: 'Spin the globe · pick a pin',
    look: () => new THREE.Vector3(GLOBE_AT.x, 0.58, 0), signAt: () => GLOBE_AT.clone().setY(GLOBE_AT.y + GLOBE_R + 0.42), hits: () => [hit, walls.globeHit] },
  { id: 'car', sign: 'Projects!', burst: '#ff8a1f', ink: '#29a9ef', tip: 'Garage under construction · more soon',
    look: () => walls.car.localToWorld(new THREE.Vector3(0, 0.4, 0.5)), signAt: () => walls.car.localToWorld(new THREE.Vector3(0, 1.05, 0.3)), hits: () => [walls.carHit] },
  { id: 'resume', sign: 'Résumé!', burst: '#4fc35a', ink: '#ffd400', tip: 'Open the résumé to read it',
    look: () => walls.camp.position.clone().setY(innerWidth < innerHeight ? 0.55 : 0.8),   // the campfire (aimed higher on wide screens: room for the page)
    // phones: come in high, from straight in front of the nook, so the seated Neo doesn't block the view
    eye: () => innerWidth < innerHeight ? overview.pos.clone().lerp(walls.nook.position, 0.6).setY(1.9) : undefined, signAt: () => walls.nook.localToWorld(new THREE.Vector3(NOOK.x - 0.42, NOOK.top + 0.32, 0)), hits: () => [walls.nookHit, walls.camp] },
];
// Decorative bursts (not clickable) that pop up only while their section is in focus
const DECOR = [];
const OVERVIEW_TIP = 'Pick a spot to explore', ZOOM_IN = 0.5, FLY_TIME = 1.4;   // ZOOM_IN: share of the way the camera flies toward a section
const overview = { pos: new THREE.Vector3(), look: new THREE.Vector3() }, camLook = new THREE.Vector3();
let focus = null, fly = null, globeK = 1;
// on narrow screens the globe stays small in the overview (it crowds the room) and grows when "About me" is opened
const globeKFor = (id) => id === 'globe' || innerWidth >= innerHeight ? 1 : 0.55;
const viewOf = (id, zoomed = true) => {
  if (!id) return [overview.pos.clone(), overview.look.clone()];
  if (id === 'resume' && cvOpen && zoomed) {                            // square on to the page, filling the screen
    const p = walls.page.getWorldPosition(new THREE.Vector3()).setY(PAGE_Y), n = new THREE.Vector3(0, 0, 1).applyQuaternion(walls.page.getWorldQuaternion(new THREE.Quaternion()));
    const tn = Math.tan(THREE.MathUtils.degToRad(loftCam.fov / 2)), g = walls.page.geometry.parameters;
    const d = Math.max(g.height * 1.08 / 2 / tn, g.width * 1.08 / 2 / (tn * innerWidth / innerHeight));
    return [p.clone().addScaledVector(n, d), p];
  }
  const sec = SECTIONS.find((s) => s.id === id), look = sec.look(), eye = sec.eye?.() ?? overview.pos.clone().lerp(look, ZOOM_IN);
  if (id === 'globe' && !cardEl.hidden) return [eye.sub(GLOBE_AT).setLength(GLOBE_R * 3.4).add(GLOBE_AT), GLOBE_AT.clone()];   // close on a pin
  return [eye, look];
};
const tipEl = roomEl.querySelector('.tip'), backEl = document.getElementById('back'), cvEl = document.getElementById('cv'), cvBtn = document.getElementById('cv-open');
document.getElementById('cv-dl').href = SITE.resume;
// "Open résumé" flies the camera up to the page and makes it solid; again (or Back / Esc) settles back by the fire
function readCv(on) {
  cvOpen = on;
  fly = { t: 0, from: [loftCam.position.clone(), camLook.clone()], to: viewOf('resume'), k: [globeK, globeK] };
  cvBtn.textContent = on ? 'Close résumé' : 'Open résumé';
  tipEl.textContent = on ? 'Download it below' : SECTIONS.find((s) => s.id === 'resume').tip;
}
cvBtn.onclick = () => readCv(!cvOpen);
function goTo(id) {
  if (focus === 'globe' && !cardEl.hidden) cardEl.querySelector('.x').click();
  if (cvOpen) { cvOpen = false; cvBtn.textContent = 'Open résumé'; }
  focus = id;
  fly = { t: 0, from: [loftCam.position.clone(), camLook.clone()], to: viewOf(id), k: [globeK, globeKFor(id)] };
  roomEl.dataset.focus = id || '';
  roomEl.classList.remove('picked');
  tipEl.textContent = id ? SECTIONS.find((s) => s.id === id).tip : OVERVIEW_TIP;
  backEl.hidden = !id;
  cvEl.hidden = id !== 'resume';
  if (id) backEl.focus();
}
backEl.onclick = () => cvOpen ? readCv(false) : goTo(null);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && focus && !folio.open) backEl.onclick(); });
const flyPos = new THREE.Vector3(), flyLook = new THREE.Vector3();
// While a section is open, the other sections' 3D props fade out so nothing peeks into its view
const PROPS = { globe: () => [neo, coin, globe.root], car: () => [walls.car], resume: () => [walls.nook, walls.camp] };
function fadeSections(dt) {
  let busy = false;
  for (const s of SECTIONS) for (const o of PROPS[s.id]()) {
    const want = focus && focus !== s.id ? 0 : 1, op = o.userData.op ?? 1;
    if (op === want) continue;
    busy = true;
    const next = o.userData.op = calm ? want : THREE.MathUtils.clamp(op + Math.sign(want - op) * dt / 0.5, 0, 1);
    o.visible = next > 0;
    o.traverse((m) => { for (const mat of m.material ? [].concat(m.material) : []) {
      mat.userData.op0 ??= mat.opacity; mat.userData.tr0 ??= mat.transparent;
      const tr = mat.userData.tr0 || next < 1;
      if (tr !== mat.transparent) { mat.transparent = tr; mat.needsUpdate = true; }
      mat.opacity = mat.userData.op0 * next;
    } });
  }
  return busy;
}
function updateLoftView(dt) {
  if (fly) {
    fly.t = Math.min(1, fly.t + dt / (calm ? 1e-3 : FLY_TIME));
    const e = ease(fly.t);
    globeK = THREE.MathUtils.lerp(fly.k[0], fly.k[1], e);
    setCam(flyPos.lerpVectors(fly.from[0], fly.to[0], e), flyLook.lerpVectors(fly.from[1], fly.to[1], e));
    if (fly.t === 1) fly = null;
  }
  const fading = fadeSections(dt);
  // signs follow their spot on screen; read every height first, then write, so the browser lays out once per frame
  const signs = [...SECTIONS, ...DECOR].filter((s) => s.el), hs = signs.map((s) => s.el.offsetHeight);
  signs.forEach((s, i) => {
    const v = s.signAt().project(loftCam);
    const y = Math.max((1 - v.y) / 2 * innerHeight, hs[i] + 64);                  // never above the top menu
    const tf = `translate(${(v.x + 1) / 2 * innerWidth}px, ${y}px) translate(-50%, -100%)`;
    if (s.el.style.transform !== tf) s.el.style.transform = tf;                  // untouched while the camera is still
    const hide = !!(v.z > 1 || (s.section ? focus !== s.section : focus && focus !== s.id) || (focus === 'resume' && s.id === 'resume'));   // the floating page takes its place
    if (s.el.hidden !== hide) s.el.hidden = hide;
  });
  return !!fly || fading;                                               // still moving: render at full rate
}
// Comic burst: a jagged star outline, halftone dots fading across it, chunky outlined letters, all through a grain
// filter so it reads like cheap newsprint. Shape jitter is seeded per sign so each one is a little different.
const SVG = 'http://www.w3.org/2000/svg';
function comicBurst(s, i) {
  const r = rand(97 + i * 31), N = 15, pts = [];
  for (let k = 0; k < N * 2; k++) {
    const a = (k / (N * 2)) * Math.PI * 2 + (r() - 0.5) * 0.12, out = k % 2 === 0;
    const rad = out ? 1 + r() * 0.16 : 0.7 + r() * 0.06;
    pts.push(`${(Math.cos(a) * 118 * rad).toFixed(1)},${(Math.sin(a) * 74 * rad).toFixed(1)}`);
  }
  const id = `b${i}`, svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '-140 -95 280 190');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <defs>
      <pattern id="${id}d" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
        <circle cx="3.5" cy="3.5" r="1.7" fill="#000" opacity=".28"/></pattern>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset=".35" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#fff"/></linearGradient>
      <mask id="${id}m"><rect x="-140" y="-95" width="280" height="190" fill="url(#${id}g)"/></mask>
      <filter id="${id}n" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="3" seed="${i + 3}" result="n"/>
        <feColorMatrix in="n" type="saturate" values="0" result="g"/>
        <feComposite in="SourceGraphic" in2="g" operator="arithmetic" k1="1" k2=".42"/>
      </filter>
    </defs>
    <g filter="url(#${id}n)">
      <polygon points="${pts.join(' ')}" fill="${s.burst}" stroke="#111" stroke-width="5" stroke-linejoin="round"/>
      <polygon points="${pts.join(' ')}" fill="url(#${id}d)" mask="url(#${id}m)"/>
      <g transform="rotate(-6) skewX(-8)" font-family="Bangers, Impact, 'Arial Black', sans-serif" font-weight="400"
         font-size="${Math.min(50, 560 / s.sign.length).toFixed(1)}" text-anchor="middle" letter-spacing="1">
        <text y="17" x="4" dy="4" fill="#111" stroke="#111" stroke-width="10" stroke-linejoin="round"></text>
        <text y="17" fill="${s.ink}" stroke="#111" stroke-width="7" stroke-linejoin="round" paint-order="stroke"></text>
        <text y="17" fill="none" stroke="#fff" stroke-width="1.6" opacity=".55" transform="translate(-1.5 -2)"></text>
      </g>
    </g>`;
  for (const t of svg.querySelectorAll('text')) { t.textContent = s.sign.toUpperCase(); t.setAttribute('textLength', 188); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
  return svg;
}
function sectionAt(e) {
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, loftCam);
  return SECTIONS.find((s) => ray.intersectObjects(s.hits()).length);
}

const LAND_DELAY = 0.45, LAND_T = 0.8;                            // s after the light starts fading / to fall
function landCoin(dt) {
  landT += dt;
  const u = Math.min(Math.max((landT - LAND_DELAY) / LAND_T, 0), 1), e = u * u;    // accelerates as it falls
  coin.visible = trail.visible = landT >= LAND_DELAY;
  coin.position.lerpVectors(landFrom, landAt, e);
  coinSpin.rotation.x = -Math.PI / 2 - (1 - e) * Math.PI * 6;                     // flipping, settles face up
  const b = Math.min(Math.max((landT - LAND_DELAY - LAND_T) / 0.4, 0), 1);        // one small bounce
  coin.position.y += Math.sin(b * Math.PI) * 0.035 * (1 - b);
  updateTrail(landFrom, loftCam);
  const fade = Math.min(Math.max((landT - LAND_DELAY - LAND_T) / 0.6, 0), 1);
  trail.material.opacity = 1 - fade; coinGlow.material.opacity = 1 - fade; coinGlow.scale.setScalar(COIN_D * 2.6);
  if (fade === 1) { trail.visible = false; landT = -1; }
}
async function enterRoom() {
  if (walls) return;                              // already in the loft
  hintEl.remove();
  navEl.classList.remove('hide'); skipEl.classList.add('hide');
  buildLoft();
  layoutRoom();
  // Neo walks out of the void into the loft and sits down under the globe
  loft.add(neo);
  neo.position.set(GLOBE_AT.x, 0, 0.15); neo.rotation.set(0, 0, 0);
  neo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  mixer.stopAllAction();
  mixer.clipAction(neoClips.find((c) => c.name === 'neo_sit')).play();
  // the coin falls into the loft as a shooting star and lands on the floor in front of him
  loft.add(coin, trail); stars.visible = false;
  // shade it like the rest of the loft: reflect the room's own environment, catch the sun's shadows, cast its own
  coinSpin.traverse((o) => { if (o.isMesh) { o.material.envMap = loft.environment; o.material.envMapIntensity = 0.6; o.castShadow = o.receiveShadow = true; } });
  coin.visible = trail.visible = true; coin.quaternion.identity(); coinSpin.rotation.set(0, 0, 0); coin.scale.setScalar(1);
  landAt.set(GLOBE_AT.x + 0.42, COIN_D * 0.12, 0.72); landFrom.copy(landAt).add(tmp.set(-0.8, 3, -0.5));
  coin.position.copy(landFrom); coin.visible = trail.visible = false;   // it falls in once the light starts to fade
  buildGlobe();
  freeIntro();
  // Render on demand: full rate while something moves (camera flight, fades, the coin landing, globe drag/turn);
  // otherwise only the idle loops (breathing, wrench, slow spin) are left, and 30 fps is plenty for those. Nothing
  // at all is drawn while the portfolio panel covers the room (and browsers already pause hidden tabs).
  const clock2 = new THREE.Clock();
  let acc = 0, busy = true;
  renderer.setAnimationLoop(() => {
    const raw = clock2.getDelta();
    if (folio.open) return;
    acc += raw;
    if (!busy && acc < 1 / 30) return;
    const dt = Math.min(acc, 0.05); acc = 0;
    mixer.update(dt); for (const m of mixers) m.update(dt);
    busy = updateLoftView(dt);
    busy = updateGlobe(dt, clock2.elapsedTime) || busy;
    updateCamp(dt, clock2.elapsedTime);
    if (landT >= 0) { landCoin(dt); busy = true; }
    renderer.render(loft, loftCam);
  });
  roomEl.hidden = false;
  tipEl.textContent = OVERVIEW_TIP;
  document.getElementById('signs').replaceChildren(...SECTIONS.map((s) => {
    const b = document.createElement('button');
    b.className = 'sign'; b.ariaLabel = s.sign; b.append(comicBurst(s, SECTIONS.indexOf(s)));
    b.onclick = () => goTo(s.id);
    return (s.el = b);
  }), ...DECOR.map((s, i) => {
    const d = document.createElement('div');
    d.className = 'sign decor'; d.hidden = true; d.append(comicBurst(s, SECTIONS.length + i));
    return (s.el = d);
  }));
  // Stay fully white until the loft can actually be shown — models placed, textures in, shaders compiled, a frame
  // drawn — so the light fades straight into the room (fading at once showed the black canvas while it got ready)
  await Promise.race([Promise.all([...LOFT_MODELS.map(loadModel), loadEarth(), loadPage()]).catch(() => {}), new Promise((r) => setTimeout(r, 6000))]);
  await renderer.compileAsync(loft, loftCam).catch(() => {});
  await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
  landT = 0;
  roomEl.classList.add('in');
  whiteEl.style.transition = 'opacity 1.6s';                           // the light fades to reveal the loft
  whiteEl.style.opacity = 0;
}
function pickPlace(d) {
  if (focus !== 'globe') goTo('globe');
  const dir = latLng(d.lat, d.lng);                                    // turn the pin to face you, then fly in close
  globe.turn = { tilt: Math.asin(dir.y), spin: nearAngle(globe.spin.rotation.y, -Math.atan2(dir.x, dir.z)) };
  globe.hold = true;
  for (const p of globe.pins) p.head.scale.setScalar(p.d === d ? 1.4 : 1);
  document.getElementById('c-name').textContent = d.name;
  document.getElementById('c-country').textContent = d.country;
  document.getElementById('c-note').textContent = d.note;
  cardEl.hidden = false;
  roomEl.classList.add('picked');
  fly = { t: 0, from: [loftCam.position.clone(), camLook.clone()], to: viewOf('globe'), k: [globeK, 1] };   // in close (card is open)
}
cardEl.querySelector('.x').onclick = () => {
  cardEl.hidden = true;
  roomEl.classList.remove('picked');
  for (const p of globe.pins) p.head.scale.setScalar(1);
  globe.hold = false;
  globe.turn = { tilt: HOME_TILT, spin: globe.spin.rotation.y };      // level back out, then carry on spinning
  if (focus === 'globe') fly = { t: 0, from: [loftCam.position.clone(), camLook.clone()], to: viewOf('globe'), k: [globeK, 1] };
};

// ── The globe: a textured Earth floating above Neo, part of the loft scene (same renderer, same lights) ──
// root (position, size, faces the About-me camera) > tilt (x: latitude toward you) > spin (y: longitude) > earth + pins
const globe = { root: new THREE.Group(), tilt: new THREE.Group(), spin: new THREE.Group(), pins: [], earth: null, aura: null,
  drag: null, turn: null, hold: false };
globe.root.add(globe.tilt); globe.tilt.add(globe.spin);
const HOME_TILT = 25 * Math.PI / 180, SPIN_SPEED = Math.PI * 2 / 120;   // northern hemisphere toward you; a turn every 2 min
const D2R = Math.PI / 180;
// unit vector for a lat/lng on three's SphereGeometry with an equirectangular map (lng 0 at +x, east toward -z)
const latLng = (lat, lng) => new THREE.Vector3(Math.cos(lat * D2R) * Math.cos(lng * D2R), Math.sin(lat * D2R), -Math.cos(lat * D2R) * Math.sin(lng * D2R));
const nearAngle = (from, to) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));      // shortest way round
function buildGlobe() {
  const R = GLOBE_R;
  globe.earth = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48),
    new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.35 }));   // self-lit a little: it glows
  globe.earth.castShadow = true;
  loadEarth().then(([map, bump]) => {
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    Object.assign(globe.earth.material, { map, emissiveMap: map, bumpMap: bump, bumpScale: 1.5 });
    globe.earth.material.needsUpdate = true;
  });
  // blue aura behind it (was a CSS gradient): additive sprite, hidden where the Earth is in front of it
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [o, col] of [[0.38, 'rgba(120,180,255,.75)'], [0.55, 'rgba(60,130,255,.38)'], [0.75, 'rgba(40,100,255,.12)'], [1, 'rgba(40,100,255,0)']]) grad.addColorStop(o, col);
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  globe.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  globe.aura.scale.setScalar(R * 2 * 2.3);
  globe.root.add(globe.aura);
  globe.spin.add(globe.earth);
  // pins: a steel needle out of the surface with an orange head (plus a bigger invisible tap target)
  const steel = new THREE.MeshStandardMaterial({ color: 0xc4c8d0, metalness: 0.8, roughness: 0.3 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff6a3d, roughness: 0.4, emissive: 0xff6a3d, emissiveIntensity: 0.3 });
  const h = R * PIN_HEIGHT * 1.6, up = new THREE.Vector3(0, 1, 0);
  for (const d of PLACES) {
    const dir = latLng(d.lat, d.lng), pin = new THREE.Group();
    pin.position.copy(dir).multiplyScalar(R); pin.quaternion.setFromUnitVectors(up, dir);
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.007, R * 0.007, h, 8), steel); needle.position.y = h / 2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(R * 0.035, 16, 12), orange); head.position.y = h;
    const hit = new THREE.Mesh(new THREE.SphereGeometry(R * 0.1, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = h;
    pin.add(needle, head, hit); globe.spin.add(pin);
    globe.pins.push({ d, head, hit });
  }
  globe.tilt.rotation.x = HOME_TILT;
  globe.spin.rotation.y = -Math.atan2(latLng(25, 10).x, latLng(25, 10).z);   // start on Europe/Africa, like before
  loft.add(globe.root);
  // keyboard / screen-reader access to the pins (visually hidden until focused)
  document.getElementById('places').replaceChildren(...PLACES.map((d) => {
    const b = document.createElement('button');
    b.className = 'place'; b.textContent = `${d.name}, ${d.country}`; b.onclick = () => pickPlace(d);
    return b;
  }));
}
function updateGlobe(dt, t) {
  globe.root.position.copy(GLOBE_AT).setY(GLOBE_AT.y + (calm ? 0 : Math.sin(t * Math.PI / 3) * 0.02));   // slow bob
  globe.root.scale.setScalar(globeK);
  globe.aura.scale.setScalar(GLOBE_R * 2 * 2.3 * (calm ? 1 : 1 + 0.035 * (1 - Math.cos(t * Math.PI / 2))));   // pulse
  if (globe.turn) {
    const k = 1 - Math.exp(-dt * 5);
    globe.tilt.rotation.x += (globe.turn.tilt - globe.tilt.rotation.x) * k;
    globe.spin.rotation.y += (globe.turn.spin - globe.spin.rotation.y) * k;
    if (Math.abs(globe.turn.tilt - globe.tilt.rotation.x) + Math.abs(globe.turn.spin - globe.spin.rotation.y) < 1e-3) globe.turn = null;
  } else if (!globe.drag && !globe.hold && !calm) globe.spin.rotation.y += SPIN_SPEED * dt;
  return !!(globe.turn || globe.drag);
}
// drag to spin (once "About me" is open); a tap that doesn't move picks the pin under it
const globeRay = (e) => { ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, loftCam); return ray; };
function pinAt(e) {
  const hits = globeRay(e).intersectObjects([globe.earth, ...globe.pins.map((p) => p.hit)]);
  return hits[0] && globe.pins.find((p) => p.hit === hits[0].object)?.d;   // the Earth in front blocks pins round the back
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!walls || focus !== 'globe' || !globeRay(e).intersectObject(walls.globeHit).length) return;
  globe.drag = { x: e.clientX, y: e.clientY, moved: 0 }; globe.turn = null;
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch {}
});
renderer.domElement.addEventListener('pointermove', (e) => {
  const g = globe.drag; if (!g) return;
  const dx = e.clientX - g.x, dy = e.clientY - g.y; g.x = e.clientX; g.y = e.clientY; g.moved += Math.abs(dx) + Math.abs(dy);
  const k = 3 / Math.min(innerWidth, innerHeight);                                       // a full-screen drag ≈ half a turn
  globe.spin.rotation.y += dx * k;
  globe.tilt.rotation.x = THREE.MathUtils.clamp(globe.tilt.rotation.x + dy * k, -1.2, 1.2);
});
const endGlobeDrag = (e) => {
  const g = globe.drag; if (!g) return;
  globe.drag = null;
  const d = g.moved < 6 && pinAt(e);
  if (d) pickPlace(d);
};
renderer.domElement.addEventListener('pointerup', endGlobeDrag);
renderer.domElement.addEventListener('pointercancel', () => { globe.drag = null; });
// once in the loft, the intro's void (ripple floor, stars, lights, the coin's studio reflections) is never seen again
function freeIntro() {
  scene.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material ?? [])) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); }
  });
  coinEnv?.dispose();
  scene.clear();
}
const feet = {};
let walkPrev = 0;
let state = 'walking', angle = 0, turnFrom = 0, turnTo = 0, turnT = 0, zoomS = 0;
const camFrom = new THREE.Vector3(), lookFrom = new THREE.Vector3();

gltfLoader().load('neo.glb', (gltf) => {
  neo = gltf.scene;
  scene.add(neo);
  neo.traverse((o) => {
    if (o.isMesh) o.frustumCulled = false; // skinned bounds don't follow the animation
    const foot = o.isBone && o.name.match(/(Left|Right)Foot$/);
    if (foot) feet[foot[1]] = o;
  });

  hand = neo.getObjectByName('mixamorigRightHand'); finger = neo.getObjectByName('mixamorigRightHandIndex1');

  mixer = new THREE.AnimationMixer(neo);
  neoClips = gltf.animations;
  const clip = (n) => gltf.animations.find((a) => a.name === n);
  walk = mixer.clipAction(clip('neo_slow_walk'));
  idle = mixer.clipAction(clip('neo_idle'));
  gltfLoader().load('lift.glb', (g) => {                       // bends down, picks the coin up, holds it out
    lift = mixer.clipAction(THREE.AnimationUtils.subclip(g.animations[0], 'neo_lift', 0, LIFT_HOLD * 30, 30));
    lift.setLoop(THREE.LoopOnce); lift.clampWhenFinished = true;
  });
  walk.play();

  // Invisible, generous tap target (easier on phones than hitting the mesh)
  hit = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.05), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.52;
  neo.add(hit);
  if (skipWanted) skipIntro();
  else setTimeout(() => state === 'walking' && startEl.classList.add('on'), 1800);
});

const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
renderer.domElement.addEventListener('click', (e) => {
  if (focus === 'resume' && !cvOpen && pageAt(e)) return readCv(true);   // tapping the page opens it too
  if (!walls || focus) return;
  const s = sectionAt(e);
  if (s) goTo(s.id);
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (state === 'walking' && neo) tapNeo();       // tap / click anywhere → he stops, faces the camera, picks up the coin
  else if (state === 'ready') {                // flick the coin up; it launches when you let go
    drag = { y: e.clientY };                   // flick up: the coin starts turning with your finger
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch {} // keep the drag even if the finger leaves the canvas
  }
});
function endDrag() {
  if (!drag) return;
  drag = null;                                 // end of the flick: it flies up and away
  state = 'launch'; launchT = 0;
  launchDir.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(0.5).add(tmp.set(0, 1, 0)).normalize();   // up and to the right on screen
  hintEl.classList.remove('on');
  trail.visible = stars.visible = true;
}
renderer.domElement.addEventListener('pointerup', endDrag);
renderer.domElement.addEventListener('pointercancel', endDrag);
function tapNeo() {
  startEl.remove();
  for (const m of LOFT_MODELS) loadModel(m);   // start downloading the loft while he picks up the coin
  loadEarth(); loadPage();
  introEl.classList.add('gone');
  navEl.classList.add('hide'); skipEl.classList.add('hide');
  // he'll end up facing the camera with the coin just in front of his right foot: walk there first
  faceYaw = Math.atan2(camera.position.x - coin.position.x, camera.position.z - coin.position.z);
  const f = new THREE.Vector3(Math.sin(faceYaw), 0, Math.cos(faceYaw)), r = new THREE.Vector3(f.z, 0, -f.x);
  standAt.copy(coin.position).addScaledVector(r, COIN_FLOOR[0]).addScaledVector(f, -COIN_FLOOR[1]).setY(0);
  state = 'approach'; walk.timeScale = APPROACH_SPEED;
}
function pickUp() {                            // face the camera and bend down for it
  state = 'turning'; walk.timeScale = 1;
  liftUsed = !!lift;
  const next = liftUsed ? lift : idle;         // (idle if the clip hasn't arrived yet: the coin just jumps to his hand)
  next.reset().play();
  walk.crossFadeTo(next, 0.5, false);
  turnFrom = neo.rotation.y;
  turnTo = turnFrom + Math.atan2(Math.sin(faceYaw - turnFrom), Math.cos(faceYaw - turnFrom)); // shortest way round
  turnT = 0;
  qFlat.copy(coin.quaternion);
}
renderer.domElement.addEventListener('pointermove', (e) => {
  if (drag) { coinSpin.rotation.x += (drag.y - e.clientY) * 0.03; drag.y = e.clientY; }   // the coin turns with your flick
  if (e.pointerType === 'mouse') renderer.domElement.style.cursor = walls ? (!focus && sectionAt(e) ? 'pointer' : focus === 'resume' ? (!cvOpen && pageAt(e) ? 'pointer' : '') : focus === 'globe' ? (globe.drag ? 'grabbing' : pinAt(e) ? 'pointer' : globeRay(e).intersectObject(walls.globeHit).length ? 'grab' : '') : '') :
    state === 'walking' ? 'pointer' : state === 'ready' ? (drag ? 'grabbing' : 'grab') : '';
});

function resize() {
  const a = innerWidth / innerHeight;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = a;
  // Narrower oval on portrait phones, and pull back until its full width fits on screen
  [rx, rz] = a < 1 ? [0.75, 0.35] : [1.3, 0.5];
  const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * a;
  const dist = Math.max(3.8, (rx + 0.45) / halfW);                     // pulled back: whole body in view all the way round
  camera.position.set(0, dist * 0.42, dist);
  camera.updateProjectionMatrix();
}
addEventListener('resize', () => {
  resize();
  if (walls) layoutRoom();
});
resize();

const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
const ease = (t) => t * t * (3 - 2 * t);

// Where the camera aims (near the held coin) and where the coin sits in his fingers, recomputed every frame
const P = { show: { p: new THREE.Vector3(), q: new THREE.Quaternion() } };
const fwd = new THREE.Vector3(), handAt = new THREE.Vector3(), palmAt = new THREE.Vector3(), qFlat = new THREE.Quaternion(), qHeld = new THREE.Quaternion();
function updateSpots() {
  neo.updateMatrixWorld(true);
  fwd.set(Math.sin(neo.rotation.y), 0, Math.cos(neo.rotation.y));
  P.show.q.copy(neo.quaternion);                                           // face out of his front, toward the camera
  hand.getWorldPosition(handAt); finger.getWorldPosition(tmp);
  palmAt.lerpVectors(handAt, tmp, 0.7); palmAt.y += COIN_D * 0.65;        // floating just above his upturned palm (clears it even mid-spin)
  handAt.lerp(tmp, 1.6);                                                   // just past the knuckles, between his fingers
  qHeld.copy(neo.quaternion);                                              // floating above the palm, facing the camera
  P.show.p.copy(neo.position).setY(CHEST_Y).lerp(palmAt, 0.5);
}
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const launchFrom = new THREE.Vector3(), launchDir = new THREE.Vector3(), landFrom = new THREE.Vector3(), landAt = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  floorMat.uniforms.uTime.value = t;

  if (neo) {
    if (state === 'walking') {
      // constant ground speed on the ellipse: advance the angle by distance / path length per radian here
      const tx = -rx * Math.sin(angle), tz = rz * Math.cos(angle);
      angle += (WALK_SPEED / Math.hypot(tx, tz)) * dt;
      neo.position.set(Math.cos(angle) * rx, 0, Math.sin(angle) * rz);
      neo.rotation.y = Math.atan2(-rx * Math.sin(angle), rz * Math.cos(angle)); // face along the path
    } else if (state === 'turning') {
      turnT = Math.min(turnT + dt / 0.9, 1);
      neo.rotation.y = turnFrom + (turnTo - turnFrom) * ease(turnT);
      if (turnT === 1) { state = 'zooming'; zoomS = 0; camFrom.copy(camera.position); lookFrom.copy(lookAt); }
    } else if (state === 'approach') {          // straight to the coin, turning toward it as he goes
      tmp.subVectors(standAt, neo.position).setY(0);
      const d = tmp.length(), h = Math.atan2(tmp.x, tmp.z);
      neo.rotation.y += Math.atan2(Math.sin(h - neo.rotation.y), Math.cos(h - neo.rotation.y)) * (1 - Math.exp(-dt * 6));
      neo.position.addScaledVector(tmp.normalize(), Math.min(d, WALK_SPEED * APPROACH_SPEED * dt));
      if (d < 0.01) pickUp();
    }
    mixer.update(dt);

    // One ripple per footstep: fire when the walk clip's time passes a foot plant (handles the loop wrap)
    const wt = walk.time;
    if (state === 'walking' || state === 'approach') for (const { t: pt, side } of FOOT_PLANTS) {
      if (walkPrev <= wt ? pt > walkPrev && pt <= wt : pt > walkPrev || pt <= wt) {
        feet[side].getWorldPosition(tmp);
        addRipple(tmp.x, tmp.z, t);
      }
    }
    walkPrev = wt;
    updateSpots();
    if (state === 'turning' || state === 'zooming') {
      // on the floor until his hand gets there, then in his fingers, turning from flat to face the camera
      const lt = liftUsed ? lift.time : LIFT_HOLD;
      if (lt >= LIFT_GRAB) {                       // gripped between his fingers, then lying on the palm as it turns up
        const w = ease(Math.min(Math.max((lt - PALM_TURN[0]) / (PALM_TURN[1] - PALM_TURN[0]), 0), 1));
        coin.position.lerpVectors(handAt, palmAt, w);
        const k = easeInOut(Math.min((lt - LIFT_GRAB) / (PALM_TURN[1] - LIFT_GRAB), 1));
        coin.quaternion.slerpQuaternions(qFlat, qHeld, k);                 // flat → facing the camera
        coin.scale.setScalar(COIN_SMALL + (1 - COIN_SMALL) * k);           // and growing to full size
      }
    }
    if (state !== 'walking' && state !== 'approach' && state !== 'turning') {
      // Close-up on the held coin (a little wider than before), Neo behind it
      const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(camera.aspect, 1);
      const camTo = P.show.p.clone().addScaledVector(fwd, CLOSE_W / 2 / half);
      if (state === 'zooming') {
        zoomS += dt;
        const k = ease(Math.min(zoomS / 3.2, 1));                // slow camera push-in
        camera.position.lerpVectors(camFrom, camTo, k);
        lookAt.lerpVectors(lookFrom, P.show.p, k);
        if (k === 1 && (!liftUsed || !lift.isRunning())) state = 'ready';
      } else if (state === 'ready') {
        coin.position.copy(palmAt).add(tmp.set(0, Math.sin(t * 2.2) * 0.008, 0));   // hovering, bobbing gently
        coin.quaternion.copy(qHeld);
        coinSpin.rotation.y = Math.sin(t * 1.3) * 0.12;                // a slight wobble so the gold catches the light
        camera.position.copy(camTo); lookAt.copy(P.show.p);
        launchFrom.copy(coin.position);
        hintEl.classList.toggle('on', !drag);
      } else if (state === 'launch') {
        // up and to the right, flipping end over end, straight off the top of the screen; the streak it leaves then
        // splits open into white along its whole length, slicing the screen in half
        launchT = Math.min(launchT + dt, LAUNCH_T);
        const u = launchT;
        coin.position.copy(launchFrom).addScaledVector(launchDir, 3.2 * u ** 1.5);
        coinSpin.rotation.x += dt * 30;
        updateTrail(launchFrom, camera);
        coinGlow.material.opacity = Math.min(u * 4, 1); coinGlow.scale.setScalar(COIN_D * 2.6);
        stars.material.opacity = Math.min(u / 0.5, 1) * 0.9;
        const a = launchFrom.clone().project(camera), b = launchFrom.clone().add(launchDir).project(camera);
        const ax = (a.x + 1) / 2 * innerWidth, ay = (1 - a.y) / 2 * innerHeight;
        const ang = Math.atan2(-(b.y - a.y) * innerHeight, (b.x - a.x) * innerWidth);
        const rk = Math.min(Math.max((u - 0.45) / 0.65, 0), 1);
        ripEl.style.display = rk > 0 ? 'block' : 'none';
        ripEl.style.height = `${(rk ** 2.2 * 2.2 * Math.hypot(innerWidth, innerHeight)).toFixed(1)}px`;
        ripEl.style.transform = `translate(${ax}px, ${ay}px) translate(-50%, -50%) rotate(${ang}rad)`;
        if (launchT === LAUNCH_T) {                                // → the loft
          whiteEl.style.transition = 'none'; whiteEl.style.opacity = 1; ripEl.remove();
          state = 'white'; enterRoom();
        }
      }
    }
  }
  camera.lookAt(lookAt);
  renderer.render(scene, camera);
});


