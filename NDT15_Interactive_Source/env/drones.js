// env/drones.js — UAV patrol drones build + per-frame animation (from main.js)
import * as THREE from 'three';
import { scene, M, mat, bx } from '../core.js';

const drones = [];

function buildDrone(col) {
  const g = new THREE.Group();
  bx(g, 2.4, .7, 2.4, M.crane, 0, 0, 0);
  const belly = bx(g, .7, .4, .7, mat(col, .4, .5, col, .8), 0, -.6, 0);
  const arms = [];
  [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]].forEach(([rx, rz]) => {
    bx(g, .25, .25, .25, M.crane, rx, .25, rz);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, .06, 14), new THREE.MeshStandardMaterial({ color: 0x2a3a52, transparent: true, opacity: .45 }));
    r.position.set(rx, .45, rz); g.add(r); arms.push(r);
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.5, 9, 18, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .08, side: THREE.DoubleSide }));
  cone.position.set(0, -5, 0); g.add(cone);
  scene.add(g); return { g, arms, belly, cone };
}

// Builds the patrol drones. Returns the drones array. Behavior preserved from main.js.
export function initDrones() {
  [{ c: 0xFF5468, r: 150, h: 41, s: .32, p: 0, task: 'Giám sát khu bến', id: 'UAV-01' }, { c: 0x34E0F0, r: 120, h: 35, s: .42, p: Math.PI, task: 'Quét vùng biển', id: 'UAV-02' }, { c: 0xF8B23C, r: 180, h: 49, s: .24, p: Math.PI / 2, task: 'Kiểm tra an ninh', id: 'UAV-03' }]
    .forEach(d => {
      const droneObj = buildDrone(d.c);
      droneObj.g.userData = {
        isClickable: true, objType: 'uav',
        data: {
          icon: '🚁', name: d.id, subtitle: 'DRONE GIÁM SÁT',
          details: {
            'Nhiệm vụ': d.task, 'Độ cao': d.h + ' m',
            'Pin': Math.floor(60 + Math.random() * 40) + '%',
            'Tốc độ': Math.floor(d.s * 100) + ' km/h'
          }
        }
      };
      drones.push({ ...droneObj, r: d.r, h: d.h, spd: d.s, ph: d.p });
    });
  return drones;
}

// Per-frame drone patrol animation (from animate()).
export function updateDrones(dt, el) {
  drones.forEach((d, i) => {
    const a = el * d.spd + d.ph;
    d.g.position.set(Math.cos(a) * d.r, d.h + Math.sin(el * 1.3 + i) * 1.6, Math.sin(a) * d.r + 6);
    d.g.rotation.y = -a; d.g.rotation.z = Math.cos(a) * .16;
    d.arms.forEach(r => r.rotation.y += dt * 45);
    d.belly.material.emissiveIntensity = .5 + Math.sin(el * 5 + i) * .4;
  });
}
