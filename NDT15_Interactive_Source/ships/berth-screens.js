import * as THREE from 'three';
import { berthXs } from './berths.js';
import { vessels, vesselPose } from './vessels.js';

/* ──────────────────────────────────────────────────────────────────────────
 * ships/berth-screens.js — Per-berth LED status screens.
 *
 * Owns the canvas-backed textures/materials (berthMats) shown on the STS crane
 * crossbeams, and the once-per-second render of each berth's status (which
 * vessel is docked, its action, and ETA).
 *
 * Behavior is preserved verbatim from the original ships.js.
 *
 * Requirements: 10.1, 10.3, 10.4
 * ────────────────────────────────────────────────────────────────────────── */

const berthCanvases = [];
const berthTexs = [];
export const berthMats = [];
for (let i = 0; i < 6; i++) {
  const cvs = document.createElement('canvas');
  cvs.width = 1440; cvs.height = 200;
  berthCanvases.push(cvs);
  const tex = new THREE.CanvasTexture(cvs);
  tex.anisotropy = 16;
  berthTexs.push(tex);
  berthMats.push(new THREE.MeshBasicMaterial({ map: tex }));
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
      if (!v.vid) v.vid = 'IMO ' + Math.floor(1000000 + Math.random() * 8999999);
      if (!v.eta) {
        const d = new Date();
        d.setHours(d.getHours() + 2 + Math.floor(Math.random() * 5));
        v.eta = d.getHours().toString().padStart(2, '0') + ':00';
      }

      const fStr = '"Segoe UI", Verdana, sans-serif';
      ctx.fillStyle = '#2ADA9A'; ctx.font = '900 65px ' + fStr;
      ctx.fillText(v.nm, 720, 50);

      ctx.fillStyle = '#FF5468'; ctx.font = '900 55px ' + fStr; // Red for Busy
      ctx.fillText(v.action === 'import' ? 'ĐANG DỠ HÀNG' : 'ĐANG LẤY HÀNG', 720, 115);

      ctx.fillStyle = '#F8B23C'; ctx.font = '900 50px ' + fStr; // Orange for ETA
      ctx.fillText(`ETA: ${v.eta}`, 720, 175);
    } else {
      const fStr = '"Segoe UI", Verdana, sans-serif';
      ctx.fillStyle = '#4D8DF6'; ctx.font = '900 80px ' + fStr;
      ctx.fillText('BẾN CẢNG ' + (i + 1), 720, 70);
      ctx.fillStyle = '#15D8A4'; ctx.font = '900 60px ' + fStr; // Green for Ready
      ctx.fillText('SẴN SÀNG', 720, 150);
    }
    berthTexs[i].needsUpdate = true;
  });
}
