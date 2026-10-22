// DEV ONLY (delete before deploy): renders sitting Neo (neo_sit clip) as a transparent WebP for the ring page
// and POSTs it to the site-live dev server, which saves it to its SHOTS folder.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from './vendor/meshopt/meshopt_decoder.js';

const W = 900, H = 900;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.setClearColor(0, 0); renderer.setSize(W, H, false);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x302820, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(1.5, 3, 2.5); scene.add(key);
const rim = new THREE.DirectionalLight(0x8fb4ff, 2.5); rim.position.set(-2, 2, -3); scene.add(rim);

const neo = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('neo.glb');
scene.add(neo.scene);
neo.scene.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
const mixer = new THREE.AnimationMixer(neo.scene);
mixer.clipAction(neo.animations.find((a) => a.name === 'neo_sit')).play(); mixer.setTime(1);
neo.scene.updateMatrixWorld(true);

// frame his box from slightly above and to the side
const box = new THREE.Box3().setFromObject(neo.scene, true), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 50);
const r = Math.max(s.x, s.y, s.z) * 0.74 / Math.tan(THREE.MathUtils.degToRad(15));
cam.position.copy(c).add(new THREE.Vector3(0.2, 0.1, 1).normalize().multiplyScalar(r)); cam.lookAt(c);
renderer.render(scene, cam);
const blob = await new Promise((ok) => renderer.domElement.toBlob(ok, 'image/webp', 0.86));
await fetch('/sit.webp', { method: 'POST', body: blob });
document.title = 'done';
