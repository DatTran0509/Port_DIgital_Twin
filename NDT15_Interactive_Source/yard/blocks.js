/* ──────────────────────────────────────────────────────────────────────────
 * yard/blocks.js — Yard container field (varied stacks) + clickable block info
 *
 * Builds the stacked-container field for EVERY Yard_Block across the full
 * COLS×ROWS grid using exactly 4 InstancedMesh buckets (one per container
 * colour in cMats) — constant draw calls regardless of block count (Req 9.1).
 *
 * NEW:
 *  - VARIED STACK HEIGHTS: each block has its own max tier count and each
 *    container column a (deterministically) random height, so the skyline is
 *    jagged like a real yard (some bays full, some low, some empty).
 *  - CLICKABLE BLOCKS: each block gets an invisible "hit box" mesh tagged
 *    userData.isClickable with rich, realistic terminal data (code, cargo type,
 *    occupancy, capacity, daily throughput, dwell time, shipping lines, reefer
 *    plugs / IMDG class, …). The raycaster opens the info panel on click.
 *
 * Every coordinate derives from layout.js — no hardcoded grid positions.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, M, cMats, bx, dummy } from '../core.js';
import { PARAMS, blockCenter, blockId, blockCenterX, vertRoadX } from '../layout.js';

/* ── Canonical block list ───────────────────────────────────────────────── */
export const blocks = (() => {
  const out = [];
  for (let row = 0; row < PARAMS.ROWS; row++) {
    for (let col = 0; col < PARAMS.COLS; col++) {
      const { x, z } = blockCenter(col, row);
      out.push({ col, row, id: blockId(col, row), x, z });
    }
  }
  return out;
})();

export const BLOCK_COUNT = blocks.length;
export const blockX = Array.from({ length: PARAMS.COLS }, (_, col) => blockCenterX(col));
export const yardLanes = vertRoadX();

// Per-block info data (filled at build), consumed by the clickable hit boxes.
export const blockData = [];

/* ── Container layout tuning ───────────────────────────────────────────── */
const cW = 4, cH = 2.4, cD = 9;       // container size (x, y, z)
const gX = 0.25, gZ = 0.6, gY = 0.1;  // gaps
const YARD_Y = 4.6;                   // yard surface top (container base)

function fitCount(span, box, gap) {
  const step = box + gap;
  return Math.max(1, Math.floor((span - box) / step) + 1);
}
const N_COL = fitCount(PARAMS.BLOCK_W, cW, gX);
const N_ROW = fitCount(PARAMS.BLOCK_D, cD, gZ);

/* ── Deterministic per-block RNG (stable variety) ─────────────────────────── */
function makeRng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Realistic terminal info per block (researched fields) ────────────────── */
const ZONES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const LINES = ['MSC', 'Maersk', 'CMA CGM', 'COSCO', 'Hapag-Lloyd', 'ONE', 'Evergreen', 'Yang Ming', 'HMM', 'ZIM'];
const IMDG = ['Class 3 - Chất lỏng dễ cháy', 'Class 8 - Chất ăn mòn', 'Class 9 - Hàng nguy hiểm khác', 'Class 2 - Khí nén'];

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function buildBlockData(b, count, capacity, maxTiers, rng) {
  const code = ZONES[b.col % ZONES.length] + '-' + String(b.row + 1).padStart(2, '0');
  const util = Math.round((count / Math.max(1, capacity)) * 100);
  const importToday = 20 + Math.floor(rng() * 90);
  const exportToday = 20 + Math.floor(rng() * 90);
  const dwell = (2 + rng() * 5).toFixed(1);
  const teu = count * 2;                              // ~40ft boxes ≈ 2 TEU each
  const line1 = pick(rng, LINES);
  let line2 = pick(rng, LINES);
  if (line2 === line1) line2 = LINES[(LINES.indexOf(line1) + 3) % LINES.length];

  // Cargo type: mostly dry, then reefer, then DG, then OOG.
  const r = rng();
  let cargo, ctype, icon = '📦', extra = {};
  if (r < 0.6) {
    cargo = 'Hàng khô (General Purpose)';
    ctype = "20'GP · 40'GP · 40'HC";
  } else if (r < 0.82) {
    cargo = 'Hàng lạnh (Reefer)';
    ctype = "20'RF · 40'RF High-Cube";
    icon = '❄️';
    extra = {
      'Ổ cắm lạnh': (N_COL * N_ROW) + ' cổng (' + (40 + Math.floor(rng() * 50)) + '% đang dùng)',
      'Nhiệt độ cài đặt': '-18°C (đông lạnh)',
    };
  } else if (r < 0.93) {
    cargo = 'Hàng nguy hiểm (DG/IMDG)';
    ctype = "20'GP · ISO Tank";
    icon = '☣️';
    extra = {
      'Phân loại IMDG': pick(rng, IMDG),
      'Khoảng cách an toàn': '≥ 3 m giữa các lô',
    };
  } else {
    cargo = 'Hàng quá khổ (OOG)';
    ctype = "40'FR Flat Rack · 40'OT Open Top";
    icon = '🛠️';
  }

  const details = {
    'Mã bãi': code,
    'Loại hàng hóa': cargo,
    'Loại container': ctype,
    'Đang chứa': count + ' cont (~' + teu + ' TEU)',
    'Sức chứa thiết kế': capacity + ' cont',
    'Tỷ lệ lấp đầy': util + '%',
    'Xếp chồng tối đa': maxTiers + ' tầng',
    'Nhập trong ngày': importToday + ' cont',
    'Xuất trong ngày': exportToday + ' cont',
    'Lưu bãi trung bình': dwell + ' ngày',
    'Hãng khai thác': line1 + ', ' + line2,
    ...extra,
    'Trạng thái': util > 90 ? '⚠ Gần đầy' : 'Đang khai thác',
  };

  return {
    icon,
    name: 'BÃI ' + code + ' · Số ' + b.id,
    subtitle: 'BÃI CONTAINER — ' + cargo.toUpperCase(),
    details,
  };
}

/* ── Build the instanced container field with varied heights ──────────────── */
const containerMeshes = [];
export { containerMeshes };

function buildContainers() {
  const cBuckets = cMats.map(() => []);

  blocks.forEach((b, bi) => {
    const rng = makeRng(b.id * 97 + 13);
    const maxTiers = 2 + Math.floor(rng() * 5);       // 2..6 tiers per block
    const x0 = b.x - (N_COL - 1) / 2 * (cW + gX);
    const z0 = b.z - (N_ROW - 1) / 2 * (cD + gZ);
    let count = 0;

    for (let col = 0; col < N_COL; col++) {
      for (let row = 0; row < N_ROW; row++) {
        // Each column gets its own height: occasional empty slot, otherwise a
        // random number of tiers up to this block's max → jagged skyline.
        let h;
        const rr = rng();
        if (rr < 0.12) h = 0;                          // empty ground slot (gap)
        else h = 1 + Math.floor(rng() * maxTiers);
        if (h > maxTiers) h = maxTiers;
        for (let t = 0; t < h; t++) {
          const x = x0 + col * (cW + gX);
          const z = z0 + row * (cD + gZ);
          const y = YARD_Y + cH / 2 + t * (cH + gY);
          const bucket = (bi + col + row + t) % cMats.length;
          cBuckets[bucket].push([x, y, z]);
          count++;
        }
      }
    }

    const capacity = N_COL * N_ROW * maxTiers;
    blockData.push(buildBlockData(b, count, capacity, maxTiers, rng));
    b._maxTiers = maxTiers;                            // remembered for hit-box height
  });

  const cGeo = new THREE.BoxGeometry(cW, cH, cD);
  const meshes = [];
  cBuckets.forEach((poses, ci) => {
    if (!poses.length) return;
    const im = new THREE.InstancedMesh(cGeo, cMats[ci], poses.length);
    im.castShadow = im.receiveShadow = true;
    poses.forEach((p, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
    meshes.push(im);
  });
  return meshes;
}

/* Small flat ground pad per block. */
function buildGroundPads() {
  const padW = (N_COL - 1) * (cW + gX) + cW + 1;
  const padD = (N_ROW - 1) * (cD + gZ) + cD + 1;
  blocks.forEach((b) => {
    bx(scene, padW, 0.4, padD, M.road, b.x, YARD_Y - 0.4, b.z);
  });
}

/* Invisible clickable hit box per block (opens the info panel on click). */
function buildHitBoxes() {
  const padW = (N_COL - 1) * (cW + gX) + cW + 1;
  const padD = (N_ROW - 1) * (cD + gZ) + cD + 1;
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  blocks.forEach((b, bi) => {
    const h = (b._maxTiers || 4) * (cH + gY) + 2;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(padW, h, padD), hitMat);
    hit.position.set(b.x, YARD_Y + h / 2, b.z);
    hit.userData = { isClickable: true, objType: 'yardblock', data: blockData[bi] };
    scene.add(hit);
  });
}

export function initBlocks() {
  blockData.length = 0;
  const meshes = buildContainers();
  containerMeshes.length = 0;
  containerMeshes.push(...meshes);

  // Draw-call invariance guard (Req 9.1): one InstancedMesh per colour bucket.
  const expected = cMats.length;
  const actual = containerMeshes.length;
  if (actual !== expected) {
    const msg = `Container draw-call invariant violated (Req 9.1): expected ` +
      `${expected} container InstancedMesh buckets (cMats.length), got ${actual}.`;
    console.error(msg);
    throw new Error(msg);
  }

  buildGroundPads();
  buildHitBoxes();
}
