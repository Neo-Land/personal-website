// Everything across the river, plus the rooftop under Neo:
//  - the baked rooftop (rooftop.glb, built and lit in Blender by rooftop/build_rooftop.py)
//  - Manhattan's ground: a low slab, piers and low waterfront buildings, so the towers rise out of a city
//  - the skyline (skyline.glb, from rooftop/build_skyline.py): real silhouettes, lit windows drawn by a shader here,
//    and the boroughs behind it as faded silhouettes
// The far shore uses its own lighter haze (SKY_HAZE), so nearer things stay darker than farther ones.
import * as THREE from 'three';
import { scene, loadModel } from './stage.js';

const SKY_X = 280;                                                  // the skyline sits this far right of the river's centre
const SKY_HAZE = 0.0006;

// a flat colour sunk into the haze by distance; fade: a floor on how far (for the faint boroughs)
const haze = (color, fade = 0) => new THREE.ShaderMaterial({
  fog: false, toneMapped: false,
  uniforms: { uC: { value: new THREE.Color(color) }, uFogC: { value: scene.fog.color }, uFogD: { value: SKY_HAZE }, uFade: { value: fade } },
  vertexShader: `varying float vD; void main(){ vec4 p = vec4(position, 1.);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
    #endif
    vec4 mv = modelViewMatrix * p; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uC, uFogC; uniform float uFogD, uFade; varying float vD;
    void main(){ gl_FragColor = vec4(mix(uC, uFogC, max(uFade, 1. - exp(-pow(vD * uFogD, 2.)))), 1.); }`,
});

// ── Manhattan's ground ──
const land = new THREE.Mesh(new THREE.BoxGeometry(4800, 4, 1400), haze(0x3a2e30));   // wide: Upper Manhattan runs off to the left
land.position.set(SKY_X - 1150, -84, -1490); scene.add(land);      // top at y -82, front (the seawall) at z -790
const lowMat = haze(0x2c2428);
const boxes = (count, place) => {                                   // many boxes in one draw call
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lowMat, count);
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, new THREE.Matrix4().compose(...place(i)));
  scene.add(mesh);
};
const upright = new THREE.Quaternion();
boxes(60, (i) => {                                                  // piers, every ~72 m along the seawall
  const x = SKY_X - 3100 + i * 72 + (Math.random() - 0.5) * 20, len = 40 + Math.random() * 50;
  return [new THREE.Vector3(x, -83, -790 + len / 2), upright, new THREE.Vector3(10 + Math.random() * 10, 2.5, len)];
});
boxes(460, () => {                                                  // low buildings along the waterfront
  const h = 6 + Math.random() * 28, x = SKY_X - 3200 + Math.random() * 4440, z = -800 - Math.random() * 90;
  return [new THREE.Vector3(x, -82 + h / 2, z), upright, new THREE.Vector3(14 + Math.random() * 24, h, 12 + Math.random() * 20)];
});
const stackMat = haze(0x2c2428);                                     // far-left industrial shore: a few stacks in the haze
for (const [x, h, z] of [[-820, 120, -1250], [-780, 95, -1270], [-735, 140, -1240], [-690, 80, -1300], [-900, 60, -1220]]) {
  const st = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, h, 10), stackMat); st.position.set(x, -84 + h / 2, z); scene.add(st);
}

// ── the skyline's windows: a grid in its metre UVs (3.2 m bays, 3.6 m floors), ~28% lit warm or cool; far away, where a
// window is smaller than a pixel, the grid fades to its average so it doesn't shimmer ──
const windows = new THREE.ShaderMaterial({
  fog: false, toneMapped: false,
  uniforms: { uWall: { value: new THREE.Color(0x232636) }, uFogC: { value: scene.fog.color }, uFogD: { value: SKY_HAZE } },
  vertexShader: `varying vec2 vUv; varying vec3 vW; varying float vD;
    void main(){ vUv = uv; vW = (modelMatrix * vec4(position, 1.)).xyz; vec4 mvPosition = modelViewMatrix * vec4(position, 1.); vD = -mvPosition.z; gl_Position = projectionMatrix * mvPosition; }`,
  fragmentShader: `uniform vec3 uWall, uFogC; uniform float uFogD; varying vec2 vUv; varying vec3 vW; varying float vD;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec3 c = uWall;
      vec3 vN = normalize(cross(dFdx(vW), dFdy(vW)));                 // flat face normal (the mesh ships without normals)
      if (abs(vN.y) < .5) {                                           // walls only, not roofs
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

// ── loading: resolves once both the rooftop and the skyline are in the scene ──
const rooftop = loadModel('rooftop.glb').then((g) => {
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    const map = o.material.map; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    o.material = new THREE.MeshBasicMaterial({ map, toneMapped: false });   // the bake already is the final light
  });
  scene.add(g.scene);
});
const skyline = loadModel('skyline.glb').then((g) => {
  const boroughs = haze(0x3a2e34, 0.62);                            // Queens and Brooklyn behind: faint silhouettes, no windows
  g.scene.traverse((o) => { if (o.isMesh) o.material = o.name.startsWith('skyline_far') ? boroughs : windows; });
  g.scene.position.x = SKY_X;
  scene.add(g.scene);
});
export const cityReady = Promise.all([rooftop, skyline]);
