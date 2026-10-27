// The Hudson below the ledge: the Palisades cliff dropping into it, the river surface (a live shader), and three
// giant origami paper boats crossing it.
import * as THREE from 'three';
import { scene, SUN } from './stage.js';

// the Palisades: the cliff drops from under the building straight into the river, so the view over the ledge is open water
const cliffFace = new THREE.Mesh(new THREE.PlaneGeometry(600, 72), new THREE.MeshBasicMaterial({ color: 0x3a2722 }));
cliffFace.position.set(0, -50, -5.2); scene.add(cliffFace);

// the river: a few travelling waves tilt the normal; the sky reflects by angle and the sun leaves a streak
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

// ── paper boats: a folded hull and peaked sail (each fold its own shade of paper, lit by the scene), a red flag at the
// stern, a soft shadow on the water and a fading wake ──
const canvasTex = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d')); return new THREE.CanvasTexture(c); };
const wakeTex = canvasTex(128, 8, (x) => {
  const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(255,240,215,0)'); g.addColorStop(1, 'rgba(255,240,215,.55)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 8);
});
const shadowTex = canvasTex(64, 64, (x) => {                       // stretched toward the camera: the low sun is behind the city
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(30,18,12,.55)'); g.addColorStop(1, 'rgba(30,18,12,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
});

const hullGeo = (() => {
  const L = 12, l = 7, H = 5, W = 3.4, S = 13;                      // half-lengths at the rim / keel, rim height, half-width, sail peak
  const folds = [                                                   // triangles: [corners…]
    [[-L, H, W], [L, H, W], [l, 0, 0]], [[-L, H, W], [l, 0, 0], [-l, 0, 0]],          // near side of the hull
    [[L, H, -W], [-L, H, -W], [-l, 0, 0]], [[L, H, -W], [-l, 0, 0], [l, 0, 0]],       // far side
    [[-L, H, W], [-l, 0, 0], [-L, H, -W]], [[L, H, -W], [l, 0, 0], [L, H, W]],         // the pointed ends
    [[-6, H, W * 0.7], [6, H, W * 0.7], [0, S, 0]], [[6, H, -W * 0.7], [-6, H, -W * 0.7], [0, S, 0]],   // the sail's two folds
  ];
  const shades = [1, 1, 0.84, 0.84, 0.9, 0.9, 0.97, 0.8];
  const pos = [], col = [];
  folds.forEach((t, k) => { for (const p of t) { pos.push(...p); col.push(0.96 * shades[k], 0.93 * shades[k], 0.86 * shades[k]); } });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();                                         // flat: every fold faces its own way
  return g;
})();
const paperMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-9.5, 11, 0), new THREE.Vector3(-9.5, 8.6, 0), new THREE.Vector3(-14, 9.9, 0)]);   // at the stern, streaming back
const flagMat = new THREE.MeshStandardMaterial({ color: 0xd8312a, side: THREE.DoubleSide, roughness: 0.8 });
const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a22 });

function paperBoat(x, z, speed) {                                   // speed: metres per second, + = to the right
  const group = new THREE.Group(); group.scale.setScalar(1.5);     // comically big for paper
  const boat = new THREE.Group(); group.add(boat);                  // what bobs (the shadow and wake stay on the water)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7), poleMat); pole.position.set(-9.5, 7.5, 0);   // up from the stern
  boat.add(new THREE.Mesh(hullGeo, paperMat), pole, new THREE.Mesh(flagGeo, flagMat));
  if (speed < 0) boat.rotation.y = Math.PI;                         // the flag streams back, whichever way it sails
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(30, 16), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.15, 7);
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(90, 7), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false }));
  wake.rotation.x = -Math.PI / 2; wake.position.set(-Math.sign(speed) * 56, 0.1, 0); if (speed < 0) wake.rotation.z = Math.PI;
  group.add(shadow, wake); group.position.set(x, -84, z); scene.add(group);
  return { group, boat, speed, phase: Math.random() * 6 };
}
const boats = [paperBoat(-200, -330, 6), paperBoat(150, -440, -4.5), paperBoat(-420, -540, 3.5)];   // lanes mid-river, clear of the piers

// t: seconds; moving: false under reduced motion (the water and boats hold still)
export function updateRiver(dt, t, moving) {
  river.material.uniforms.uTime.value = moving ? t : 0;
  if (!moving) return;
  for (const b of boats) {
    b.group.position.x += b.speed * dt;
    if (Math.abs(b.group.position.x) > 900) b.group.position.x = -Math.sign(b.group.position.x) * 900;   // sail off one side, back in the other
    const ph = t * 1.3 + b.phase;                                   // a gentle bob and rock (the flag rides along, fixed)
    b.boat.position.y = Math.sin(ph) * 0.35; b.boat.rotation.z = Math.sin(ph * 0.8) * 0.05; b.boat.rotation.x = Math.sin(ph * 1.1) * 0.04;
  }
}
