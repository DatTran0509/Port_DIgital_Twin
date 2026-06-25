/* ──────────────────────────────────────────────────────────────────────────
 * sim/locate.js — Live entity locator for the Copilot
 *
 * Answers questions about SPECIFIC running objects by querying the live
 * registries (vessels, trucks, yard blocks, RTG cranes, trains), then HIGHLIGHTS
 * the object and FOCUSES the camera on it. Examples it resolves:
 *   "bãi container 15 nằm ở đâu" · "tàu OCEAN đang làm gì" ·
 *   "xe nào đang bốc dỡ bãi số 3" · "tàu hỏa nào đang đến lấy hàng"
 *
 * If it can't pin down a concrete instance it returns { handled:false } so the
 * Copilot falls back to the static knowledge base.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { camera } from '../core.js';
import { vessels } from '../ships.js';
import { trucks } from '../trucks.js';
import { blocks, blockData } from '../yard/blocks.js';
import { getTrains } from '../env/rail-terminal.js';
import { getAgvs } from '../env/automation.js';
import { gatePosition, apronBounds, landwardStrip, landwardZones, sideOuterX, sideYardBounds, railFlank, berthX, PARAMS } from '../layout.js';
import { flyTo } from './camera.js';
import { highlight } from './highlight.js';
import { focusObject } from '../interaction/raycast-follow.js';
import { showObjectInfo } from '../ui.js';
import { isUnderground, leaveUnderground } from '../env/underground.js';

const strip = s => (s || '').toLowerCase().normalize('NFD').split('').map(c=>{const k=c.charCodeAt(0);return (k>=768&&k<=879)?'':(k===273?'d':c);}).join('');

// Lift the basement confinement before flying to a surface target, so the view
// actually rises out of the underground instead of staying clamped below it.
export function surface() { if (isUnderground()) leaveUnderground(); }

function focusAt(x, y, z, radius) {
  surface();
  const r = Math.max(20, radius);
  flyTo({ x: x + r * 0.4, y: y + r * 1.8 + 35, z: z + r * 1.9 + 55 }, { x, y, z }, 1500);
}

function truckState(tk) {
  const s = tk.state;
  if (s === 0) return 'đang tiến vào cổng';
  if (s === 1 || s === 1.7) return 'đang kiểm tra tại cổng (check-in)';
  if (s === 2) return 'đang chạy vào bãi đích';
  if (s === 3 || s === 3.5) return tk.isImport ? 'đang được cẩu dỡ container xuống bãi' : 'đang được cẩu bốc container lên xe';
  if (s === 3.6 || s === 6) return 'đang rời bãi tìm đường ra cổng';
  if (s === 6.2 || s === 6.5) return 'đang kiểm tra check-out';
  if (s === 7) return 'đã xong, đang rời cảng';
  return 'đang lưu thông trong cảng';
}

function blockNumber(qn) {
  if (!/\b(bai|block|khoi|container|lo)\b/.test(qn)) return null;
  const nums = qn.match(/\d{1,2}/g);
  if (!nums) return null;
  for (const x of nums) { const n = +x; if (n >= 1 && n <= blocks.length) return n; }
  return null;
}

function matchVessel(qn) {
  let best = null, bs = 0;
  for (const v of vessels) {
    let s = 0;
    for (const tk of strip(v.nm).split(' ')) if (tk.length >= 3 && qn.includes(tk)) s++;
    if (s > bs) { bs = s; best = v; }
  }
  return bs > 0 ? best : null;
}

/* ── Static landmark registry (any fixed facility → fly + highlight + info) ──
 * Positions derive from layout zones so they track the parametric layout. */
const _gz = landwardZones(), _lz = landwardStrip(), _gp = gatePosition(), _ap = apronBounds();
const _onX = Math.abs(sideOuterX('R')) + 130, _sL = sideYardBounds('L'), _rf = railFlank('L');
const cZ = b => (b.minZ + b.maxZ) / 2, cX = b => (b.minX + b.maxX) / 2;
const LANDMARKS = [
  { re: /hydro|green hub|nang luong xanh|nha may hydro|hydrogen|bess|tram sac|sac dien|pin luu tru|de\-?carbon/, x: cX(_gz.green), y: 12, z: _lz.midZ, r: 80, icon: '🟢', name: 'Green Energy Hub (Hydro · BESS · Sạc)', info: 'Trung tâm năng lượng xanh: sản xuất & lưu trữ HYDRO, pin BESS, trạm sạc e-RTG/e-truck — cấp điện sạch cho cảng & tàu.' },
  { re: /pin mat troi|nang luong mat troi|solar|dien mat troi|tam pin|panel|quang dien/, x: 360, y: 24, z: _lz.midZ, r: 55, icon: '☀️', name: 'Hệ pin mặt trời', info: 'Dàn pin mặt trời trên mái kho, thu điện ban ngày, hòa cùng điện gió tạo microgrid.' },
  { re: /tuabin|tua bin|dien gio|wind|cot gio|turbine|phong dien|tu bin/, x: _onX, y: 55, z: 100, r: 90, icon: '🌬️', name: 'Trang trại tuabin gió', info: 'Tuabin gió trên bờ và ngoài khơi, ~2.5MW mỗi tổ — nguồn năng lượng tái tạo chính của cảng.' },
  { re: /ben tu dong|automation|tu dong hoa|terminal tu dong|\basc\b|cau tu dong/, x: cX(_gz.auto), y: 14, z: _lz.midZ, r: 90, icon: '🤖', name: 'Bến tự động hóa (AGV/ASC)', info: 'Bến không người lái: đội AGV tự hành + cẩu ASC xếp dỡ tự động 24/7.' },
  { re: /duong sat|\brail\b|ga tau|on dock rail|lien van|ga hang/, x: cX(_rf), y: 14, z: cZ(_rf), r: 80, icon: '🚆', name: 'Ga đường sắt on-dock', info: 'Ga đường sắt cạnh bãi: cẩu RMG chuyển container thẳng giữa tàu hỏa và bãi (liên vận đa phương thức).' },
  { re: /radar|rada/, x: _ap.maxX + 17, y: 30, z: 12, r: 45, icon: '📡', name: 'Trạm Radar an ninh', info: 'Radar ven biển quét 360° bán kính 5km, phát hiện mục tiêu lạ rồi điều drone.' },
  { re: /bai phu|side yard|kho ton|bai ton|bai luu tru|bai thiet bi|\bdepot\b|bai ben canh|bai trai|bai phai/, x: cX(_sL), y: 14, z: cZ(_sL), r: 90, icon: '📦', name: 'Bãi phụ (lưu trữ / thiết bị)', info: 'Hai bãi phụ hai bên cảng: bãi lưu trữ container (trái) và depot thiết bị (phải), nối ngầm qua hầm logistics.' },
  { re: /control tower|thap dieu khien|thap chi huy|trung tam dieu hanh|dieu hanh tong|thap quan ly/, x: 0, y: 30, z: _gp.z + 40, r: 55, icon: '🗼', name: 'Tháp Điều Khiển', info: 'Trung tâm điều hành tổng — tổng hợp 15 lớp dữ liệu để giám sát & ra lệnh toàn cảng.' },
  { re: /\bcong\b|gate|barrier|alpr|cong cang/, x: _gp.x, y: 12, z: _gp.z, r: 45, icon: '🚪', name: 'Cổng tự động', info: 'Cổng ALPR nhận diện biển số, đối chiếu lệnh điện tử và mở barrier dưới 2 giây.' },
  { re: /cau bo|cau boc|\bsts\b|cau gian|cau quay|cau cau tau/, x: berthX()[2], y: 46, z: PARAMS.BERTH_Z, r: 55, icon: '🏗️', name: 'Cẩu STS (bốc dỡ tàu)', info: 'Cẩu giàn bờ (Ship-To-Shore) bốc/dỡ container giữa tàu và bãi.' },
  { re: /\bdrone\b|uav|may bay khong nguoi/, x: 150, y: 42, z: 6, r: 60, icon: '🚁', name: 'Drone UAV tuần tra', info: 'UAV tuần tra an ninh vành đai, cất cánh trong 30s khi radar báo động.' },
];
function landmarkMatch(qn) { return LANDMARKS.find(l => l.re.test(qn)) || null; }
function answerLandmark(lm) {
  window.dispatchEvent(new Event('clear-follow-target'));
  const bs = Math.min(lm.r, 55);
  highlight({ x: lm.x, y: lm.y, z: lm.z, sx: bs * 1.6, sy: bs, sz: bs * 1.6 }, { label: lm.name });
  focusAt(lm.x, Math.max(8, lm.y * 0.6), lm.z, lm.r);
  return { handled: true, text: `${lm.icon} ${lm.name} — ${lm.info} Tôi đã đưa camera tới đó và highlight khu vực.` };
}

const GO = /(o dau|nam |cho nao|vi tri|dau roi|tim |dan toi|dua toi|cho toi|di den|di toi|di chuyen|den khu|^den |^toi |^ra |^di |bay (den|toi)|focus|xem |chi (toi|cho)|den do|toi do|den vi tri)/;

/* ── AGV / transfer-vehicle answers ───────────────────────────────────────── */
function answerAgv() {
  const agvs = getAgvs ? getAgvs() : [];
  if (agvs && agvs.length) { surface(); focusObject(agvs[0], 'auto', agvs[0].userData && agvs[0].userData.data); }
  return { handled: true, text: `🤖 Xe trung chuyển tự hành (AGV): đội ${agvs ? agvs.length : 'các'} xe không người lái chạy vòng tại bến tự động, dẫn đường bằng LiDAR + định vị từ tính/UWB, mỗi xe chở 1 container 40ft, chạy điện 24/7 và đồng bộ với cẩu ASC/RMG. Ngoài ra còn AGV trung chuyển ga↔bãi ở khu đường sắt. Đã focus một xe AGV.` };
}

/* ── Truck fleet answers ──────────────────────────────────────────────────── */
function answerTrucksIncoming() {
  const incoming = trucks.filter(tk => tk.pending || tk.state === 0 || tk.state === 1 || tk.state === 1.7);
  const waiting = trucks.filter(tk => tk.pending).length;
  const approaching = incoming.length - waiting;
  const tk = incoming.find(t => !t.pending) || incoming[0];
  if (tk && tk.g && !tk.pending) { surface(); focusObject(tk.g, 'truck', tk.g.userData && tk.g.userData.data); }
  return { handled: true, text: `🚦 Sắp vào cảng: ${incoming.length} xe (${approaching} đang tiến vào/check-in tại cổng, ${waiting} đang chờ điều phối slot). ${tk && !tk.pending ? `Ví dụ xe ${tk.plate} ${truckState(tk)} — đã focus.` : ''}` };
}
function answerTrucksStatus() {
  const a = trucks.filter(t => !t.pending);
  const c = { approach: 0, gate: 0, toYard: 0, serving: 0, leaving: 0 };
  a.forEach(t => {
    if (t.state === 0) c.approach++;
    else if (t.state === 1 || t.state === 1.7 || t.state === 6.2 || t.state === 6.5) c.gate++;
    else if (t.state === 2) c.toYard++;
    else if (t.state >= 3 && t.state < 3.6) c.serving++;
    else c.leaving++;
  });
  const tk = a.find(t => t.state >= 3 && t.state < 3.6) || a[0];
  if (tk && tk.g) { surface(); focusObject(tk.g, 'truck', tk.g.userData && tk.g.userData.data); }
  return { handled: true, text: `🚛 ${a.length} xe đầu kéo đang hoạt động: ${c.approach} tiến vào cổng · ${c.gate} đang qua cổng · ${c.toYard} đang vào bãi · ${c.serving} đang bốc/dỡ · ${c.leaving} đang rời cảng. ${tk ? `Ví dụ xe ${tk.plate} (bãi ${tk.assignedBlock + 1}) ${truckState(tk)} — đã focus.` : ''}` };
}

/* ── per-entity answers (with highlight + focus side effects) ─────────────── */
function answerBlock(n) {
  const b = blocks.find(bk => bk.id === n);
  const d = blockData[blocks.indexOf(b)];
  highlight({ x: b.x, y: 14, z: b.z, sx: 30, sy: 28, sz: 48 }, { label: d ? d.name : 'Bãi số ' + n, color: 0x27C281 });
  focusAt(b.x, 12, b.z, 30);
  if (d) showObjectInfo(d, 'yardblock');
  const det = d ? d.details : null;
  const info = det ? ` Mã bãi ${det['Mã bãi']}, ${det['Loại hàng hóa']}, đang chứa ${det['Đang chứa']}, lấp đầy ${det['Tỷ lệ lấp đầy']}, lưu bãi TB ${det['Lưu bãi trung bình']}.` : '';
  return { handled: true, text: `📦 Bãi container số ${n} nằm trong cụm bãi trung tâm của cảng, toạ độ x≈${Math.round(b.x)}, z≈${Math.round(b.z)} (hàng ${b.row + 1}, cột ${b.col + 1}).${info} Tôi đã highlight và focus camera vào bãi này.` };
}

function answerShip(v) {
  surface();
  if (v.g) focusObject(v.g, 'ship', v.data);
  const ps = v.ps || {};
  const act = v.action === 'import' ? 'nhập khẩu (dỡ hàng)' : 'xuất khẩu (bốc hàng)';
  const st = (ps.progress || 'đang di chuyển').toLowerCase();
  return { handled: true, text: `🚢 Tàu ${v.nm} — hàng ${act} — hiện ${st}. ${ps.etaText || ''} Tôi đã highlight và bám camera theo tàu này.` };
}

function answerTrucksAtBlock(n) {
  const list = trucks.filter(tk => tk.assignedBlock === n - 1 && !tk.pending);
  if (!list.length) return { handled: true, text: `Hiện chưa có xe đầu kéo nào được phân về bãi số ${n}. Bạn thử bãi khác hoặc hỏi "xe nào đang bốc dỡ".` };
  const serving = list.filter(tk => tk.state >= 3 && tk.state < 3.6);
  const tk = serving[0] || list[0];
  surface(); if (tk.g) focusObject(tk.g, 'truck', tk.g.userData && tk.g.userData.data);
  return { handled: true, text: `🚛 Có ${list.length} xe được phân về bãi số ${n}${serving.length ? `, trong đó ${serving.length} xe đang được cẩu bốc/dỡ` : ''}. Xe ${tk.plate} ${truckState(tk)}. Tôi đã focus & highlight xe đó.` };
}

function answerTrucks() {
  const active = trucks.filter(tk => !tk.pending);
  const serving = active.filter(tk => tk.state >= 3 && tk.state < 3.6);
  const tk = serving[0] || active[0];
  if (tk && tk.g) { surface(); focusObject(tk.g, 'truck', tk.g.userData && tk.g.userData.data); }
  return { handled: true, text: `🚛 Đang có ${active.length} xe đầu kéo hoạt động trong cảng${serving.length ? `, ${serving.length} xe đang bốc/dỡ tại bãi` : ''}. ${tk ? `Ví dụ xe ${tk.plate} (bãi số ${tk.assignedBlock + 1}) ${truckState(tk)} — đã focus.` : ''}` };
}

function answerTrain(qn) {
  const trains = getTrains();
  if (!trains || !trains.length) return { handled: true, text: 'Hệ thống đường sắt đang khởi tạo, chưa có đoàn tàu.' };
  const pickup = /lay|nhan|xuat|boc/.test(qn), deliver = /giao|nhap|^do|do hang/.test(qn);
  const inGa = trains.filter(x => x.state && x.state !== 'gone');
  let tr = null;
  if (pickup) tr = (inGa.concat(trains)).find(x => x.side === 'L');
  else if (deliver) tr = (inGa.concat(trains)).find(x => x.side === 'R');
  if (!tr) tr = inGa[0] || trains[0];
  surface(); if (tr.g) focusObject(tr.g, 'rail', tr.data);
  const dir = tr.side === 'L' ? 'đến để NHẬN/bốc container TỪ cảng (chiều xuất)' : 'đến để GIAO/dỡ container VÀO cảng (chiều nhập)';
  const det = tr.data.details;
  return { handled: true, text: `🚆 Đoàn tàu ${det['Mã đoàn tàu']} ${dir}. Tuyến: ${det['Tuyến']}. Trạng thái: ${det['Trạng thái']}. Tôi đã focus & highlight đoàn tàu.` };
}

/* ── dispatcher ───────────────────────────────────────────────────────────── */
export function answerLive(raw) {
  const qn = strip(raw);
  const hasAgv = /xe trung chuyen|\bagv\b|xe tu hanh|xe dan duong|xe khong nguoi/.test(qn);
  const hasXe = /\bxe\b|truck|dau keo|xe tai/.test(qn);
  const hasTrain = /tau hoa|tau lua|train|doan tau|xe lua/.test(qn);
  const num = blockNumber(qn);
  const hasBlock = /\b(bai|block|khoi)\b/.test(qn);
  const whichActive = /(nao|dang|may xe|bao nhieu|tinh trang|trang thai)/.test(qn);
  const incoming = /sap vao|sap toi|chuan bi vao|sap den|moi vao|vao cang|den cang|cho vao/.test(qn);
  const doingWhat = /lam gi|dang lam|hoat dong|tinh trang|trang thai/.test(qn);

  if (hasAgv) return answerAgv();
  if (hasTrain) return answerTrain(qn);
  if (hasXe && num) return answerTrucksAtBlock(num);
  if (hasXe && incoming) return answerTrucksIncoming();
  if (hasXe && doingWhat) return answerTrucksStatus();
  if (hasXe && whichActive) return answerTrucks();
  const v = matchVessel(qn);
  if (v) return answerShip(v);
  if (/\btau\b/.test(qn) && whichActive) {
    const docked = vessels.find(x => x.ps && x.ps.docked);
    if (docked) return answerShip(docked);
  }
  if (num && hasBlock) return answerBlock(num);
  // Any fixed facility, when the user asks where it is / to go there.
  const lm = landmarkMatch(qn);
  if (lm && GO.test(qn)) return answerLandmark(lm);
  return { handled: false };
}
