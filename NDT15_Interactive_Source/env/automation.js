/* ──────────────────────────────────────────────────────────────────────────
 * env/automation.js — AUTOMATED TERMINAL showcase (landward strip, right)
 *
 * The flagship "next-gen port" feature (à la Singapore Tuas, fully automated /
 * unmanned): a driverless AGV fleet circulating an automated guided loop, and
 * automated stacking cranes (ASC) working an instanced container block on their
 * own. Self-running, no driver cabs. Derived from layout.landwardZones().auto.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, M, mat, cMats, bx, cy, dummy } from '../core.js';
import { landwardZones, apronBounds } from '../layout.js';

const Y = 5.0;   // coplanar with the main port apron (integrated platform)
const matPad = mat(0x55585e, 0.95, 0.03);
const matLane = mat(0x3f4247, 0.95, 0.02);
const matAgv = mat(0x232a31, 0.5, 0.5);
const matAgvY = mat(0xe2ad24, 0.5, 0.35);
const matSensor = mat(0x0f2e28, 0.4, 0.3, 0x21d18a, 0.8);
const matSteel = mat(0x8b9197, 0.5, 0.6);

const matWhite = mat(0xffffff, 0.8);
const matPad2 = mat(0x55585e, 0.95, 0.03);

const agvs = [];
const ascs = [];
const shuttles = [];   // AGVs that run the lane connecting the automated yard ↔ main port
const tractors = [];   // terminal tractors on the 2-lane access road (in + out)
let loop = null;       // { cx, cz, ra, rb }
let t = 0;

function buildAGV(idx) {
  const g = new THREE.Group(); scene.add(g);
  bx(g, 9, 1.0, 3.2, matAgv, 0, 0.4, 0);                 // chassis
  bx(g, 9.2, 0.3, 3.4, matAgvY, 0, 1.4, 0);              // deck w/ yellow edge
  bx(g, 8.6, 2.6, 3.0, cMats[idx % cMats.length], 0, 1.6, 0);  // carried container
  bx(g, 0.6, 0.5, 0.5, matSensor, 4.4, 0.6, 1.4);        // LiDAR/nav sensor pods
  bx(g, 0.6, 0.5, 0.5, matSensor, 4.4, 0.6, -1.4);
  for (const wx of [-3, 3]) for (const wz of [-1.5, 1.5]) { const w = cy(g, 0.6, 0.4, M.crane, wx, 0.0, wz); w.rotation.z = Math.PI / 2; }
  g.userData = {
    isClickable: true, objType: 'auto',
    data: {
      icon: '🤖', name: 'AGV Tự Hành ' + String(idx + 1).padStart(2, '0'), subtitle: 'XE DẪN ĐƯỜNG TỰ ĐỘNG — KHÔNG NGƯỜI LÁI',
      details: {
        'Loại': 'Automated Guided Vehicle (AGV)', 'Dẫn đường': 'LiDAR + định vị từ tính/UWB',
        'Tải': '1 container 40ft', 'Năng lượng': 'Pin điện — sạc tự động',
        'Vận hành': '24/7 không người lái', 'Trạng thái': '🟢 Đang vận chuyển',
      },
    },
  };
  agvs.push(g);
}

function buildASC(x, b) {
  const g = new THREE.Group(); g.position.set(x, Y, b.midZ - 4); scene.add(g);
  const span = 26, H = 17;
  for (const sz of [-span / 2, span / 2]) { bx(g, 1.3, H, 1.3, matSteel, -3.5, 0, sz); bx(g, 1.3, H, 1.3, matSteel, 3.5, 0, sz); }
  bx(g, 8, 1.5, span + 2, matSteel, 0, H, 0);
  bx(g, 10, 0.9, 2.2, M.craneY, 0, H + 0.7, 0);
  const trolley = bx(g, 2.6, 1.2, 3.6, M.craneY, 0, H - 1.3, 0);
  const spreader = bx(g, 3.0, 0.5, 6.0, matAgv, 0, H - 7, 0);
  g.userData = {
    isClickable: true, objType: 'auto',
    data: {
      icon: '🏗️', name: 'Cẩu Xếp Tự Động (ASC)', subtitle: 'AUTOMATED STACKING CRANE — KHÔNG NGƯỜI',
      details: { 'Loại': 'Automated Stacking Crane', 'Nhịp': span + ' m', 'Điều khiển': 'Hoàn toàn tự động qua TOS/AI', 'Sức nâng': '40 tấn', 'Trạng thái': '⚙️ Tự động xếp dỡ' },
    },
  };
  ascs.push({ trolley, spreader, phase: x });
}

function buildAutoStack(b) {
  const buckets = cMats.map(() => []);
  const x0 = b.minX + 26, z0 = b.midZ - 6, cols = 7, rows = 9;     // bigger automated block
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const tiers = 2 + ((c * 7 + r * 3) % 5);
    for (let tt = 0; tt < tiers; tt++) buckets[(c + r + tt) % cMats.length].push([x0 + c * 4.4, Y + 1.3 + tt * 2.65, z0 - 13 + r * 3.1]);
  }
  const geo = new THREE.BoxGeometry(4, 2.5, 2.9);
  buckets.forEach((poses, ci) => {
    if (!poses.length) return;
    const im = new THREE.InstancedMesh(geo, cMats[ci], poses.length);
    im.castShadow = im.receiveShadow = true;
    poses.forEach((p, i) => { dummy.position.set(p[0], p[1], p[2]); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.instanceMatrix.needsUpdate = true; scene.add(im);
  });
}

function buildShuttle(laneX, zNear, zFar, i) {
  const g = new THREE.Group();
  g.position.set(laneX, Y, zNear + (zFar - zNear) * (i / 3));
  g.rotation.y = Math.PI / 2;                 // long axis along z (= travel direction)
  scene.add(g);
  bx(g, 9, 1.0, 3.2, matAgv, 0, 0.4, 0);
  bx(g, 9.2, 0.3, 3.4, matAgvY, 0, 1.4, 0);
  bx(g, 8.4, 2.6, 3.0, cMats[i % cMats.length], 0, 1.6, 0);
  bx(g, 0.6, 0.5, 0.5, matSensor, 4.4, 0.6, 0);
  for (const wx of [-3, 3]) for (const wz of [-1.5, 1.5]) { const w = cy(g, 0.55, 0.4, M.crane, wx, 0.0, wz); w.rotation.z = Math.PI / 2; }
  g.userData = {
    isClickable: true, objType: 'auto',
    data: {
      icon: '🔗', name: 'AGV Kết Nối Bãi Tự Động ↔ Cảng Chính', subtitle: 'TUYẾN TRUNG CHUYỂN TỰ ĐỘNG',
      details: { 'Tuyến': 'Bãi xếp tự động ↔ bãi container cảng chính', 'Nhiệm vụ': 'Đệm tải & tái phân phối container theo lệnh TOS', 'Dẫn đường': 'Làn riêng có vạch dẫn từ tính', 'Trạng thái': '🟢 Đang trung chuyển' },
    },
  };
  shuttles.push({ g, zNear, zFar, ph: i * 1.6 });
}

// ── ONE-WAY tractor LOOP (two lanes, but all vehicles circulate the same way →
//    no head-on) + a delivery bay that off-loads containers into the main yard ──
let troad = null, dropGantry = null;
function buildTractorRoad(b) {
  const cx = 123, zP = apronBounds().maxZ - 6, zT = b.front + 70;     // port end / terminal end
  const cz = (zP + zT) / 2, rz = (zT - zP) / 2, rx = 9;
  troad = { cx, cz, rx, rz };
  // Embankment grounding the loop across the valley to the main port.
  bx(scene, 32, Y, (b.front - apronBounds().maxZ) + 14, matPad2, cx, 0, (apronBounds().maxZ + b.front) / 2);
  // Two-lane carriageway slab (vehicles run a one-way oval on it) + centre divider.
  bx(scene, (rx + 6) * 2, 0.42, rz * 2 + 12, matLane, cx, Y - 0.4, cz);
  for (let z = zP + 4; z < zT; z += 9) bx(scene, 0.5, 0.5, 4, matWhite, cx, Y + 0.05, z, false);
  buildDropGantry(cx, zP + 8);
}

function buildTractor(i) {
  const g = new THREE.Group(); g.position.set(troad.inX, Y, troad.zP); scene.add(g);
  bx(g, 3.2, 2.4, 3.2, matAgv, 0, 1.0, 3.2);                          // cab (front toward +z)
  bx(g, 2.9, 0.9, 0.3, matSensor, 0, 2.4, 4.75);                      // windshield/sensor
  bx(g, 3.4, 0.7, 9, mat(0x262b30, 0.6, 0.4), 0, 0.7, -0.6);          // chassis/trailer bed
  const box = bx(g, 3.3, 2.6, 6.4, cMats[i % cMats.length], 0, 1.4, -1.4);
  box.visible = false;
  for (const wx of [-1.5, 1.5]) for (const wz of [-3, 0.5, 4]) { const w = cy(g, 0.7, 0.5, M.crane, wx, 0.0, wz); w.rotation.z = Math.PI / 2; }
  g.userData = {
    isClickable: true, objType: 'auto',
    data: {
      icon: '🚛', name: 'Xe Đầu Kéo Nội Bộ ' + (i + 1), subtitle: 'TRUNG CHUYỂN BẾN TỰ ĐỘNG ↔ BÃI CHÍNH',
      details: { 'Loại': 'Đầu kéo + rơ-moóc 40ft', 'Tuyến': '2 làn (vào/ra) — không đối đầu', 'Nhiệm vụ': 'Nhận container từ cẩu ASC chở về bãi chính', 'Trạng thái': '🟢 Đang luân chuyển' },
    },
  };
  tractors.push({ g, box, a: (i / 4) * Math.PI * 2 });
}

function buildDropGantry(x, z) {
  const g = new THREE.Group(); g.position.set(x, Y, z); scene.add(g);
  const H = 14;
  for (const lx of [-13, 13]) for (const lz of [-6, 6]) bx(g, 1.2, H, 1.2, matSteel, lx, 0, lz);
  bx(g, 28, 1.4, 14, matSteel, 0, H, 0);                              // top beam frame
  const trolley = bx(g, 2.6, 1.2, 3.6, matAgvY, 0, H - 1.2, 0);
  const spreader = bx(g, 3.2, 0.5, 6.2, matAgv, 0, H - 6, 0);
  const cargo = bx(g, 3.2, 2.5, 6, cMats[2], 0, H - 7.6, 0); cargo.visible = false;
  // Delivery stack — in the loop MEDIAN (between the two lanes), clear of the road.
  for (let s = 0; s < 4; s++) for (let tt = 0; tt < 2 + (s % 2); tt++) bx(g, 3.2, 2.5, 6, cMats[(s + tt) % cMats.length], 0, 1.3 + tt * 2.6, 14 + s * 7, false);
  g.userData = {
    isClickable: true, objType: 'auto',
    data: { icon: '🏗️', name: 'Cẩu Giao Hàng Vào Bãi Chính', subtitle: 'BỐC CONTAINER TỪ XE → XẾP VÀO BÃI', details: { 'Chức năng': 'Hạ container từ xe đầu kéo & xếp vào bãi cảng chính', 'Cơ chế': 'Cẩu giàn tại điểm giao, đồng bộ với xe trung chuyển', 'Trạng thái': '🟢 Đang giao hàng' } },
  };
  dropGantry = { spreader, cargo, hi: H - 6, lo: H - 11 };
}

// Live AGV / shuttle registries for the Copilot locator ("xe trung chuyển").
export function getAgvs() { return agvs; }
export function getShuttles() { return shuttles; }

export function initAutomation() {
  const b = landwardZones().auto;
  const cx = (b.minX + b.maxX) / 2;
  bx(scene, (b.maxX - b.minX) + 10, Y, b.depth + 10, matPad, cx, 0, b.midZ);   // raised platform

  // Automated guided loop lane (visual oval) on the pad.
  loop = { cx, cz: b.back - 40, ra: (b.maxX - b.minX) / 2 - 16, rb: 26 };
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.min(loop.ra, loop.rb) - 4, Math.min(loop.ra, loop.rb) + 4, 48),
    matLane);
  ring.rotation.x = -Math.PI / 2; ring.scale.set(loop.ra / Math.min(loop.ra, loop.rb), loop.rb / Math.min(loop.ra, loop.rb), 1);
  ring.position.set(loop.cx, Y + 0.06, loop.cz); scene.add(ring);

  buildAutoStack(b);
  buildASC(b.minX + 30, b);
  buildASC(b.minX + 62, b);
  buildASC(b.minX + 94, b);
  for (let i = 0; i < 4; i++) buildAGV(i);

  // Connecting shuttle AGVs — run the lane (x≈140) joining this automated yard
  // Terminal tractors on a ONE-WAY loop delivering containers into the main yard.
  buildTractorRoad(b);
  for (let i = 0; i < 4; i++) buildTractor(i);

  // Zone sign / control kiosk.
  const sg = new THREE.Group(); sg.position.set(b.maxX - 16, Y, b.front - 6); scene.add(sg);
  bx(sg, 1, 11, 1, matSteel, -5, 0, 0); bx(sg, 1, 11, 1, matSteel, 5, 0, 0);
  bx(sg, 12, 3.2, 0.5, mat(0x12303f, 0.4, 0.3, 0x21d18a, 0.55), 0, 8, 0);
  sg.userData = {
    isClickable: true, objType: 'auto',
    data: {
      icon: '🛰️', name: 'Bãi Tự Động Hoá (Automated Terminal)', subtitle: 'KHO XẾP TỰ ĐỘNG & TRUNG CHUYỂN AGV',
      details: {
        'Công dụng': 'Bãi xếp container TỰ ĐỘNG hoàn toàn — nhận hàng dư tải từ bãi chính & ga tàu hoả, xếp/dồn không người lái 24/7',
        'Thiết bị': 'Cẩu xếp tự động ASC + đội AGV không người lái',
        'Luồng hàng': 'AGV chở container theo làn riêng nối bãi chính ↔ bãi tự động (xem làn AGV)',
        'Điều phối': 'AI / Terminal Operating System (TOS) — chống va chạm, tối ưu lộ trình',
        'Vì sao cần': 'Tăng sức chứa & năng suất (+30%), chạy đêm không cần đèn/nhân công',
        'Năng lực': '~6.000 TEU lưu trữ tự động', 'Trạng thái': '🟢 Tự động hoàn toàn',
      },
    },
  };
}

export function updateAutomation(dt) {
  t += dt;
  agvs.forEach((g, i) => {
    const a = t * 0.18 + (i / agvs.length) * Math.PI * 2;
    const vx = -loop.ra * Math.sin(a), vz = loop.rb * Math.cos(a);
    g.position.set(loop.cx + loop.ra * Math.cos(a), Y, loop.cz + loop.rb * Math.sin(a));
    g.rotation.y = Math.atan2(-vz, vx);
  });
  ascs.forEach((r, i) => {
    const z = Math.sin(t * 0.7 + i) * 9;
    r.trolley.position.z = z; r.spreader.position.z = z;
    r.spreader.position.y = (17 - 7) + Math.sin(t * 1.3 + i) * 2.2;
  });
  // Connecting shuttles (kept for any legacy instances) ferry along their lane.
  shuttles.forEach((s) => {
    const p = (Math.sin(t * 0.5 + s.ph) + 1) / 2;
    s.g.position.z = s.zNear + (s.zFar - s.zNear) * p;
  });

  // Terminal tractors circulate the ONE-WAY oval (so they never meet head-on):
  // loaded by the ASC at the terminal (top), carry DOWN, and drop at the yard
  // bay (bottom) where the gantry off-loads them into the main yard.
  if (troad) {
    const TWO = Math.PI * 2, n = tractors.length, minGap = (TWO / n) * 0.5;
    tractors.forEach((tk) => {
      // Collision avoidance (car-following): find the gap to the nearest tractor
      // AHEAD on the one-way loop and STOP if it's closing in (no rear-ending).
      let gap = TWO;
      tractors.forEach((o) => { if (o !== tk) { const d = ((o.a - tk.a) % TWO + TWO) % TWO; if (d > 1e-3 && d < gap) gap = d; } });
      let spd = 0.12;
      if (Math.sin(tk.a) < -0.7) spd = 0.04;          // slow through the delivery bay
      if (gap < minGap) spd = 0;                       // hold to keep a safe gap
      tk.a = (tk.a + spd * dt) % TWO;
      const a = tk.a, vx = -troad.rx * Math.sin(a), vz = troad.rz * Math.cos(a);
      tk.g.position.set(troad.cx + troad.rx * Math.cos(a), Y, troad.cz + troad.rz * Math.sin(a));
      tk.g.rotation.y = Math.atan2(vx, vz);
      tk.box.visible = vz < 0 && Math.sin(a) > -0.82;  // carrying down; dropped at the bay
    });
  }
  // Delivery-bay gantry off-loading containers into the main yard.
  if (dropGantry) {
    const c = (t * 0.45) % 1, k = c < 0.5 ? c / 0.5 : (1 - c) / 0.5;
    dropGantry.spreader.position.y = dropGantry.hi - k * (dropGantry.hi - dropGantry.lo);
    dropGantry.cargo.position.y = dropGantry.spreader.position.y - 1.6;
    dropGantry.cargo.visible = c > 0.2 && c < 0.8;
  }
}
