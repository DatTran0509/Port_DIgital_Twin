/* ──────────────────────────────────────────────────────────────────────────
 * env/side-yards.js — Lateral logistics expansion (both flanks of the terminal)
 *
 *   LEFT  (−x): overflow / long-term CONTAINER STORAGE — a block grid of stacked
 *               containers (instanced, 4 colour buckets → 4 draw calls), with
 *               its own internal road grid, clickable per-block info.
 *   RIGHT (+x): EQUIPMENT DEPOT — built by ./side-depot.js (weighbridge, parked
 *               shuttle trucks, reach stackers, workshop, fuel, chassis…).
 *
 * Both sit on big paved platforms whose corners are ROUNDED (ExtrudeGeometry on
 * a rounded-rect Shape) for a soft, realistic edge instead of hard AI-looking
 * boxes. All geometry derives from layout.js, so the yards move/scale with the
 * port parameters. Targets the same draw-call discipline as the main yard.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, mat, cMats, bx, cy, dummy } from '../core.js';
import {
  SIDE, sideYardBounds, sideColBoundsX, sideStorageBlocks,
  sideInnerX, horizRoadZ, apronBounds,
} from '../layout.js';
import { buildDepot } from './side-depot.js';

const PLATFORM_TOP = 5.0;                       // flush with the main apron top
const matPave = mat(0x6f736c, 0.95, 0.03);      // warm concrete platform (≈ olive land family)
const matLane = mat(0x44474c, 0.95, 0.02);      // internal asphalt lane

/* ── Rounded-rectangle paved slab (soft corners, no hard box edges) ────────── */
function roundedRectShape(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function roundedSlab(parent, w, d, r, thick, material, cx, cz, baseY) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, d, r),
    { depth: thick, bevelEnabled: false, curveSegments: 8 });
  geo.rotateX(-Math.PI / 2);                    // shape XY plane → ground XZ; thickness → +y
  const m = new THREE.Mesh(geo, material);
  m.position.set(cx, baseY, cz);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* ── Internal road grid for one side yard ──────────────────────────────────── */
function buildSideRoads(side, b) {
  const g = new THREE.Group();
  scene.add(g);
  const ab = apronBounds();
  const innerX = sideInnerX(side);
  // Vertical lanes on every column boundary (run along z, full yard depth).
  const vSpanZ = b.maxZ - b.minZ;
  const vCenterZ = (b.minZ + b.maxZ) / 2;
  sideColBoundsX(side).forEach((x) => bx(g, SIDE.ROAD_W, 0.42, vSpanZ, matLane, x, 4.6, vCenterZ));
  // Horizontal lanes on the interior main-row lines (keeps the grid aligned).
  const hSpanX = b.maxX - b.minX;
  const hCenterX = (b.minX + b.maxX) / 2;
  horizRoadZ().forEach((z) => {
    if (z > b.minZ + 4 && z < b.maxZ - 4) bx(g, hSpanX, 0.42, SIDE.ROAD_W, matLane, hCenterX, 4.6, z);
  });
  // Two connector lanes bridging the buffer gap back to the main apron edge
  // (at z's clear of the perimeter transfer cranes, which sit at the row gaps).
  const edgeX = side === 'L' ? ab.minX : ab.maxX;
  const connCx = (edgeX + innerX) / 2;
  const connW = Math.abs(innerX - edgeX);
  [b.minZ + vSpanZ * 0.32, b.minZ + vSpanZ * 0.68].forEach((z) =>
    bx(g, connW, 0.42, SIDE.ROAD_W, matLane, connCx, 4.6, z));
  return g;
}

/* ── LEFT yard: instanced overflow container storage ───────────────────────── */
const cW = 4, cH = 2.5, cD = 8, gX = 0.3, gZ = 0.6, gY = 0.1;
const fit = (span, box, gap) => Math.max(1, Math.floor((span - box) / (box + gap)) + 1);
const NC = fit(SIDE.BLOCK_W, cW, gX), NR = fit(SIDE.BLOCK_D, cD, gZ);

function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function buildStorage(side) {
  const blocks = sideStorageBlocks(side);
  const buckets = cMats.map(() => []);
  blocks.forEach((blk, bi) => {
    const r = rng((bi + 1) * 131 + 7);
    // Long-term storage → taller, more uniform stacks than the live main yard.
    const maxTiers = 4 + Math.floor(r() * 4);   // 4..7
    const x0 = blk.x - (NC - 1) / 2 * (cW + gX);
    const z0 = blk.z - (NR - 1) / 2 * (cD + gZ);
    let count = 0;
    for (let c = 0; c < NC; c++) for (let row = 0; row < NR; row++) {
      const rr = r();
      let h = rr < 0.06 ? 0 : Math.max(2, Math.round(maxTiers * (0.55 + r() * 0.45)));
      if (h > maxTiers) h = maxTiers;
      for (let t = 0; t < h; t++) {
        buckets[(bi + c + row + t) % cMats.length].push([x0 + c * (cW + gX), PLATFORM_TOP + cH / 2 + t * (cH + gY), z0 + row * (cD + gZ)]);
        count++;
      }
    }
    blk._count = count; blk._cap = NC * NR * maxTiers; blk._tiers = maxTiers;
  });

  const cGeo = new THREE.BoxGeometry(cW, cH, cD);
  buckets.forEach((poses, ci) => {
    if (!poses.length) return;
    const im = new THREE.InstancedMesh(cGeo, cMats[ci], poses.length);
    im.castShadow = im.receiveShadow = true;
    poses.forEach((p, i) => { dummy.position.set(p[0], p[1], p[2]); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
  });

  // Clickable hit boxes (one per storage block).
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const LINES = ['MSC', 'Maersk', 'CMA CGM', 'COSCO', 'ONE', 'Evergreen', 'Hapag-Lloyd'];
  blocks.forEach((blk) => {
    const code = 'OS-' + String.fromCharCode(65 + blk.col) + String(blk.row + 1).padStart(2, '0');
    const util = Math.round((blk._count / Math.max(1, blk._cap)) * 100);
    const h = (blk._tiers || 5) * (cH + gY) + 2;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(SIDE.BLOCK_W + 1, h, SIDE.BLOCK_D + 1), hitMat);
    hit.position.set(blk.x, PLATFORM_TOP + h / 2, blk.z);
    hit.userData = {
      isClickable: true, objType: 'storage',
      data: {
        icon: '🗄️', name: 'Bãi Tồn Kho ' + code, subtitle: 'LƯU TRỮ DÀI HẠN — OVERFLOW',
        details: {
          'Mã bãi': code,
          'Chức năng': 'Lưu container tồn kho / chờ giải phóng / dài ngày',
          'Đang chứa': blk._count + ' cont (~' + blk._count * 2 + ' TEU)',
          'Sức chứa': blk._cap + ' cont',
          'Tỷ lệ lấp đầy': util + '%',
          'Xếp chồng': (blk._tiers) + ' tầng',
          'Lưu bãi TB': (8 + (blk.col + blk.row) % 12) + ' ngày',
          'Hãng khai thác': LINES[(blk.col + blk.row) % LINES.length],
          'Trạng thái': util > 88 ? '⚠ Gần đầy' : 'Đang lưu trữ',
        },
      },
    };
    scene.add(hit);
  });
}

/* ── Reefer container rack: powered cold-storage line along the yard front ──── */
const matFrame = mat(0x8f969b, 0.5, 0.6);
const matCat = mat(0xcaa53a, 0.5, 0.3);                         // safety-yellow catwalk
const matPanel = mat(0x0f2e28, 0.4, 0.3, 0x18c08a, 0.6);       // glowing power panel
function buildReeferRack(b) {
  const g = new THREE.Group();
  g.position.set((b.minX + b.maxX) / 2, PLATFORM_TOP, b.minZ - 3);
  const len = Math.min(84, (b.maxX - b.minX) * 0.62);
  const n = 7, step = len / n;
  for (let i = 0; i <= n; i++) {                                // frame posts
    const px = -len / 2 + i * step;
    bx(g, 0.6, 9, 0.6, matFrame, px, 0, -2.4); bx(g, 0.6, 9, 0.6, matFrame, px, 0, 2.4);
  }
  bx(g, len, 0.5, 0.6, matFrame, 0, 9, -2.4); bx(g, len, 0.5, 0.6, matFrame, 0, 9, 2.4);
  for (let i = 0; i < n; i++) {                                 // reefer boxes, 2 high
    const cxp = -len / 2 + step / 2 + i * step;
    for (let t = 0; t < 2; t++) bx(g, step - 1.6, 2.5, 5, cMats[(i + t) % cMats.length], cxp, 0.2 + t * 2.65, 0);
    bx(g, 0.9, 1.3, 0.4, matPanel, cxp, 3.0, 2.7);              // power panel
  }
  bx(g, len, 0.2, 1.4, matCat, 0, 5.8, 3.2);                    // service catwalk
  g.userData = {
    isClickable: true, objType: 'storage',
    data: {
      icon: '❄️', name: 'Dàn Container Lạnh (Reefer)', subtitle: 'KHU CẮM ĐIỆN LẠNH — REEFER RACK',
      details: {
        'Chức năng': 'Cấp nguồn & giám sát container lạnh',
        'Số ổ cắm': (n * 4) + ' cổng 440V/3 pha',
        'Nhiệt độ giám sát': '-25°C … +25°C (cài theo lô)',
        'Hàng tiêu biểu': 'Thủy sản, rau quả, dược phẩm',
        'Cảnh báo': 'Tự động báo khi lệch nhiệt độ',
        'Trạng thái': '🟢 Đang cấp điện',
      },
    },
  };
  scene.add(g);
}

/* ── Compact forklift working the storage aisles ───────────────────────────── */
function buildForklift(x, z, ry, idx) {
  const g = new THREE.Group();
  g.position.set(x, PLATFORM_TOP, z); g.rotation.y = ry;
  bx(g, 2.4, 1.7, 4, matCat, 0, 0.5, 0.4);                      // body
  bx(g, 1.9, 2.0, 1.9, mat(0x2b3138, 0.3, 0.6), 0, 1.6, 1.4);  // protective cab cage
  for (const mx of [-0.7, 0.7]) bx(g, 0.25, 6, 0.25, matFrame, mx, 0, -2.0); // mast rails
  for (const fx of [-0.7, 0.7]) bx(g, 0.3, 0.25, 2.2, mat(0x20262b, 0.5, 0.4), fx, 0.1, -3.2); // forks
  [[-1.1, -1.6], [1.1, -1.6], [-1.1, 2.2], [1.1, 2.2]].forEach(([wx, wz]) => {
    const w = cy(g, 0.7, 0.5, mat(0x14171a, 0.85, 0.05), wx, 0.0, wz); w.rotation.z = Math.PI / 2;
  });
  g.userData = {
    isClickable: true, objType: 'storage',
    data: {
      icon: '🚜', name: 'Xe Nâng Forklift FL-' + String(idx + 1).padStart(2, '0'), subtitle: 'THIẾT BỊ XẾP DỠ TRONG BÃI',
      details: { 'Loại': 'Forklift đối trọng', 'Sức nâng': '8 tấn', 'Nhiệm vụ': 'Dồn & sắp xếp container trong bãi tồn', 'Trạng thái': '⚙️ Sẵn sàng' },
    },
  };
  scene.add(g);
}

/* ── Storage RMG gantry (straddles a block; static, fills the vertical space) ── */
function buildStorageRMG(x, z, idx) {
  const g = new THREE.Group(); g.position.set(x, PLATFORM_TOP, z); scene.add(g);
  const span = 30, H = 18;
  for (const sx of [-span / 2, span / 2]) { bx(g, 1.4, H, 1.4, matFrame, sx, 0, -20); bx(g, 1.4, H, 1.4, matFrame, sx, 0, 20); }
  bx(g, span + 2, 1.6, 4, matFrame, 0, H, -20); bx(g, span + 2, 1.6, 4, matFrame, 0, H, 20);
  bx(g, 2.6, 1.0, 44, matFrame, 0, H + 1, 0);                  // runway rail
  const trolley = bx(g, 3, 1.4, 4, matCat, 0, H - 1.3, 0);
  bx(g, 3.2, 0.5, 6, mat(0x23282d, 0.4, 0.5), 0, H - 8, 0);    // spreader
  void trolley;
  g.userData = {
    isClickable: true, objType: 'storage',
    data: {
      icon: '🏗️', name: 'Cẩu Giàn Bãi Tồn RMG-' + String(idx + 1).padStart(2, '0'), subtitle: 'RAIL-MOUNTED GANTRY — BÃI LƯU TRỮ',
      details: { 'Loại': 'Cẩu giàn ray (RMG)', 'Nhịp': span + ' m', 'Sức nâng': '40 tấn (xếp 6 tầng)', 'Chức năng': 'Xếp dỡ & dồn bãi container tồn kho', 'Trạng thái': '⚙️ Sẵn sàng' },
    },
  };
}

/* ── Small storage-yard admin office ───────────────────────────────────────── */
function buildStorageOffice(x, z) {
  const g = new THREE.Group(); g.position.set(x, PLATFORM_TOP, z); scene.add(g);
  bx(g, 16, 4, 10, mat(0xc3ccc4, 0.7, 0.05), 0, 0, 0);
  bx(g, 16.3, 1.5, 10.3, mat(0x182a30, 0.15, 0.7, 0x081418, 0.25), 0, 1.4, 0);
  bx(g, 16, 0.6, 10, mat(0x55655d, 0.8, 0.1), 0, 4, 0);
  bx(g, 5, 0.4, 3, mat(0x15b88f, 0.4, 0.3), 0, 2.6, -5.2);
  g.userData = {
    isClickable: true, objType: 'storage',
    data: { icon: '🏢', name: 'Văn Phòng Bãi Tồn Kho', subtitle: 'QUẢN LÝ LƯU TRỮ DÀI HẠN', details: { 'Chức năng': 'Quản lý xuất/nhập bãi tồn, hải quan giám sát', 'Kết nối': 'Đồng bộ TOS cảng chính', 'Trạng thái': '🟢 Đang trực' } },
  };
}

/* ── Fill the LEFT storage yard with equipment so it reads as operating ─────── */
function buildLeftYardEquip(b) {
  const blocks = sideStorageBlocks('L');
  // RMG gantries straddling a few representative storage blocks.
  [blocks[7], blocks[12], blocks[17], blocks[2]].forEach((blk, i) => { if (blk) buildStorageRMG(blk.x, blk.z, i); });
  // Extra forklifts working the aisles.
  buildForklift(sideColBoundsX('L')[2], b.minZ + (b.maxZ - b.minZ) * 0.55, 1.6, 2);
  buildForklift(sideColBoundsX('L')[4], b.minZ + (b.maxZ - b.minZ) * 0.35, -1.2, 3);
  // Admin office on the inner-front platform margin.
  buildStorageOffice(b.maxX - 2, b.minZ - 2);
}

/* ── Entrance pylon sign (so each yard reads as a named facility) ───────────── */
function buildSignpost(side, b) {
  const g = new THREE.Group();
  const x = side === 'L' ? b.maxX + 4 : b.minX - 4;             // on the inner margin
  g.position.set(x, PLATFORM_TOP, b.minZ + (b.maxZ - b.minZ) * 0.5);
  const post = mat(0xaab0ac, 0.6, 0.3);
  bx(g, 1.2, 12, 1.2, post, 0, 0, -5); bx(g, 1.2, 12, 1.2, post, 0, 0, 5);  // twin posts
  bx(g, 1.2, 1.0, 11.5, post, 0, 12, 0);                        // header beam
  bx(g, 0.5, 4.2, 10.5, mat(0x12303f, 0.4, 0.3, 0x18c08a, 0.45), 0.2, 7, 0); // sign panel
  bx(g, 0.6, 4.6, 11, mat(0x15b88f, 0.4, 0.3), -0.1, 6.8, 0);   // teal backing
  scene.add(g);
}

/* ── Public API ────────────────────────────────────────────────────────────── */
export function initSideYards() {
  const L = sideYardBounds('L');
  const R = sideYardBounds('R');
  const M_ = SIDE.MARGIN;

  // Paved platforms with rounded corners (extend a margin past the block grid).
  const plat = (b) => roundedSlab(scene, (b.maxX - b.minX) + M_ * 2, (b.maxZ - b.minZ) + M_ * 2,
    14, 0.6, matPave, (b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, PLATFORM_TOP - 0.6);
  plat(L); plat(R);

  buildSideRoads('L', L);
  buildSideRoads('R', R);

  buildStorage('L');           // left = overflow container storage
  buildDepot(R);               // right = equipment depot

  // LEFT yard furnishings so it reads as a complete, operating facility.
  buildReeferRack(L);
  buildForklift(sideColBoundsX('L')[1], L.minZ + (L.maxZ - L.minZ) * 0.42, 0.4, 0);
  buildForklift(sideColBoundsX('L')[3], L.minZ + (L.maxZ - L.minZ) * 0.7, -2.4, 1);
  buildLeftYardEquip(L);

  buildSignpost('L', L);
  buildSignpost('R', R);
}
