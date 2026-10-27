// Neo on the ledge: sitting by default; when a card opens he stands up and turns to face you, and sits back down when
// it closes.
//
// Standing up reuses the rise from Mixamo "Lifting" (the loft's coin pickup, lift.glb; it binds to Neo's bones by name),
// from the moment his hand is on the ground until he's upright: sit → blend down into that crouch → rise → idle.
// Sitting down plays the same rise backwards. Under reduced motion it's a plain crossfade.
import * as THREE from 'three';
import { scene, still, studio, NEO, loadModel } from './stage.js';

const RISE = [40, 76];                                              // Lifting frames used (30 fps): hand on the ground → upright

let neo, mixer, sit, idle, rise = null, standTimer = 0;

export const neoReady = loadModel('neo-slim.glb').then((g) => {
  g.scene.traverse((o) => {                                         // a faint studio reflection: leather and denim stop looking flat
    if (o.isMesh) { o.frustumCulled = false; o.material.envMap = studio; o.material.envMapIntensity = 0.35; }
  });
  neo = g.scene; neo.position.copy(NEO); scene.add(neo);
  mixer = new THREE.AnimationMixer(neo);
  const clip = (name) => mixer.clipAction(g.animations.find((a) => a.name === name));
  sit = clip('neo_sit'); idle = clip('neo_idle');
  sit.play();
});

loadModel('lift.glb').then((g) => {                                 // optional: without it, standing is a crossfade
  const c = g.animations[0];
  c.tracks = c.tracks.filter((t) => !t.name.startsWith('mixamorigRightHand.quaternion'));   // its palm-up turn is the coin trick
  rise = THREE.AnimationUtils.subclip(c, 'rise', RISE[0], RISE[1], 30);
}).catch(() => {});

function fadeTo(action, seconds) {                                  // fade every other pose out and this one in
  for (const a of [sit, idle, rise && mixer.clipAction(rise)]) if (a && a !== action) a.fadeOut(seconds);
  action.enabled = true; action.setEffectiveWeight(1); action.fadeIn(seconds).play();
}

export function stand(up) {
  if (!mixer) return;
  clearTimeout(standTimer);
  const end = up ? idle : sit;
  if (!rise || still) { end.reset(); fadeTo(end, 0.6); return; }
  const r = mixer.clipAction(rise);
  r.setLoop(THREE.LoopOnce, 1); r.clampWhenFinished = true;
  r.reset(); r.timeScale = up ? 1 : -1; r.time = up ? 0 : rise.duration;
  fadeTo(r, up ? 0.45 : 0.3);
  standTimer = setTimeout(() => { end.reset(); fadeTo(end, 0.5); }, (rise.duration - 0.45) * 1000);
}

// k: 0 seated (facing sitYaw) … 1 standing for an open card (facing faceYaw)
export function updateNeo(dt, k, sitYaw, faceYaw) {
  mixer?.update(dt);
  if (neo) neo.rotation.y = sitYaw + Math.atan2(Math.sin(faceYaw - sitYaw), Math.cos(faceYaw - sitYaw)) * k;
}
