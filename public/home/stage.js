// The shared basics every part of the rooftop uses: the renderer, the scene, the camera, where the sun and Neo are,
// a model loader, and the easing curves.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from '../vendor/meshopt/meshopt_decoder.js';

export const still = matchMedia('(prefers-reduced-motion: reduce)').matches;   // reduced motion: no drift, bobbing or reveal
export const params = new URLSearchParams(location.search);       // ?look=off (plain render), ?perf (fps readout)

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.info.autoReset = false;                                    // ?perf counts the whole frame (all passes), reset per frame in main.js
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
// Golden-hour haze (after the mood reference): the sun high-left behind streaky clouds, everything washed in one
// orange-gold, the far skyline barely darker than the sky, the river doing half the work with a live sun streak.
scene.fog = new THREE.FogExp2(0xd99a6c, 0.0016);                 // ≈ the sky just above the horizon
export const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 3000);

export const SUN = new THREE.Vector3(-0.45, 0.12, -1).normalize();  // direction to the sun
export const NEO = new THREE.Vector3(0.6, 0.5, -4.25);              // where Neo sits on the ledge

// a dim studio environment, for reflections on Neo and the boats' materials
export const studio = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

// every model on the page is meshopt-compressed (see README "Model compression")
export const loadModel = (url) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);

export const ease = (t) => t * t * (3 - 2 * t);
export const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutBack = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
export const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
