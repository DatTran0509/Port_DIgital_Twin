import * as THREE from 'three';
import { scene, M, cMats, bx, cy, sp, cable, mat } from './core.js';

export const BERTH_Z = -22;
export const berthXs = [-150, -90, -30, 30, 90, 150]; // Expanded spacing

export const vessels = [];
export const pings = [];
export const aisEls = [];
export const longCranes = [];

const vesselHulls = [];
const berthCanvases = [];
const berthTexs = [];
const berthMats = [];
for (let i = 0; i < 6; i++) {
  const cvs = document.createElement('canvas');
  cvs.width = 1440; cvs.height = 200;
  berthCanvases.push(cvs);
  const tex = new THREE.CanvasTexture(cvs);
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearFilter;
  berthTexs.push(tex);
  berthMats.push(new THREE.MeshBasicMaterial({ map: tex }));
}

function buildVessel(hull, stripe) {
  const g = new THREE.Group();
  const hm = mat(hull, 0.4, 0.6);
  const hMain = bx(g, 62, 8, 14, hm, 0, -8, 0);
  
  const bw = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 8, 24), hm);
  bw.scale.set(10 / 7, 1, 1); bw.position.set(-31, -4, 0); bw.castShadow = bw.receiveShadow = true; g.add(bw);
  
  const st = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 8, 24), hm);
  st.scale.set(6 / 7, 1, 1); st.position.set(31, -4, 0); st.castShadow = st.receiveShadow = true; g.add(st);
  
  bx(g, 62, 0.2, 13.8, mat(0x203040, 0.8, 0.2), 0, 0, 0);
  
  const stripeMat = mat(stripe, 0.2, 0.8, stripe, 0.8);
  bx(g, 62, 0.4, 14.2, stripeMat, 0, -1.5, 0, false);
  const bwStr = new THREE.Mesh(new THREE.CylinderGeometry(7.1, 7.1, 0.4, 24), stripeMat);
  bwStr.scale.set(10 / 7, 1, 1); bwStr.position.set(-31, -1.3, 0); g.add(bwStr);
  const stStr = new THREE.Mesh(new THREE.CylinderGeometry(7.1, 7.1, 0.4, 24), stripeMat);
  stStr.scale.set(6 / 7, 1, 1); stStr.position.set(31, -1.3, 0); g.add(stStr);
  
  const supMat = mat(0xffffff, 0.3, 0.1);
  const glassMat = mat(0x050d1a, 0.1, 0.9);
  
  bx(g, 16, 3, 13, supMat, 18, 0.2, 0);
  bx(g, 14, 2.5, 12.5, glassMat, 18, 3.2, 0);
  bx(g, 14.5, 0.8, 13.5, supMat, 18, 5.7, 0);
  bx(g, 14.8, 0.15, 13.8, mat(0x34E0F0, 0.2, 0.8, 0x34E0F0, 1.2), 18, 5.85, 0, false);
  bx(g, 10, 2, 10, glassMat, 16, 6.5, 0);
  bx(g, 11, 0.8, 11, supMat, 16, 8.5, 0);
  
  cy(g, 4.5, 0.4, mat(0x203040, 0.8, 0.2), 29, 3.2, 0);
  cy(g, 4.0, 0.45, stripeMat, 29, 3.2, 0, false);
  
  cy(g, 0.5, 8, supMat, 16, 9.3, 0);
  bx(g, 3, 0.4, 0.4, supMat, 16, 16, 0);
  sp(g, 1.2, supMat, 16, 17.5, 0);
  
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 4; j++) {
      if (Math.random() > 0.1) {
        bx(g, 3.8, 2.6, 6.4, cMats[(i + j) % 4].clone(), -26 + i * 4.2, 0.2, -4.5 + j * 3);
      }
    }
  }
  g.scale.setScalar(0.7); // Make ships slightly smaller to avoid collisions
  scene.add(g); vesselHulls.push(hMain, g);
  return g;
}

export function initShips(coLayer0) {
  // Berths
  berthXs.forEach((bxv, i) => {
    // Widened berth platform
    bx(scene, 80, 1, 16, M.berth, bxv, 4, -7);
    cy(scene, .5, 14, M.crane, bxv - 35, -6, -14); cy(scene, .5, 14, M.crane, bxv + 35, -6, -14);
    [-35, 0, 35].forEach(ox => bx(scene, .8, 2.5, .8, M.crane, bxv + ox, 5, -5.5));
  });

  vessels.push(
    { g: buildVessel(0x172638, 0x1e3a70), mode: 'cycle', bx: -90, t0: 0, dur: 110, cz: -120, nm: 'MSC ARIA', action: 'import' },
    { g: buildVessel(0x1c2c3e, 0x2a5088), mode: 'cycle', bx: 30, t0: 36, dur: 110, cz: -200, nm: 'EVER LINK', action: 'export' },
    { g: buildVessel(0x334455, 0x1188ff), mode: 'cycle', bx: 150, t0: 73, dur: 110, cz: -280, nm: 'MAERSK ALFA', action: 'import' },
    { g: buildVessel(0x172638, 0x1e3a70), mode: 'dock', bx: -30, nm: 'OCEAN KING', action: 'export' },
    { g: buildVessel(0x14222f, 0x244a6a), mode: 'queue', qx: 80, qz: -300, nm: 'OOCL STAR', action: 'import' },
    { g: buildVessel(0x1b2c3e, 0x2a5088), mode: 'queue', qx: 250, qz: -350, nm: 'MAERSK LINE', action: 'export' },
    { g: buildVessel(0x172638, 0x1e3a70), mode: 'queue', qx: -200, qz: -280, nm: 'COSCO SHIPPING', action: 'import' }
  );

  vessels.forEach((v, i) => {
    const el = document.createElement('div'); el.className = 'ais'; el.dataset.tr = 'translate(-50%, -180%)';
    el.innerHTML = `<span class="adot"></span><b>${v.nm}</b><span class="ast"></span>`; coLayer0.appendChild(el);
    aisEls.push(el);
    
    const ring = new THREE.Mesh(new THREE.RingGeometry(2, 2.5, 40),
      new THREE.MeshBasicMaterial({ color: 0x34E0F0, transparent: true, opacity: .55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 5; scene.add(ring);
    pings.push({ ring, v, off: i * 0.9 });
  });

  berthXs.forEach((bxv, i) => {
    buildLongCrane(bxv, i);
    longCranes[i].servesBx = bxv;
  });
  longCranes.forEach(lc => Object.assign(lc, { prevDocked: false, lifts: 0, maxLifts: 2 }));
}

export function vesselPose(v, el) {
  const lerp = (a, b, t) => a + (b - a) * t;
  if (v.mode === 'dock') return { x: v.bx, z: BERTH_Z, ry: Math.PI, st: 'dock', spd: 0, docked: true };
  if (v.mode === 'queue') {
    const r = 25, a = el * .1;
    return { x: v.qx + Math.cos(a) * r, z: v.qz + Math.sin(a) * r, ry: -a + Math.PI, st: 'hold', spd: 0.5 };
  }
  
  const p = ((((el - v.t0) % v.dur) + v.dur) % v.dur) / v.dur;
  const wp = [
    [0, 500, v.cz], 
    [.25, v.bx, v.cz], 
    [.35, v.bx, BERTH_Z], 
    [.62, v.bx, BERTH_Z], 
    [.72, v.bx, v.cz], 
    [1, -500, v.cz]
  ];
  let x = v.bx, z = BERTH_Z, ry = Math.PI; // Always face left (direction of travel)
  for (let i = 0; i < wp.length - 1; i++) { 
    if (p >= wp[i][0] && p <= wp[i + 1][0]) { 
      const lt = (p - wp[i][0]) / (wp[i + 1][0] - wp[i][0]); 
      x = lerp(wp[i][1], wp[i + 1][1], lt); z = lerp(wp[i][2], wp[i + 1][2], lt); 
      break; 
    } 
  }
  const docked = p >= .35 && p <= .62;
  return { x, z, ry, st: docked ? 'berth' : (p < .35 ? 'inbound' : 'depart'), spd: docked ? 0 : 12, docked };
}

let lastEl = -1;
export function updateBerthScreens(el) {
  // Only update once per second to save performance
  if (Math.floor(el) === lastEl) return;
  lastEl = Math.floor(el);
  
  berthCanvases.forEach((c, i) => {
    const ctx = c.getContext('2d');
    const v = vessels.find(vs => vs.mode === 'dock' ? Math.abs(vs.bx - berthXs[i]) < 5 : (vs.mode === 'cycle' && vs.bx === berthXs[i] && vesselPose(vs, el || 0).docked));
    
    // Original background
    ctx.fillStyle = '#050a10';
    ctx.fillRect(0, 0, 1440, 200);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    
    if (v) {
      ctx.fillStyle = '#2ADA9A'; ctx.font = 'bold 80px Arial';
      ctx.fillText(v.nm, 720, 60);
      ctx.fillStyle = '#FF5468'; ctx.font = 'bold 55px Arial'; // Red for Busy
      ctx.fillText(v.action === 'import' ? 'ĐANG DỠ HÀNG' : 'ĐANG NHẬN HÀNG', 720, 140);
    } else {
      ctx.fillStyle = '#4D8DF6'; ctx.font = 'bold 80px Arial';
      ctx.fillText('BẾN CẢNG ' + (i+1), 720, 70);
      ctx.fillStyle = '#15D8A4'; ctx.font = 'bold 60px Arial'; // Green for Ready
      ctx.fillText('SẴN SÀNG', 720, 140);
    }
    berthTexs[i].needsUpdate = true;
  });
}

function buildLongCrane(x, idx) {
  const g = new THREE.Group(); g.position.set(x, 5, -1); scene.add(g);
  bx(g, 2, 42, 2, M.crane, -15, 0, -10); bx(g, 2, 42, 2, M.crane, 15, 0, -10);
  bx(g, 42, 3, 3.5, M.crane, 0, 42, -10);
  
  const trolley = bx(g, 5, 2.5, 5, M.craneY, 0, 44, 0);
  
  // Massive LED Screen fixed high on top of the STS crane crossbeam
  if (idx !== undefined) {
    // Support pillars
    bx(g, 0.8, 8, 0.8, M.crane, -14, 46, -10);
    bx(g, 0.8, 8, 0.8, M.crane, 14, 46, -10);
    // LED Screen facing sea
    const bsc = new THREE.Mesh(new THREE.PlaneGeometry(36, 5), berthMats[idx]);
    bsc.position.set(0, 50, -10.5); 
    bsc.rotation.y = Math.PI; 
    g.add(bsc);

    // LED Screen facing yard
    const bsc2 = new THREE.Mesh(new THREE.PlaneGeometry(36, 5), berthMats[idx]);
    bsc2.position.set(0, 50, -9.5); 
    g.add(bsc2);
  }

  bx(g, 42, 3, 3.5, M.crane, 0, 42, 48);
  bx(g, 3.5, 2, 100, M.craneY, 0, 45, 10);
  cable(g, new THREE.Vector3(-10, 42, -10), new THREE.Vector3(-10, 46, -30), M.rope);
  cable(g, new THREE.Vector3(10, 42, -10), new THREE.Vector3(10, 46, -30), M.rope);

  const spreader = bx(g, 8.5, 1.5, 14, M.crane, 0, 38, 0);
  const rope = cable(g, new THREE.Vector3(0, 44, 0), new THREE.Vector3(0, 38, 0), M.rope);
  const cargo = bx(g, 3.4, 2.6, 6.4, cMats[1], 0, 36, 0);
  longCranes.push({ g, trolley, spreader, rope, cargo, cy: 0, bx: x });
  return g;
}
