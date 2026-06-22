/* ──────────────────────────────────────────────────────────────────────────
 * yard/transfer-crane.js — Compact slewing jib cranes for LENGTHWISE transfers
 *
 * Eight small tower/jib cranes, evenly split 4-per-side, parked on the OUTER
 * apron edge (outside every truck lane). Each sits beside the GAP between two
 * vertically-adjacent EDGE-column blocks and swings its jib so the hook travels
 * from one block to the next — relocating containers LENGTHWISE (along z / dọc).
 * Cross-column (ngang) moves are handled by the existing RTG cranes.
 *
 * GUARANTEED COLLISION-FREE (deterministic, not luck):
 *  1. RTG avoidance — the RTG of every edge block works on its LEFT (−x) service
 *     road, so each tower drops on the block's +x side (offset DROP_OFF from the
 *     centre). The hook is therefore always well clear of the RTG spreader.
 *  2. Crane-vs-crane — all cranes share ONE period, so every shared block is
 *     visited by its two cranes at DIFFERENT, non-overlapping phases of the
 *     cycle (one via the angA end, the other via angB). They can never descend
 *     onto the same block at the same time. A small per-crane phase step keeps
 *     it looking lively, and the jibs are also height-staggered as a backup so
 *     two arms never share both position and height.
 *
 * Everything derives from layout.js; geometry/materials reuse core.js helpers.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, M, cMats, bx, cable } from '../core.js';
import { PARAMS, apronBounds, blockCenterZ, blockCenterX } from '../layout.js';

export const transferCranes = [];

const lerp = (a, b, t) => a + (b - a) * t;
function easeAngle(cur, target, k) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * k;
}

/* ── Compact tower-crane dimensions ───────────────────────────────────────── */
const JIB_LEN  = 66;          // jib reach (covers the slew radius to the drop point)
const CJIB_LEN = 16;          // counter-jib length
const APEX_H   = 10;          // apex tower above the slew
const HOOK_HI  = -3;          // hook hoisted up near the jib (slew-local y)
const ROPE_BASE = 1 - HOOK_HI;
const MAST_LOW = 40, MAST_HIGH = 52;   // staggered jib heights (both clear the RTG)
const PERIOD   = 13;          // identical cycle period for ALL cranes (key to the guarantee)
const PHASE_STEP = 0.12;      // small per-crane phase offset (stays within the safe window)

const MAKERS = ['Liebherr', 'Potain', 'XCMG', 'Zoomlion'];
const pick = (arr, k) => arr[k % arr.length];

// Build ONE compact slewing jib crane. R/swing place the two swing extremes on
// the +x edge of the two adjacent block centres (clear of the −x-side RTG).
function buildTowerCrane(x, z, idx, homeAngle, R, swing, side, mastH, phase) {
  const g = new THREE.Group();
  g.position.set(x, 5, z);
  scene.add(g);

  bx(g, 7, 3, 7, M.crane, 0, 0, 0);                              // base
  for (const [px, pz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) bx(g, 1.1, mastH, 1.1, M.crane, px, 2, pz);
  for (let yy = 8; yy < mastH; yy += 8) {
    bx(g, 5, 0.7, 1, M.crane, 0, 2 + yy, -2); bx(g, 5, 0.7, 1, M.crane, 0, 2 + yy, 2);
    bx(g, 1, 0.7, 5, M.crane, -2, 2 + yy, 0); bx(g, 1, 0.7, 5, M.crane, 2, 2 + yy, 0);
  }

  const slew = new THREE.Group();
  slew.position.set(0, 2 + mastH, 0);
  slew.rotation.y = homeAngle;
  g.add(slew);

  bx(slew, JIB_LEN, 2, 2, M.craneY, JIB_LEN / 2, 1, 0);          // working jib (+x)
  bx(slew, CJIB_LEN, 2, 2, M.craneY, -CJIB_LEN / 2, 1, 0);       // counter-jib
  bx(slew, 5, 4, 6, M.crane, -CJIB_LEN, -1, 0);                  // counterweight
  bx(slew, 1.6, APEX_H, 1.6, M.crane, 0, 1, 0);                  // apex tower
  bx(slew, 3.2, 3.6, 3.2, M.craneY, 4.5, -3, 2.4);              // operator cab
  const apex = new THREE.Vector3(0, 1 + APEX_H, 0);
  cable(slew, apex, new THREE.Vector3(JIB_LEN * 0.55, 2.5, 0), M.rope);
  cable(slew, apex, new THREE.Vector3(JIB_LEN - 2, 2.5, 0), M.rope);
  cable(slew, apex, new THREE.Vector3(-CJIB_LEN, 2.5, 0), M.rope);

  bx(slew, 3, 1.6, 3.4, M.craneY, R, -1, 0);                     // trolley (rides with the slew)
  const spreader = bx(slew, 4, 0.8, 7, M.crane, R, HOOK_HI, 0);
  const cargo = bx(slew, 3.4, 2.6, 6.4, cMats[idx % cMats.length], R, HOOK_HI - 1.6, 0);
  cargo.visible = false;
  const rope = cable(slew, new THREE.Vector3(R, 1, 0), new THREE.Vector3(R, HOOK_HI, 0), M.rope);

  const hookLo = 12 - mastH;            // descend to ≈ world y 19 (stack top) regardless of tier

  const code = 'TC-' + side + String(idx + 1).padStart(2, '0');
  g.userData = {
    isClickable: true,
    objType: 'transfercrane',
    data: {
      icon: '🏗️',
      name: 'Cẩu Tháp Dọc ' + code,
      subtitle: 'CẨU THÁP QUAY — LUÂN CHUYỂN DỌC GIỮA 2 BÃI',
      details: {
        'Mã thiết bị': code,
        'Loại cẩu': 'Cẩu tháp quay (jib) — móc cẩu',
        'Nhà sản xuất': pick(MAKERS, idx),
        'Chức năng': 'Chuyển container DỌC (trục z) giữa 2 bãi liền kề',
        'Tải nâng định mức': (40 + (idx % 3) * 5) + ' tấn',
        'Tầm với jib': JIB_LEN + ' m',
        'Chiều cao tháp': mastH + ' m',
        'Vị trí': 'Giữa 2 bãi, biên ' + (side === 'L' ? 'trái' : 'phải') + ' (ngoài đường xe)',
        'Ghi chú': 'Hạ lệch mép bãi, tránh bàn hút cẩu RTG',
        'Trạng thái': '⚙️ Đang chờ luân chuyển',
      },
    },
  };

  transferCranes.push({
    slew, spreader, cargo, rope, hookLo,
    angA: homeAngle - swing, angB: homeAngle + swing,
    ang: homeAngle - swing, scp: phase,
  });
}

export function initTransferCranes() {
  const ap = apronBounds();
  const { ROWS, ROW_PITCH, COLS, BLOCK_W } = PARAMS;
  const leftX = ap.minX - 3;       // just beyond the outer apron edge — clear of roads
  const rightX = ap.maxX + 3;
  const DROP_OFF = BLOCK_W / 2 - 2;     // drop on the +x edge of the block (away from RTG)

  // Slew geometry per side: reach to the +x-edge drop point; half-arc so the two
  // extremes hit z_r and z_{r+1}. (RTG sits on the block's −x service road.)
  const dz = ROW_PITCH / 2;
  const dxL = Math.abs((blockCenterX(0) + DROP_OFF) - leftX);
  const dxR = Math.abs(rightX - (blockCenterX(COLS - 1) + DROP_OFF));
  const RL = Math.hypot(dxL, dz), swingL = Math.atan2(dz, dxL);
  const RR = Math.hypot(dxR, dz), swingR = Math.atan2(dz, dxR);

  let idx = 0;
  for (let r = 0; r < ROWS - 1; r++) {                 // 4 gaps per edge column (ROWS=5)
    const gapZ = (blockCenterZ(r) + blockCenterZ(r + 1)) / 2;
    const mastH = (r % 2 === 0) ? MAST_LOW : MAST_HIGH;  // alternate height (backup anti-cross)
    const phase = (r * PHASE_STEP) % 1;                  // small lively offset, stays collision-safe
    buildTowerCrane(leftX, gapZ, idx++, 0, RL, swingL, 'L', mastH, phase);
    buildTowerCrane(rightX, gapZ, idx++, Math.PI, RR, swingR, 'R', mastH, phase);
  }
}

// Per-frame: swing the jib between the two block centres, hoisting at each end —
// a pure LENGTHWISE (z) container relocation. ALL cranes share PERIOD so shared
// blocks are always serviced at different phases (no two hooks ever coincide).
export function updateTransferCranes(dt) {
  transferCranes.forEach(c => {
    c.scp = (c.scp + dt / PERIOD) % 1;
    const s = c.scp, LO = c.hookLo;
    let tang, hookY, carry;
    if (s < 0.10) { tang = c.angA; hookY = lerp(HOOK_HI, LO, s / 0.10); carry = false; }
    else if (s < 0.16) { tang = c.angA; hookY = LO; carry = true; }
    else if (s < 0.26) { tang = c.angA; hookY = lerp(LO, HOOK_HI, (s - 0.16) / 0.10); carry = true; }
    else if (s < 0.50) { tang = lerp(c.angA, c.angB, (s - 0.26) / 0.24); hookY = HOOK_HI; carry = true; }
    else if (s < 0.60) { tang = c.angB; hookY = lerp(HOOK_HI, LO, (s - 0.50) / 0.10); carry = true; }
    else if (s < 0.66) { tang = c.angB; hookY = LO; carry = false; }
    else if (s < 0.76) { tang = c.angB; hookY = lerp(LO, HOOK_HI, (s - 0.66) / 0.10); carry = false; }
    else { tang = lerp(c.angB, c.angA, (s - 0.76) / 0.24); hookY = HOOK_HI; carry = false; }

    c.ang = easeAngle(c.ang, tang, Math.min(1, dt * 3));
    c.slew.rotation.y = c.ang;
    c.spreader.position.y = hookY;
    c.cargo.position.y = hookY - 1.6; c.cargo.visible = carry;
    c.rope.position.y = (1 + hookY) / 2;
    c.rope.scale.y = Math.max(0.01, (1 - hookY) / ROPE_BASE);

    c.slew.parent.userData.data.details['Trạng thái'] =
      carry ? '🟢 Đang chuyển container (dọc)' : '⚙️ Đang xoay jib (không tải)';
  });
}
