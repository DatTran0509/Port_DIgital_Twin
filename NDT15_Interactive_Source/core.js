import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
/* ── RENDERER & SCENE ─────────────────────────────── */
export const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.useLegacyLights = false;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8ba5b3, 2000, 18000); // Complete obscuration at the horizon

export const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 5, 20000);
camera.position.set(150, 80, 280);

export const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 5, 22); orbit.enableDamping = true; orbit.dampingFactor = .06;
orbit.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
orbit.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
orbit.minDistance = 18; orbit.maxDistance = 50000; orbit.maxPolarAngle = Math.PI * 0.44; orbit.update();

window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// Removed custom water material since we'll use THREE.Water

/* ── MATERIALS ────────────────────────────────────── */
export const mat = (c, r = .85, m = .05, e = 0, ei = 0) => {
  const mt = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  if (e) { mt.emissive = new THREE.Color(e); mt.emissiveIntensity = ei; } return mt;
};
export const M = {
  seabed: mat(0x030810, 1), quay: mat(0x3a4f66, .88, .06), apron: mat(0x354558, .9),
  berth: mat(0x2d3e50, .92), yard: mat(0x2a3d52, .9), road: mat(0x2d3f54, .9),
  mark: mat(0xffd070, .5, .2, 0xffd070, .18), crane: mat(0x1a3050, .35, .82),
  craneY: mat(0xd08018, .4, .55, 0x804000, .12), ship1: mat(0x162538, .7, .25),
  ship2: mat(0x1b2c3e, .7, .25), sup: mat(0xbcd8ec, .65, .1), rope: mat(0x4a6070, .8),
  gate: mat(0xf0f5ff, .4, .1, 0x34E0F0, 0), barr: mat(0xc02828, .5, .4, 0x500000, .25),
  barr2: mat(0xdddddd, .5, .3), radar: mat(0x1a3355, .3, .9, 0x0a2040, .7),
  buoy: mat(0xd89020, .5, .4, 0x402800, .5),
  cE: mat(0x1a8c5a, .8, .6), cW: mat(0x2060b8, .8, .6), cL: mat(0x6838b0, .8, .6), cR: mat(0xb87010, .8, .6),
};

export const cMats = [M.cE, M.cW, M.cL, M.cR];

/* ── LIGHTS ───────────────────────────────────────── */
export const ambLight = new THREE.AmbientLight(0x10223a, 1.0); scene.add(ambLight);
export const hemiLight = new THREE.HemisphereLight(0x1a3460, 0x050d1a, 0.75); scene.add(hemiLight);
export const sun = new THREE.DirectionalLight(0xa8c8e0, 2.0);
sun.position.set(155, 212, 176); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); // High res shadows to stop shimmering/stuttering
['left', 'bottom'].forEach(k => sun.shadow.camera[k] = -450);
['right', 'top'].forEach(k => sun.shadow.camera[k] = 450);
sun.shadow.camera.far = 1000; 
sun.shadow.bias = -0.0001; 
sun.shadow.normalBias = 0.05; 
scene.add(sun);

export const portLights = new THREE.Group();
portLights.visible = false;
scene.add(portLights);

/* ── GEOMETRY HELPERS ─────────────────────────────── */
export const dummy = new THREE.Object3D();
const boxGeos = {};
const cyGeos = {};
export const bx = (p, w, h, d, mt, x = 0, y = 0, z = 0, shad = true) => {
  const k = `${w}_${h}_${d}`;
  if (!boxGeos[k]) boxGeos[k] = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(boxGeos[k], mt);
  m.position.set(x, y + h / 2, z);
  if (shad) m.castShadow = m.receiveShadow = true;
  p.add(m); return m;
};
export const cy = (p, r, h, mt, x = 0, y = 0, z = 0, shad = true) => {
  const k = `${r}_${h}`;
  if (!cyGeos[k]) cyGeos[k] = new THREE.CylinderGeometry(r, r, h, 12);
  const m = new THREE.Mesh(cyGeos[k], mt);
  m.position.set(x, y + h / 2, z);
  if (shad) m.castShadow = true;
  p.add(m); return m;
};
export const sp = (p, r, mt, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), mt); m.position.set(x, y, z); p.add(m); return m; };
export function cable(parent, p1, p2, mt) {
  const d = new THREE.Vector3().subVectors(p2, p1), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, len, 4), mt);
  m.position.copy(new THREE.Vector3().addVectors(p1, p2).multiplyScalar(.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  parent.add(m);
  return m;
}

export const clock = new THREE.Clock();
