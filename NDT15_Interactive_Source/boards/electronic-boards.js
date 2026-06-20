/* ──────────────────────────────────────────────────────────────────────────
 * boards/electronic-boards.js — Gate & Port electronic signboards
 *
 * Builds the two canvas-backed electronic boards (Board 1 "Gate" at (0,32,85)
 * and Board 2 "Port" at (0,65,-8)) with their frames/legs and double-sided
 * screen planes, and redraws them on a throttled schedule via updateBoards().
 *
 * Behavior-preserving extraction of initElectronicBoards()/updateBoards() from
 * the original main.js (Req 10.1, 10.3). Positions, fonts, throttle cadence,
 * and text are identical to the baseline.
 *
 * securityAlert state: in the original main.js this was a module-level var
 * toggled by a window 'toggle-security-alert' event listener. To keep this
 * module self-contained and behavior-identical (so the orchestrator/scene does
 * not need to thread the flag through updateBoards), this module subscribes to
 * the same window 'toggle-security-alert' event and tracks its own flag. The
 * redraw logic reads that flag exactly as before.
 *
 * Requirements: 10.1, 10.3
 * ────────────────────────────────────────────────────────────────────────── */

import * as THREE from 'three';
import { scene, mat, bx } from '../core.js';

/* ── Module state (mirrors the original main.js module-level vars) ────────── */
const boardCanvases = [];
const boardTexs = [];
export const boardMats = [];

let securityAlert = false;
window.addEventListener('toggle-security-alert', (e) => {
  securityAlert = e.detail;
});

/* ── Build: two canvas-backed boards added to the scene ───────────────────── */
export function initElectronicBoards() {
  for (let i = 0; i < 2; i++) {
    const cvs = document.createElement('canvas');
    cvs.width = 2048; cvs.height = 384;
    boardCanvases.push(cvs);
    const tex = new THREE.CanvasTexture(cvs);
    tex.anisotropy = 16;
    boardTexs.push(tex);
    boardMats.push(new THREE.MeshBasicMaterial({ map: tex }));
  }

  // Board 1: Gate
  const gBoard = new THREE.Group();
  gBoard.position.set(0, 32, 85);
  bx(gBoard, 52, 10, 2, mat(0x111111, 0.5, 0.5), 0, 0, 0); // Frame
  const scr1 = new THREE.Mesh(new THREE.PlaneGeometry(50, 8), boardMats[0]);
  scr1.position.set(0, 5, 1.1);
  gBoard.add(scr1);
  const scr1b = new THREE.Mesh(new THREE.PlaneGeometry(50, 8), boardMats[0]);
  scr1b.position.set(0, 5, -1.1);
  scr1b.rotation.y = Math.PI;
  gBoard.add(scr1b);
  scene.add(gBoard);

  // Board 2: Port
  const pBoard = new THREE.Group();
  // Move exactly on top of the port cranes but slightly lower so it fits in camera
  pBoard.position.set(0, 65, -8);

  // Pillars reach from y=25 to y=65 (pBoard is at 65). Local y=-40, height 40.
  bx(pBoard, 2.5, 40, 2.5, mat(0x223344, 0.5, 0.5), -30, -40, 0); // Legs
  bx(pBoard, 2.5, 40, 2.5, mat(0x223344, 0.5, 0.5), 30, -40, 0);

  bx(pBoard, 62, 12, 2, mat(0x111111, 0.5, 0.5), 0, 0, 0); // Frame starts at y=0, height 12.
  const scr2 = new THREE.Mesh(new THREE.PlaneGeometry(60, 10), boardMats[1]);
  scr2.position.set(0, 6, 1.1); // Center of the frame is at y=6
  pBoard.add(scr2);
  const scr2b = new THREE.Mesh(new THREE.PlaneGeometry(60, 10), boardMats[1]);
  scr2b.position.set(0, 6, -1.1);
  scr2b.rotation.y = Math.PI;
  pBoard.add(scr2b);
  scene.add(pBoard);

  return { gBoard, pBoard };
}

/* ── Throttled redraw (2 Hz), normal vs. security-alert display ───────────── */
let lastBoardUpdate = -1;
export function updateBoards(el) {
  if (Math.floor(el * 2) === lastBoardUpdate) return;
  lastBoardUpdate = Math.floor(el * 2);

  const fStr = '"Segoe UI", Verdana, sans-serif';
  const d = new Date();
  const timeStr = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');

  boardCanvases.forEach((cvs, i) => {
    const ctx = cvs.getContext('2d');

    if (securityAlert) {
      // Red flashing alert
      const flash = Math.floor(el * 4) % 2 === 0;
      ctx.fillStyle = flash ? '#FF0000' : '#880000';
      ctx.fillRect(0, 0, cvs.width, cvs.height);

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 110px ' + fStr;
      ctx.fillText('⚠ CẢNH BÁO AN NINH ⚠', 1024, 130);

      ctx.font = '700 80px ' + fStr;
      ctx.fillStyle = flash ? '#FFFF00' : '#FFCCCC';
      ctx.fillText('PHÁT HIỆN TÀU LẠ XÂM NHẬP', 1024, 260);
    } else {
      // Normal display
      ctx.fillStyle = '#050a10';
      ctx.fillRect(0, 0, cvs.width, cvs.height);

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#4D8DF6';

      if (i === 0) {
        // Gate Board
        ctx.font = '900 90px ' + fStr;
        ctx.fillText('CỔNG CHÍNH CẢNG NDT15', 1024, 150);
      } else {
        // Port Board
        ctx.font = '900 100px ' + fStr;
        ctx.fillText('CẢNG HÀNG HẢI QUỐC TẾ NDT15', 1024, 150);
      }

      ctx.fillStyle = '#15D8A4';
      ctx.font = '900 80px ' + fStr;
      ctx.fillText(timeStr + ' · HOẠT ĐỘNG BÌNH THƯỜNG', 1024, 270);
    }

    boardTexs[i].needsUpdate = true;
  });
}
