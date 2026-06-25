/* ──────────────────────────────────────────────────────────────────────────
 * env/rail-terminal.js — Realistic ON-DOCK RAIL system (mirrors the vessel flow)
 *
 *   LEFT  terminal = OUTBOUND : train arrives EMPTY → PICKS UP containers → full.
 *   RIGHT terminal = INBOUND  : train arrives FULL  → DELIVERS containers → empty.
 *
 * Flow (like a ship): approach from the CITY side (+z) → INSPECTION (soát tàu,
 * barrier + ID board) → proceed to the work position → DWELL (train STOPS) →
 * the RMG gantry travels to each car and a paired AGV shuttles to/from the yard,
 * SYNCED so the crane always sets the box ONTO the AGV (never the ground) →
 * containers appear/disappear ONE BY ONE → reverse out toward the CITY (+z).
 *
 * The crane only works while the train DWELLs and locks onto the stationary
 * train's car coordinates. Each train has TWO locomotives (push-pull) and rich,
 * live-updating info. A gate electronic board verifies the incoming train ID.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, M, mat, cMats, bx, cy, dummy } from '../core.js';
import { railFlank } from '../layout.js';

const Y = 5.0, H = 17, CYCLE = 7.0;
const matBase = mat(0x60645f, 0.95, 0.0);
const matBallast = mat(0x5b5550, 0.97, 0.0);
const matRail = mat(0x9aa0a6, 0.4, 0.85);
const matSleeper = mat(0x4a4640, 0.95, 0.0);
const matLoco = mat(0xb23b2e, 0.45, 0.35);
const matLocoDk = mat(0x20252b, 0.4, 0.5);
const matCar = mat(0x3a4250, 0.6, 0.3);
const matSteel = mat(0x8b9197, 0.5, 0.6);
const matApron = mat(0x595d63, 0.9, 0.03);
const matWall = mat(0xc3ccc4, 0.7, 0.05);
const matScreen = mat(0x0a1014, 0.4, 0.3, 0x18c08a, 0.7);
const matAgv = mat(0x222a31, 0.5, 0.5);
const matAgvY = mat(0xe2ad24, 0.5, 0.35);
const matBarr = mat(0xd23a2a, 0.5, 0.3, 0x4a0a04, 0.2);

const lerp = (a, b, t) => a + (b - a) * t;
const toward = (c, g, s) => (c < g ? Math.min(c + s, g) : Math.max(c - s, g));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const CAR_N = 6, CAR_PITCH = 16;
const ORIGINS = ['ICD Sóng Thần (Bình Dương)', 'Ga Yên Viên (Hà Nội)', 'ICD Lào Cai', 'Ga Đông Anh', 'ICD Tân Cảng Long Bình'];
const DESTS = ['ICD Lào Cai', 'Ga Đồng Đăng (Lạng Sơn)', 'ICD Phước Long', 'Ga Diêu Trì', 'Trung Quốc (qua Đồng Đăng)'];
const CAPTAINS = ['Nguyễn Văn Hùng', 'Trần Quốc Bảo', 'Lê Minh Đức', 'Phạm Văn Sơn', 'Hoàng Đình Phúc', 'Vũ Thành Nam'];
const CARGO = ['Hàng bách hoá (GP)', 'Hàng lạnh (Reefer)', 'Nông sản xuất khẩu', 'Linh kiện điện tử', 'Hàng dệt may', 'Thép & vật liệu xây dựng'];

const trains = [];
const inspections = [];
const boards = {};
let t = 0, seq = 100;

/* ── Build ─────────────────────────────────────────────────────────────────── */
function buildTracks(b, railX, railX2) {
  const cx = (b.minX + b.maxX) / 2, zEnd = b.gateZ + 70, zStart = b.minZ;
  const zC = (zStart + zEnd) / 2, zD = zEnd - zStart;
  bx(scene, (b.maxX - b.minX) + 8, Y, zD + 8, matBase, cx, 0, zC);
  bx(scene, 12, 0.3, b.maxZ - b.minZ, matApron, b.innerX + (b.side === 'L' ? 1 : -1) * 5, Y, (b.minZ + b.maxZ) / 2);
  for (const tx of [railX, railX2]) {
    bx(scene, 8, 0.4, zD, matBallast, tx, Y - 0.4 + 0.42, zC);
    for (const rx of [tx - 0.7, tx + 0.7]) bx(scene, 0.18, 0.3, zD, matRail, rx, Y, zC);
  }
  const step = 3.2, n = Math.floor(zD / step);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, 0.25, 0.5), matSleeper, n * 2);
  im.receiveShadow = true; let i = 0;
  for (const tx of [railX, railX2]) for (let k = 0; k < n; k++) {
    dummy.position.set(tx, Y - 0.05, zStart + step / 2 + k * step);
    dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    im.setMatrixAt(i++, dummy.matrix);
  }
  im.instanceMatrix.needsUpdate = true; scene.add(im);
}

function buildLoco(g, z, flip) {
  const f = flip ? -1 : 1;
  bx(g, 3.6, 3.8, 15, matLoco, 0, 0.9, z);
  bx(g, 3.4, 1.0, 15, matLocoDk, 0, 4.7, z);
  bx(g, 3.2, 2.0, 4.5, matLocoDk, 0, 4.7, z + f * 4.0);
  bx(g, 2.8, 1.1, 0.3, matScreen, 0, 3.4, z + f * 7.5);
  for (const wz of [-4.5, 4.5]) { const w = cy(g, 0.95, 0.7, M.crane, 1.7, -0.2, z + wz); w.rotation.x = Math.PI / 2; }
}

function makeTrainData(side) {
  seq += 1;
  const code = 'TH-' + seq + (side === 'L' ? 'X' : 'N');      // X=xuất(pickup), N=nhập(deliver)
  const route = side === 'L' ? ('Cảng NDT15  →  ' + pick(DESTS)) : (pick(ORIGINS) + '  →  Cảng NDT15');
  return {
    icon: '🚆', name: 'Tàu Hoả ' + code,
    subtitle: side === 'L' ? 'TÀU ĐẾN — NHẬN CONTAINER TỪ CẢNG' : 'TÀU ĐẾN — GIAO CONTAINER VÀO CẢNG',
    details: {
      'Mã đoàn tàu': code, 'Trưởng tàu': pick(CAPTAINS), 'Loại hàng': pick(CARGO), 'Tuyến': route,
      'Chiều': side === 'L' ? 'Xuất — đến rỗng, bốc hàng lên tàu' : 'Nhập — đến đầy, dỡ hàng xuống cảng',
      'Số toa': CAR_N + ' toa · ' + (CAR_N * 2) + ' TEU', 'Đầu kéo': '2 đầu kéo (push-pull) ' + pick(['D19E', 'D20E', 'D13E']),
      'Tốc độ vào ga': '15 km/h', 'Trạng thái': '🟡 Đang tiến vào ga',
    },
  };
}

function buildTrain(b, railX) {
  const deliver = b.side === 'R';                              // R delivers (unload), L picks up (load)
  const g = new THREE.Group(); g.position.set(railX, Y, b.gateZ + 55); g.visible = false; scene.add(g);
  buildLoco(g, 0, false);                                      // front loco (leads −z)
  const cars = [];
  for (let c = 0; c < CAR_N; c++) {
    const cz = CAR_PITCH * (c + 1);
    bx(g, 3.3, 0.8, 14, matCar, 0, 0.5, cz);
    for (const wx of [-1.5, 1.5]) for (const wz of [-5, 5]) { const w = cy(g, 0.8, 0.55, matLocoDk, wx, -0.2, cz + wz); w.rotation.x = Math.PI / 2; }
    const box = bx(g, 3.0, 2.6, 12.6, cMats[c % cMats.length], 0, 1.3, cz);
    box.visible = deliver;                                     // full on arrival if delivering
    cars.push({ localZ: cz, box });
  }
  buildLoco(g, CAR_PITCH * (CAR_N + 1), true);                 // rear loco (push-pull)
  const data = makeTrainData(b.side);
  g.userData = { isClickable: true, objType: 'rail', data };

  const tr = {
    side: b.side, deliver, g, cars, data, units: [],
    z: b.gateZ + 55, state: 'gone', timer: 2 + (b.side === 'R' ? 6 : 0),
    zInspect: b.gateZ - 64, zDwell: (b.minZ + b.maxZ) / 2 - 30, zExit: b.gateZ + 55, zSpawn: b.gateZ + 55,
    vFast: 70, vSlow: 26, depTimer: 0,
  };
  trains.push(tr);
  return tr;
}

function buildAgv(z, c) {
  const g = new THREE.Group(); g.position.set(0, Y, z); scene.add(g);
  bx(g, 9, 1.0, 3.2, matAgv, 0, 0.4, 0);
  bx(g, 9.2, 0.3, 3.4, matAgvY, 0, 1.4, 0);
  const box = bx(g, 8.4, 2.6, 3.0, cMats[c % cMats.length], 0, 1.6, 0);
  box.visible = false;
  for (const wx of [-3, 3]) for (const wz of [-1.5, 1.5]) { const w = cy(g, 0.55, 0.4, M.crane, wx, 0.0, wz); w.rotation.z = Math.PI / 2; }
  g.userData = { isClickable: true, objType: 'auto', data: { icon: '🤖', name: 'AGV Trung Chuyển Ray', subtitle: 'XE TỰ HÀNH: GA TÀU ↔ BÃI', details: { 'Loại': 'AGV không người lái', 'Đồng bộ': 'Khớp toạ độ với cẩu RMG khi nhận/giao container', 'Trạng thái': 'Chờ tác nghiệp' } } };
  return { g, box };
}

function buildUnit(b, cxR, span, zInit, cars, railX, interX, yardX, deliver) {
  const g = new THREE.Group(); g.position.set(cxR, Y, zInit); scene.add(g);
  for (const lx of [-span / 2, span / 2]) for (const lz of [-4, 4]) bx(g, 1.3, H, 1.3, matSteel, lx, 0, lz);
  bx(g, span + 2, 1.5, 9, matSteel, 0, H, 0);
  bx(g, span - 2, 0.8, 2.2, M.craneY, 0, H + 1.2, 0);
  const trolley = bx(g, 3, 1.3, 4, M.craneY, 0, H - 1.3, 0);
  const spreader = bx(g, 3.4, 0.5, 6.4, matLocoDk, 0, H - 8, 0);
  const craneCargo = bx(g, 3.2, 2.5, 6.0, cMats[cars[0] ? 0 : 1], 0, H - 9.8, 0);
  craneCargo.visible = false;
  g.userData = { isClickable: true, objType: 'rail', data: { icon: '🏗️', name: 'Cẩu Giàn Ray (RMG) — Lưu Động', subtitle: 'BÁM TOẠ ĐỘ TOA TÀU & ĐỒNG BỘ AGV', details: { 'Loại': 'Rail-Mounted Gantry di động', 'Nhịp': Math.round(span) + ' m', 'Cơ chế': 'Chạy dọc tới từng toa → đặt container đúng vị trí AGV', 'Trạng thái': 'Chờ tàu' } } };
  const agv = buildAgv(zInit, cars[0] ? 0 : 1);
  return {
    g, trolley, spreader, craneCargo, agv: agv.g, agvBox: agv.box, gd: g.userData.data,
    cars, carPtr: 0, scp: Math.random() * 0.3, deliver,
    hi: H - 8, lo: H - 14.2, railLX: railX - cxR, interLX: interX - cxR, interX, yardX,
  };
}

function buildInspection(b, railX) {
  const g = new THREE.Group(); g.position.set(railX, Y, b.gateZ - 64); scene.add(g);
  for (const px of [-7, 7]) bx(g, 1.6, 11, 1.6, matSteel, px, 0, 0);
  bx(g, 16, 1.4, 4, matSteel, 0, 11, 0);
  bx(g, 13, 1.0, 0.4, matScreen, 0, 7, 1.9);
  bx(g, 5, 4, 5, matWall, 11, 0, -3);
  bx(g, 5.4, 0.5, 5.4, mat(0x55655d, 0.8, 0.1), 11, 4, -3);
  const piv = new THREE.Group(); piv.position.set(-7, 5.5, 4); g.add(piv);
  bx(piv, 14, 0.4, 0.4, matBarr, 7, 0, 0);
  g.userData = { isClickable: true, objType: 'rail', data: { icon: '🛂', name: 'Trạm Soát Tàu Hoả', subtitle: 'KIỂM TRA & CẤP PHÉP VÀO GA', details: { 'Chức năng': 'Soi chiếu container, kiểm tra giấy tờ, an ninh', 'Thiết bị': 'Cổng soi X-quang + cân tải + nhận diện', 'Quy trình': 'Tàu dừng soát → đạt → barrier mở → vào ga', 'Trạng thái': '🟢 Đang trực' } } };
  inspections.push({ side: b.side, piv });
}

function buildControl(b) {
  const ys = b.side === 'L' ? 1 : -1;
  const g = new THREE.Group(); g.position.set(b.outerX - ys * 2, Y, b.maxZ + 40); scene.add(g);
  bx(g, 15, 9, 12, matWall, 0, 0, 0);
  bx(g, 13, 3, 0.4, matScreen, 0, 5, -6.1);
  bx(g, 16, 1, 13, mat(0x55655d, 0.8, 0.1), 0, 9, 0);
  bx(g, 4.4, 4.4, 4.4, mat(0x4D8DF6, 0.2, 0.7, 0x113355, 0.4), 0, 10, 0);
  cy(g, 0.2, 8, matSteel, 5, 11, 4);
  g.userData = { isClickable: true, objType: 'rail', data: { icon: '🚉', name: 'Trung Tâm Điều Độ Tàu Hoả', subtitle: 'QUẢN LÝ KHAI THÁC ĐƯỜNG SẮT', details: { 'Chức năng': 'Lập lịch tàu, cấp đường, điều phối cẩu RMG & AGV', 'Giám sát': 'Vị trí tàu realtime + tiến độ bốc dỡ từng toa', 'Kết nối': 'Đồng bộ TOS cảng + điều độ đường sắt quốc gia', 'Trạng thái': '🟢 Đang điều độ' } } };
}

function buildGateBoard(g, side) {
  const cvs = document.createElement('canvas'); cvs.width = 512; cvs.height = 220;
  const tex = new THREE.CanvasTexture(cvs); tex.anisotropy = 8;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(24, 10.3), new THREE.MeshBasicMaterial({ map: tex }));
  scr.position.set(0, 9, 1.35); g.add(scr);
  boards[side] = { cvs, ctx: cvs.getContext('2d'), tex, last: '' };
}

function buildGate(b, railX, railX2) {
  const g = new THREE.Group(); g.position.set((railX + railX2) / 2, Y, b.gateZ); scene.add(g);
  for (const px of [-14, 14]) bx(g, 2.4, 12, 2.4, matSteel, px, 0, 0);
  bx(g, 32, 3, 2.4, matSteel, 0, 13.5, 0);
  bx(g, 30, 0.4, 8, matBallast, 0, 0, 4);
  buildGateBoard(g, b.side);
  g.userData = { isClickable: true, objType: 'rail', data: { icon: '🚧', name: 'Cổng Tàu Hoả', subtitle: 'NHẬN DIỆN & VERIFY MÃ TÀU TỪ XA', details: { 'Vai trò': 'Bảng điện tử nhận diện tàu từ xa, verify mã & cấp phép tuyến', 'Kết nối': 'Ga cảng ↔ ICD ↔ mạng đường sắt quốc gia', 'Trạng thái': '🟢 Thông tuyến' } } };
}

function buildFlank(side) {
  const b = railFlank(side);
  const ys = side === 'L' ? 1 : -1;
  const railX = b.innerX - ys * 30, railX2 = b.innerX - ys * 18, interX = b.innerX + ys * 5;
  const yardX = b.yardEdge + ys * 26;
  const legA = b.outerX + ys * 3, legB = interX + ys * 3, cxR = (legA + legB) / 2, span = Math.abs(legB - legA);
  buildTracks(b, railX, railX2);
  const tr = buildTrain(b, railX);
  const half = Math.ceil(CAR_N / 2);
  const front = tr.cars.slice(0, half), rear = tr.cars.slice(half);
  tr.units.push(buildUnit(b, cxR, span, tr.zDwell + CAR_PITCH * 2, front, railX, interX, yardX, tr.deliver));
  tr.units.push(buildUnit(b, cxR, span, tr.zDwell + CAR_PITCH * 5, rear, railX, interX, yardX, tr.deliver));
  buildInspection(b, railX);
  buildControl(b);
  buildGate(b, railX, railX2);
}

export function initRailTerminal() { buildFlank('L'); buildFlank('R'); }

// Live train registry for the Copilot locator ("tàu hỏa nào đang…").
export function getTrains() { return trains; }

/* ── Per-frame ─────────────────────────────────────────────────────────────── */
function statusText(state, side) {
  switch (state) {
    case 'approach': return '🟡 Đang tiến vào ga';
    case 'inspect': return '🔎 Đang qua trạm soát tàu';
    case 'proceed': return '🟢 Đang vào vị trí tác nghiệp';
    case 'dwell': return side === 'L' ? '📦 Đang BỐC hàng lên tàu' : '📦 Đang DỠ hàng xuống bãi';
    case 'depart': return '↗ Hoàn tất — đang rời ga về thành phố';
    default: return '… Tuyến trống (chờ tàu kế tiếp)';
  }
}

function idleUnit(u, dt) {
  u.trolley.position.x = lerp(u.trolley.position.x, u.railLX, Math.min(1, dt * 2));
  u.spreader.position.x = u.trolley.position.x;
  u.spreader.position.y = lerp(u.spreader.position.y, u.hi, Math.min(1, dt * 2));
  u.craneCargo.visible = false;
  u.agv.position.x = lerp(u.agv.position.x, u.interX, Math.min(1, dt * 2));
  u.agvBox.visible = false;
}

function updateUnit(u, tr, dt) {
  const car = u.cars[u.carPtr];
  if (!car) { idleUnit(u, dt); return; }
  const carWorldZ = tr.z + car.localZ;
  u.g.position.z = lerp(u.g.position.z, carWorldZ, Math.min(1, dt * 2.2));  // gantry travels to the car
  const s = u.scp;
  let tx = u.railLX, sy = u.hi, cc = false, ab = false, af = 0;
  if (u.deliver) {
    // UNLOAD: crane lifts box off the car → traverses → PLACES IT ON the AGV →
    // lifts clear → ONLY THEN the AGV (now loaded) drives to the yard.
    if (s < 0.10) { tx = u.railLX; sy = u.hi; }                                       // gantry to car
    else if (s < 0.18) { tx = u.railLX; sy = lerp(u.hi, u.lo, (s - 0.10) / 0.08); }    // lower onto car
    else if (s < 0.28) { tx = u.railLX; sy = lerp(u.lo, u.hi, (s - 0.18) / 0.10); }    // grab + raise
    else if (s < 0.42) { tx = lerp(u.railLX, u.interLX, (s - 0.28) / 0.14); }          // traverse to AGV
    else if (s < 0.52) { tx = u.interLX; sy = lerp(u.hi, u.lo, (s - 0.42) / 0.10); }   // lower onto AGV
    else if (s < 0.60) { tx = u.interLX; sy = lerp(u.lo, u.hi, (s - 0.52) / 0.08); }   // release + lift clear
    else if (s < 0.86) { tx = u.interLX; }                                            // (AGV carries)
    else { tx = lerp(u.interLX, u.railLX, (s - 0.86) / 0.14); }                        // trolley returns
    cc = (s >= 0.18 && s < 0.52);                   // box on the crane (car → AGV)
    ab = (s >= 0.52 && s < 0.80);                   // box on the AGV (placed → delivered)
    af = s < 0.60 ? 0 : s < 0.80 ? (s - 0.60) / 0.20 : 1 - (s - 0.80) / 0.20; // AGV moves ONLY after handoff
    car.box.visible = s < 0.18;                     // leaves the car once lifted
  } else {
    // LOAD: AGV brings a box from the yard → WAITS at the interchange → crane
    // lifts it OFF the AGV → places it on the car → AGV returns empty.
    if (s < 0.20) { tx = u.interLX; sy = u.hi; }                                       // AGV arriving (below)
    else if (s < 0.28) { tx = u.interLX; sy = u.hi; }                                  // AGV waits, crane over it
    else if (s < 0.38) { tx = u.interLX; sy = lerp(u.hi, u.lo, (s - 0.28) / 0.10); }   // lower to AGV
    else if (s < 0.48) { tx = u.interLX; sy = lerp(u.lo, u.hi, (s - 0.38) / 0.10); }   // lift box off AGV
    else if (s < 0.62) { tx = lerp(u.interLX, u.railLX, (s - 0.48) / 0.14); }          // traverse to car
    else if (s < 0.70) { tx = u.railLX; sy = lerp(u.hi, u.lo, (s - 0.62) / 0.08); }    // lower onto car
    else if (s < 0.80) { tx = u.railLX; sy = lerp(u.lo, u.hi, (s - 0.70) / 0.10); }    // place + raise
    else { tx = lerp(u.railLX, u.interLX, (s - 0.80) / 0.20); }                        // trolley returns
    cc = (s >= 0.38 && s < 0.70);                   // box on the crane (AGV → car)
    ab = (s < 0.38);                                // box on the AGV (from yard, waiting)
    af = s < 0.20 ? 1 - s / 0.20 : s < 0.80 ? 0 : (s - 0.80) / 0.20; // AGV still while crane handles it
    car.box.visible = s >= 0.70;                    // appears on the car once placed
  }
  u.trolley.position.x = tx; u.spreader.position.x = tx; u.spreader.position.y = sy;
  u.craneCargo.position.x = tx; u.craneCargo.position.y = sy - 1.8; u.craneCargo.visible = cc;
  u.agv.position.x = lerp(u.interX, u.yardX, af); u.agv.position.z = u.g.position.z; u.agvBox.visible = ab;
  u.scp += dt / CYCLE;
  if (u.scp >= 1) { u.scp = 0; u.carPtr += 1; }
}

function respawn(tr) {
  Object.assign(tr.data, makeTrainData(tr.side));
  tr.g.userData.data = tr.data;
  tr.cars.forEach((c) => { c.box.visible = tr.deliver; });    // reset full(deliver)/empty(pickup)
  tr.units.forEach((u) => { u.carPtr = 0; u.scp = 0; });
  tr.z = tr.zSpawn; tr.state = 'approach'; tr.g.visible = true; tr.depTimer = 0;
}

function drawBoard(side, tr) {
  const bd = boards[side]; if (!bd) return;
  const recog = tr.state === 'approach' || tr.state === 'inspect' || tr.state === 'proceed';
  const key = tr.state + tr.data.details['Mã đoàn tàu'];
  if (key === bd.last) return; bd.last = key;
  const x = bd.ctx;
  x.fillStyle = '#05101a'; x.fillRect(0, 0, 512, 220);
  x.fillStyle = '#0a2030'; x.fillRect(0, 0, 512, 46);
  x.textAlign = 'center'; x.fillStyle = '#4D8DF6'; x.font = '700 28px "Segoe UI",sans-serif';
  x.fillText('GA ĐƯỜNG SẮT NDT15', 256, 33);
  x.fillStyle = '#9fb4d2'; x.font = '600 22px "Segoe UI",sans-serif';
  x.fillText(side === 'L' ? 'TÀU XUẤT — NHẬN HÀNG' : 'TÀU NHẬP — GIAO HÀNG', 256, 78);
  x.fillStyle = '#fff'; x.font = '800 44px "Segoe UI",sans-serif';
  x.fillText(tr.data.details['Mã đoàn tàu'], 256, 130);
  if (recog) { x.fillStyle = '#15D8A4'; x.font = '800 30px "Segoe UI",sans-serif'; x.fillText('✔ ĐÃ NHẬN DIỆN — VERIFIED', 256, 180); }
  else { x.fillStyle = '#5f7896'; x.font = '700 26px "Segoe UI",sans-serif'; x.fillText('— TUYẾN TRỐNG —', 256, 178); }
  bd.tex.needsUpdate = true;
}

export function updateRail(dt) {
  t += dt;
  trains.forEach((tr) => {
    if (tr.state === 'approach') { tr.z = toward(tr.z, tr.zInspect, dt * tr.vFast); if (tr.z === tr.zInspect) { tr.state = 'inspect'; tr.timer = 4.5; } }
    else if (tr.state === 'inspect') { tr.timer -= dt; if (tr.timer <= 0) tr.state = 'proceed'; }
    else if (tr.state === 'proceed') { tr.z = toward(tr.z, tr.zDwell, dt * tr.vSlow); if (tr.z === tr.zDwell) tr.state = 'dwell'; }
    else if (tr.state === 'dwell') { if (tr.units.every((u) => u.carPtr >= u.cars.length)) { tr.depTimer += dt; if (tr.depTimer > 2.5) tr.state = 'depart'; } }
    else if (tr.state === 'depart') { tr.z = toward(tr.z, tr.zExit, dt * tr.vFast); if (tr.z === tr.zExit) { tr.state = 'gone'; tr.timer = 6; tr.g.visible = false; } }
    else { tr.timer -= dt; if (tr.timer <= 0) respawn(tr); }
    tr.g.position.z = tr.z;
    tr.data.details['Trạng thái'] = statusText(tr.state, tr.side);
    const dwelling = tr.state === 'dwell';
    tr.units.forEach((u) => { if (dwelling) updateUnit(u, tr, dt); else idleUnit(u, dt); });
    drawBoard(tr.side, tr);
  });
  inspections.forEach((ins) => {
    const tr = trains.find((x) => x.side === ins.side);
    const block = tr && (tr.state === 'approach' || tr.state === 'inspect');
    ins.piv.rotation.z = lerp(ins.piv.rotation.z, block ? 0 : -1.4, Math.min(1, dt * 4));
  });
}
