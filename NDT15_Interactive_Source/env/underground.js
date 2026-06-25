/* ──────────────────────────────────────────────────────────────────────────
 * env/underground.js — UNDERGROUND INFRASTRUCTURE LEVEL (NDT layer 13)
 *
 * A large basement beneath the main port — the physical embodiment of the
 * digital twin's "Underground Infrastructure Management" layer. Real ports/
 * cities run a UTILITY TUNNEL bundling power, water, sewer, gas, telecom, plus
 * stormwater pumping (flood control), substations and data vaults; modern ones
 * are managed by a BIM-GIS digital twin. This level recreates that and CONNECTS
 * to the surface ports:
 *   - Utility tunnel spine (power · water · fuel · sewer · fibre)
 *   - Stormwater PUMPING STATION (flood control)
 *   - Underground SUBSTATION vault (feeds the surface grid)
 *   - DIGITAL-TWIN DATA VAULT (the servers running this very twin)
 *   - LOGISTICS TUNNEL branching to the LEFT + RIGHT side yards (inter-port link)
 *   - Underground PARKING + WATER/FUEL reservoirs
 *   - An ACCESS PORTAL (surface headhouse + shaft) to descend.
 *
 * The basement is enclosed (opaque ceiling) so it's hidden from the surface and
 * vice-versa; a top-bar button flies the camera smoothly down inside / back up.
 * Built hidden (visible only in underground mode) → zero cost on the surface.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, mat, cMats, bx, cy, camera, orbit } from '../core.js';

const FY = -28, CY = -4, BX = 152, ZMIN = -2, ZMAX = 356;       // basement extents
const MIDZ = (ZMIN + ZMAX) / 2;

const matFloor = mat(0x35383d, 0.96, 0.0);
const matWall = mat(0x44484e, 0.92, 0.05);
const matCeil = mat(0x2c2f34, 0.95, 0.0);
const matSteel = mat(0x8b9197, 0.45, 0.6);
const matStrip = mat(0xffffff, 0.3, 0.1, 0xfff3d8, 1.4);        // emissive ceiling light
const matWater = mat(0x2f6fb0, 0.4, 0.4);
const matFuel = mat(0xc9a02a, 0.4, 0.4);
const matSewer = mat(0x676b70, 0.6, 0.3);
const matGas = mat(0xb23a2e, 0.4, 0.4);
const matTray = mat(0x3a4048, 0.6, 0.4);
const matRack = mat(0x161b21, 0.5, 0.5);
const matLed = mat(0x0f2e28, 0.4, 0.3, 0x21d18a, 0.9);
const matLedB = mat(0x10202e, 0.4, 0.3, 0x35c0ff, 0.9);
const matTank = mat(0xcdd3cd, 0.35, 0.45);
const matCar = mat(0x9c3a30, 0.5, 0.3);
const matAccent = mat(0x15b88f, 0.4, 0.3);

let group = null, portal = null, open = false, anim = null;
const saved = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
const savedOrbit = {};
let ugT = 0, ugRobot = null, ugLift = null, vloop = null;
const ugCargo = [], ugPumps = [], rampVeh = [], loopVeh = [], surfElevs = [];
// Vehicle ramp top→bottom, aligned under the SURFACE gate (x≈78) and a hole cut
// in the ceiling so cars drive in continuously from the surface.
const ramp = { xt: 78, zt: 346, yt: CY, zb: 288, yb: FY + 1 };
const HOLE = { x0: 64, x1: 92, z0: 330, z1: 356 };                 // ceiling opening
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

const ub = (w, h, d, m, x, y, z) => bx(group, w, h, d, m, x, y, z, false);
const ucy = (r, h, m, x, y, z) => cy(group, r, h, m, x, y, z, false);
const click = (g, icon, name, subtitle, details) => { g.userData = { isClickable: true, objType: 'underground', data: { icon, name, subtitle, details } }; };

function zone(x, z, w, d) {                                     // a clickable zone marker pad
  const g = new THREE.Group(); g.position.set(x, FY + 0.3, z); group.add(g);
  bx(g, w, 0.3, d, matAccent, 0, 0, 0, false);
  return g;
}

function shell() {
  // floor, ceiling (opaque → seals the level), perimeter walls
  ub(BX * 2 + 8, 1.5, ZMAX - ZMIN + 8, matFloor, 0, FY - 0.75, MIDZ);
  // Ceiling built as 4 pieces leaving a HOLE for the vehicle ramp shaft.
  const cyy = CY + 0.75, W = BX * 2 + 8;
  ub(W, 1.5, HOLE.z0 - (ZMIN - 4), matCeil, 0, cyy, ((ZMIN - 4) + HOLE.z0) / 2);   // front band
  ub(W, 1.5, (ZMAX + 4) - HOLE.z1, matCeil, 0, cyy, (HOLE.z1 + (ZMAX + 4)) / 2);   // back band
  ub(HOLE.x0 - (-BX - 4), 1.5, HOLE.z1 - HOLE.z0, matCeil, ((-BX - 4) + HOLE.x0) / 2, cyy, (HOLE.z0 + HOLE.z1) / 2);  // left
  ub((BX + 4) - HOLE.x1, 1.5, HOLE.z1 - HOLE.z0, matCeil, (HOLE.x1 + (BX + 4)) / 2, cyy, (HOLE.z0 + HOLE.z1) / 2);    // right
  // bright "daylight" glow framing the opening (reads as the surface above)
  for (const ex of [HOLE.x0, HOLE.x1]) ub(1.2, 1.2, HOLE.z1 - HOLE.z0, matStrip, ex, CY - 0.4, (HOLE.z0 + HOLE.z1) / 2);
  for (const ez of [HOLE.z0, HOLE.z1]) ub(HOLE.x1 - HOLE.x0, 1.2, 1.2, matStrip, (HOLE.x0 + HOLE.x1) / 2, CY - 0.4, ez);
  for (const sx of [-BX, BX]) ub(1.5, CY - FY, ZMAX - ZMIN + 8, matWall, sx, (FY + CY) / 2, MIDZ);
  ub(BX * 2, CY - FY, 1.5, matWall, 0, (FY + CY) / 2, ZMIN);
  ub(BX * 2, CY - FY, 1.5, matWall, 0, (FY + CY) / 2, ZMAX);
  // structural columns grid
  for (let gx = -110; gx <= 110; gx += 55) for (let gz = ZMIN + 40; gz < ZMAX; gz += 60) ub(3, CY - FY - 2, 3, matWall, gx, (FY + CY) / 2, gz);
  // ceiling light strips (emissive — self-lit basement)
  for (let gz = ZMIN + 20; gz < ZMAX; gz += 22) { ub(120, 0.4, 1.2, matStrip, 0, CY - 1.0, gz); ub(40, 0.4, 1.2, matStrip, -100, CY - 1.0, gz); ub(40, 0.4, 1.2, matStrip, 100, CY - 1.0, gz); }
}

function utilitySpine() {
  // Bundled service pipes + cable tray running the whole length (the utility tunnel).
  const y0 = FY + 4;
  const lines = [[-14, matWater, 1.4, 'Nước'], [-9, matSewer, 1.6, 'Thoát nước'], [-4.5, matGas, 1.0, 'Khí'], [0.5, matFuel, 1.2, 'Nhiên liệu']];
  lines.forEach(([ox, m, r]) => { const p = ucy(r, ZMAX - ZMIN - 10, m, ox, y0, MIDZ); p.rotation.x = Math.PI / 2; });
  // cable trays (power + fibre) on brackets
  ub(5, 0.5, ZMAX - ZMIN - 10, matTray, 8, y0 + 3.5, MIDZ);
  ub(5, 0.5, ZMAX - ZMIN - 10, matTray, 8, y0 + 5.0, MIDZ);
  for (let gz = ZMIN + 10; gz < ZMAX; gz += 8) ub(0.3, 0.3, 0.3, matLedB, 8, y0 + 5.3, gz);
  const m = zone(-6, MIDZ, 30, ZMAX - ZMIN - 14, 'spine');
  click(m, '🧰', 'Trục Hầm Kỹ Thuật (Utility Tunnel)', 'GOM ĐIỆN · NƯỚC · NHIÊN LIỆU · CÁP', {
    'Chức năng': 'Hành lang gom toàn bộ đường ống & cáp ngầm của cảng',
    'Tuyến trong ống': 'Nước cấp · thoát nước · khí · nhiên liệu · điện · cáp quang',
    'Lợi ích': 'Bảo trì tập trung, không phải đào đường mặt đất',
    'Số hoá': 'BIM-GIS — cảm biến rò rỉ/áp suất báo về Control Tower (lớp 13)',
    'Kết nối': 'Cấp dịch vụ cho cảng chính & 2 bãi phụ trên mặt đất', 'Trạng thái': '🟢 Vận hành',
  });
}

function pumpStation(z) {
  const g = new THREE.Group(); g.position.set(-95, FY, z); group.add(g);
  bx(g, 40, 6, 34, matFloor, 0, 0.2, 0, false);                 // sump basin floor
  for (const px of [-12, 0, 12]) { bx(g, 6, 5, 6, matSteel, px, 0.2, -8, false); cy(g, 0.6, 7, matWater, px, 5, -8, false); const pad = bx(g, 3.4, 0.3, 0.5, matSteel, px, 5.4, -8, false); ugPumps.push(pad); }  // pumps + risers + spinning impeller
  for (const pz of [-13, 13]) { const p = cy(g, 2.2, 36, matSewer, 0, 2.4, pz); p.rotation.z = Math.PI / 2; }  // big drainage culverts
  bx(g, 38, 0.3, 32, matLedB, 0, 0.0, 0, false);                // water sheen
  click(g, '🌊', 'Trạm Bơm Thoát Nước Ngầm', 'CHỐNG NGẬP — STORMWATER PUMPING', {
    'Chức năng': 'Thu & bơm nước mưa/triều cường ra biển, chống ngập cảng',
    'Thiết bị': '3 bơm chìm công suất lớn + cống hộp thu nước',
    'Số hoá': 'Mô phỏng ngập theo kịch bản mưa (digital twin thuỷ văn)',
    'Kết nối': 'Bảo vệ toàn bộ mặt bằng cảng chính & 2 bãi phụ', 'Trạng thái': '🟢 Mực nước an toàn',
  });
}

function substation(z) {
  const g = new THREE.Group(); g.position.set(95, FY, z); group.add(g);
  for (const px of [-10, 0, 10]) { bx(g, 7, 7, 8, matSteel, px, 0.2, 0, false); bx(g, 7.4, 0.6, 8.4, matLed, px, 7.2, 0, false); }
  bx(g, 30, 0.5, 4, matTray, 0, 9, -6, false);                  // overhead bus duct
  click(g, '⚡', 'Trạm Biến Áp Ngầm', 'PHÂN PHỐI ĐIỆN — CẤP LÊN MẶT ĐẤT', {
    'Chức năng': 'Hạ áp & phân phối điện (gồm điện xanh từ hub) cho cảng',
    'Thiết bị': '3 máy biến áp + tủ trung thế GIS',
    'An toàn': 'Đặt ngầm, cách ly, giám sát nhiệt độ realtime',
    'Kết nối': 'Cấp điện cẩu, chiếu sáng & điện bờ của 3 cảng', 'Trạng thái': '🟢 Tải 62%',
  });
}

function dataVault(z) {
  const g = new THREE.Group(); g.position.set(95, FY, z); group.add(g);
  bx(g, 34, 0.4, 26, matRack, 0, 0.1, 0, false);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    bx(g, 2.6, 6, 4, matRack, -13 + c * 6.5, 0.1, -8 + r * 5, false);
    bx(g, 2.7, 0.5, 0.4, r % 2 ? matLed : matLedB, -13 + c * 6.5, 3 + (r % 3), -10.1 + r * 5, false);
  }
  click(g, '🖥️', 'Trung Tâm Dữ Liệu — Bản Sao Số', 'BỘ NÃO CỦA DIGITAL TWIN 15 LỚP', {
    'Chức năng': 'Máy chủ chạy bản sao số: thu IoT, mô phỏng, AI điều phối',
    'Hạ tầng': '20 tủ rack + lưu trữ + mạng cáp quang dự phòng',
    'Vai trò': 'Tổng hợp 15 lớp dữ liệu của cảng (lớp 13 hạ tầng ngầm)',
    'Kết nối': 'Đồng bộ Control Tower, cảng chính & 2 bãi phụ', 'Trạng thái': '🟢 Uptime 99,98%',
  });
}

function logisticsTunnel() {
  // A through tunnel with a conveyor/AGV deck linking the LEFT and RIGHT side
  // yards underneath the port (inter-port cargo link).
  const y0 = FY + 1.5;
  ub(BX * 2 + 40, 0.6, 14, matSteel, 0, y0, 70);                 // conveyor deck spanning the width
  for (let x = -BX - 16; x < BX + 16; x += 6) ub(13, 0.4, 1.2, matAccent, x, y0 + 0.5, 70);  // belt rollers
  for (const sx of [-1, 1]) ub(40, CY - FY - 2, 16, matWall, sx * (BX + 18), (FY + CY) / 2, 70);  // tunnel bores to the sides
  // Underground logistics vehicles (ULVs) ferrying containers between the side yards.
  for (let i = 0; i < 4; i++) { const m = ub(8, 2.6, 3, cMats[i % cMats.length], -BX, y0 + 2.0, 70); ugCargo.push({ m, ph: i / 4 }); }
  const g = zone(0, 70, 60, 16);
  click(g, '🚇', 'Tuyến Hầm Logistics Liên Cảng', 'NỐI CẢNG CHÍNH ↔ 2 BÃI PHỤ DƯỚI LÒNG ĐẤT', {
    'Chức năng': 'Băng tải/AGV ngầm vận chuyển container giữa 3 khu không cản giao thông mặt đất',
    'Hướng tuyến': 'Đâm sang bãi tồn (trái) và bãi tự động (phải)',
    'Lợi ích': 'Giảm kẹt xe mặt đất, an ninh, chạy 24/7',
    'Số hoá': 'Theo dõi vị trí kiện hàng realtime trong twin', 'Trạng thái': '🟢 Đang luân chuyển',
  });
}

function parkingAndTanks(z) {
  const g = new THREE.Group(); g.position.set(-90, FY, z); group.add(g);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) bx(g, 4, 1.4, 7, [matCar, mat(0x2f5a86, .5, .3), mat(0x3a4250, .6, .3)][c % 3], -18 + c * 9, 0.7, -6 + r * 9, false);
  for (let i = 0; i < 6; i++) bx(g, 1.2, 0.3, 1.2, matStrip, -18 + i * 8, 3, 0, false);
  click(g, '🅿️', 'Bãi Đỗ Xe Ngầm', 'ĐỖ XE NỘI BỘ & NHÂN VIÊN', { 'Chức năng': 'Giải phóng mặt bằng bề mặt cho khai thác', 'Sức chứa': '~120 chỗ', 'Kết nối': 'Thang máy/đường dốc lên khu điều hành', 'Trạng thái': '🟢 Còn chỗ' });
  // reservoirs
  const r2 = new THREE.Group(); r2.position.set(90, FY, z + 60); group.add(r2);
  for (const tx of [-12, 0, 12]) cy(r2, 4, 16, tx === 0 ? matFuel : matTank, tx, 1, 0, false);
  click(r2, '🛢️', 'Bồn Chứa Ngầm (Nước & Nhiên Liệu)', 'DỰ TRỮ CHIẾN LƯỢC', { 'Chức năng': 'Dự trữ nước chữa cháy, nước sạch & nhiên liệu', 'Sức chứa': '3 bồn × 200 m³', 'An toàn': 'Đặt ngầm, cảm biến mức & rò rỉ', 'Trạng thái': '🟢 Đầy 80%' });
}

function buildPortalSurface() {
  // BIG vehicle gate (like the main port gate) in the OPEN gate plaza behind the
  // port: a tall arch over a down-ramp into a dark tunnel mouth + barriers.
  const px = 78, pz = 398;
  portal = new THREE.Group(); portal.position.set(px, 5, pz); scene.add(portal);
  bx(portal, 36, 5, 28, mat(0x60645f, 0.95, 0.0), 0, -5, 0);               // grounding pad
  // Grand entrance ARCH spanning the ramp.
  const pillar = mat(0xb8c0bc, 0.6, 0.2);
  for (const ax of [-16, 10]) bx(portal, 3.4, 17, 3.4, pillar, ax, 0, 2);
  bx(portal, 32, 4.5, 3.4, pillar, -3, 17, 2);
  bx(portal, 26, 3, 0.7, mat(0x12303f, 0.4, 0.3, 0x18c08a, 1.1), -3, 13, 3.8);  // big lit gate sign
  // control booth beside the ramp
  bx(portal, 6, 6, 6, mat(0xc3ccc4, 0.6, 0.1), 14, 0, 10);
  // descending road → dark tunnel mouth toward the port (−z)
  bx(portal, 16, 0.3, 10, mat(0x55585e, 0.95, 0.03), -3, -0.3, 9);
  const rs = bx(portal, 14, 0.5, 22, mat(0x44474c, 0.95, 0.02), -3, -1.6, -4); rs.rotation.x = 0.34;
  bx(portal, 17, 7, 5, mat(0x090c10, 0.9, 0.1), -3, -3.6, -15);            // dark tunnel mouth
  bx(portal, 18, 1.1, 1.2, matAccent, -3, 1.0, -12.6);                      // lintel
  for (const sx of [-11, 5]) bx(portal, 0.8, 6, 22, mat(0x6b6f72, 0.9), sx, -1.6, -4);  // retaining walls
  for (const ox of [-9, 1]) { cy(portal, 0.3, 2.4, matSteel, ox, 0, 13); bx(portal, 6, 0.25, 0.25, matAccent, ox + 3, 2.2, 13); }  // barriers
  portal.userData = {
    isClickable: true, objType: 'underground', uaction: 'ug-descend',
    data: {
      icon: '🛗', name: 'Cổng Xe Xuống Tầng Ngầm', subtitle: 'CỔNG LỚN CHO Ô TÔ RA/VÀO TẦNG NGẦM',
      details: {
        'Vị trí': 'Plaza cạnh cổng chính (cuối cảng)',
        'Chức năng': 'Cổng + đường dốc lớn cho xe tải/đầu kéo xuống & lên tầng ngầm',
        'Kiểm soát': 'Barrier ra/vào + nhận diện biển số',
        'Hướng dẫn': 'Bấm vào cổng (hoặc nút ⬇ Tầng Ngầm) để đi xuống',
        'Trạng thái': '🟢 Mở',
      },
    },
  };
  bx(scene, 5, 0.2, 5, matStrip, 120, CY + 0.1, 335, false);               // shaft marker (inside)
}

// Surface ELEVATOR towers (people/light cargo) — OFF the vehicle roads, in the
// open buffers beside the port; a glass car visibly rides up/down. Click → descend.
function buildElevator(x, z, idx) {
  const g = new THREE.Group(); g.position.set(x, 5, z); scene.add(g);
  bx(g, 9, 5, 9, mat(0x60645f, 0.95, 0.0), 0, -5, 0);                      // grounding pad
  for (const [ox, oz] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]]) bx(g, 0.5, 18, 0.5, matSteel, ox, 0, oz);
  bx(g, 8, 1, 8, matSteel, 0, 18, 0);                                      // roof
  for (const oz of [-3.4, 3.4]) bx(g, 7, 17, 0.2, mat(0x182a30, 0.15, 0.7, 0x081418, 0.3), 0, 0, oz);  // glass walls
  bx(g, 5.5, 4, 0.5, mat(0x12303f, 0.4, 0.3, 0x18c08a, 1.0), 0, 13, -3.6); // lit sign
  const car = bx(g, 5.4, 3, 5.4, mat(0xbfe0f0, 0.3, 0.5, 0x1a3344, 0.4), 0, 2, 0);
  click(g, '🛗', 'Thang Máy Tầng Ngầm ' + idx, 'THANG MÁY NGƯỜI & HÀNG (NGOÀI LÀN XE)', {
    'Chức năng': 'Đưa người & hàng nhẹ giữa mặt đất ↔ tầng ngầm',
    'Vị trí': 'Lối đi bộ riêng, tách khỏi làn xe ô tô',
    'Hướng dẫn': 'Bấm để đi xuống tầng ngầm', 'Trạng thái': '🟢 Hoạt động',
  });
  g.userData.uaction = 'ug-descend';
  surfElevs.push({ car });
}

// Vertical container lift in the shaft — the key BASEMENT ⇄ SURFACE interaction
// (matches real underground terminals: a shaft hoist moving boxes between the
// surface yard and the deep logistics tunnel).
function buildLift() {
  const px = 120, pz = 330;
  for (const [ox, oz] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) ub(0.6, CY - FY, 0.6, matSteel, px + ox, (FY + CY) / 2, pz + oz);
  ub(10, 0.4, 10, matSteel, px, CY - 1, pz);                   // top guide frame (toward surface)
  ub(5, 0.3, 5, matStrip, px, CY - 0.6, pz);                   // shaft-to-surface glow
  const car = new THREE.Group(); car.position.set(px, FY + 2, pz); group.add(car);
  bx(car, 8, 0.5, 8, matSteel, 0, 0, 0, false);
  for (const [ox, oz] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]]) bx(car, 0.3, 4, 0.3, matSteel, ox, 2, oz, false);
  const box = bx(car, 6, 2.6, 6, matFuel, 0, 1.6, 0, false);
  click(car, '🛗', 'Thang Nâng Container Đứng', 'CHUYỂN CONTAINER HẦM ⇄ MẶT ĐẤT', {
    'Chức năng': 'Nâng/hạ container giữa tuyến hầm logistics và bãi trên mặt đất qua giếng đứng',
    'Cơ chế': 'Cẩu giếng (shaft hoist) — như cảng container ngầm thực tế',
    'Kết nối': 'Điểm GIAO THOA chính giữa tầng ngầm và cảng mặt đất', 'Trạng thái': '🟢 Đang nâng hàng',
  });
  ugLift = { car, box };
}

// Autonomous inspection robot patrolling the utility spine (twin sensor feed).
function buildRobot() {
  const r = new THREE.Group(); r.position.set(-6, FY, ZMIN + 30); group.add(r);
  bx(r, 2.2, 1.4, 3.2, matSteel, 0, 0.7, 0, false);
  bx(r, 0.6, 0.6, 0.6, matLedB, 0, 1.7, 1.3, false);          // sensor head
  bx(r, 1.6, 0.4, 0.4, matAccent, 0, 1.9, 0, false);
  for (const wx of [-1, 1]) for (const wz of [-1, 1]) { const w = cy(r, 0.4, 0.3, matRack, wx, 0.1, wz, false); w.rotation.z = Math.PI / 2; }
  click(r, '🤖', 'Robot Tuần Tra Hạ Tầng Ngầm', 'GIÁM SÁT & BẢO TRÌ TỰ ĐỘNG', {
    'Chức năng': 'Quét rò rỉ ống, nhiệt độ cáp, khí gas dọc trục hầm kỹ thuật',
    'Cảm biến': 'LiDAR + nhiệt + khí', 'Số hoá': 'Đẩy dữ liệu realtime về digital twin (lớp 13)', 'Trạng thái': '🟢 Đang tuần tra',
  });
  ugRobot = r;
}

// Underground BIM-GIS monitoring control room (staffed operations).
function buildControlRoom() {
  const g = new THREE.Group(); g.position.set(-104, FY, 205); group.add(g);
  bx(g, 26, 8, 18, matWall, 0, 0.2, 0, false);
  bx(g, 21, 4, 0.3, mat(0x182a30, 0.15, 0.7, 0x081418, 0.3), 0, 4, -9.05, false);  // glass front
  for (let i = 0; i < 4; i++) bx(g, 4, 2.2, 0.3, matLedB, -8 + i * 5, 3.6, -8.8, false);  // monitoring screens
  bx(g, 26.4, 0.6, 18.4, matCeil, 0, 8, 0, false);
  click(g, '🖥️', 'Trung Tâm Giám Sát Hầm (BIM-GIS)', 'ĐIỀU HÀNH HẠ TẦNG NGẦM', {
    'Chức năng': 'Giám sát bơm, điện, ống, robot, thang nâng theo thời gian thực',
    'Công nghệ': 'Bản sao số BIM-GIS — biến dữ liệu thành cảnh báo & lệnh',
    'Kết nối': 'Đồng bộ Control Tower & 3 cảng mặt đất', 'Trạng thái': '🟢 Trực 24/7',
  });
}

function ugTruck(x, y, z, ci) {
  const g = new THREE.Group(); g.position.set(x, y, z); group.add(g);
  bx(g, 3.2, 2.2, 3, matRack, 0, 1.1, 3, false);                 // cab (front +z)
  bx(g, 3.4, 0.7, 8.5, matSteel, 0, 0.6, -1, false);             // chassis
  bx(g, 3.2, 2.5, 6.2, cMats[ci % cMats.length], 0, 1.8, -1.5, false);
  for (const wx of [-1.4, 1.4]) for (const wz of [-3.5, 0.5, 4]) { const w = cy(g, 0.6, 0.4, matFloor, wx, 0.0, wz, false); w.rotation.z = Math.PI / 2; }
  return g;
}

function ugWeighbridge(x, z) {
  const g = new THREE.Group(); g.position.set(x, FY, z); group.add(g);
  bx(g, 5, 0.5, 16, matSteel, 0, 0.3, 0, false);
  bx(g, 4, 3, 4, matWall, 6, 0.2, 0, false);
  bx(g, 3, 1.2, 0.2, matLedB, 6, 2, -2.1, false);
  click(g, '⚖️', 'Trạm Cân Tải Ngầm', 'KIỂM SOÁT TẢI TRỌNG XE RA/VÀO', { 'Chức năng': 'Cân container vào/ra tầng ngầm, chống quá tải', 'Loại': 'Cân ô tô điện tử 80 tấn', 'Số hoá': 'Số liệu cân đẩy thẳng về hệ thống TOS', 'Trạng thái': '🟢 Hoạt động' });
}

// Vehicle access RAMP (surface ⇄ basement), check-in/out gates + a floor loop.
function buildVehicleAccess() {
  ub(18, 0.5, 16, matStrip, ramp.xt, CY - 0.4, ramp.zt);         // glowing opening to the surface
  const dz = ramp.zb - ramp.zt, dy = ramp.yb - ramp.yt, len = Math.hypot(dz, dy);
  const ang = -Math.atan2(dy, dz);
  const slab = bx(group, 16, 0.6, len, matWall, ramp.xt, (ramp.yt + ramp.yb) / 2, (ramp.zt + ramp.zb) / 2, false);
  slab.rotation.x = ang;
  for (const sx of [-8, 8]) { const w = bx(group, 0.8, 3, len, matSteel, ramp.xt + sx, (ramp.yt + ramp.yb) / 2 + 1.2, (ramp.zt + ramp.zb) / 2, false); w.rotation.x = ang; }
  // Check-in / check-out gate booths + barriers at the foot of the ramp.
  for (const ox of [-6, 6]) {
    const bz = ramp.zb + 8;
    bx(group, 3.4, 4, 3.4, matWall, ramp.xt + ox, FY + 0.2, bz, false);
    bx(group, 2.6, 1.2, 0.2, matLedB, ramp.xt + ox, FY + 2.2, bz - 1.75, false);
    bx(group, 7, 0.3, 0.3, matAccent, ramp.xt + ox + (ox < 0 ? 5 : -5), FY + 2.6, bz + 2.5, false);   // barrier arm
  }
  // Internal floor road loop linking the ramp foot to the facilities.
  vloop = { cx: 80, cz: 170, rx: 55, rz: 45, y: FY + 0.6 };
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1.0, 44), matRack);
  ring.rotation.x = -Math.PI / 2; ring.scale.set(vloop.rx, vloop.rz, 1); ring.position.set(vloop.cx, vloop.y + 0.1, vloop.cz); group.add(ring);
  ugWeighbridge(vloop.cx, vloop.cz - vloop.rz + 8);
  for (let i = 0; i < 2; i++) rampVeh.push({ g: ugTruck(ramp.xt + (i ? 6 : -6), ramp.yt, ramp.zt, i), off: i * 0.5 });
  for (let i = 0; i < 4; i++) loopVeh.push({ g: ugTruck(vloop.cx, vloop.y, vloop.cz, i + 1), ph: i / 4 });
  const m = zone(ramp.xt, ramp.zb + 8, 22, 18);
  click(m, '🚛', 'Lối Xuống & Cổng Kiểm Soát Xe', 'ĐƯỜNG DỐC XE RA/VÀO TẦNG NGẦM', {
    'Chức năng': 'Đường dốc cho xe tải/đầu kéo lưu thông giữa mặt đất ↔ tầng ngầm',
    'Kiểm soát': 'Cổng check-in / check-out + barrier + nhận diện biển số',
    'Kết nối': 'Nối trực tiếp luồng xe mặt đất với hệ thống ngầm', 'Trạng thái': '🟢 Đang lưu thông',
  });
}

function buildStorageStation(x, z) {
  const g = new THREE.Group(); g.position.set(x, FY, z); group.add(g);
  bx(g, 40, 0.4, 30, matFloor, 0, 0.1, 0, false);
  for (let r = 0; r < 3; r++) for (let lvl = 0; lvl < 3; lvl++) {
    bx(g, 34, 0.4, 3, matTray, 0, 1.5 + lvl * 3, -9 + r * 9, false);
    for (let c = 0; c < 5; c++) bx(g, 4, 2.4, 2.6, cMats[(r + lvl + c) % cMats.length], -14 + c * 7, 1.6 + lvl * 3, -9 + r * 9, false);
  }
  for (const px of [-17, 17]) bx(g, 0.5, 9.5, 30, matSteel, px, 0.2, 0, false);
  click(g, '📦', 'Trạm Lưu Trữ Ngầm (CFS)', 'KHO & GOM HÀNG LẺ DƯỚI LÒNG ĐẤT', {
    'Chức năng': 'Lưu trữ container/hàng lẻ, gom-tách (CFS) an toàn dưới ngầm',
    'Quy mô': '3 tầng kệ cao', 'Lợi ích': 'Tận dụng không gian ngầm, ổn định nhiệt độ',
    'Kết nối': 'Liên thông tuyến hầm logistics & thang nâng lên bãi', 'Trạng thái': '🟢 Đang khai thác',
  });
}

function buildGuesthouse(x, z) {
  const g = new THREE.Group(); g.position.set(x, FY, z); group.add(g);
  bx(g, 26, 10, 16, matWall, 0, 0.2, 0, false);
  for (let f = 0; f < 3; f++) for (let w = 0; w < 6; w++) bx(g, 2.6, 1.8, 0.2, matLedB, -10 + w * 4, 2 + f * 3, -8.1, false);
  bx(g, 27, 0.6, 17, matCeil, 0, 10, 0, false);
  bx(g, 6, 3, 0.3, matAccent, 0, 0.2, -8.2, false);
  click(g, '🏨', 'Nhà Khách & Khu Nghỉ Ca', 'TIỆN ÍCH CHO KÍP TRỰC NGẦM', {
    'Chức năng': 'Phòng nghỉ ca, canteen, y tế, thay đồ cho nhân viên trực 24/7',
    'Vai trò': 'Bảo đảm vận hành liên tục dưới tầng ngầm', 'Trạng thái': '🟢 Đang phục vụ',
  });
}

export function initUnderground() {
  group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  shell();
  utilitySpine();
  logisticsTunnel();
  pumpStation(60);
  substation(150);
  dataVault(235);
  parkingAndTanks(300);
  buildControlRoom();
  buildRobot();
  buildLift();
  buildVehicleAccess();
  buildStorageStation(-100, 130);
  buildGuesthouse(-110, 250);
  buildPortalSurface();
  buildElevator(-185, 70, 1);     // off-road buffers, left + right of the port
  buildElevator(185, 70, 2);
  buildToggle();
  // Clicking the surface gate / elevators descends (raycast dispatches the event).
  window.addEventListener('ug-descend', () => { if (!open) enter(); });
}

/* ── Smooth surface ⇄ underground camera transition ────────────────────────── */
function flyCam(pos, look, dur, onDone) {
  if (anim) cancelAnimationFrame(anim);
  const p0 = camera.position.clone(), t0 = orbit.target.clone(), st = performance.now();
  const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  (function tick() {
    const k = Math.min((performance.now() - st) / dur, 1), e = eio(k);
    camera.position.lerpVectors(p0, pos, e);
    orbit.target.lerpVectors(t0, look, e);
    orbit.update();
    if (k < 1) { anim = requestAnimationFrame(tick); } else { anim = null; if (onDone) onDone(); }
  })();
}

function enter() {
  open = true;
  saved.pos.copy(camera.position); saved.tgt.copy(orbit.target);
  savedOrbit.min = orbit.minDistance; savedOrbit.max = orbit.maxDistance; savedOrbit.pol = orbit.maxPolarAngle;
  orbit.minDistance = 6; orbit.maxDistance = 150; orbit.maxPolarAngle = Math.PI;   // stay inside the basement
  window.dispatchEvent(new Event('clear-follow-target'));                          // don't let follow-cam fight us
  group.visible = true;
  // Fly to an OVERALL basement vantage (not a close-up on the lift).
  flyCam(new THREE.Vector3(140, -7, 40), new THREE.Vector3(-10, -18, 190), 1900);
  const b = document.getElementById('ug-btn'); if (b) b.textContent = '⬆ Lên Mặt Đất';
}
function exit() {
  open = false;
  if (savedOrbit.max) { orbit.minDistance = savedOrbit.min; orbit.maxDistance = savedOrbit.max; orbit.maxPolarAngle = savedOrbit.pol; }
  flyCam(saved.pos.clone(), saved.tgt.clone(), 1700, () => { group.visible = false; });
  const b = document.getElementById('ug-btn'); if (b) b.textContent = '⬇ Tầng Ngầm';
}

// Whether the camera is currently confined inside the basement.
export function isUnderground() { return open; }

// Surface WITHOUT the return-to-saved fly: lifts the basement confinement and
// hides the level so a caller (Copilot) can immediately fly to a SURFACE target
// instead of the camera staying clamped under the basement ceiling.
export function leaveUnderground() {
  if (!open) return;
  open = false;
  if (savedOrbit.max) { orbit.minDistance = savedOrbit.min; orbit.maxDistance = savedOrbit.max; orbit.maxPolarAngle = savedOrbit.pol; }
  if (anim) { cancelAnimationFrame(anim); anim = null; }
  if (group) group.visible = false;
  const b = document.getElementById('ug-btn'); if (b) b.textContent = '⬇ Tầng Ngầm';
}

// Per-frame: basement activity + confine the camera so it can't fly outside.
export function updateUnderground(dt) {
  ugT += dt;
  // Surface elevator cars ride up/down (always visible, even on the surface).
  surfElevs.forEach((e, i) => { e.car.position.y = 2 + (Math.sin(ugT * 0.55 + i * 2.1) * 0.5 + 0.5) * 10; });
  if (!group || !group.visible) return;
  // Inter-port ULVs gliding along the logistics tunnel (left ⇄ right).
  ugCargo.forEach((c) => { c.m.position.x = lerp(-BX - 10, BX + 10, (ugT * 0.045 + c.ph) % 1); });
  // Pump impellers spinning (flood control running).
  ugPumps.forEach((p, i) => { p.rotation.y += dt * (3 + i); });
  // Inspection robot patrolling the utility spine.
  if (ugRobot) { const p = (Math.sin(ugT * 0.22) + 1) / 2; ugRobot.position.z = lerp(ZMIN + 24, ZMAX - 24, p); ugRobot.rotation.y = Math.cos(ugT * 0.22) >= 0 ? 0 : Math.PI; }
  // Vertical lift cycling — basement ⇄ surface container transfer.
  if (ugLift) { const p = (Math.sin(ugT * 0.5) + 1) / 2; ugLift.car.position.y = lerp(FY + 2, CY - 3, p); ugLift.box.visible = p > 0.15; }
  // Vehicles on the access ramp (driving down / up between surface and basement).
  rampVeh.forEach((v) => {
    const p = (ugT * 0.07 + v.off) % 1, down = p < 0.5, f = down ? p / 0.5 : 1 - (p - 0.5) / 0.5;
    v.g.position.z = lerp(ramp.zt, ramp.zb, f); v.g.position.y = lerp(ramp.yt, ramp.yb, f);
    v.g.rotation.y = down ? Math.PI : 0;   // face the travel direction (down = −z)
  });
  // Vehicles circulating the basement floor loop.
  loopVeh.forEach((v) => {
    const a = ugT * 0.16 + v.ph * Math.PI * 2;
    const vx = -vloop.rx * Math.sin(a), vz = vloop.rz * Math.cos(a);
    v.g.position.set(vloop.cx + vloop.rx * Math.cos(a), vloop.y, vloop.cz + vloop.rz * Math.sin(a));
    v.g.rotation.y = Math.atan2(vx, vz) + Math.PI / 2;
  });
  // Data-flow pulse on the LED strips.
  const pulse = 0.6 + Math.sin(ugT * 4) * 0.4;
  matLed.emissiveIntensity = pulse; matLedB.emissiveIntensity = pulse + 0.25;
  // Confine the camera to the basement once the descent has finished.
  if (open && anim === null) {
    const tg = orbit.target;
    tg.x = clamp(tg.x, -BX + 10, BX - 10); tg.z = clamp(tg.z, ZMIN + 10, ZMAX - 10); tg.y = clamp(tg.y, FY + 4, CY - 4);
    const cp = camera.position;
    cp.x = clamp(cp.x, -BX + 3, BX - 3); cp.z = clamp(cp.z, ZMIN + 3, ZMAX - 3); cp.y = clamp(cp.y, FY + 3, CY - 3);
  }
}

/* ── CHRONOS flood hook (Resilience scenario) ──────────────────────────────
 * Raises a translucent flood plane inside the basement and tints the power /
 * pump infrastructure red as the substation vault is inundated. level ∈ [0,1].
 * The basement need not be visible — the tint persists so descending mid-storm
 * shows the damage. */
let floodPlane = null, floodLevel = 0;
const _floodOrig = [];
export function setFlood(level) {
  floodLevel = Math.max(0, Math.min(1, level || 0));
  if (!group) return;
  if (!floodPlane) {
    floodPlane = bx(group, BX * 2, 0.6, ZMAX - ZMIN, mat(0x2f6fb0, 0.3, 0.5, 0x18406a, 0.4), 0, FY, MIDZ, false);
    floodPlane.material.transparent = true; floodPlane.material.opacity = 0.62;
    // remember the materials we recolour so we can restore them
    [matSteel, matLed, matWater].forEach(m => _floodOrig.push({ m, c: m.color.getHex(), e: m.emissive ? m.emissive.getHex() : 0 }));
  }
  const h = floodLevel * (CY - FY - 4);
  floodPlane.scale.y = Math.max(0.01, h / 0.6);
  floodPlane.position.y = FY + h / 2;
  floodPlane.visible = floodLevel > 0.02;
  // tint the substation / pump steel toward danger red as it floods
  const dng = floodLevel;
  matSteel.color.setRGB(0.55 + dng * 0.35, 0.57 - dng * 0.4, 0.6 - dng * 0.45);
  matLed.emissive.setRGB(dng, 0.82 * (1 - dng), 0.54 * (1 - dng));
  if (floodLevel < 0.02 && _floodOrig.length) {
    _floodOrig.forEach(o => { o.m.color.setHex(o.c); if (o.m.emissive) o.m.emissive.setHex(o.e); });
  }
}

function buildToggle() {
  const btn = document.createElement('button');
  btn.className = 'top-btn'; btn.id = 'ug-btn'; btn.textContent = '⬇ Tầng Ngầm';
  btn.onclick = () => (open ? exit() : enter());
  const host = document.getElementById('dn-toggle');
  if (host && host.parentElement) host.parentElement.appendChild(btn);
  else document.getElementById('topbar')?.appendChild(btn);
}
