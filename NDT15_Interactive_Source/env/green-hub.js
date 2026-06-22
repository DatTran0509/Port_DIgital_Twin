/* ──────────────────────────────────────────────────────────────────────────
 * env/green-hub.js — GREEN ENERGY HUB (landward strip, left)
 *
 * The decarbonisation story investors now demand (IMO 2040 / EU ETS): on-site
 * GREEN HYDROGEN production + storage + bunkering, a battery ENERGY STORAGE
 * system (BESS), and an electric CHARGING station for e-RTG / e-trucks — fed by
 * the existing wind + solar + shore-power assets. Each cluster is clickable with
 * realistic data. Derived from layout.landwardZones().green.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, mat, bx, cy, sp } from '../core.js';
import { landwardZones } from '../layout.js';

const Y = 5.0;   // coplanar with the main port apron (integrated platform)
const matPad = mat(0x6c706a, 0.95, 0.03);
const matWall = mat(0xeef1ec, 0.5, 0.1);
const matAccent = mat(0x1f9d6b, 0.4, 0.3);       // green H2 accent
const matSteel = mat(0x9aa0a6, 0.4, 0.6);
const matTank = mat(0xd6dad3, 0.3, 0.5);
const matRoof = mat(0x4f5e57, 0.8, 0.1);
const matBatt = mat(0x2c333a, 0.5, 0.4);         // battery container
const matLed = mat(0x0f2e28, 0.4, 0.3, 0x21d18a, 0.7);
const matPipe = mat(0xb8bdb6, 0.4, 0.6);

const clickable = (g, icon, name, subtitle, details) => {
  g.userData = { isClickable: true, objType: 'green', data: { icon, name, subtitle, details } };
};

function hydrogenPlant(x, z) {
  const g = new THREE.Group(); g.position.set(x, Y, z); scene.add(g);
  // Electrolyzer hall
  bx(g, 26, 11, 16, matWall, 0, 0, 0);
  bx(g, 27, 1.6, 17, matRoof, 0, 11, 0);
  bx(g, 27, 0.5, 0.4, matAccent, 0, 10.4, -8.3);
  // Vertical H2 storage tanks
  for (let i = 0; i < 4; i++) cy(g, 1.6, 13, matTank, -8 + i * 3.0, 0, 12);
  bx(g, 14, 1.0, 4, matSteel, -3.5, 0, 12);            // tank skid base
  // Spherical high-pressure tanks
  sp(g, 3.2, matTank, 13, 4.5, 8); sp(g, 3.2, matTank, 13, 4.5, 1);
  bx(g, 1.2, 4.5, 1.2, matSteel, 13, 0, 8); bx(g, 1.2, 4.5, 1.2, matSteel, 13, 0, 1);
  // Pipework
  for (const pz of [10, 12, 14]) cy(g, 0.25, 18, matPipe, -3.5, 6, pz).rotation.z = Math.PI / 2;
  // H2 bunkering dispenser
  bx(g, 2, 3, 1.4, matAccent, -14, 0, -6);
  bx(g, 0.2, 0.2, 3, matPipe, -13, 2, -4.5);
  clickable(g, '🟢', 'Nhà Máy Hydro Xanh', 'SẢN XUẤT & NẠP NHIÊN LIỆU SẠCH', {
    'Công nghệ': 'Điện phân (electrolyzer) dùng điện gió/mặt trời',
    'Công suất': '20 MW · ~8 tấn H₂/ngày',
    'Lưu trữ': '4 bồn đứng + 2 bồn cầu cao áp',
    'Ứng dụng': 'Nạp tàu chạy H₂, xe nâng pin nhiên liệu',
    'Phát thải': 'Không CO₂ (green hydrogen)', 'Trạng thái': '🟢 Đang sản xuất',
  });
}

function bessFarm(x, z) {
  const g = new THREE.Group(); g.position.set(x, Y, z); scene.add(g);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    const bx0 = -18 + c * 12, bz0 = r * 6;
    bx(g, 9, 3, 3.2, matBatt, bx0, 0, bz0);             // battery container
    bx(g, 9, 0.4, 3.4, matSteel, bx0, 3, bz0);
    bx(g, 0.6, 0.5, 0.4, matLed, bx0 - 3.5, 1.6, bz0 - 1.7); // status LED
  }
  // Inverter / transformer cabinets
  for (const ix of [-18, 18]) { bx(g, 3, 3.4, 2.4, matSteel, ix, 0, 12); bx(g, 3.2, 0.5, 2.6, matLed, ix, 3.4, 12); }
  clickable(g, '🔋', 'Hệ Thống Pin Lưu Trữ (BESS)', 'CÂN BẰNG TẢI & LƯU ĐIỆN TÁI TẠO', {
    'Dung lượng': '40 MWh (8 khối container)',
    'Công suất': '20 MW nạp/xả',
    'Chức năng': 'Tích điện gió/mặt trời, cấp lúc cao điểm & sự cố',
    'Lợi ích': 'Giảm phụ thuộc lưới, ổn định điện bờ', 'Trạng thái': '🟢 85% SoC — đang nạp',
  });
}

function chargingStation(x, z) {
  const g = new THREE.Group(); g.position.set(x, Y, z); scene.add(g);
  bx(g, 22, 0.25, 12, matPad, 0, 0, 0);
  for (const cx of [-9, 9]) for (const cz of [-4, 4]) cy(g, 0.4, 6.5, matSteel, cx, 0.25, cz);
  bx(g, 24, 0.7, 13, matWall, 0, 6.5, 0);              // canopy
  bx(g, 24.4, 0.4, 0.5, matAccent, 0, 6.2, -6.3);
  for (const px of [-6, 0, 6]) { bx(g, 1, 2.2, 1, matSteel, px, 0.25, 0); bx(g, 1.1, 0.5, 1.1, matLed, px, 2.45, 0); }
  clickable(g, '⚡', 'Trạm Sạc Thiết Bị Điện', 'E-RTG / E-TRUCK CHARGING', {
    'Trụ sạc': '6 trụ DC nhanh (350 kW)',
    'Đối tượng': 'Xe tải điện, e-RTG, reach stacker điện',
    'Nguồn': 'Điện tái tạo + BESS', 'Lợi ích': 'Vận hành bãi không phát thải tại chỗ',
    'Trạng thái': '🟢 4/6 trụ đang sạc',
  });
}

export function initGreenHub() {
  const b = landwardZones().green;
  const cx = (b.minX + b.maxX) / 2;
  // Raised pad (fills land → apron height so the hub is coplanar with the port).
  bx(scene, (b.maxX - b.minX) + 10, Y, b.depth + 10, matPad, cx, 0, b.midZ);
  hydrogenPlant(cx, b.front + 34);
  bessFarm(cx, b.midZ + 18);
  chargingStation(cx, b.back - 22);
}
