/* ──────────────────────────────────────────────────────────────────────────
 * yard/block-screens.js — Per-block signboard screens
 *
 * Owns the canvas-backed textures shown on each RTG signboard and the per-frame
 * redraw that reflects the serving crane's current job (truck plate + IMPORT/
 * EXPORT) or the idle "ready" state. The signboard meshes themselves are built
 * by yard/rtg.js, which consumes blockMats from here.
 *
 * One canvas/texture/material is built PER BLOCK across the full COLS×ROWS grid
 * (loops over the canonical `blocks` array from blocks.js — never a hardcoded
 * count), so blockMats[i] is the signboard for blocks[i] and rtgCranes[i]
 * (shared index contract with rtg.js / task 4.2). The idle label shows the
 * block's UNIQUE id (Req 1.4).
 *
 * NOTE: block-screens.js ↔ rtg.js form an intentional import cycle. It is safe
 * because every cross-module reference (blockMats in rtg.js, rtgCranes here) is
 * read inside a function body at runtime, never at module top level.
 *
 * Requirements: 1.4, 10.1, 10.3, 10.4
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { blocks, BLOCK_COUNT } from './blocks.js';
import { rtgCranes } from './rtg.js';

export const blockCanvases = [];
export const blockTexs = [];
export const blockMats = [];

// One canvas/texture/material per block (aligned to the `blocks` array order).
for (let i = 0; i < BLOCK_COUNT; i++) {
  const cvs = document.createElement('canvas');
  cvs.width = 1024; cvs.height = 256;
  blockCanvases.push(cvs);
  const tex = new THREE.CanvasTexture(cvs);
  blockTexs.push(tex);
  blockMats.push(new THREE.MeshBasicMaterial({ map: tex }));
}

export function updateBlockScreens() {
  blockCanvases.forEach((cvs, i) => {
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#050a10';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.textAlign = 'center';

    const rtg = rtgCranes[i];
    const fStr = '"Segoe UI", Verdana, sans-serif';
    if (rtg && rtg.state > 0 && rtg.tTrk) {
      ctx.fillStyle = rtg.tTrk.isImport ? '#FFD070' : '#2ADA9A';
      ctx.font = '900 65px ' + fStr;
      ctx.fillText(rtg.tTrk.plate, 512, 80);
      ctx.fillStyle = '#ffffff'; ctx.font = '900 55px ' + fStr;
      ctx.fillText(rtg.tTrk.isImport ? 'NHẬP TỪ XE TẢI' : 'XUẤT CHO XE TẢI', 512, 160);
    } else {
      ctx.fillStyle = '#4D8DF6'; ctx.font = '900 70px ' + fStr;
      ctx.fillText('BÃI SỐ ' + blocks[i].id, 512, 100);
      ctx.fillStyle = '#15D8A4'; ctx.font = '900 55px ' + fStr;
      ctx.fillText('SẴN SÀNG', 512, 180);
    }
    blockTexs[i].needsUpdate = true;
  });
}
