// The sunset sky and the lights. The baked rooftop ignores scene lights, so these light the live things: Neo, the
// paper boats. Neo also gets his own soft fill from the camera side so his face reads against the sunset.
import * as THREE from 'three';
import { scene, camera, SUN, NEO } from './stage.js';

// value noise + fractal sum, for the clouds
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

const faceFill = new THREE.DirectionalLight(0xffe0c4, 1.1); scene.add(faceFill, faceFill.target);
const FILL = [1.1, 2.0];                                            // fill strength: at home, with a card open

const tmp = new THREE.Vector3();
// t: seconds (drifts the clouds); k: how far into an open card (0 … 1), which strengthens Neo's fill
export function updateSky(t, k) {
  sky.position.copy(camera.position);                               // the sky always surrounds the camera
  sky.material.uniforms.uTime.value = t;
  faceFill.position.copy(NEO).add(tmp.subVectors(camera.position, NEO).setY(0).normalize().multiplyScalar(2.5)).setY(NEO.y + 1.8);
  faceFill.target.position.set(NEO.x, NEO.y + 0.5, NEO.z);
  faceFill.intensity = FILL[0] + (FILL[1] - FILL[0]) * k;
}
