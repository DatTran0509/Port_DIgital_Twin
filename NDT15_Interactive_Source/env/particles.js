// env/particles.js — CO2 emission particle system + per-frame update (from main.js)
import * as THREE from 'three';
import { scene } from '../core.js';

let emitPos, emitGeo, emitPts;
const emitData = [];

// Builds the CO2 particle points cloud. Returns the points object.
// Behavior preserved exactly from main.js.
export function initParticles() {
  const emitSrc = [[-100, 5, -9], [-50, 5, -6], [0, 5, -8], [50, 5, -5], [100, 24, 28], [-150, 17, -4]];
  const emitN = 70;
  emitPos = new Float32Array(emitN * 3);
  for (let i = 0; i < emitN; i++) {
    const s = emitSrc[i % emitSrc.length];
    emitData.push({
      x: s[0] + (Math.random() - .5) * 5, base: s[1], z: s[2] + (Math.random() - .5) * 5,
      y: s[1] + Math.random() * 14, spd: 1.6 + Math.random() * 2.2
    });
  }
  emitGeo = new THREE.BufferGeometry(); emitGeo.setAttribute('position', new THREE.BufferAttribute(emitPos, 3));
  emitPts = new THREE.Points(emitGeo, new THREE.PointsMaterial({ color: 0x90a4ba, size: 1.3, transparent: true, opacity: .28 }));
  scene.add(emitPts);
  return emitPts;
}

// Per-frame particle rise/recycle (from animate()).
export function updateParticles(dt) {
  if (!emitGeo) return;
  emitData.forEach((p, i) => {
    p.y += dt * p.spd;
    if (p.y > p.base + 16) p.y = p.base;
    emitPos[i * 3] = p.x; emitPos[i * 3 + 1] = p.y; emitPos[i * 3 + 2] = p.z;
  });
  emitGeo.attributes.position.needsUpdate = true;
}
