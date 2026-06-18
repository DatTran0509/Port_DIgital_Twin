import * as THREE from 'three';
import { scene, M, cMats, bx, cy, cable, dummy, mat } from './core.js';

export const blockX = [-150, -90, -30, 30, 90, 150]; // Expanded spacing
export const yardLanes = [-131, -71, -11, 49, 109, 169]; // Centers of the 2-lane roads next to blocks

export const rtgCranes = [];

export const blockCanvases = [];
export const blockTexs = [];
export const blockMats = [];

for (let i = 0; i < 6; i++) {
  const cvs = document.createElement('canvas');
  cvs.width = 1024; cvs.height = 256;
  blockCanvases.push(cvs);
  const tex = new THREE.CanvasTexture(cvs);
  blockTexs.push(tex);
  blockMats.push(new THREE.MeshBasicMaterial({ map: tex }));
}

export function initYard() {
  const fillLv = [3, 4, 3, 4, 3, 4];
  const cBuckets = [[], [], [], []];
  const cW = 4, cH = 2.4, cD = 10, gX = .25, gZ = .5, gY = .1;
  
  blockX.forEach((bxc, bi) => {
    // 5 cols, 4 rows
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 4; row++) {
        for (let t = 0; t < fillLv[bi]; t++) {
          cBuckets[(bi + col + t) % 4].push([bxc + (col - 2) * (cW + gX) - 4, 5.0 + t * (cH + gY), 20 + row * (cD + gZ)]);
        }
      }
    }
  });

  const cGeo = new THREE.BoxGeometry(cW, cH, cD);
  const containerMeshes = [];
  cBuckets.forEach((poses, ci) => {
    if (!poses.length) return;
    const im = new THREE.InstancedMesh(cGeo, cMats[ci], poses.length);
    im.castShadow = im.receiveShadow = true;
    poses.forEach((pos, i) => { dummy.position.set(...pos); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.instanceMatrix.needsUpdate = true;
    scene.add(im); containerMeshes.push(im);
  });

  const m_white = mat(0xffffff, .9);
  
  blockX.forEach((bxc, i) => {
    cy(scene, .3, 12, M.crane, bxc, 5.0, 18);
    bx(scene, 1.6, 1.6, 1.6, M.craneY, bxc, 17.1, 18);
    buildRtgCrane(bxc, i);
    
    // Draw lane divider (dashed white) under RTG crane
    const yLaneCenter = yardLanes[i];
    for (let z = 20; z < 55; z += 4) {
      bx(scene, 0.3, .45, 1.5, m_white, yLaneCenter, 4.6, z);
    }
    // Draw U-Turn curve markings
    for (let a = 0; a <= Math.PI; a += Math.PI/8) {
      const cz = 18 - 4 * Math.sin(a);
      const cx = yLaneCenter + 2.5 * Math.cos(a);
      const m = bx(scene, 0.4, .45, 0.4, m_white, cx, 4.6, cz);
      m.rotation.y = a;
    }
  });
}

function buildRtgCrane(bxv, idx) {
  const rtgg = new THREE.Group(); rtgg.position.set(bxv, 5.0, 35); scene.add(rtgg);
  bx(rtgg, 1.8, 20, 1.8, M.crane, -23, 0, 0); bx(rtgg, 1.8, 20, 1.8, M.crane, 23, 0, 0);
  bx(rtgg, 1.8, 20, 1.8, M.crane, -23, 0, 22); bx(rtgg, 1.8, 20, 1.8, M.crane, 23, 0, 22);
  bx(rtgg, 50, 2.5, 2, M.craneY, 0, 20, 0); bx(rtgg, 50, 2.5, 2, M.craneY, 0, 20, 22);
  const trolley = bx(rtgg, 3.5, 2.5, 3.5, M.craneY, 0, 19, 11);
  [-23, 23].forEach(wx => [-1, 22].forEach(wz => bx(rtgg, 2.5, .8, 2.5, M.crane, wx, 0, wz)));
  
  // Add Block Signboard
  const signBase = bx(rtgg, 1.2, 8, 1.2, M.crane, 23.5, 8, 22);
  const signScreen = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), blockMats[idx]);
  signScreen.position.set(18, 12, 22.7);
  rtgg.add(signScreen);
  
  const spreader = bx(rtgg, 3.4, 0.4, 6.4, M.craneY, 0, 15, 11);
  const rope = cable(rtgg, new THREE.Vector3(0, 19, 11), new THREE.Vector3(0, 15, 11), M.rope);
  const cargo = bx(rtgg, 3.4, 2.4, 6.4, cMats[2], 0, 13.5, 11);
  cargo.visible = false;
  
  rtgCranes.push({ g: rtgg, trolley, spreader, rope, cargo, bxv, state: 0, tTrk: null, tZ: 35, h: 15, trX: 0 });
}

export function updateBlockScreens() {
  blockCanvases.forEach((cvs, i) => {
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#050a10';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.textAlign = 'center';
    
    const rtg = rtgCranes[i];
    const fStr = '"Segoe UI", Verdana, sans-serif';
    if (rtg.state > 0 && rtg.tTrk) {
      ctx.fillStyle = rtg.tTrk.isImport ? '#FFD070' : '#2ADA9A';
      ctx.font = '900 65px ' + fStr;
      ctx.fillText(rtg.tTrk.plate, 512, 80);
      ctx.fillStyle = '#ffffff'; ctx.font = '900 55px ' + fStr;
      ctx.fillText(rtg.tTrk.isImport ? 'NHẬP TỪ XE TẢI' : 'XUẤT CHO XE TẢI', 512, 160);
    } else {
      ctx.fillStyle = '#4D8DF6'; ctx.font = '900 70px ' + fStr;
      ctx.fillText('BÃI SỐ ' + (i+1), 512, 100);
      ctx.fillStyle = '#15D8A4'; ctx.font = '900 55px ' + fStr;
      ctx.fillText('SẴN SÀNG', 512, 180);
    }
    blockTexs[i].needsUpdate = true;
  });
}

export function updateRtgCranes(dt) {
  rtgCranes.forEach(rc => {
    if (rc.tTrk) {
      if (rc.state === 0) { 
        rc.tZ = rc.tTrk.z - 11; 
        rc.state = 1; 
        rc.cargo.visible = false; 
        rc.cargo.material = rc.tTrk.cargo.material; 
      }
      else if (rc.state === 1) {
        rc.g.position.z += (rc.tZ - rc.g.position.z) * Math.min(1, dt * 2.5);
        if (Math.abs(rc.g.position.z - rc.tZ) < 0.2) {
          rc.state = rc.tTrk.isImport ? 6 : 2; 
        }
      }
      // EXPORT ONLY: Pick up from block
      else if (rc.state === 2) {
        rc.h -= dt * 7;
        if (rc.h <= 8) { rc.h = 8; rc.state = 3; }
      }
      else if (rc.state === 3) {
        rc.cargo.visible = true; 
        rc.state = 4;
      }
      else if (rc.state === 4) {
        rc.h += dt * 7;
        if (rc.h >= 15) { rc.h = 15; rc.state = 6; }
      }
      // COMMON: Move to truck
      else if (rc.state === 6) {
        const trkTgtX = rc.tTrk.yardLane + 1.5 - rc.bxv; 
        rc.trX += (trkTgtX - rc.trX) * Math.min(1, dt * 2.5);
        if (Math.abs(rc.trX - trkTgtX) < 0.2) rc.state = 7;
      }
      // COMMON: Lower to truck
      else if (rc.state === 7) {
        rc.h -= dt * 7;
        if (rc.h <= 2) { rc.h = 2; rc.state = 8; }
      }
      // COMMON: Swap cargo with truck
      else if (rc.state === 8) {
        if (rc.tTrk.isImport) {
          rc.cargo.visible = true; 
          rc.tTrk.cargo.visible = false;
        } else {
          rc.cargo.visible = false; 
          rc.tTrk.cargo.visible = true;
        }
        rc.state = 9;
      }
      // COMMON: Raise from truck
      else if (rc.state === 9) {
        rc.h += dt * 7;
        if (rc.h >= 15) { rc.h = 15; rc.state = 10; }
      }
      // COMMON: Move X to block center
      else if (rc.state === 10) {
        rc.trX += (0 - rc.trX) * Math.min(1, dt * 2.5);
        if (Math.abs(rc.trX) < 0.2) {
          rc.state = rc.tTrk.isImport ? 11 : 15;
        }
      }
      // IMPORT ONLY: Drop to block
      else if (rc.state === 11) {
        rc.h -= dt * 7;
        if (rc.h <= 8) { rc.h = 8; rc.state = 12; }
      }
      else if (rc.state === 12) {
        rc.cargo.visible = false;
        rc.state = 13;
      }
      else if (rc.state === 13) {
        rc.h += dt * 7;
        if (rc.h >= 15) { rc.h = 15; rc.state = 15; }
      }
      // COMMON: Reset
      else if (rc.state === 15) {
        rc.state = 0;
        rc.tTrk.state = 3.6; // Release truck
        rc.tTrk = null;
      }
    }
    rc.trolley.position.x = rc.trX;
    rc.spreader.position.x = rc.trX; rc.spreader.position.y = rc.h;
    rc.cargo.position.x = rc.trX; rc.cargo.position.y = rc.h - 1.5;
    rc.rope.position.x = rc.trX; rc.rope.position.y = (19 + rc.h) / 2;
    rc.rope.scale.y = Math.max(0.01, (19 - rc.h) / 10);
  });
}
