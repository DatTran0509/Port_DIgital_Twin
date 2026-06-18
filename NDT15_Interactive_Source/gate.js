import * as THREE from 'three';
import { scene, M, bx, cy, mat } from './core.js';

export const barriers = [];

const screenCanvas = document.createElement('canvas');
screenCanvas.width = 2048; screenCanvas.height = 256;
const sCtx = screenCanvas.getContext('2d');
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.needsUpdate = true;
const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });

sCtx.fillStyle = '#050a10';
sCtx.fillRect(0, 0, 2048, 256);
screenTex.needsUpdate = true;

export function initGate() {
  const gateg = new THREE.Group(); gateg.position.set(0, 5.0, 85); scene.add(gateg);
  const archCol = mat(0xffffff, 0.4, 0.1);
  const darkMet = mat(0x1a2530, 0.3, 0.8);
  
  // Widened the gate arch
  bx(gateg, 100, 4.0, 7, archCol, 0, 13, 0);
  bx(gateg, 100, 0.8, 7.2, mat(0x4D8DF6, 0.2, 0.5, 0x4D8DF6, 1.5), 0, 12.5, 0, false); 
  
  // Pillar positions (widened to match 4 massive lanes)
  [-40, -20, 0, 20, 40].forEach(px => {
    bx(gateg, 3.0, 13, 6.0, darkMet, px, 0, 0);
    bx(gateg, 0.3, 10, 6.2, mat(0x34E0F0, 0.2, 0.5, 0x34E0F0, 1.0), px, 2.0, 0, false);
  });

  // Màn hình cho 4 làn
  [-30, -10, 10, 30].forEach((x, i) => {
    const isOutbound = (x > 0);
    const bZ = isOutbound ? -4.5 : 4.5;
    
    const scW = 12, scH = 3.5; // Made screens larger
    
    const scM1 = new THREE.Mesh(new THREE.PlaneGeometry(scW, scH), screenMat);
    scM1.position.set(x, 10, 3.6);
    gateg.add(scM1);
    const scM2 = new THREE.Mesh(new THREE.PlaneGeometry(scW, scH), screenMat);
    scM2.position.set(x, 10, -3.6);
    scM2.rotation.y = Math.PI;
    gateg.add(scM2);
    
    const uvs1 = scM1.geometry.attributes.uv;
    for (let j = 0; j < uvs1.count; j++) { uvs1.setX(j, (i * 0.25) + uvs1.getX(j) * 0.25); }
    const uvs2 = scM2.geometry.attributes.uv;
    for (let j = 0; j < uvs2.count; j++) { uvs2.setX(j, (i * 0.25) + uvs2.getX(j) * 0.25); }
    
    cy(gateg, .3, 15, M.crane, x - 7, 11, isOutbound ? 3.5 : -3.5);
    bx(gateg, 3.5, 3.5, 2.0, M.radar, x - 7, 14, isOutbound ? 3.5 : -3.5);
    
    const bgrp = new THREE.Group(); 
    bgrp.position.set(x + 7.5, 4, bZ);
    gateg.add(bgrp);
    
    const armMat = mat(0xffffff, 0.5, 0.2, 0x4D8DF6, 2.0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(15.0, 0.4, 0.4), armMat);
    arm.position.set(-7.5, 0, 0);
    bgrp.add(arm);
    
    barriers.push({ grp: bgrp, armMat: armMat, lane: x, screenIdx: i, status: 0 });
  });

  updateGateScreens();
  bx(gateg, 100, .4, 7, M.road, 0, 0, 0);
}

export function updateGateScreens() {
  sCtx.fillStyle = '#050a10';
  sCtx.fillRect(0, 0, 2048, 256);
  
  barriers.forEach(b => {
    const ox = b.screenIdx * 512;
    sCtx.textAlign = 'center';
    
    if (b.status === 0) {
      sCtx.fillStyle = '#4D8DF6';
      sCtx.font = 'bold 45px Arial';
      sCtx.fillText('AUTO GATE', ox + 256, 100);
      sCtx.fillStyle = '#223344';
      sCtx.font = '35px Arial';
      sCtx.fillText('READY', ox + 256, 170);
      if (b.armMat) b.armMat.emissive.setHex(0x4D8DF6);
    } else if (b.status === 1) {
      sCtx.fillStyle = '#2ADA9A';
      sCtx.font = 'bold 60px Arial';
      sCtx.fillText(b.plate || '51C-888.88', ox + 256, 90);
      sCtx.fillStyle = '#ffffff';
      sCtx.font = 'bold 45px Arial';
      sCtx.fillText('HỢP LỆ', ox + 256, 160);
      sCtx.fillStyle = '#2ADA9A';
      sCtx.font = '35px Arial';
      sCtx.fillText('▼ ĐI TIẾP', ox + 256, 215);
      if (b.armMat) b.armMat.emissive.setHex(0x2ADA9A);
    } else if (b.status === -1) {
      sCtx.fillStyle = '#FF5468';
      sCtx.font = 'bold 60px Arial';
      sCtx.fillText(b.plate || 'UNK-000.00', ox + 256, 90);
      sCtx.fillStyle = '#FF5468';
      sCtx.font = 'bold 45px Arial';
      sCtx.fillText('KHÔNG HỢP LỆ', ox + 256, 160);
      sCtx.fillStyle = '#ffaa00';
      sCtx.font = '35px Arial';
      sCtx.fillText('↶ QUAY ĐẦU', ox + 256, 215);
      if (b.armMat) b.armMat.emissive.setHex(0xFF5468);
    }
  });
  screenTex.needsUpdate = true;
}
