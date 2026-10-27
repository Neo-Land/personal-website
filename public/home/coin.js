// The easter egg: the loft's gold "HACKATHON WINNER" coin (coin.glb: diameter 1, face toward +Z) for 3rd place at
// GirlHacks 2026. On phones it's propped against the vent pipe below the ledge; on wider screens that pipe is out of
// frame, so it leans on the ledge to Neo's right. A slow glint hints it's clickable; opened, it floats up in front of
// the camera, turning once, and main.js shows its panel (<template id="d-medal">).
import * as THREE from 'three';
import { scene, camera, still, studio, loadModel, easeIO, clamp01 } from './stage.js';
import { cityReady } from './city.js';

const SIZE = 0.23;                                                  // diameter (m): a third of the vent pipe's height
const TILT = 0.35;                                                  // radians it leans back, propped
const SPOT = {                                                      // where it rests: [x, z] on the surface, surface height
  phone: { x: 1.6, z: -2.86, y: 0 },                                // the roof, against the front of the vent pipe at (1.6, -3.0)
  desktop: { x: 1.2, z: -4.05, y: 0.54 },                           // on the ledge's coping, right of Neo
};
const OPEN_TIME = 1.1;                                              // seconds to float up (or back)

const coin = new THREE.Group(), spin = new THREE.Group(); coin.add(spin); scene.add(coin);
coin.rotation.order = 'YXZ';
coin.visible = false;                                               // until the model is in

// the glint: a soft white star that flares on its rim every few seconds
const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,236,190,.7)'); r.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, opacity: 0 }));
glint.position.set(-0.3, 0.32, 0.05); glint.scale.setScalar(0.5); spin.add(glint);   // in coin units (diameter 1)

// hover / click target: a little larger than the coin, so it's easy to hit on a phone
const hit = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
coin.add(hit);

cityReady.then(() => loadModel('coin.glb')).then((g) => {          // after the scene: it never delays the reveal
  g.scene.traverse((o) => { if (o.isMesh) { o.material.envMap = studio; o.material.envMapIntensity = 0.6; } });
  spin.add(g.scene);
  coin.visible = true;
}).catch(() => {});

const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
export function pickCoin(e) {
  if (!coin.visible) return false;
  ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  return ray.intersectObject(hit).length > 0;
}

let t01 = 0, dir = 0;                                               // 0 resting … 1 up in front of you; dir +1 / -1 while moving
export const coinOpen = () => dir === 1 || (t01 > 0 && dir !== -1);
export function openCoin() { if (coin.visible) dir = 1; }
export function closeCoin() { dir = -1; }

const restP = new THREE.Vector3(), restQ = new THREE.Quaternion(), upP = new THREE.Vector3(), upQ = new THREE.Quaternion();
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), turn = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
const e3 = new THREE.Euler(0, 0, 0, 'YXZ');
export function updateCoin(dt, t, phone, hovered) {
  if (dir) { t01 = clamp01(t01 + dir * dt / (still ? 0.01 : OPEN_TIME)); if (t01 === 0 || t01 === 1) dir = 0; }
  // resting: propped up, turned toward the camera
  const s = phone ? SPOT.phone : SPOT.desktop;
  restP.set(s.x, s.y + SIZE / 2 * Math.cos(TILT), s.z);
  restQ.setFromEuler(e3.set(-TILT, Math.atan2(camera.position.x - s.x, camera.position.z - s.z), 0));
  // opened: floating in front of the camera, left of the desktop panel / above the phone sheet
  camera.getWorldDirection(fwd); right.crossVectors(fwd, camera.up).normalize();
  upP.copy(camera.position).addScaledVector(fwd, 0.75).addScaledVector(right, phone ? 0 : -0.14).addScaledVector(camera.up, phone ? 0.2 : 0.02);
  const k = easeIO(t01);
  coin.position.lerpVectors(restP, upP, k);
  coin.position.y += Math.sin(k * Math.PI) * 0.15;                 // a little arc on the way up
  coin.quaternion.slerpQuaternions(restQ, camera.quaternion, k).multiply(turn.setFromAxisAngle(Y, k * Math.PI * 2));   // one full turn
  if (t01 === 1 && !still) coin.quaternion.multiply(turn.setFromAxisAngle(Y, Math.sin(t * 1.2) * 0.12));   // a gentle sway once up
  coin.scale.setScalar(SIZE);
  // glint: a short flare every 4 s (always on while hovered), none while it's open
  const flare = hovered ? 1 : Math.max(0, Math.sin(t * Math.PI / 2)) ** 24;
  glint.material.opacity = (still ? 0.5 : flare) * (1 - k);
}
