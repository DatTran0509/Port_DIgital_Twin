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
import { gatePosition } from '../layout.js';

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

  // Board 1: Gate — gắn NGAY TRÊN ĐỈNH cổng (vòm cổng cao ~world y=22), căn giữa
  // cổng, KHÔNG còn trụ chống xuống đường chen làn xe. Bám theo gatePosition().
  const gp = gatePosition();
  const gBoard = new THREE.Group();
  gBoard.position.set(gp.x, 22, gp.z); // đáy khung ~ đỉnh vòm cổng, cùng z với cổng
  bx(gBoard, 52, 10, 2, mat(0x111111, 0.5, 0.5), 0, 0, 0); // Frame: đáy local 0 → tâm local 5
  // Hai giá đỡ ngắn cắm xuống vòm cổng (đỉnh giá = đáy khung local 0).
  bx(gBoard, 2.5, 4, 2.5, mat(0x223344, 0.5, 0.5), -20, -4, 0);
  bx(gBoard, 2.5, 4, 2.5, mat(0x223344, 0.5, 0.5), 20, -4, 0);
  const scr1 = new THREE.Mesh(new THREE.PlaneGeometry(50, 8), boardMats[0]);
  scr1.position.set(0, 5, 1.1); // căn giữa khung đen (tâm khung = local 5)
  gBoard.add(scr1);
  const scr1b = new THREE.Mesh(new THREE.PlaneGeometry(50, 8), boardMats[0]);
  scr1b.position.set(0, 5, -1.1);
  scr1b.rotation.y = Math.PI;
  gBoard.add(scr1b);
  scene.add(gBoard);

  // Board 2: Port — biển lớn phía bến tàu. Nâng cao hẳn lên để KHÔNG bị các cẩu
  // STS / chồng container che khuất (trước đây y=65 bị tụt xuống, không thấy gì).
  const pBoard = new THREE.Group();
  pBoard.position.set(0, 100, -8);

  // Chân trụ: đỉnh dừng đúng ĐÁY khung (local 0) — KHÔNG nhô lên trên khung nữa —
  // và kéo thẳng xuống mặt quay (pBoard y=100 → local -98 ≈ world y 2).
  bx(pBoard, 2.5, 98, 2.5, mat(0x223344, 0.5, 0.5), -30, -98, 0); // Legs
  bx(pBoard, 2.5, 98, 2.5, mat(0x223344, 0.5, 0.5), 30, -98, 0);

  bx(pBoard, 62, 12, 2, mat(0x111111, 0.5, 0.5), 0, 0, 0); // Frame: đáy local 0 → tâm local 6
  const scr2 = new THREE.Mesh(new THREE.PlaneGeometry(60, 10), boardMats[1]);
  scr2.position.set(0, 6, 1.1); // căn giữa khung đen (tâm khung = local 6)
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
        ctx.fillText('CỔNG CHÍNH CẢNG NDT15', 1024, 145);
      } else {
        // Port Board
        ctx.font = '900 100px ' + fStr;
        ctx.fillText('CẢNG HÀNG HẢI QUỐC TẾ NDT15', 1024, 145);
      }

      ctx.fillStyle = '#15D8A4';
      ctx.font = '900 80px ' + fStr;
      ctx.fillText(timeStr + ' · HOẠT ĐỘNG BÌNH THƯỜNG', 1024, 255);
    }

    boardTexs[i].needsUpdate = true;
  });
}
