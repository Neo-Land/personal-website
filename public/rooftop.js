// The rooftop scene, phase 2: the roof, ledge, props and the rooftops below are baked in Blender
// (rooftop/build_rooftop.py); the Manhattan skyline is modelled there too but its windows are drawn live here.
// Sitting Neo with the cards orbiting him like an aura (still grey stand-ins). Clicking a
// card glides the camera so Neo sits left of frame, flies the card up front, stands Neo up (see stand()) and slides in
// the card's info. ?perf shows fps / draw calls / memory.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from './vendor/meshopt/meshopt_decoder.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
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
const LOOK = new URLSearchParams(location.search).get('look') !== 'off';   // ?look=off: the plain render, for comparison
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
// Neo's own light (the baked world ignores scene lights): a soft warm fill from the camera side so his face reads against
// the sunset, stronger once he stands and faces you, plus a dim studio environment for reflections on his materials
const faceFill = new THREE.DirectionalLight(0xffe0c4, 1.1); scene.add(faceFill, faceFill.target);
const FILL = [1.1, 2.0];                                         // home, focus
const studio = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

// ── the camera's "look": glow on the bright things (the sun, the river's glints), depth of field that softens only what's
// behind Neo once a card is open (phones skip it), then a grade: warm highlights, cooler shadows, a gentle contrast
// curve, a vignette and fine film grain. The effects work on the finished frame: the scene is drawn to the canvas
// exactly as before (the sky, river and windows are shaders that output final screen colours, so re-tone-mapping them
// in a linear chain washed everything out), copied into a texture, and the passes run on that.
class AsShownPass extends Pass {
  constructor() {
    super();
    this.tex = new THREE.FramebufferTexture(1, 1);
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({ ...CopyShader, uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms) }));
  }
  setSize(w, h) { this.tex.dispose(); this.tex = new THREE.FramebufferTexture(Math.floor(w), Math.floor(h)); }
  render(r, writeBuffer) {
    r.setRenderTarget(null); r.render(scene, camera); r.copyFramebufferToTexture(this.tex);
    this.quad.material.uniforms.tDiffuse.value = this.tex;
    r.setRenderTarget(writeBuffer); this.quad.render(r);
  }
}
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
composer.addPass(new AsShownPass());
const dof = new BokehPass(scene, camera, { focus: 3.3, aperture: 0, maxblur: 0.006 });
dof.materialBokeh.fragmentShader = dof.materialBokeh.fragmentShader
  .replace('float factor = ( focus + viewZ );', 'float factor = min( focus + viewZ, 0.0 );');   // blur only what's farther than the focus
composer.addPass(dof);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.9);   // strength, radius, threshold (screen brightness)
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAspect; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(.2126, .7152, .0722));
      c *= mix(vec3(.94, .98, 1.05), vec3(1.), smoothstep(.0, .5, l));       // shadows lean cool
      c *= mix(vec3(1.), vec3(1.04, 1., .93), smoothstep(.5, 1., l));         // highlights lean warm
      c = mix(c, c * c * (3. - 2. * c), .22);                                // a gentle S-curve
      vec2 q = vUv - .5; q.x *= uAspect;
      c *= mix(.78, 1., smoothstep(.95, .3, length(q)));                     // vignette
      c += (hash(floor(vUv * uRes) + fract(uTime) * 97.) - .5) * .035;        // fine grain, new every frame
      gl_FragColor = vec4(c, 1.);
    }`,
});
composer.addPass(grade);

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
// paper boats: giant folded ones (hull + peaked sail, each fold its own shade of paper) with a red flag up top,
// bobbing as they cross, a fading wake behind
const wakeTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 8; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(255,240,215,0)'); g.addColorStop(1, 'rgba(255,240,215,.55)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 8); return new THREE.CanvasTexture(c); })();
const boatGeo = (() => {
  const L = 12, l = 7, H = 5, W = 3.4, S = 13;                         // half-lengths at the rim / keel, rim height, half-width, sail peak
  const tris = [                                                       // [corners…], shade
    [[-L, H, W], [L, H, W], [l, 0, 0]], [[-L, H, W], [l, 0, 0], [-l, 0, 0]],          // near side of the hull
    [[L, H, -W], [-L, H, -W], [-l, 0, 0]], [[L, H, -W], [-l, 0, 0], [l, 0, 0]],       // far side
    [[-L, H, W], [-l, 0, 0], [-L, H, -W]], [[L, H, -W], [l, 0, 0], [L, H, W]],         // the pointed ends
    [[-6, H, W * 0.7], [6, H, W * 0.7], [0, S, 0]], [[6, H, -W * 0.7], [-6, H, -W * 0.7], [0, S, 0]],   // the sail's two folds
  ];
  const shades = [1, 1, 0.84, 0.84, 0.9, 0.9, 0.97, 0.8];
  const pos = [], col = [];
  tris.forEach((t, k) => { for (const p of t) { pos.push(...p); col.push(0.96 * shades[k], 0.93 * shades[k], 0.86 * shades[k]); } });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
})();
boatGeo.computeVertexNormals();                                     // flat: every fold faces its own way
const paperMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });   // lit by the scene
// its shadow on the water: a soft dark smudge, stretched toward the camera (the low sun is behind the city)
const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(30,18,12,.55)'); g.addColorStop(1, 'rgba(30,18,12,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-9.5, 11, 0), new THREE.Vector3(-9.5, 8.6, 0), new THREE.Vector3(-14, 9.9, 0)]);   // at the stern, streaming back
const flagMat = new THREE.MeshStandardMaterial({ color: 0xd8312a, side: THREE.DoubleSide, roughness: 0.8 }), poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a22 });
const ferries = [[-200, -330, 6], [150, -440, -4.5], [-420, -540, 3.5]].map(([x, z, v]) => {   // lanes mid-river, clear of the piers
  const f = new THREE.Group(); f.scale.setScalar(1.5);              // comically big for paper
  const boat = new THREE.Group(); f.add(boat); f.userData.boat = boat;
  const hull = new THREE.Mesh(boatGeo, paperMat);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7), poleMat); pole.position.set(-9.5, 7.5, 0);   // up from the stern
  const flag = new THREE.Mesh(flagGeo, flagMat);
  if (v < 0) boat.rotation.y = Math.PI;                               // the flag streams back, whichever way it sails
  boat.add(hull, pole, flag);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(30, 16), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.15, 7); f.add(shadow);
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(90, 7), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false }));
  wake.rotation.x = -Math.PI / 2; wake.position.set(-Math.sign(v) * 56, 0.1, 0); if (v < 0) wake.rotation.z = Math.PI;
  f.add(wake); f.position.set(x, -84, z); f.userData.v = v; f.userData.ph = Math.random() * 6; scene.add(f); return f;
});
// Manhattan's ground: a low slab the skyline stands on, a seawall facing us, piers, and low buildings along the
// waterfront so the towers rise out of a city instead of the water. All instanced, coloured to sink into the haze.
const SKY_X = 280;                                               // = the skyline's shift in the loader below
// the far shore takes the skyline's lighter haze (SKY_HAZE), so nearer things stay darker than farther ones
const SKY_HAZE = 0.0006;
const haze = (color, fade = 0) => new THREE.ShaderMaterial({        // fade: a floor on how far it sinks into the haze
  fog: false, toneMapped: false, uniforms: { uC: { value: new THREE.Color(color) }, uFogC: { value: scene.fog.color }, uFogD: { value: SKY_HAZE }, uFade: { value: fade } },
  vertexShader: `varying float vD; void main(){ vec4 p = vec4(position, 1.);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
    #endif
    vec4 mv = modelViewMatrix * p; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uC, uFogC; uniform float uFogD, uFade; varying float vD;
    void main(){ gl_FragColor = vec4(mix(uC, uFogC, max(uFade, 1. - exp(-pow(vD * uFogD, 2.)))), 1.); }`,
});
const land = new THREE.Mesh(new THREE.BoxGeometry(4800, 4, 1400), haze(0x3a2e30));   // wide: Upper Manhattan runs off to the left
land.position.set(SKY_X - 1150, -84, -1490); scene.add(land);           // top at y -82, front (the seawall) at z -790, back past One WTC
const lowMat = haze(0x2c2428);
const PIERS = 60, piers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lowMat, PIERS);
for (let i = 0; i < PIERS; i++) {
  const x = SKY_X - 3100 + i * 72 + (Math.random() - 0.5) * 20, len = 40 + Math.random() * 50;
  piers.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, -83, -790 + len / 2), new THREE.Quaternion(), new THREE.Vector3(10 + Math.random() * 10, 2.5, len)));
}
scene.add(piers);
const LOW = 460, low = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lowMat, LOW);
for (let i = 0; i < LOW; i++) {
  const h = 6 + Math.random() * 28, x = SKY_X - 3200 + Math.random() * 4440, z = -800 - Math.random() * 90;
  low.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, -82 + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(14 + Math.random() * 24, h, 12 + Math.random() * 20)));
}
scene.add(low);
// far-left industrial shore: a few stacks fading into the haze
const stackMat = haze(0x2c2428);
for (const [x, h, z] of [[-820, 120, -1250], [-780, 95, -1270], [-735, 140, -1240], [-690, 80, -1300], [-900, 60, -1220]]) {
  const st = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, h, 10), stackMat); st.position.set(x, -84 + h / 2, z); scene.add(st);
}

// windows: a grid in the skyline's metre UVs (3.2 m bays, 3.6 m floors), ~28% lit warm or cool; far away, where a
// window is smaller than a pixel, the grid fades to its average so it doesn't shimmer
const windows = new THREE.ShaderMaterial({
  fog: false, toneMapped: false,                                      // its own, lighter haze: the city sits at true scaled distances
  uniforms: { uWall: { value: new THREE.Color(0x232636) }, uFogC: { value: scene.fog.color }, uFogD: { value: SKY_HAZE } },
  vertexShader: `varying vec2 vUv; varying vec3 vW; varying float vD;
    void main(){ vUv = uv; vW = (modelMatrix * vec4(position, 1.)).xyz; vec4 mvPosition = modelViewMatrix * vec4(position, 1.); vD = -mvPosition.z; gl_Position = projectionMatrix * mvPosition; }`,
  fragmentShader: `uniform vec3 uWall, uFogC; uniform float uFogD; varying vec2 vUv; varying vec3 vW; varying float vD;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec3 c = uWall;
      vec3 vN = normalize(cross(dFdx(vW), dFdy(vW)));                 // flat face normal (the mesh ships without normals)
      if (abs(vN.y) < .5) {
        vec2 cell = vUv / vec2(3.2, 3.6), f = fract(cell), id = floor(cell);
        float win = step(.25, f.x) * step(f.x, .75) * step(.3, f.y) * step(f.y, .8);
        float on = step(.72, h(id));
        vec3 lit = mix(vec3(1., .74, .42), vec3(.7, .82, 1.), step(.65, h(id + 7.))) * (.55 + .5 * h(id + 3.));
        vec3 near = mix(c, lit, win * on) + uWall * .35 * win * (1. - on);
        vec3 far = c + vec3(1., .78, .5) * .1;                                 // the grid's average glow (lit windows + sky reflections)
        c = mix(near, far, clamp(length(fwidth(cell)) * 1.5 - .5, 0., 1.));
      }
      gl_FragColor = vec4(mix(c, uFogC, 1. - exp(-pow(vD * uFogD, 2.))), 1.);
    }`,
});
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('rooftop.glb', (g) => {
  g.scene.getObjectByName('below')?.removeFromParent();          // the rooftops under the ledge: dropped, the view stays open
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    const map = o.material.map; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    o.material = new THREE.MeshBasicMaterial({ map, toneMapped: false });   // the bake already is the final light
  });
  scene.add(g.scene);
  worldReady++; begin();
});
// the skyline (rooftop/build_skyline.py): real silhouettes for the landmarks, its windows drawn by the shader above;
// the boroughs behind it are a second mesh, drawn faded
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('skyline.glb', (g) => {
  const boroughs = haze(0x3a2e34, 0.62);                          // Queens and Brooklyn behind: faint silhouettes, no windows
  g.scene.traverse((o) => { if (o.isMesh) o.material = o.name.startsWith('skyline_far') ? boroughs : windows; });
  g.scene.position.x = SKY_X;                                   // to the right of the river
  scene.add(g.scene);
  worldReady++; begin();
});

// ── Neo ──
const NEO = new THREE.Vector3(0.6, 0.5, -4.25);                    // on the ledge
let SIT_YAW = 0;                                                    // facing the camera; set in size() for each screen shape
let mixer, sit, idle, ready = false, neo, worldReady = 0;            // worldReady: 2 once the rooftop and the skyline are in
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('neo-slim.glb', (g) => {
  g.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material.envMap = studio; o.material.envMapIntensity = 0.35; } });   // a faint studio reflection: leather and denim stop looking flat
  neo = g.scene; neo.position.copy(NEO);
  scene.add(neo);
  mixer = new THREE.AnimationMixer(g.scene);
  const clip = (n) => mixer.clipAction(g.animations.find((a) => a.name === n));
  sit = clip('neo_sit'); idle = clip('neo_idle');
  sit.play(); ready = true; begin();
});
// Standing up: the rise from Mixamo "Lifting" (the loft's coin pickup, lift.glb: it binds to Neo's bones by name), from
// the moment his hand is on the ground until he's upright. sit → blend down into that crouch → rise → idle; closing a
// card plays the same rise backwards, so he sits down the way he got up. Reduced motion: a plain crossfade.
const RISE = [40, 76];                                             // Lifting frames used (30 fps): hand on the ground → upright
const CARD_LAG = 0.3;                                               // share of the camera move before the opened card sets off
let rise = null, standT = 0;
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('lift.glb', (g) => {
  const c = g.animations[0];
  c.tracks = c.tracks.filter((t) => !t.name.startsWith('mixamorigRightHand.quaternion'));   // its palm-up turn is the coin trick
  rise = THREE.AnimationUtils.subclip(c, 'rise', RISE[0], RISE[1], 30);
});
function to(a, d) {                                                // fade every other pose out and this one in
  for (const b of [sit, idle, rise && mixer.clipAction(rise)]) if (b && b !== a) b.fadeOut(d);
  a.enabled = true; a.setEffectiveWeight(1); a.fadeIn(d).play();
}
function stand(up) {
  if (!ready) return;
  clearTimeout(standT);
  const end = up ? idle : sit;
  if (!rise || still) { end.reset(); to(end, 0.6); return; }
  const r = mixer.clipAction(rise);
  r.setLoop(THREE.LoopOnce, 1); r.clampWhenFinished = true;
  r.reset(); r.timeScale = up ? 1 : -1; r.time = up ? 0 : rise.duration;
  to(r, up ? 0.45 : 0.3);
  standT = setTimeout(() => { end.reset(); to(end, 0.5); }, (rise.duration - 0.45) * 1000);
}

// ── cards: five playing cards fanned along the curve, face up (real screenshots); they arrive back-up and turn over ──
const CW = 400, CH = 560, CARD = 0.5;                                 // poker-card proportions (5:7)
const faceTex = (draw) => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; const x = c.getContext('2d'); draw(x);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.redraw = () => { draw(x); t.needsUpdate = true; }; return t; };
const backTex = faceTex((x) => drawBack(x, CW, CH));                  // one back design, shared
const cardGeo = new THREE.PlaneGeometry(CARD, CARD * CH / CW);
const cards = buttons.map((b, i) => {
  const card = new THREE.Group(), flip = new THREE.Group(); card.add(flip);
  const info = { name: b.textContent, fit: b.dataset.fit, resume: b.dataset.d === 'resume', link: !!b.dataset.href, art: b.dataset.art, fade: 'fade' in b.dataset, img: null };
  const tex = faceTex((x) => drawFront(x, CW, CH, info, i));
  if (b.dataset.img) { const im = new Image(); im.onload = () => { info.img = im; tex.redraw(); }; im.src = b.dataset.img; }   // the screenshot, drawn in once it's here
  const front = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false }));
  const back = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: backTex, transparent: true, fog: false }));
  back.rotation.y = Math.PI;                                           // on the other side: what you see while it arrives
  flip.add(front, back);
  card.userData = { i, s: 1, flip, faces: [front, back], redraw: tex.redraw };
  scene.add(card);
  return card;
});
// Hover targets: one invisible plane per card, fixed at its resting place and a little larger, so hovering doesn't
// flicker when the card itself lifts toward you (the pointer used to slip off and back)
const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
const hits = cards.map((c, i) => { const h = new THREE.Mesh(cardGeo, hitMat); h.userData.i = i; h.scale.setScalar(1.15); scene.add(h); return h; });
// the card faces use the page's fonts; canvas text doesn't wait for web fonts, so draw them again once those are in
Promise.all(['600 44px Fraunces', '400 22px "Instrument Sans"', '500 18px "IBM Plex Mono"'].map((f) => document.fonts.load(f)))
  .then(() => cards.forEach((c) => c.userData.redraw())).catch(() => {});
const faces = hits;                                                   // what the pointer is tested against
// the half ring: an upright arch behind him, facing the camera, from his right side over his head to his left.
// The cards stay put; the one you point at grows toward you.
const ring = new THREE.Object3D(); ring.position.copy(NEO).add(new THREE.Vector3(0, 0.55, -0.15)); ring.rotation.order = 'YXZ'; scene.add(ring);   // high enough that the arc's ends clear the headline
const slot = cards.map(() => { const s = new THREE.Object3D(); ring.add(s); return s; });
// FAN: how far each card leans with the curve (1 = fully radial)
const FAN = 0.33;
// all seven the same size, on a semicircle round him (ARC degrees, centred on top: wider and the ends sink behind the ledge): the
// cards a recruiter wants (data-main: LinkedIn, Résumé, GitHub) across the top, the rest split down the two sides
const ARC = 160;
const isMain = buttons.map((b) => 'main' in b.dataset);
const rest = buttons.map((b, i) => i).filter((i) => !isMain[i]), half = Math.ceil(rest.length / 2);
const around = [...rest.slice(0, half), ...buttons.map((b, i) => i).filter((i) => isMain[i]), ...rest.slice(half)];   // left → right
const slotA = [], slotZ = [];                                      // each card's angle on the arc (0 = far left, π/2 = top), depth
around.forEach((i, k) => { slotA[i] = Math.PI / 2 - THREE.MathUtils.degToRad(ARC / 2) + THREE.MathUtils.degToRad(ARC) * k / (around.length - 1);
  slotZ[i] = -0.015 * Math.abs(k - (around.length - 1) / 2); });   // the top card nearest: overlapping cards never share a plane (no flicker)
const angle = (i) => slotA[i];
function arch(rx, ry) {
  slot.forEach((s, i) => { const a = angle(i); s.position.set(-Math.cos(a) * rx, Math.sin(a) * ry, slotZ[i]); });
}
const HOVER = 1.15, LIFT = 0.1;                                              // hovered card: bigger, a little toward you
const ringQ = new THREE.Quaternion(), rollQ = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);

// ── camera poses: home (Neo centred, ring around him) and focus (Neo left, card up front, info on the right) ──
const pose = { start: { p: new THREE.Vector3(), l: new THREE.Vector3(), fov: 50 }, home: { p: new THREE.Vector3(), l: new THREE.Vector3(), fov: 55 }, focus: { p: new THREE.Vector3(), l: new THREE.Vector3(), fov: 40 } };
let phone = false, cardScale = 1;
function size() {
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
  grade.uniforms.uAspect.value = innerWidth / innerHeight; grade.uniforms.uRes.value.set(innerWidth, innerHeight).multiplyScalar(renderer.getPixelRatio());
  camera.aspect = innerWidth / innerHeight; phone = camera.aspect < 0.8;
  if (phone) {                                                                // portrait: Neo and his fan left of centre, the city to the right
    pose.home.p.set(2.0, 1.85, 0.3); pose.home.l.set(0.85, 1.0, -4.4); pose.home.fov = 60;
    pose.focus.p.set(1.9, 1.75, -1.0); pose.focus.l.set(0.95, 1.4, -4.6); pose.focus.fov = 55;
  } else {
    pose.home.p.set(2.3, 1.95, -1.3); pose.home.l.set(-0.5, 0.75, -10.5); pose.home.fov = 55;   // high, behind him: river + city below the sun
    pose.focus.p.set(2.3, 1.4, -2.0); pose.focus.l.set(1.35, 1.15, -4.7); pose.focus.fov = 40; // Neo ends up left of frame
  }
  // the fan scales with how much width the camera sees at Neo's distance: same semicircle everywhere, smaller on narrow
  // screens (desktop is already at the cap)
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(pose.home.fov / 2)) * camera.aspect);
  const viewW = 2 * pose.home.p.distanceTo(NEO) * Math.tan(hfov / 2);
  const rx = Math.min(1.4, viewW * 0.29); arch(rx, rx * 1.02);         // spread wide, arched a little taller than wide
  cardScale = Math.min(0.86, (viewW * 0.11) / CARD);                     // narrower than the gaps, so cards never overlap
  // the reveal starts higher, further back and looking up toward the sun over the skyline, then cranes down to him
  pose.start.p.copy(pose.home.p).add(phone ? new THREE.Vector3(2.5, 3.5, 6) : new THREE.Vector3(4, 3.2, 7));
  pose.start.l.copy(SUN).multiplyScalar(700).add(new THREE.Vector3(0, 30, 0)); pose.start.fov = phone ? 66 : 48;
  SIT_YAW = Math.atan2(pose.home.p.x - NEO.x, pose.home.p.z - NEO.z);   // sitting, he faces you
  ring.rotation.set(-0.12, Math.atan2(pose.home.p.x - NEO.x, pose.home.p.z - NEO.z), 0);   // faces the camera, top leaning back a touch
}
// where the focused card floats: in front of the focus camera, a bit right of centre (above centre on phones)
const focusSpot = () => {
  const p = pose.focus.p, l = pose.focus.l, fwd = l.clone().sub(p).normalize(), right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
  return p.clone().addScaledVector(fwd, 1.8).addScaledVector(right, phone ? 0 : -0.1).addScaledVector(camera.up, phone ? 0.34 : 0.02);   // phones: high, clear of the info sheet
};

// ── state: hover, focus in/out (tweens run in the loop) ──
let hovered = -1, kbd = -1, focused = -1, t01 = 0, dir = 0;    // t01: 0 = home … 1 = focus; dir: +1 / -1 while moving
const flyFrom = new THREE.Vector3(), tmp = new THREE.Vector3();
// ── opening reveal ──
const REVEAL = 4.6, POP_AT = REVEAL * 0.72, POP_GAP = 0.08, POP_LEN = 0.5;   // seconds
let revealT = still ? REVEAL + 9 : 0, revealing = false, begun = false;
function begin(force) {
  if (begun || !(force || (worldReady === 2 && ready))) return;
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
  if (buttons[i].dataset.href) {                                   // LinkedIn, GitHub: straight to the profile, in a new tab
    skipReveal();
    Object.assign(document.createElement('a'), { href: buttons[i].dataset.href, target: '_blank', rel: 'noopener' }).click();
    return;
  }
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
renderer.domElement.addEventListener('click', (e) => { const i = pick(e); if (i >= 0) act(i); else close(); });

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
  if (!still) for (const f of ferries) {
    f.position.x += f.userData.v * dt; if (Math.abs(f.position.x) > 900) f.position.x = -Math.sign(f.position.x) * 900;
    const ph = t * 1.3 + f.userData.ph, b = f.userData.boat;          // a gentle bob and rock (the flag rides along, fixed)
    b.position.y = Math.sin(ph) * 0.35; b.rotation.z = Math.sin(ph * 0.8) * 0.05; b.rotation.x = Math.sin(ph * 1.1) * 0.04;
  }
  faceFill.position.copy(NEO).add(tmp.subVectors(camera.position, NEO).setY(0).normalize().multiplyScalar(2.5)).setY(NEO.y + 1.8);
  faceFill.target.position.set(NEO.x, NEO.y + 0.5, NEO.z); faceFill.intensity = FILL[0] + (FILL[1] - FILL[0]) * k;
  if (neo) {                                                      // standing: he turns from the city to face you
    const face = Math.atan2(pose.focus.p.x - NEO.x, pose.focus.p.z - NEO.z);
    neo.rotation.y = SIT_YAW + Math.atan2(Math.sin(face - SIT_YAW), Math.cos(face - SIT_YAW)) * k;
  }

  const on = focused < 0 ? (hovered >= 0 ? hovered : kbd) : -1;
  ring.getWorldQuaternion(ringQ);
  cards.forEach((m, i) => {
    const u = m.userData, a = angle(i);
    slot[i].updateMatrixWorld(); slot[i].getWorldPosition(m.position);
    m.quaternion.copy(ringQ).multiply(rollQ.setFromAxisAngle(Z, (Math.PI / 2 - a) * FAN));   // fanned along the curve, gently so faces stay readable
    hits[i].position.copy(m.position); hits[i].quaternion.copy(m.quaternion); hits[i].scale.setScalar(1.15 * cardScale);
    const turn = easeIO(clamp01((revealT - POP_AT - i * POP_GAP - 0.3) / 0.6));   // arrives back-up, then turns face-up
    u.flip.rotation.y = Math.PI * (1 - turn);
    if (i === focused) {                                          // fly from its place on the curve to the spot up front, upright
      const kc = ease(clamp01((t01 - CARD_LAG) / (1 - CARD_LAG)));  // the card waits a beat so you see Neo start to stand
      m.position.lerpVectors(dir === -1 ? m.position : flyFrom, focusSpot(), kc);
      m.quaternion.slerp(camera.quaternion, kc);
      u.s = 1 + kc * (phone ? 0.25 : 0.4);
    } else {
      u.s += ((i === on ? HOVER : 1) - u.s) * Math.min(1, still ? 1 : dt * 10);
      m.position.addScaledVector(tmp.subVectors(camera.position, m.position).normalize(), LIFT * (u.s - 1) / (HOVER - 1));
    }
    const pop = easeOutBack(clamp01((revealT - POP_AT - i * POP_GAP) / POP_LEN));   // cards arrive one by one after the reveal
    m.scale.setScalar(u.s * Math.max(pop, 0.0001) * (i === focused ? 1 : cardScale));   // fan cards follow the screen size; the opened one doesn't
    const op = focused >= 0 && i !== focused ? 1 - 0.7 * k : 1;
    for (const f of u.faces) f.material.opacity = op;
  });
  dof.enabled = !phone && !still && k > 0.01;                      // depth of field fades in with the card
  dof.uniforms.aperture.value = 0.0012 * k; dof.uniforms.focus.value = camera.position.distanceTo(NEO) + 0.35;
  grade.uniforms.uTime.value = still ? 0 : t;
  if (LOOK) composer.render(dt); else renderer.render(scene, camera);

  if (PERF && (frames++, (acc += dt) >= 0.5)) {
    const r = renderer.info, mem = performance.memory ? ` · heap ${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB` : '';
    perfEl.textContent = `${Math.round(frames / acc)} fps · ${r.render.calls} calls · ${(r.render.triangles / 1000).toFixed(0)}k tris\n` +
      `${r.memory.geometries} geometries · ${r.memory.textures} textures${mem}`;
    frames = 0; acc = 0;
  }
});
size();
addEventListener('resize', size);
