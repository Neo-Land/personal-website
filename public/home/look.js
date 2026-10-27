// The camera's "look": glow on the bright things (the sun, the river's glints), depth of field that softens only what's
// behind Neo once a card is open (phones skip it), then a grade: warm highlights, cooler shadows, a gentle contrast
// curve, a vignette and fine film grain.
//
// The effects work on the finished frame: the scene is drawn to the canvas exactly as without them (the sky, river
// and windows are shaders that output final screen colours, so re-tone-mapping them in a linear chain washed
// everything out), copied into a texture, and the passes run on that. ?look=off skips them all, for comparison.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { renderer, scene, camera, still, params, NEO } from './stage.js';

const ON = params.get('look') !== 'off';

class AsShownPass extends Pass {                                    // draws the scene as usual, then hands the frame on
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

composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.9));   // strength, radius, threshold (screen brightness)

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

export function resizeLook() {
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
  grade.uniforms.uAspect.value = innerWidth / innerHeight;
  grade.uniforms.uRes.value.set(innerWidth, innerHeight).multiplyScalar(renderer.getPixelRatio());
}

// k: how far into an open card the camera is (0 home … 1 focused)
export function renderWithLook(dt, t, k, phone) {
  dof.enabled = !phone && !still && k > 0.01;                       // depth of field fades in with the card
  dof.uniforms.aperture.value = 0.0012 * k;
  dof.uniforms.focus.value = camera.position.distanceTo(NEO) + 0.35;
  grade.uniforms.uTime.value = still ? 0 : t;
  if (ON) composer.render(dt); else renderer.render(scene, camera);
}
