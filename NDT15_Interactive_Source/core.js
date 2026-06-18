import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ── RENDERER & SCENE ─────────────────────────────── */
export const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101e33);
scene.fog = new THREE.FogExp2(0x101e33, 0.0015); // Adjusted for larger scale

export const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.5, 1500);
camera.position.set(150, 80, 280);

export const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 5, 22); orbit.enableDamping = true; orbit.dampingFactor = .06;
orbit.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
orbit.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
orbit.minDistance = 18; orbit.maxDistance = 600; orbit.maxPolarAngle = Math.PI * .482; orbit.update();

window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

export const uT = { value: 0 };
export const waterMat = new THREE.ShaderMaterial({
  uniforms: { t: uT },
  vertexShader: `uniform float t;varying vec3 vP;
    void main(){vec3 p=position;
      p.z+=sin(p.x*.13+t*.62)*1.6+sin(p.y*.09+t*.5)*1.2+sin((p.x+p.y)*.07+t*.8)*.7;
      vP=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
  fragmentShader: `uniform float t;varying vec3 vP;
    void main(){vec3 d=vec3(.01,.11,.22),m=vec3(.04,.21,.32);
      float h=sin(vP.x*.10+t*.5)*.5+.5;vec3 c=mix(d,m,h*.75);
      float s=pow(max(0.,sin(vP.x*.55+t*2.9)*sin(vP.y*.45+t*2.2)),6.)*.07;
      float cr=smoothstep(.2,1.8,vP.z)*.06;
      gl_FragColor=vec4(c+s+cr,1.);}`
});

/* ── MATERIALS ────────────────────────────────────── */
export const mat = (c, r = .85, m = .05, e = 0, ei = 0) => {
  const mt = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  if (e) { mt.emissive = new THREE.Color(e); mt.emissiveIntensity = ei; } return mt;
};
export const M = {
  seabed: mat(0x030810, 1), quay: mat(0x1c2d40, .88, .06), apron: mat(0x19293a, .9),
  berth: mat(0x162230, .92), yard: mat(0x0f1d2c, .9), road: mat(0x121f30, .9),
  mark: mat(0xffd070, .5, .2, 0xffd070, .18), crane: mat(0x1a3050, .35, .82),
  craneY: mat(0xd08018, .4, .55, 0x804000, .12), ship1: mat(0x162538, .7, .25),
  ship2: mat(0x1b2c3e, .7, .25), sup: mat(0xbcd8ec, .65, .1), rope: mat(0x4a6070, .8),
  gate: mat(0xf0f5ff, .4, .1, 0x34E0F0, 0), barr: mat(0xc02828, .5, .4, 0x500000, .25),
  barr2: mat(0xdddddd, .5, .3), radar: mat(0x1a3355, .3, .9, 0x0a2040, .7),
  buoy: mat(0xd89020, .5, .4, 0x402800, .5),
  cE: mat(0x1a8c5a, .45), cW: mat(0x2060b8, .45), cL: mat(0x6838b0, .45), cR: mat(0xb87010, .45),
};

export const cMats = [M.cE, M.cW, M.cL, M.cR];

/* ── LIGHTS ───────────────────────────────────────── */
export const ambLight = new THREE.AmbientLight(0x10223a, 1.0); scene.add(ambLight);
export const hemiLight = new THREE.HemisphereLight(0x1a3460, 0x050d1a, 0.75); scene.add(hemiLight);
export const sun = new THREE.DirectionalLight(0xa8c8e0, 2.0);
sun.position.set(155, 212, 176); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
['left', 'bottom'].forEach(k => sun.shadow.camera[k] = -330);
['right', 'top'].forEach(k => sun.shadow.camera[k] = 330);
sun.shadow.camera.far = 880; sun.shadow.bias = -0.001; scene.add(sun);

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
