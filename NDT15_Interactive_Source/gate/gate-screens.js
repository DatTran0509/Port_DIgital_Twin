/* ──────────────────────────────────────────────────────────────────────────
 * gate/gate-screens.js — Gate screen rendering
 *
 * Owns the shared canvas/texture/material used by the four auto-gate lane
 * screens and the per-status text rendering. Behavior is preserved exactly
 * from the original gate.js; only the file boundary changed (Req 10.1, 10.3).
 *
 * `barriers` (the per-lane state list) is owned by ./gate.js; this module reads
 * it at call time inside updateGateScreens(). The ES-module cycle between these
 * two files is safe because nothing here touches `barriers` at load time.
 *
 * Requirements: 10.1, 10.3, 10.4
 * ────────────────────────────────────────────────────────────────────────── */

import * as THREE from 'three';
import { barriers } from './gate.js';

const screenCanvas = document.createElement('canvas');
screenCanvas.width = 2048; screenCanvas.height = 256;
const sCtx = screenCanvas.getContext('2d');
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.needsUpdate = true;
export const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });

sCtx.fillStyle = '#050a10';
sCtx.fillRect(0, 0, 2048, 256);
screenTex.needsUpdate = true;

export function updateGateScreens() {
  sCtx.fillStyle = '#050a10';
  sCtx.fillRect(0, 0, 2048, 256);

  barriers.forEach(b => {
    const ox = b.screenIdx * 512;
    sCtx.textAlign = 'center';

    const fStr = '"Segoe UI", Verdana, sans-serif';
    if (b.status === 0) {
      sCtx.fillStyle = '#4D8DF6';
      sCtx.font = '900 55px ' + fStr;
      sCtx.fillText('AUTO GATE', ox + 256, 100);
      sCtx.fillStyle = '#15D8A4';
      sCtx.font = '900 45px ' + fStr;
      sCtx.fillText('SẴN SÀNG', ox + 256, 170);
      if (b.armMat) b.armMat.emissive.setHex(0x4D8DF6);
    } else if (b.status === 1) {
      sCtx.fillStyle = '#2ADA9A';
      sCtx.font = '900 65px ' + fStr;
      sCtx.fillText(b.plate || '51C-888.88', ox + 256, 90);
      sCtx.fillStyle = '#ffffff';
      sCtx.font = '900 50px ' + fStr;
      sCtx.fillText('HỢP LỆ', ox + 256, 160);
      sCtx.fillStyle = '#2ADA9A';
      sCtx.font = '900 40px ' + fStr;
      sCtx.fillText('▼ ĐI TIẾP', ox + 256, 215);
      if (b.armMat) b.armMat.emissive.setHex(0x2ADA9A);
    } else if (b.status === -1) {
      sCtx.fillStyle = '#FF5468';
      sCtx.font = '900 65px ' + fStr;
      sCtx.fillText(b.plate || 'UNK-000.00', ox + 256, 90);
      sCtx.fillStyle = '#FF5468';
      sCtx.font = '900 50px ' + fStr;
      sCtx.fillText('KHÔNG HỢP LỆ', ox + 256, 160);
      sCtx.fillStyle = '#ffaa00';
      sCtx.font = '900 40px ' + fStr;
      sCtx.fillText('↶ QUAY ĐẦU', ox + 256, 215);
      if (b.armMat) b.armMat.emissive.setHex(0xFF5468);
    }
  });
  screenTex.needsUpdate = true;
}
