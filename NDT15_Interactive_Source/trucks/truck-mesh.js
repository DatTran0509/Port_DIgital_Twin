import * as THREE from 'three';
import { scene, mat, bx } from '../core.js';

// Shared truck visual build (geometry/material reused). Baseline behavior
// preserved from the original trucks.js before the task 6 rework.
//
// PERFORMANCE (Req 9.4): buildTruck() runs once per truck (8+). Every geometry
// and material below is created EXACTLY ONCE at module load and reused by every
// truck — there are no per-truck allocations of geometry or material. Box parts
// already reuse core.bx()'s cached BoxGeometry (keyed by w_h_d) + a shared
// material; the cylinders (hood, wheels) and headlight spheres — which bx()/cy()
// don't cover here — are hoisted to the module-level shared geometries below.
//
// Head colour: the original picked a random colour from a fixed 4-colour palette
// per truck. To keep that variety WITHOUT a per-truck material, we precompute the
// 4 head materials once and pick one by index — faithful to the original (≤4
// distinct shared head materials). All other materials are identical for every
// truck, so each is a single shared instance.

/* ── Shared geometries (created ONCE, reused by every truck — Req 9.4) ────── */
// Half-cylinder hood cap (matches the original CylinderGeometry args exactly).
const hoodGeo = new THREE.CylinderGeometry(1.7, 1.7, 3.4, 16, 1, false, 0, Math.PI);
// Single wheel geometry shared by all 6 wheels of all trucks.
const wheelGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 16);
// Headlight sphere geometry (replaces the un-cached core.sp() allocation).
const hlSphereGeo = new THREE.SphereGeometry(0.35, 16, 10);

/* ── Shared materials (created ONCE, reused by every truck — Req 9.4) ─────── */
// Fixed 4-colour head palette → 4 shared head materials, picked by index.
const headMats = [
  mat(0xff2222, 0.3, 0.6),
  mat(0xffaa00, 0.3, 0.6),
  mat(0x11cc44, 0.3, 0.6),
  mat(0x0088ff, 0.3, 0.6),
];
const cabMat = mat(0x050d1a, 0.1, 0.9);   // windshield / roof visor (dark glass)
const chassisMat = mat(0x101c2c, 0.7);     // chassis / trailer bed
const wheelMat = mat(0x111111, 0.8, 0.1);  // tyres
// Light materials are identical for every truck → one shared instance each.
// Day/night toggles emissiveIntensity on these shared materials, which is the
// desired behaviour (all trucks' lights switch together).
const hlMat = mat(0xffffff, 0.1, 0.1, 0xffffff, 2.0); // headlights
const tlMat = mat(0xff0000, 0.1, 0.1, 0xff0000, 1.5); // tail lights
const rlMat = mat(0xffaa00, 0.1, 0.1, 0xffaa00, 1.5); // roof running lights

// Add a plain (non-shadow) mesh reusing a shared geometry + material.
function addMesh(g, geo, mt, x, y, z, rotZ = 0) {
  const m = new THREE.Mesh(geo, mt);
  if (rotZ) m.rotation.z = rotZ;
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

export const truckGroup = new THREE.Group();
scene.add(truckGroup);

export function buildTruck(col) {
  const g = new THREE.Group();
  // Pick one of the 4 SHARED head materials (preserves colour variety).
  const headMat = headMats[Math.floor(Math.random() * 4)];

  bx(g, 3.4, 2.0, 2.5, headMat, 0, 1.4, -2.5);
  addMesh(g, hoodGeo, headMat, 0, 2.4, -2.5, Math.PI / 2);

  bx(g, 3.5, 1.0, 1.4, cabMat, 0, 2.2, -3.1);

  bx(g, 3.6, 0.8, 7.6, chassisMat, 0, 0.8, 2.6);
  const cargo = bx(g, 3.4, 2.6, 6.4, col, 0, 2.5, 2.6);

  [[-2.0, -2.8], [2.0, -2.8], [-2.0, 1.5], [2.0, 1.5], [-2.0, 4.5], [2.0, 4.5]].forEach(([wx, wz]) => {
    addMesh(g, wheelGeo, wheelMat, wx, 0.8, wz, Math.PI / 2);
  });

  addMesh(g, hlSphereGeo, hlMat, -1.2, 1.2, -3.8);
  addMesh(g, hlSphereGeo, hlMat, 1.2, 1.2, -3.8);
  bx(g, 0.6, 0.3, 0.2, tlMat, -1.3, 1.0, 6.5);
  bx(g, 0.6, 0.3, 0.2, tlMat, 1.3, 1.0, 6.5);
  [-1, 0, 1].forEach(lx => bx(g, 0.2, 0.15, 0.2, rlMat, lx, 4.2, -2.8));

  const hl = { mats: [hlMat, tlMat, rlMat] };

  const plateNum = Math.floor(10000 + Math.random() * 90000);
  const platePrefix = ['51C', '51D', '60C', '61C'][Math.floor(Math.random() * 4)];
  const plate = `${platePrefix}-${plateNum.toString().slice(0, 3)}.${plateNum.toString().slice(3)}`;

  const drivers = ['Nguyễn Văn A', 'Trần Thị B', 'Lê Hoàng C', 'Phạm D'];
  const companies = ['Gemadept Logistics', 'Tân Cảng', 'Vinafco', 'Sotrans'];

  g.userData = {
    isClickable: true,
    objType: 'truck',
    data: {
      icon: '🚛', name: `Xe Tải ${plate}`, subtitle: 'PHƯƠNG TIỆN ĐƯỜNG BỘ',
      details: {
        'Biển số': plate,
        'Tài xế': drivers[Math.floor(Math.random() * drivers.length)],
        'Đơn vị vận tải': companies[Math.floor(Math.random() * companies.length)],
        'Mức nhiên liệu': Math.floor(30 + Math.random() * 70) + '%'
      }
    }
  };

  truckGroup.add(g); return { g, cargo, hl, plate };
}

export function setTruckOpacity(tk, alpha) {
  if (tk.lastAlpha === alpha) return;
  tk.lastAlpha = alpha;
  const isTrans = alpha < 0.99;
  tk.g.traverse(c => {
    if (c.isMesh && c.material) {
      if (!c.userData.origMat) {
        c.userData.origMat = c.material;
        c.material = c.material.clone();
      }
      c.material.transparent = isTrans;
      c.material.opacity = alpha;
    }
  });
}
