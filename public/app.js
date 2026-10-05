import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
// Ticket: two halves (main + stub) split at the perforation, so the tear (beat 6) can pull them apart
const TICKET_W = 0.15, TICKET_H = 0.06, PERF = 0.72;   // perforation at 72% of the width
// Spots on Neo's rest pose (three.js: +Z = his front), measured on the mesh in Blender
const POCKET = [-0.078, 0.512, 0.038], POCKET_TILT = 0.5;      // his right front pocket; top leans out past the jacket hem
const FLY_TOP = [0, 0.505, 0.063], FLY_BOT = [0, 0.45, 0.03];  // the seam: just under the belt buckle, downward
const FLY_GAP = 0.012;                                          // ticket floats this far in front of the seam

function ticketTexture() {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 480;
  const g = c.getContext('2d'), px = 1200 * PERF, font = (w, s) => `${w} ${s}px system-ui, -apple-system, Helvetica, Arial, sans-serif`;
  const label = (s, x, y) => { g.fillStyle = '#7a7f8c'; g.font = font(600, 22); g.fillText(s, x, y); };
  const value = (s, x, y, size = 40) => { g.fillStyle = '#151a22'; g.font = font(700, size); g.fillText(s, x, y); };
  const barcode = (x0, x1, y, h) => { let x = x0, n = 7; g.fillStyle = '#151a22';
    while (x < x1) { n = (n * 37 + 11) % 97; const w = 3 + (n % 4) * 3; g.fillRect(x, y, w, h); x += w + 3 + (n % 3) * 3; } };
  g.save(); g.beginPath(); g.roundRect(0, 0, 1200, 480, 34); g.clip();
  g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 1200, 480);
  g.fillStyle = '#1d2b53'; g.fillRect(0, 0, 1200, 100);
  g.fillStyle = '#ffffff'; g.font = font(800, 46); g.fillText('BOARDING PASS', 44, 66);
  g.font = font(700, 30); g.fillText('NL 2005', px + 36, 62);
  label('PASSENGER', 44, 150); value('NEHEMIAS', 44, 196);
  label('FROM', 44, 250); value('EWR', 44, 335, 92);
  g.fillStyle = '#ff6a3d'; g.font = font(700, 64); g.fillText('✈', 280, 322);
  label('TO', 400, 250); value('ANY', 400, 335, 92);
  label('FLIGHT', 640, 150); value('NL 2005', 640, 196, 34);
  label('GATE', 640, 250); value('B12', 640, 292, 34);
  label('SEAT', 640, 345); value('1A', 640, 387, 34);
  barcode(44, 580, 380, 64);
  label('PASSENGER', px + 36, 150); value('NEHEMIAS', px + 36, 190, 28);
  label('ROUTE', px + 36, 245); value('EWR → ANY', px + 36, 285, 30);
  label('SEAT', px + 36, 335); value('1A', px + 36, 372, 30);
  barcode(px + 36, 1160, 400, 50);
  g.restore();
  // perforation: dashed line + notches cut out top and bottom
  g.strokeStyle = '#a3a3a3'; g.lineWidth = 4; g.setLineDash([14, 12]);
  g.beginPath(); g.moveTo(px, 40); g.lineTo(px, 440); g.stroke();
  g.globalCompositeOperation = 'destination-out';
  for (const y of [0, 480]) { g.beginPath(); g.arc(px, y, 24, 0, Math.PI * 2); g.fill(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function makeTicket() {
  const mat = new THREE.MeshStandardMaterial({ map: ticketTexture(), side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.55 });
  const half = (u0, u1) => {
    const geo = new THREE.PlaneGeometry(TICKET_W * (u1 - u0), TICKET_H);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0));
    geo.translate(TICKET_W * ((u0 + u1) / 2 - PERF), 0, 0); // group origin sits on the perforation
    return new THREE.Mesh(geo, mat);
  };
  const t = new THREE.Group();
  t.userData.main = half(0, PERF); t.userData.stub = half(PERF, 1);
  t.add(t.userData.main, t.userData.stub);
  return t;
}

// The reveal: a glowing white lens along the seam, origin at the top of the seam, length 1 downward, width 1
function makeSlit() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.quadraticCurveTo(0.5, -0.5, 0, -1); shape.quadraticCurveTo(-0.5, -0.5, 0, 0);
  const geo = new THREE.ShapeGeometry(shape, 32);
  // core draws over the jeans (no depth test) but before the ticket (renderOrder), so the ticket stays in front
  const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, depthTest: false }));
  const glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xcfdcff, toneMapped: false, transparent: true,
    opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.renderOrder = 1;
  glow.scale.set(3, 1.15, 1); glow.position.y = 0.07;
  const g = new THREE.Group(); g.add(glow, core); g.visible = false;
  return g;
}

let neo, mixer, walk, idle, hit, ticket, slit, skinned, spots, neoClips;
let tear = 0, opening = 0, drag = null;    // tear 0→1 follows the drag; opening 0→1 is the bloom into white
const whiteEl = document.getElementById('white'), hintEl = document.getElementById('hint');
const startEl = document.getElementById('start');                 // "click Neo to begin", shown once he's walking
startEl.textContent = matchMedia('(hover: none)').matches ? 'Tap Neo to begin' : 'Click Neo to begin';

// ══ YOUR CONTENT — edit everything in SITE; the panel is built from it ═══════════════════
const SITE = {
  name: 'Nehemias Landaverde',
  role: 'Computer Science Student · Montclair State University · NJ',
  bio: [
    'I’m a CS undergrad at Montclair State University (GPA 3.66) who likes building things people can actually click on — full-stack web apps, interactive 3D, and the security and testing that make them hold up.',
    'This summer I joined Podium Education’s Global Career Accelerator (Web Development track), shipping deadline-driven front-end projects from wireframe to deployment and earning certifications with Intel, L’Oréal, OpenAI and UNESCO. I’m also the founding tech lead bringing a ColorStack chapter to Montclair State, and since 2023 I’ve led shifts as a lifeguard and swim instructor for the City of Union City.',
    'Bilingual in English and Spanish, intermediate Italian (NJ Seal of Biliteracy in both). Looking for software engineering internships and early-career roles.',
  ],
  skills: ['TypeScript', 'JavaScript', 'React', 'Next.js', 'Python', 'Java', 'SQL', 'PostgreSQL', 'Supabase',
    'Tailwind CSS', 'three.js', 'Pixi.js', 'Zod', 'Vitest', 'Playwright', 'Git', 'Cloudflare', 'Vercel', 'Blender'],
  projects: [                                         // strongest first
    { title: 'Gamify.Life', blurb: 'A full-stack app that turns real-life hobbies into an RPG: 121 skills across 10 hobbies as prerequisite graphs, an XP ledger, quests and achievements, inside a retro desktop-OS interface. Server-authoritative progression validated with Zod and committed with Postgres advisory locks, row-level security, and 125+ Vitest/Playwright tests with axe accessibility checks.',
      tags: ['Next.js', 'TypeScript', 'Supabase', 'PostgreSQL', 'Pixi.js'], live: 'https://gamify-life-amber.vercel.app', code: 'https://github.com/Neo-Land/Gamify-Life', image: '' },
    { title: 'This website', blurb: 'An interactive three.js portfolio: a rigged 3D character, a drag-to-tear boarding pass, and a shadow-lit loft with a pinned globe. Character pipeline from AI image-to-3D (Tripo) through Mixamo rigging and Blender cleanup. Static on Cloudflare with self-hosted dependencies, a strict CSP, HSTS and no trackers.',
      tags: ['three.js', 'WebGL', 'Blender', 'Cloudflare'], live: '', code: '', image: '' },
    { title: 'ColorStack @ Montclair State', blurb: 'Chapter website and recognition proposal for a new ColorStack chapter, growing the pipeline of Black and Latinx students in computing on campus.',
      tags: ['Web', 'Leadership'], live: '', code: 'https://github.com/Neo-Land/colorstack-msu', image: '' },
  ],
  email: ['nehe.landav', 'gmail.com'].join('@'),   // split so email-harvesting bots scanning this file don't match it
  linkedin: 'https://www.linkedin.com/in/nehemiaslandaverde/',
  github: 'https://github.com/Neo-Land',
  resume: 'resume.pdf',                               // phone-free copy of the résumé
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
  if (state === 'opening' || state === 'white') return;
  state = 'white'; drag = null;
  whiteEl.style.transition = 'opacity .5s'; whiteEl.style.opacity = 1;
  introEl.classList.add('gone'); skipEl.classList.add('hide'); navEl.classList.remove('hide');
  setTimeout(enterRoom, 500);
}

// ── Typed greeting (starts on page load) ──────────────────────────
const GREETINGS = [
  [['en', 'Welcome, friend...'], ['it', 'Benvenuto, amico...'], ['es', 'Bienvenido, amigo...'], ['ja', 'ようこそ、友よ…']],
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
  async function erase() {
    for (let i = lines.length - 1; i >= 0; i--) {
      put(i);
      while (lines[i].lastChild) { lines[i].lastChild.remove(); await wait(quick ? 0 : 22); }
    }
  }
  await wait(500);
  await type(GREETINGS[0]);
  await wait(1800);
  await erase();
  await wait(400);
  await type(GREETINGS[1]);
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
let globeLib, world;
// globe.gl is ~1.8 MB: start fetching while the ticket waits on the seam, so the room is ready when the light fades
const loadGlobe = () => globeLib ??= new Promise((ok, fail) => {
  const sc = document.createElement('script');
  sc.src = 'vendor/globe.gl.min.js'; sc.onload = ok; sc.onerror = fail;   // self-hosted, pinned 2.46.2
  document.head.appendChild(sc);
});
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
function brickTex() {
  const ROWS = 22, COLS = 8, S = 1024, rowH = S / ROWS, bw = S / COLS, m = 6;
  const bricks = [], r = rand(3), { gm, gb, done } = pair(S);
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const t = r();                                          // mostly tan/orange/red-brown, a few burnt and pale ones
    const l = t < 0.08 ? 20 + r() * 6 : t > 0.93 ? 55 + r() * 8 : 30 + r() * 18;
    bricks.push({ x: i * bw + (j % 2) * bw / 2, y: j * rowH, h: 14 + r() * 20, s: 30 + r() * 25, l, seed: r() * 1e9 | 0 });
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
  const brickMat = new THREE.MeshStandardMaterial({ map: brick, bumpMap: bump, bumpScale: 4, roughness: 0.95 });
  const vault = brickMat.clone(); vault.color.setScalar(0.4);              // darker brick ceiling
  const steel = new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.5, metalness: 0.6 });
  const plane = (w, h, mat, tile) => { const geo = new THREE.PlaneGeometry(w, h); if (tile) worldUV(geo, w, h, tile); const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; return m; };
  const box = (w, h, d, mat, tile) => { const geo = new THREE.BoxGeometry(w, h, d); if (tile) boxUV(geo, w, h, d, tile); const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; };

  const wood = woodTex();
  const floor = plane(12, 12, new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 1.6, roughness: 0.42 }), 1.6);
  floor.rotation.x = -Math.PI / 2;
  const back = plane(12, CEIL, brickMat, BRICK_TILE); back.position.set(0, CEIL / 2, BACK);
  const left = plane(12, CEIL, brickMat, BRICK_TILE); left.rotation.y = Math.PI / 2;
  const ceiling = plane(12, 12, vault, BRICK_TILE); ceiling.rotation.x = Math.PI / 2; ceiling.position.y = CEIL;
  loft.add(floor, back, left, ceiling);
  for (const z of [-1.5, -0.3, 0.9, 2.1]) { const b = box(12, 0.16, 0.1, steel); b.position.set(0, CEIL - 0.08, z); loft.add(b); }
  const duct = box(0.3, 0.22, 12, steel); duct.position.set(-0.7, CEIL - 0.3, 0);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 12, 12), steel); pipe.rotation.x = Math.PI / 2; pipe.position.set(0.55, CEIL - 0.24, 0);
  loft.add(duct, pipe);

  // Right wall: brick piers between tall steel windows, a sill below and a header above (all cast shadows)
  const right = new THREE.Group(), T = 0.22, L = 8, zc = BACK + L / 2;
  const add = (m, x, y, z) => { m.position.set(x, y, z); right.add(m); };
  add(box(T, SILL, L, brickMat, BRICK_TILE), T / 2, SILL / 2, zc);
  add(box(T, CEIL - WIN_TOP, L, brickMat, BRICK_TILE), T / 2, (WIN_TOP + CEIL) / 2, zc);
  const piers = [[BACK, BAYS[0][0]], ...BAYS.slice(1).map((b, i) => [BAYS[i][1], b[0]]), [BAYS.at(-1)[1], BACK + L]];
  for (const [z0, z1] of piers) add(box(T + 0.06, WIN_TOP - SILL, z1 - z0, brickMat, BRICK_TILE), T / 2 - 0.03, (SILL + WIN_TOP) / 2, (z0 + z1) / 2);
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
  walls.nookHit = hotspot(new THREE.BoxGeometry(2.5, 1.35, 1.0)); walls.nookHit.position.set(-0.25, 0.67, 0.15); walls.nook.add(walls.nookHit);
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
  const loader = new GLTFLoader();
  loader.load('car.glb', (g) => {
    g.scene.scale.setScalar(CAR_SCALE);
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.material.envMap = loft.environment; o.material.envMapIntensity = 0.5; } });
    group.add(g.scene);
  });
  loader.load('mechanic.glb', (g) => {
    const mech = g.scene;
    mech.position.set(...MECH_AT); mech.rotation.y = Math.PI;        // facing the car
    mech.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    group.add(mech);
    const m = new THREE.AnimationMixer(mech); m.clipAction(g.animations[0]).play(); mixers.push(m);
  });
}
// The hobby nook — a homage, not a replica: the yellow zoot suit (mannequin stripped out in Blender) hangs on a rolling
// garment rack with the fedora resting on the hanger hook, and an original carved green mask leans on a nightstand
// under a little lamp. Local layout: rack on the left, nightstand on the right, everything facing +z.
const NOOK = { bar: 1.06, rackX: -0.3, standX: 0.5 };
function buildNook(group) {
  const { bar, rackX, standX } = NOOK;
  const steel = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, metalness: 0.8, roughness: 0.35 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3822, roughness: 0.55 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc89b4a, metalness: 0.9, roughness: 0.3 });
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  const rod = (len, r = 0.014) => new THREE.CylinderGeometry(r, r, len, 12);
  const add2 = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  // rolling rack: two uprights, top bar, two feet with casters
  for (const sx of [-1, 1]) {
    const x = rackX + sx * 0.46;
    add(rod(bar), steel, x, bar / 2 + 0.05, 0);
    add(rod(0.44), steel, x, 0.06, 0, Math.PI / 2);
    for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 14), steel, x, 0.03, sz * 0.2, 0, Math.PI / 2);
  }
  add(rod(0.96), steel, rackX, bar + 0.05, 0, 0, Math.PI / 2);
  // wooden hanger: curved shoulders + a hook stem up to the bar (the hat sits on the hook)
  const shoulders = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.21, -0.12, 0), new THREE.Vector3(0, -0.03, 0), new THREE.Vector3(0.21, -0.12, 0));
  add(new THREE.TubeGeometry(shoulders, 20, 0.013, 8), wood, rackX, bar + 0.05, 0);
  add(rod(0.08, 0.005), brass, rackX, bar + 0.04, 0);
  // nightstand: box on short legs, a drawer with a brass knob, and a small lamp
  const top = 0.5;
  add(new THREE.BoxGeometry(0.44, 0.38, 0.38), wood, standX, top - 0.19, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.035, 0.12, 0.035), wood, standX + sx * 0.19, 0.06, sz * 0.16);
  add(new THREE.BoxGeometry(0.38, 0.13, 0.01), new THREE.MeshStandardMaterial({ color: 0x4a2d1b, roughness: 0.6 }), standX, top - 0.12, 0.192);
  add(new THREE.SphereGeometry(0.014, 12, 8), brass, standX, top - 0.12, 0.2);
  add(new THREE.CylinderGeometry(0.035, 0.05, 0.03, 16), brass, standX + 0.13, top + 0.015, -0.08);
  add(rod(0.2, 0.007), brass, standX + 0.13, top + 0.12, -0.08);
  add(new THREE.CylinderGeometry(0.05, 0.085, 0.09, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xf3dfb8, emissive: 0xffb45a, emissiveIntensity: 0.6, side: THREE.DoubleSide }), standX + 0.13, top + 0.23, -0.08);
  const lamp = new THREE.PointLight(0xffb45a, 1.4, 1.6, 1.8);
  lamp.position.set(standX + 0.13, top + 0.2, -0.08); group.add(lamp);
  const loader = new GLTFLoader(), dress = (o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; };
  loader.load('suit.glb', (g) => {
    g.scene.traverse(dress);
    const suit = g.scene.getObjectByName('suit'), hat = g.scene.getObjectByName('hat');
    suit.scale.setScalar(1.08); suit.position.set(rackX, bar + 0.02, 0);         // origin = collar top, under the hook
    hat.scale.setScalar(1.08); hat.position.set(rackX, bar + 0.075, 0); hat.rotation.set(-0.12, 0.3, 0.1);  // tipped on the hook
    group.add(suit, hat);
  });
  loader.load('mask.glb', (g) => {                                               // leaning back against the lamp side
    g.scene.scale.setScalar(0.16); g.scene.position.set(standX - 0.05, top, 0.04); g.scene.rotation.set(-0.32, -0.25, 0);
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
  loader.load('swordsman.glb', (g) => {
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
// Room width + camera adapt to the screen; places the walls and the globe overlay
function layoutRoom() {
  const a = innerWidth / innerHeight, t = Math.tan(THREE.MathUtils.degToRad(loftCam.fov / 2));
  roomHalf = a < 1 ? 1.6 : 2.8;                                        // narrower loft on phones so the windows stay in view
  const d = Math.max(3, (roomHalf + 0.05) / (t * a) - 0.7);            // far enough back to see the window wall
  const turn = a < 1 ? 0.35 : 0;                                      // on phones, angle the view toward the windows
  overview.pos.set(-turn, 0.8, d); overview.look.set(turn * 0.6, 0.62, 0);
  loftCam.aspect = a; loftCam.updateProjectionMatrix();
  walls.left.position.set(-roomHalf, CEIL / 2, 0);
  walls.right.position.x = roomHalf;
  for (const m of [walls.back, walls.floor, walls.ceiling]) m.position.x = roomHalf - 6;   // stop at the window wall (12 m wide)
  // parked in the back-left corner, nose angled out (nearly head-on on phones, where the room is narrow)
  walls.car.position.set(-roomHalf + (a < 1 ? 0.7 : 1.1), 0, BACK + (a < 1 ? 1.5 : 1.15));
  walls.car.rotation.y = Math.PI / 2 - (a < 1 ? 1.2 : 0.7);
  walls.car.updateMatrixWorld();
  // narrow screens: seated Neo + globe shift a little left, opening a gap so the hobby nook shows beside them
  GLOBE_AT.x = a < 1 ? -0.22 : 0;
  walls.globeHit.position.copy(GLOBE_AT); walls.glow.position.copy(GLOBE_AT);
  if (neo.parent === loft) neo.position.x = GLOBE_AT.x;
  // hobby nook by the windows, turned most of the way toward the camera
  walls.nook.position.set(roomHalf - (a < 1 ? 0.5 : 0.85), 0, a < 1 ? -1.1 : -1.3);
  walls.nook.rotation.y = a < 1 ? -Math.PI / 2 + 0.6                     // narrow screens: runs along the right wall, angled out
    : 0.75 * Math.atan2(overview.pos.x - walls.nook.position.x, overview.pos.z - walls.nook.position.z);
  // the swordsman's chair, left of the rack (tucked in closer on phones, where the room is narrow)
  walls.seat.position.set(a < 1 ? -0.92 : -1.12, 0, a < 1 ? 0.4 : 0.3);
  walls.nook.updateMatrixWorld();
  if (!fly) { globeK = globeKFor(focus); setCam(...viewOf(focus)); }
}
function setCam(pos, look) {
  loftCam.position.copy(pos); camLook.copy(look); loftCam.lookAt(look);
  loftCam.updateMatrixWorld();                                          // project() below needs the new view
  // globe overlay: centre on GLOBE_AT, sized to GLOBE_R as seen by this camera
  const c = GLOBE_AT.clone().project(loftCam), up = GLOBE_AT.clone().add(new THREE.Vector3(0, GLOBE_R * globeK, 0)).project(loftCam);
  const rFrac = (up.y - c.y);                                           // radius as a fraction of the half-height
  document.getElementById('float').style.transform = `translate(${c.x * innerWidth / 2}px, ${-c.y * innerHeight / 2}px)`;
  document.getElementById('float').style.setProperty('--gd', `${rFrac * innerHeight}px`);
  homeAltitude = 1 / Math.sin(Math.atan(rFrac * Math.tan(25 * Math.PI / 180))) - 1;   // globe.gl: 50° fov, altitude in radii
}
let homeAltitude = 2.6;
const homeView = () => ({ lat: 25, lng: 10, altitude: homeAltitude });

// Loft sections. The overview shows them all; picking one (its hanging sign, or clicking it in the room) flies the
// camera in, and only then does that section respond (the globe only spins once you've zoomed to it).
const SECTIONS = [
  { id: 'globe', sign: 'About me!', burst: '#ffd400', ink: '#e8282b', tip: 'Spin the globe · pick a pin',
    look: () => new THREE.Vector3(GLOBE_AT.x, 0.58, 0), signAt: () => GLOBE_AT.clone().setY(GLOBE_AT.y + GLOBE_R + 0.42), hits: () => [hit, walls.globeHit] },
  { id: 'car', sign: 'Projects!', burst: '#ff8a1f', ink: '#29a9ef', tip: 'Garage under construction · more soon',
    look: () => walls.car.localToWorld(new THREE.Vector3(0, 0.4, 0.5)), signAt: () => walls.car.localToWorld(new THREE.Vector3(0, 1.05, 0.3)), hits: () => [walls.carHit] },
  { id: 'hobbies', sign: 'Hobbies!', burst: '#4fc35a', ink: '#ffd400', tip: 'Off the clock · more soon',
    look: () => walls.nook.localToWorld(new THREE.Vector3(-0.3, 0.5, 0.15)),
    // phones: come in high, from straight in front of the nook, so the seated Neo doesn't block the view
    eye: () => innerWidth < innerHeight ? overview.pos.clone().lerp(walls.nook.position, 0.6).setY(1.9) : undefined, signAt: () => walls.nook.localToWorld(new THREE.Vector3(NOOK.rackX, NOOK.bar + 0.42, 0)), hits: () => [walls.nookHit] },
];
// Decorative bursts (not clickable) that pop up only while their section is in focus
const DECOR = [
  { section: 'hobbies', sign: "Smokin'!", burst: '#e8282b', ink: '#ffd400', signAt: () => walls.nook.localToWorld(new THREE.Vector3(NOOK.rackX + 0.36, NOOK.bar - 0.12, 0.2)) },
  { section: 'hobbies', sign: 'As you wish!', burst: '#ff7ab8', ink: '#ffffff', signAt: () => walls.seat.localToWorld(new THREE.Vector3(0, 1.02, 0)) },
];
const OVERVIEW_TIP = 'Pick a spot to explore', ZOOM_IN = 0.5, FLY_TIME = 1.4;   // ZOOM_IN: share of the way the camera flies toward a section
const overview = { pos: new THREE.Vector3(), look: new THREE.Vector3() }, camLook = new THREE.Vector3();
let focus = null, fly = null, globeK = 1;
// on narrow screens the globe stays small in the overview (it crowds the room) and grows when "About me" is opened
const globeKFor = (id) => id === 'globe' || innerWidth >= innerHeight ? 1 : 0.55;
const viewOf = (id) => {
  if (!id) return [overview.pos.clone(), overview.look.clone()];
  const sec = SECTIONS.find((s) => s.id === id), look = sec.look();
  return [sec.eye?.() ?? overview.pos.clone().lerp(look, ZOOM_IN), look];
};
const tipEl = roomEl.querySelector('.tip'), backEl = document.getElementById('back');
function goTo(id) {
  if (focus === 'globe' && !cardEl.hidden) cardEl.querySelector('.x').click();
  focus = id;
  fly = { t: 0, from: [loftCam.position.clone(), camLook.clone()], to: viewOf(id), k: [globeK, globeKFor(id)] };
  roomEl.dataset.focus = id || '';
  roomEl.classList.remove('picked');
  roomEl.classList.toggle('away', !!id && id !== 'globe');                // globe overlay fades while another section is in view
  tipEl.textContent = id ? SECTIONS.find((s) => s.id === id).tip : OVERVIEW_TIP;
  backEl.hidden = !id;
  if (id) backEl.focus();
}
backEl.onclick = () => goTo(null);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && focus && !folio.open) goTo(null); });
const flyPos = new THREE.Vector3(), flyLook = new THREE.Vector3();
function updateLoftView(dt) {
  if (fly) {
    fly.t = Math.min(1, fly.t + dt / (calm ? 1e-3 : FLY_TIME));
    const e = ease(fly.t);
    globeK = THREE.MathUtils.lerp(fly.k[0], fly.k[1], e);
    setCam(flyPos.lerpVectors(fly.from[0], fly.to[0], e), flyLook.lerpVectors(fly.from[1], fly.to[1], e));
    world?.pointOfView({ altitude: homeAltitude });                     // keep the globe's size matched to the camera
    if (fly.t === 1) fly = null;
  }
  for (const s of [...SECTIONS, ...DECOR]) {                            // signs follow their spot on screen
    if (!s.el) continue;
    const v = s.signAt().project(loftCam);
    const y = Math.max((1 - v.y) / 2 * innerHeight, s.el.offsetHeight + 64);      // never above the top menu
    s.el.style.transform = `translate(${(v.x + 1) / 2 * innerWidth}px, ${y}px) translate(-50%, -100%)`;
    s.el.hidden = v.z > 1 || (s.section ? focus !== s.section : focus && focus !== s.id);
  }
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
  ticket.visible = slit.visible = false;
  mixer.stopAllAction();
  mixer.clipAction(neoClips.find((c) => c.name === 'neo_sit')).play();
  const clock2 = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock2.getDelta(), 0.05);
    mixer.update(dt); for (const m of mixers) m.update(dt);
    updateLoftView(dt);
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
  await loadGlobe();
  world = Globe()(document.getElementById('globe'))
    .width(innerWidth).height(innerHeight)
    .backgroundColor('rgba(0,0,0,0)')
    .globeImageUrl('vendor/earth-blue-marble.jpg')
    .bumpImageUrl('vendor/earth-topology.png')
    .atmosphereColor('#4d8dff').atmosphereAltitude(0.28)
    // pins: a steel needle poking out of the surface (3D) ...
    .pointsData(PLACES).pointAltitude(PIN_HEIGHT).pointRadius(0.12).pointResolution(8).pointColor(() => '#c4c8d0')
    // ... with a tappable head on the tip
    .htmlElementsData(PLACES).htmlAltitude(PIN_HEIGHT)
    .htmlElement((d) => {
      const el = document.createElement('button');
      el.className = 'pin'; el.title = el.ariaLabel = `${d.name}, ${d.country}`;
      el.onclick = () => pickPlace(d, el);
      return el;
    })
    .pointOfView(homeView());
  world.htmlElementVisibilityModifier?.((el, visible) => { el.style.opacity = visible ? 1 : 0; el.style.pointerEvents = visible ? 'auto' : 'none'; });
  world.controls().enableZoom = false;
  world.controls().autoRotate = !calm;
  world.controls().autoRotateSpeed = 0.5;
  requestAnimationFrame(() => roomEl.classList.add('in'));
  whiteEl.style.transition = 'opacity 1.6s';                           // the light fades to reveal the loft
  whiteEl.style.opacity = 0;
}
function pickPlace(d, el) {
  world.controls().autoRotate = false;
  world.pointOfView({ lat: d.lat, lng: d.lng, altitude: 0.55 }, calm ? 0 : 1600);   // zoom right in on the pin
  document.querySelectorAll('.pin.on').forEach((x) => x.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('c-name').textContent = d.name;
  document.getElementById('c-country').textContent = d.country;
  document.getElementById('c-note').textContent = d.note;
  cardEl.hidden = false;
  roomEl.classList.add('picked');
}
cardEl.querySelector('.x').onclick = () => {
  cardEl.hidden = true;
  document.querySelector('.pin.on')?.classList.remove('on');
  world.pointOfView(homeView(), calm ? 0 : 1400);
  world.controls().autoRotate = !calm;
};
const feet = {};
let walkPrev = 0;
let state = 'walking', angle = 0, turnFrom = 0, turnTo = 0, turnT = 0, zoomS = 0;
const camFrom = new THREE.Vector3(), lookFrom = new THREE.Vector3();

new GLTFLoader().load('neo.glb', (gltf) => {
  neo = gltf.scene;
  scene.add(neo);
  neo.traverse((o) => {
    if (o.isMesh) o.frustumCulled = false; // skinned bounds don't follow the animation
    const foot = o.isBone && o.name.match(/(Left|Right)Foot$/);
    if (foot) feet[foot[1]] = o;
  });

  // The ticket follows real points on the deformed mesh (pocket, top/bottom of the seam), so it lines up in any pose
  skinned = neo.getObjectByProperty('isSkinnedMesh', true);
  const pos = skinned.geometry.attributes.position, p = new THREE.Vector3();
  const nearest = (a) => {
    const target = new THREE.Vector3(...a); let best = 0, bd = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const d = p.fromBufferAttribute(pos, i).applyMatrix4(skinned.bindMatrix).distanceToSquared(target);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  spots = { pocket: nearest(POCKET), top: nearest(FLY_TOP), bot: nearest(FLY_BOT) };
  ticket = makeTicket();
  ticket.traverse((o) => { o.renderOrder = 2; });
  scene.add(ticket);
  slit = makeSlit();
  scene.add(slit);

  mixer = new THREE.AnimationMixer(neo);
  neoClips = gltf.animations;
  const clip = (n) => gltf.animations.find((a) => a.name === n);
  walk = mixer.clipAction(clip('neo_slow_walk'));
  idle = mixer.clipAction(clip('neo_idle'));
  walk.play();

  // Invisible, generous tap target (easier on phones than hitting the mesh)
  hit = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.05), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.52;
  neo.add(hit);
  if (skipWanted) skipIntro();
  else setTimeout(() => state === 'walking' && startEl.classList.add('on'), 1800);
});

// Tap / click on Neo → stop, face camera, idle
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
function pick(e) {
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  return hit && ray.intersectObject(hit).length > 0;
}
const TEAR_COMMIT = 0.6;                       // let go past this and it finishes on its own
const dragLen = () => 0.45 * Math.min(innerWidth, innerHeight);
renderer.domElement.addEventListener('click', (e) => {
  if (!walls || focus) return;
  const s = sectionAt(e);
  if (s) goTo(s.id);
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (state === 'walking' && pick(e)) tapNeo();
  else if (state === 'ready') {                // drag in any direction to tear + reveal
    drag = { x: e.clientX, y: e.clientY, from: tear };
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch {} // keep the drag even if the finger leaves the canvas
    state = 'tearing';
  }
});
function endDrag() {
  if (!drag) return;
  drag = null;
  state = tear >= TEAR_COMMIT ? 'opening' : 'ready';
}
renderer.domElement.addEventListener('pointerup', endDrag);
renderer.domElement.addEventListener('pointercancel', endDrag);
function tapNeo() {
  startEl.remove();
  state = 'turning';
  introEl.classList.add('gone');
  navEl.classList.add('hide'); skipEl.classList.add('hide');
  idle.reset().play();
  walk.crossFadeTo(idle, 0.6, false);
  turnFrom = neo.rotation.y;
  const yaw = Math.atan2(camera.position.x - neo.position.x, camera.position.z - neo.position.z);
  turnTo = turnFrom + Math.atan2(Math.sin(yaw - turnFrom), Math.cos(yaw - turnFrom)); // shortest way round
  turnT = 0;
}
renderer.domElement.addEventListener('pointermove', (e) => {
  if (drag) tear = Math.min(Math.max(drag.from + Math.hypot(e.clientX - drag.x, e.clientY - drag.y) / dragLen(), 0), 1);
  if (e.pointerType === 'mouse') renderer.domElement.style.cursor = walls ? (!focus && sectionAt(e) ? 'pointer' : '') :
    state === 'walking' && pick(e) ? 'pointer' : state === 'ready' ? 'grab' : state === 'tearing' ? 'grabbing' : '';
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
  if (walls) { layoutRoom(); world?.width(innerWidth).height(innerHeight); }
});
resize();

const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
const ease = (t) => t * t * (3 - 2 * t);

// Ticket poses, recomputed every frame from the posed mesh
const pose = () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() });
const P = { pocket: pose(), out: pose(), zip: pose() };
const qPocket = new THREE.Quaternion().setFromEuler(new THREE.Euler(POCKET_TILT, 0, Math.PI / 2)); // stub end up, top tilted forward
const fwd = new THREE.Vector3(), top = new THREE.Vector3(), bot = new THREE.Vector3(), basis = new THREE.Matrix4();
function updateSpots() {
  neo.updateMatrixWorld(true);
  const at = (i, v) => skinned.getVertexPosition(i, v).applyMatrix4(skinned.matrixWorld);
  fwd.set(Math.sin(neo.rotation.y), 0, Math.cos(neo.rotation.y));
  // start buried in the leg behind the pocket; 'out' is the arc's high point above the pocket
  at(spots.pocket, P.out.p);
  P.pocket.p.copy(P.out.p).add(tmp.set(0, -0.05, 0)).addScaledVector(fwd, -0.03);
  P.out.p.add(tmp.set(0, 0.09, 0)).addScaledVector(fwd, 0.07);
  P.pocket.q.copy(neo.quaternion).multiply(qPocket);
  // Perforation (local Y) follows the seam as seen from the front; ticket faces straight out of his front
  at(spots.top, top); at(spots.bot, bot);
  const up = top.clone().sub(bot); up.addScaledVector(fwd, -up.dot(fwd)).normalize();
  const side = up.clone().cross(fwd).normalize();
  P.zip.q.setFromRotationMatrix(basis.makeBasis(side, up, fwd));
  P.zip.p.copy(top).add(bot).multiplyScalar(0.5);
  P.zip.p.addScaledVector(fwd, Math.max(top.dot(fwd), bot.dot(fwd)) - P.zip.p.dot(fwd) + FLY_GAP); // clear of the belt
}
function placeTicket(a, b, f) {
  ticket.position.lerpVectors(a.p, b.p, f);
  ticket.quaternion.slerpQuaternions(a.q, b.q, f);
}
// One continuous move: curve from inside the pocket, up over the arc point, down onto the seam
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
function pullTicket(u) {
  const k = easeInOut(u), a = (1 - k) ** 2, b = 2 * (1 - k) * k, c = k * k;     // quadratic Bezier weights
  ticket.position.set(0, 0, 0).addScaledVector(P.pocket.p, a).addScaledVector(P.out.p, b).addScaledVector(P.zip.p, c);
  // keep it upright while it clears the pocket, then turn to face out as it travels
  ticket.quaternion.slerpQuaternions(P.pocket.q, P.zip.q, easeInOut(Math.min(Math.max((u - 0.25) / 0.75, 0), 1)));
}
// Tear from the top down: both halves hinge at the bottom of the perforation, opening a V
function tearTicket(p, o) {
  const h = TICKET_H / 2;
  const hinge = (m, a, dx, dy) => {
    m.rotation.z = a;
    m.position.set(-h * Math.sin(a) + dx, -h + h * Math.cos(a) + dy, 0);
  };
  hinge(ticket.userData.stub, -p * 0.5 - o * 1.4, o * 0.12, -o * 0.16);
  hinge(ticket.userData.main, p * 0.18 + o * 0.9, -o * 0.1, -o * 0.14);
  ticket.userData.stub.position.z = p * 0.004;                   // stub lifts toward you so the halves never z-fight
}
// Reveal: white lens from the top of the seam down; widens with the tear, then blooms to fill the screen
function placeSlit(p, o) {
  const flyLen = top.clone().sub(bot).addScaledVector(fwd, -top.clone().sub(bot).dot(fwd)).length();
  slit.visible = p > 0.001;
  slit.quaternion.copy(P.zip.q);
  slit.position.copy(top).addScaledVector(fwd, P.zip.p.dot(fwd) - FLY_GAP * 0.5 - top.dot(fwd));
  slit.position.addScaledVector(tmp.set(0, 1, 0).applyQuaternion(P.zip.q), o * o * 0.3); // bloom grows upward too
  slit.scale.set(0.004 + p * 0.016 + o ** 3 * 3, Math.max(p * flyLen, 0.001) + o * o * 1.2, 1);
}
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
    }
    mixer.update(dt);

    // One ripple per footstep: fire when the walk clip's time passes a foot plant (handles the loop wrap)
    const wt = walk.time;
    if (state === 'walking') for (const { t: pt, side } of FOOT_PLANTS) {
      if (walkPrev <= wt ? pt > walkPrev && pt <= wt : pt > walkPrev || pt <= wt) {
        feet[side].getWorldPosition(tmp);
        addRipple(tmp.x, tmp.z, t);
      }
    }
    walkPrev = wt;
    updateSpots();
    ticket.visible = state === 'zooming' ? zoomS > 1.2 : state !== 'walking' && state !== 'turning'; // hidden in the pocket until needed
    if (state === 'walking' || state === 'turning') placeTicket(P.pocket, P.pocket, 0);
    else {
      // Close-up on the seam: ticket fills ~60% of the screen width
      const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      const camTo = P.zip.p.clone().addScaledVector(fwd, TICKET_W / 0.6 / 2 / halfW);
      if (state === 'zooming') {
        zoomS += dt;
        const k = ease(Math.min(zoomS / 3.2, 1));                // slow camera push-in
        camera.position.lerpVectors(camFrom, camTo, k);
        lookAt.lerpVectors(lookFrom, P.zip.p, k);
        pullTicket(Math.min(Math.max((zoomS - 1.2) / 2.6, 0), 1)); // 1.2 s → 3.8 s: out of the pocket onto the seam
        if (zoomS >= 3.8) { state = 'ready'; loadGlobe().catch(() => {}); } // waiting for the tear; prefetch the globe
      } else {
        if (state === 'ready') tear += (0 - tear) * (1 - Math.exp(-dt * 8));   // let go early → springs back
        if (state === 'opening') {
          tear = Math.min(tear + dt * 3, 1);
          opening = Math.min(opening + dt / 1.8, 1);
          if (opening === 1) { state = 'white'; enterRoom(); } // → beat 7, the white room
        }
        placeTicket(P.zip, P.zip, 0);
        tearTicket(tear, ease(opening));
        placeSlit(tear, opening);
        camera.position.copy(camTo).addScaledVector(fwd, -camTo.clone().sub(P.zip.p).length() * 0.85 * ease(opening)); // push into the light
        lookAt.copy(P.zip.p);
        if (state !== 'white') whiteEl.style.opacity = Math.min(Math.max((opening - 0.55) / 0.45, 0), 1);
        hintEl.classList.toggle('on', state === 'ready' && tear < 0.05);
      }
    }
  }
  camera.lookAt(lookAt);
  renderer.render(scene, camera);
});
