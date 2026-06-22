/* ──────────────────────────────────────────────────────────────────────────
 * env/side-depot.js — RIGHT side yard: PORT EQUIPMENT DEPOT (hậu cần)
 *
 * Fills the right-hand lateral yard with the real support equipment a container
 * terminal needs off the operational quay: a truck WEIGHBRIDGE station (trạm
 * cân tải), rows of parked container shuttle TRUCKS (xe luân chuyển), REACH
 * STACKERS / empty-container handlers, a MAINTENANCE WORKSHOP (xưởng bảo trì),
 * a FUEL STATION (trạm nhiên liệu), and CHASSIS + EMPTY-CONTAINER stacks.
 *
 * Every piece is a clickable Group carrying researched, realistic Vietnamese
 * info (matches the panel contract used across the project: userData =
 * {isClickable, objType, data:{icon,name,subtitle,details}}). Geometry/materials
 * reuse core.js helpers; container colours reuse the shared cMats buckets.
 *
 * buildDepot(bounds) lays the zones out along z within the supplied side-yard
 * bounds, so the whole depot moves/scales with layout.js automatically.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, mat, cMats, bx, cy } from '../core.js';

const G = 5;   // platform top (local groups sit here; children use local y from 0)

/* ── Shared, realistic equipment materials ─────────────────────────────────── */
const matY = mat(0xe2ad24, 0.5, 0.35);          // safety-yellow machinery
const matSteel = mat(0x8b9197, 0.5, 0.6);       // bare steel
const matDark = mat(0x262b30, 0.6, 0.4);        // chassis / dark metal
const matTyre = mat(0x14171a, 0.85, 0.05);      // tyres
const matGlass = mat(0x23414c, 0.15, 0.6, 0x0a1c24, 0.3); // cab glass
const matCab = mat(0x2b3138, 0.3, 0.6);         // cab shell
const matWall = mat(0xc3ccc4, 0.7, 0.05);       // building wall (warm off-white)
const matRoof = mat(0x55655d, 0.8, 0.1);        // building roof (muted green-grey)
const matStripe = mat(0xd9b53a, 0.55, 0.2);     // hazard/safety stripe
const matWhite = mat(0xe6ebe4, 0.6, 0.05);
const matTank = mat(0xd0d6cf, 0.35, 0.4);       // fuel tank shell
const matRed = mat(0xb23b2e, 0.5, 0.2);
const matScreen = mat(0x0a1014, 0.4, 0.3, 0x18c08a, 0.6); // glowing digital sign
const matAccent = mat(0x15b88f, 0.4, 0.3);      // brand teal accent
const matCanopy = mat(0xeef1ec, 0.5, 0.1);      // clean white canopy
const matPave = mat(0x868b84, 0.92, 0.03);      // light forecourt concrete
const matStrip = mat(0xfff4d8, 0.3, 0.1, 0xfff0c8, 0.35); // soft lit strip (canopy underside)
const matGlassDk = mat(0x182a30, 0.15, 0.7, 0x081418, 0.25); // building glazing

const depotGroup = new THREE.Group();

const clickable = (g, icon, name, subtitle, details) => {
  g.userData = { isClickable: true, objType: 'depot', data: { icon, name, subtitle, details } };
};

/* ── Parked container shuttle truck (static, decorative) ───────────────────── */
function parkedTruck(x, z, ry, idx, cargoMat) {
  const g = new THREE.Group();
  g.position.set(x, G, z); g.rotation.y = ry;
  bx(g, 3.2, 2.4, 3.0, matCab, 0, 1.3, -3.3);                 // cab
  bx(g, 2.9, 1.0, 0.4, matGlass, 0, 2.6, -4.75);              // windshield
  bx(g, 3.4, 0.7, 9.0, matDark, 0, 0.9, 0.8);                 // chassis / trailer bed
  if (cargoMat) bx(g, 3.3, 2.6, 6.4, cargoMat, 0, 1.6, 1.6);  // 40ft container
  [[-1.6, -3.0], [1.6, -3.0], [-1.6, 1.5], [1.6, 1.5], [-1.6, 4.2], [1.6, 4.2]]
    .forEach(([wx, wz]) => { const w = cy(g, 0.8, 0.6, matTyre, wx, 0.0, wz); w.rotation.z = Math.PI / 2; });
  const plate = ['51C', '60C', '61C', '50H'][idx % 4] + '-' + (100 + idx * 7) + '.' + (10 + idx);
  clickable(g, '🚛', 'Xe Luân Chuyển ' + plate, 'XE TẢI NỘI BỘ — ĐANG ĐỖ', {
    'Biển số': plate,
    'Loại xe': 'Đầu kéo + rơ-moóc 40ft (terminal tractor)',
    'Nhiệm vụ': 'Luân chuyển container nội bộ giữa các bãi',
    'Tình trạng': cargoMat ? 'Đang chở container' : 'Rỗng — chờ điều phối',
    'Nhiên liệu': (45 + idx * 5 % 50) + '%',
    'Bãi đỗ': 'Depot thiết bị (khu phải)',
  });
  depotGroup.add(g);
}

/* ── Reach stacker / empty-container handler ───────────────────────────────── */
function reachStacker(x, z, ry, idx) {
  const g = new THREE.Group();
  g.position.set(x, G, z); g.rotation.y = ry;
  bx(g, 4.2, 2.2, 8.5, matY, 0, 0.9, 0);                      // counterweighted body
  bx(g, 3.0, 2.4, 3.0, matCab, 1.0, 3.0, -1.5);               // cab
  bx(g, 2.6, 1.4, 0.3, matGlass, 1.0, 3.5, -3.0);
  // big front wheels + smaller rear
  [[-2.0, -2.6], [2.0, -2.6]].forEach(([wx, wz]) => { const w = cy(g, 1.4, 1.0, matTyre, wx, -0.2, wz); w.rotation.z = Math.PI / 2; });
  [[-1.8, 3.0], [1.8, 3.0]].forEach(([wx, wz]) => { const w = cy(g, 1.0, 0.8, matTyre, wx, 0.0, wz); w.rotation.z = Math.PI / 2; });
  // telescopic boom angled up over the front
  const boom = bx(g, 1.2, 1.2, 13, matStripe, 0, 3.4, 2);
  boom.rotation.x = -0.5;
  const spreader = bx(g, 3.6, 0.8, 6.6, matDark, 0, 7.2, -6.2);
  void spreader;
  const code = 'RS-' + String(idx + 1).padStart(2, '0');
  clickable(g, '🏗️', 'Xe Nâng Reach Stacker ' + code, 'THIẾT BỊ XẾP DỠ — KHO RỖNG', {
    'Mã thiết bị': code,
    'Loại': 'Reach stacker (xe nâng với tới)',
    'Nhà sản xuất': ['Kalmar', 'Hyster', 'SANY', 'Konecranes'][idx % 4],
    'Sức nâng': (40 + (idx % 2) * 5) + ' tấn (xếp 5 tầng)',
    'Chức năng': 'Xếp dỡ & dồn container rỗng, hàng lẻ',
    'Trạng thái': '⚙️ Sẵn sàng vận hành',
  });
  depotGroup.add(g);
}

/* ── Weighbridge / truck scale station ─────────────────────────────────────── */
function weighbridge(x, z, idx) {
  const g = new THREE.Group();
  g.position.set(x, G, z);
  // sunken steel deck the truck drives onto (slightly raised + ramps)
  bx(g, 5.2, 0.5, 20, matSteel, 0, 0, 0);
  bx(g, 5.2, 0.3, 4, matDark, 0, 0, -12);                     // approach ramp
  bx(g, 5.2, 0.3, 4, matDark, 0, 0, 12);                      // exit ramp
  for (const sx of [-2.6, 2.6]) bx(g, 0.3, 0.6, 20, matStripe, sx, 0.5, 0); // edge rails
  // control booth beside the scale
  bx(g, 4, 3.2, 4, matWall, 5.5, 0, -2);
  bx(g, 3.2, 1.4, 0.2, matGlass, 5.5, 1.6, -4.05);
  bx(g, 4.4, 0.4, 4.4, matRoof, 5.5, 3.2, -2);
  // boom barrier + digital weight sign
  const arm = bx(g, 6, 0.3, 0.3, matStripe, 3, 2.4, 4);
  void arm;
  bx(g, 0.6, 5, 0.6, matWhite, -4, 0, 4);
  bx(g, 3, 1.6, 0.3, matScreen, -4, 4, 4.2);
  const code = 'CÂN-' + String(idx + 1).padStart(2, '0');
  clickable(g, '⚖️', 'Trạm Cân Tải ' + code, 'KIỂM SOÁT TẢI TRỌNG XE', {
    'Mã trạm': code,
    'Loại cân': 'Cân ô tô điện tử (weighbridge) 80 tấn',
    'Chiều dài bàn cân': '18 m',
    'Chức năng': 'Cân container vào/ra, chống quá tải',
    'Độ chính xác': '± 20 kg',
    'Lưu lượng': (30 + idx * 6) + ' lượt/giờ',
    'Trạng thái': '🟢 Đang hoạt động',
  });
  depotGroup.add(g);
}

/* ── Maintenance workshop (xưởng bảo trì) ───────────────────────────────────── */
function workshop(x, z, w, d) {
  const g = new THREE.Group();
  g.position.set(x, G, z);
  bx(g, w, 12, d, matWall, 0, 0, 0);                          // hall
  bx(g, w + 2, 2, d + 2, matRoof, 0, 12, 0);                  // roof overhang
  for (const dx of [-w / 4, w / 4]) bx(g, w / 5, 9, 0.4, matDark, dx, 0, -d / 2 - 0.1); // roller doors
  bx(g, w * 0.7, 5, 0.3, matStripe, 0, 0.2, -d / 2 - 0.2);    // door floor stripe
  clickable(g, '🔧', 'Xưởng Bảo Trì Thiết Bị', 'SỬA CHỮA & BẢO DƯỠNG', {
    'Chức năng': 'Bảo trì RTG, reach stacker, xe tải nội bộ',
    'Khoang sửa chữa': '4 khoang + cầu nâng',
    'Kho phụ tùng': 'Tích hợp trong xưởng',
    'Ca làm việc': '2 ca/ngày',
    'Trạng thái': '🟢 Đang vận hành',
  });
  depotGroup.add(g);
}

/* ── Fuel station (trạm nhiên liệu) — proper forecourt + canopy + tank farm ─── */
function fuelStation(x, z) {
  const g = new THREE.Group();
  g.position.set(x, G, z);

  // Forecourt slab with a painted edge band.
  bx(g, 30, 0.25, 24, matPave, 0, 0, 2);
  bx(g, 30, 0.3, 0.5, matStripe, 0, 0, -9.7);                 // entrance stop line

  // ── Canopy on slim steel columns, white soffit + teal fascia + lit strip ──
  const CY_H = 7.6;
  for (const cx of [-7.5, 7.5]) for (const cz of [-3.5, 4.5]) cy(g, 0.42, CY_H, matSteel, cx, 0, cz);
  bx(g, 19, 0.9, 12, matCanopy, 0, CY_H, 0.5);               // soffit slab
  bx(g, 19.6, 0.7, 12.6, matAccent, 0, CY_H + 0.9, 0.5);     // teal cap (slightly larger)
  bx(g, 19.6, 1.0, 0.4, matAccent, 0, CY_H - 0.2, -5.4);     // front fascia band
  bx(g, 15, 0.12, 8, matStrip, 0, CY_H - 0.12, 0.5, false);  // underside light panel

  // ── Three dispenser islands (curb + cabinet + topper + hose arm) ──────────
  for (const dx of [-5.5, 0, 5.5]) {
    bx(g, 2.6, 0.3, 4.4, matWhite, dx, 0.25, 0.5);            // raised island
    bx(g, 1.1, 2.1, 0.8, matCab, dx, 0.55, 0.5);             // pump cabinet
    bx(g, 1.2, 0.5, 0.9, matAccent, dx, 2.65, 0.5);          // illuminated topper
    bx(g, 0.7, 0.5, 0.1, matScreen, dx, 1.7, 0.91);          // pump display
    bx(g, 0.12, 0.12, 1.0, matDark, dx + 0.62, 1.7, 1.2);    // hose arm
  }

  // ── Tank farm behind, inside a bund (containment) enclosure ───────────────
  const tz = -8.5;
  for (const w of [-11, 11]) bx(g, 0.6, 1.6, 9, matWall, w, 0, tz);   // bund side walls
  bx(g, 22, 1.6, 0.6, matWall, 0, 0, tz - 4.2);                       // bund back wall
  for (const tx of [-6.5, 0, 6.5]) {
    bx(g, 0.7, 1.6, 5, matSteel, tx - 1.9, 0, tz);           // saddle supports
    bx(g, 0.7, 1.6, 5, matSteel, tx + 1.9, 0, tz);
    const t = cy(g, 1.7, 6.4, tx === 0 ? matRed : matTank, tx, 0.1, tz); // center y = 0.1+3.2 = 3.3
    t.rotation.x = Math.PI / 2;                              // horizontal along z (rests on saddles)
    bx(g, 1.0, 0.6, 1.0, matStripe, tx, 5.0, tz);            // top manway / vent
  }
  bx(g, 0.2, 4, 0.2, matSteel, 9.8, 0, tz + 2);              // vent stack
  bx(g, 5, 1.4, 0.3, matStripe, 0, 4.6, tz - 4.5, false);    // hazard label panel

  // ── Brand totem at the forecourt entrance ─────────────────────────────────
  cy(g, 0.5, 9, matSteel, -13.5, 0, 7);
  bx(g, 3.4, 4, 0.6, matAccent, -13.5, 6, 7);
  bx(g, 2.9, 2.4, 0.7, matScreen, -13.5, 7, 7.35);           // price/brand display

  clickable(g, '⛽', 'Trạm Nhiên Liệu Cảng', 'CẤP DẦU THIẾT BỊ NỘI BỘ', {
    'Loại nhiên liệu': 'Diesel DO 0,05S (lưu huỳnh thấp)',
    'Cột bơm': '3 trụ bơm tốc độ cao',
    'Sức chứa': '3 bồn ngầm × 30.000 lít',
    'Đối tượng phục vụ': 'Xe tải nội bộ, reach stacker, RTG diesel',
    'An toàn': 'Đê bao chống tràn + hệ thống báo & chữa cháy',
    'Trạng thái': '🟢 Sẵn sàng cấp phát',
  });
  depotGroup.add(g);
}

/* ── Depot control / admin office (modern 2-storey block) ──────────────────── */
function office(x, z) {
  const g = new THREE.Group();
  g.position.set(x, G, z);
  bx(g, 24, 4.2, 14, matWall, 0, 0, 0);                       // ground floor
  bx(g, 24.3, 1.7, 14.3, matGlassDk, 0, 4.0, 0);             // ground glazing band
  bx(g, 22, 3.8, 12.6, matWall, 0, 5.7, 0);                  // upper floor (set back)
  bx(g, 22.3, 1.6, 12.9, matGlassDk, 0, 7.5, 0);             // upper glazing band
  bx(g, 24, 0.6, 14, matRoof, 0, 9.5, 0);                    // roof parapet
  bx(g, 24.4, 0.4, 0.5, matAccent, 0, 9.0, -7);              // teal fascia
  // entrance canopy + door
  bx(g, 7, 0.4, 4, matAccent, 0, 3.0, -8.4);
  bx(g, 5, 3.0, 0.3, matGlassDk, 0, 0, -7.05);
  // rooftop plant + mast
  bx(g, 4, 1.6, 3, matSteel, -6, 10.1, 2);
  bx(g, 3, 1.2, 3, matSteel, 6, 10.1, -2);
  cy(g, 0.2, 6, matWhite, 9, 10.1, 5);
  clickable(g, '🏢', 'Văn Phòng Điều Hành Depot', 'TRUNG TÂM ĐIỀU PHỐI HẬU CẦN', {
    'Chức năng': 'Điều phối thiết bị, lệnh luân chuyển nội bộ',
    'Bộ phận': 'Điều độ · Kỹ thuật · An toàn (HSE)',
    'Kết nối': 'Liên kết hệ thống TOS của cảng chính',
    'Nhân sự ca': '12 người',
    'Trạng thái': '🟢 Đang trực vận hành',
  });
  depotGroup.add(g);
}

/* ── Entrance guard booth + boom barrier ───────────────────────────────────── */
function guardBooth(x, z) {
  const g = new THREE.Group();
  g.position.set(x, G, z);
  bx(g, 3.4, 3.2, 3.4, matWall, 0, 0, 0);
  bx(g, 2.6, 1.4, 0.2, matGlassDk, 0, 1.5, -1.75);
  bx(g, 2.6, 1.4, 0.2, matGlassDk, 1.75, 1.5, 0).rotation.y = Math.PI / 2;
  bx(g, 4, 0.4, 4, matAccent, 0, 3.2, 0);                     // flat roof w/ accent
  // boom barrier across the lane
  cy(g, 0.4, 2.4, matWhite, 3.5, 0, 0);
  const arm = bx(g, 7, 0.25, 0.25, matStripe, 7, 2.2, 0);
  void arm;
  clickable(g, '🛡️', 'Chốt Bảo Vệ — Cổng Depot', 'KIỂM SOÁT RA VÀO', {
    'Chức năng': 'Kiểm soát người & phương tiện ra vào depot',
    'Trang bị': 'Barrier tự động + camera nhận diện biển số',
    'Trực': '24/7',
    'Trạng thái': '🟢 Đang trực',
  });
  depotGroup.add(g);
}

/* ── A parked row of chassis / trailers ────────────────────────────────────── */
function chassisRow(x0, z, n) {
  const g = new THREE.Group();
  g.position.set(x0, G, z);
  for (let i = 0; i < n; i++) {
    const ox = i * 5;
    bx(g, 3.2, 0.6, 11, matDark, ox, 0.6, 0);                 // flatbed frame
    bx(g, 0.5, 1.2, 0.5, matSteel, ox, 0.0, -5);              // king-pin stand
    [[-1.3, -3], [1.3, -3], [-1.3, 3], [1.3, 3]].forEach(([wx, wz]) => {
      const w = cy(g, 0.7, 0.5, matTyre, ox + wx, 0.2, wz); w.rotation.z = Math.PI / 2;
    });
  }
  clickable(g, '🛻', 'Bãi Rơ-moóc / Chassis', 'LƯU TRỮ SƠ-MI RƠ-MOÓC', {
    'Số lượng': n + ' rơ-moóc 40ft',
    'Loại': 'Chassis chuyên dụng chở container',
    'Chức năng': 'Dự phòng, ghép đầu kéo khi cần',
    'Trạng thái': 'Đang lưu bãi',
  });
  depotGroup.add(g);
}

/* ── A few stacks of EMPTY containers ──────────────────────────────────────── */
function emptyStacks(x0, z0) {
  const g = new THREE.Group();
  g.position.set(x0, G, z0);
  for (let s = 0; s < 4; s++) {
    const sx = s * 5;
    const tiers = 4 + (s % 3);
    for (let t = 0; t < tiers; t++) {
      bx(g, 3.4, 2.5, 8, cMats[(s + t) % cMats.length], sx, t * 2.55, 0);
    }
  }
  clickable(g, '📦', 'Kho Container Rỗng', 'EMPTY CONTAINER DEPOT', {
    'Loại': "Container rỗng 20'/40' chờ tái sử dụng",
    'Xếp chồng': '4–6 tầng',
    'Thiết bị phục vụ': 'Reach stacker',
    'Hãng lưu ký': 'MSC, Maersk, ONE, CMA CGM',
    'Trạng thái': 'Đang lưu bãi',
  });
  depotGroup.add(g);
}

/* ── Lay the depot out within the supplied side-yard bounds ─────────────────── */
export function buildDepot(b) {
  scene.add(depotGroup);
  const cx = (b.minX + b.maxX) / 2;
  const W = b.maxX - b.minX, D = b.maxZ - b.minZ;
  const zAt = (f) => b.minZ + D * f;             // fractional z helper

  // Zone 0 — Entrance: control office + guard booth (front / inner edge)
  office(cx + W * 0.20, zAt(0.06));
  guardBooth(b.minX + 9, zAt(0.40));

  // Zone 1 — Weighbridges (front, near the gate/quay approach)
  weighbridge(cx - W * 0.24, zAt(0.16), 0);
  weighbridge(cx - W * 0.06, zAt(0.16), 1);

  // Zone 2 — Parked shuttle trucks (two rows)
  for (let i = 0; i < 6; i++) {
    const withCargo = i % 3 !== 0;
    parkedTruck(b.minX + 16 + i * 13, zAt(0.34), 0, i, withCargo ? cMats[i % cMats.length] : null);
    parkedTruck(b.minX + 16 + i * 13, zAt(0.46), Math.PI, i + 3, i % 2 ? cMats[(i + 1) % cMats.length] : null);
  }

  // Zone 3 — Chassis park + reach stackers + empty stacks
  chassisRow(b.minX + 16, zAt(0.60), 6);
  reachStacker(cx + W * 0.18, zAt(0.62), -0.6, 0);
  reachStacker(cx + W * 0.30, zAt(0.66), 2.2, 1);
  emptyStacks(b.minX + W * 0.50, zAt(0.70));

  // Zone 4 — Maintenance workshop + fuel station (back, landward)
  workshop(cx - W * 0.24, zAt(0.88), 44, 28);
  fuelStation(cx + W * 0.24, zAt(0.85));

  return depotGroup;
}
