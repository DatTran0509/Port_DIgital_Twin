/* ──────────────────────────────────────────────────────────────────────────
 * env/connections.js — INTEGRATION links tying the landward facilities to the
 * port (the "connected digital-twin" story the demo must show).
 *
 * Bridges the gap between the port back edge (apronBounds.maxZ) and the raised
 * landward strip, all coplanar at the apron height (y≈5), with visible, clickable
 * infrastructure:
 *   1. GATE-ACCESS SPINE  — central truck road + staging + inland gate / ICD
 *      link (this is where trucks come from → connects road transport to port).
 *   2. RAIL SPUR          — track connecting the on-dock rail terminal to the yard.
 *   3. POWER LINE         — transmission pylons from the green-energy hub to a
 *      port substation (green power feeds the port).
 *   4. AGV LINK           — automated guidance lane joining the automated
 *      terminal to the main yard.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, M, mat, cMats, bx, cy, cable } from '../core.js';
import { apronBounds, landwardStrip, landwardZones } from '../layout.js';

const TOP = 5;                                   // apron-coplanar surface height
const matEarth = mat(0x6a6e62, 0.97, 0.0);       // embankment fill
const matSteel = mat(0x8b9197, 0.5, 0.6);
const matWire = mat(0x20262b, 0.6, 0.3);
const matBallast = mat(0x5b5550, 0.97, 0.0);
const matRail = mat(0x9aa0a6, 0.4, 0.85);
const matMark = mat(0xffffff, 0.8);
const matAuto = mat(0x0f2e28, 0.4, 0.3, 0x21d18a, 0.6);
const matLane = mat(0x3f4247, 0.95, 0.02);
const matAccent = mat(0x4D8DF6, 0.4, 0.3);

const click = (g, icon, name, subtitle, details) => { g.userData = { isClickable: true, objType: 'link', data: { icon, name, subtitle, details } }; };

// Small overhead sign marking + explaining a connection.
function marker(x, z, icon, name, subtitle, details) {
  const g = new THREE.Group(); g.position.set(x, TOP, z); scene.add(g);
  bx(g, 1, 9, 1, matSteel, -5, 0, 0); bx(g, 1, 9, 1, matSteel, 5, 0, 0);
  bx(g, 12, 3.2, 0.5, mat(0x12303f, 0.4, 0.3, 0x18c08a, 0.5), 0, 7.5, 0);
  click(g, icon, name, subtitle, details);
}

function stagedTruck(x, z, ry, i) {
  const g = new THREE.Group(); g.position.set(x, TOP, z); g.rotation.y = ry; scene.add(g);
  bx(g, 3.2, 2.3, 3.0, mat(0x2b3138, 0.3, 0.6), 0, 1.2, -3.2);
  bx(g, 3.4, 0.7, 9, mat(0x262b30, 0.6, 0.4), 0, 0.9, 0.8);
  if (i % 3 !== 0) bx(g, 3.3, 2.6, 6.4, cMats[i % cMats.length], 0, 1.6, 1.6);
  [[-1.6, -3], [1.6, -3], [-1.6, 1.5], [1.6, 1.5], [-1.6, 4.2], [1.6, 4.2]].forEach(([wx, wz]) => { const w = cy(g, 0.8, 0.6, mat(0x14171a, 0.85, 0), wx, 0.0, wz); w.rotation.z = Math.PI / 2; });
}

/* 1 ── Central gate-access spine + truck staging + inland gate ─────────────── */
function gateSpine() {
  const z0 = apronBounds().maxZ - 4;             // overlap the port back edge
  const z1 = landwardStrip().back;
  const cz = (z0 + z1) / 2, len = z1 - z0;
  bx(scene, 112, TOP, len, matEarth, 0, 0, cz);              // grounded embankment
  bx(scene, 48, 0.4, len, matLane, 0, TOP - 0.4 + 0.42, cz); // central carriageway
  for (let z = z0 + 8; z < z1 - 6; z += 12) bx(scene, 0.5, 0.5, 4, matMark, 0, TOP + 0.05, z, false);
  // staging parking bays either side of the road
  for (let i = 0; i < 6; i++) { stagedTruck(-38, z0 + 26 + i * 17, 0, i); stagedTruck(38, z0 + 26 + i * 17, Math.PI, i + 2); }
  // Inland gate / ICD link arch at the far end
  const g = new THREE.Group(); g.position.set(0, TOP, z1 - 10); scene.add(g);
  for (const px of [-26, 26]) bx(g, 3, 13, 3, matSteel, px, 0, 0);
  bx(g, 58, 4, 3, matSteel, 0, 13, 0);
  bx(g, 50, 3, 0.6, mat(0x12303f, 0.4, 0.3, 0x18c08a, 0.5), 0, 9, 1.7);
  for (const lx of [-12, 12]) { bx(g, 0.6, 4.5, 0.6, matMark, lx, 0, -3); bx(g, 9, 0.3, 0.3, mat(0xc02828, .5, .4, 0x500000, .25), lx + 4.5, 3.2, -3); }
  click(g, '🚧', 'Cổng Nội Địa & Kết Nối ICD', 'KẾT NỐI ĐƯỜNG BỘ ↔ CẢNG', {
    'Vai trò': 'Điểm kết nối xe tải nội địa / cảng cạn (ICD) vào cảng',
    'Làn': '4 làn + bãi tập kết tài xế', 'Kiểm soát': 'ANPR + cân tải + barrier tự động',
    'Liên kết số': 'Đồng bộ TOS — biết trước xe tới (pre-gate)', 'Trạng thái': '🟢 Thông suốt',
  });
}

/* 2 ── Power transmission line: green hub → port substation ─────────────────── */
function powerLine() {
  const pts = [[-210, 545], [-196, 485], [-182, 420], [-168, 362]];
  const tops = [];
  pts.forEach(([x, z], i) => {
    const h = i === pts.length - 1 ? 15 : 22;
    bx(scene, 3.4, TOP, 3.4, matEarth, x, 0, z);            // grounded concrete footing
    bx(scene, 2.4, h, 2.4, matSteel, x, TOP, z);            // tower
    bx(scene, 9, 0.6, 0.6, matSteel, x, TOP + h - 3, z);    // crossarm upper
    bx(scene, 7, 0.6, 0.6, matSteel, x, TOP + h - 6, z);    // crossarm lower
    tops.push(new THREE.Vector3(x, TOP + h - 3, z));
  });
  for (let i = 0; i < tops.length - 1; i++) for (const off of [-3.2, 0, 3.2]) {
    cable(scene, tops[i].clone().add(new THREE.Vector3(off, 0, 0)), tops[i + 1].clone().add(new THREE.Vector3(off, 0, 0)), matWire);
  }
  // Substation near the port back-left
  const g = new THREE.Group(); g.position.set(-165, TOP, 350); scene.add(g);
  bx(g, 24, TOP, 18, matEarth, 0, -TOP, 0);                 // grounded pad (land → apron height)
  bx(g, 22, 0.4, 16, matLane, 0, 0, 0);
  for (const tx of [-6, 0, 6]) { bx(g, 4, 4, 4, matSteel, tx, 0, -2); bx(g, 0.3, 5, 0.3, matSteel, tx - 1, 4, -2); bx(g, 0.3, 5, 0.3, matSteel, tx + 1, 4, -2); }
  bx(g, 5, 3, 4, mat(0xc3ccc4, 0.7, 0.05), 8, 0, 5);        // control kiosk
  click(g, '⚡', 'Trạm Biến Áp Cảng', 'NHẬN ĐIỆN XANH TỪ HUB NĂNG LƯỢNG', {
    'Vai trò': 'Nhận điện gió/mặt trời/H₂ + BESS, cấp cho cẩu & điện bờ',
    'Công suất': '110/22 kV — 60 MVA', 'Tỷ lệ tái tạo': '~63% phụ tải cảng',
    'Liên kết số': 'Giám sát lưới realtime trong Control Tower', 'Trạng thái': '🟢 Đang vận hành',
  });
}

/* 3 ── AGV guidance lane: automated terminal → main yard ───────────────────── */
function agvLink() {
  const z0 = apronBounds().maxZ - 4;
  const z1 = landwardZones().auto.front + 4;
  const cz = (z0 + z1) / 2, len = z1 - z0, x = 140;
  bx(scene, 30, TOP, len, matEarth, x, 0, cz);
  bx(scene, 22, 0.4, len, matLane, x, TOP - 0.4 + 0.42, cz);
  for (let z = z0 + 6; z < z1; z += 10) { bx(scene, 1.4, 0.5, 3, matAuto, x - 5, TOP + 0.05, z, false); bx(scene, 1.4, 0.5, 3, matAuto, x + 5, TOP + 0.05, z, false); }
  marker(x, z0 + 8, '🤖', 'Làn AGV Tự Hành', 'BÃI TỰ ĐỘNG ↔ CẢNG CHÍNH', {
    'Vai trò': 'AGV không người lái luân chuyển container giữa bãi tự động & cảng',
    'Dẫn đường': 'Vạch từ tính / UWB + LiDAR', 'An toàn': 'Làn riêng, tách xe người lái',
    'Liên kết số': 'Điều phối bởi TOS/AI — chống va chạm', 'Trạng thái': '🟢 Tự động',
  });
  void matAccent;
}

export function initConnections() {
  gateSpine();
  powerLine();
  agvLink();
}
