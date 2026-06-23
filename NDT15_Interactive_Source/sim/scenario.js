/* ──────────────────────────────────────────────────────────────────────────
 * sim/scenario.js — Fork & Resilience engine (Phase 2 + Phase 3)
 *
 * "Fork Reality": inject a scenario's timed events, run the impact cascade for
 * the disrupted (forked) universe alongside the undisturbed baseline, and show
 * the divergence — animated 3D markers, a flood/storm/cyber/power overlay, a
 * Chart.js comparison, KPI delta tiles, and an AI mitigation that bends the
 * forked curve back. Clicking a KPI tile fires the Glass Box causal trace.
 *
 * The cascade NUMBERS come from the abstract model (impact.js); the 3D scene is
 * decorated with targeted effects rather than having its real AI broken — robust
 * and fully controllable for a live demo.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, camera } from '../core.js';
import { PARAMS, berthX, blockCenter, gatePosition } from '../layout.js';
import { simulate, deltaAt, HORIZON } from './impact.js';
import * as glassbox from './glassbox.js';
import { getWater } from '../env/ocean.js';
import { setFlood } from '../env/underground.js';
import { vessels } from '../ships.js';

const BX = berthX();
const gp = gatePosition();
const ANCH = {
  crane3: new THREE.Vector3(BX[2], 50, PARAMS.BERTH_Z),
  yard: new THREE.Vector3(blockCenter(2, 2).x, 26, blockCenter(2, 2).z),
  gate: new THREE.Vector3(gp.x, 12, gp.z),
  power: new THREE.Vector3(120, 8, 318),
  sea: new THREE.Vector3(0, 8, PARAMS.BERTH_Z - 60),
  queue: new THREE.Vector3(80, 10, -300),
};

export const SCENARIOS = [
  {
    id: 'CRANE_FAIL', icon: '🛠', label: 'Cẩu B-03 hỏng', cat: 'Vận hành',
    desc: 'Cẩu STS tại Bến B-03 ngừng đột ngột giữa ca dỡ hàng.',
    events: [{ t: 0, type: 'crane_fail', target: 2 }],
    mitigation: [{ t: 0, type: 'crane_reassign' }], mitLabel: 'Điều cẩu B-02 sang hỗ trợ B-03',
    markers: [{ key: 'crane3', label: '🛠 CẨU B-03 HỎNG', color: 0xff5468 }],
    causal: [{ key: 'gate', label: 'Cổng kẹt — xe ùn ứ' }, { key: 'yard', label: 'Bãi C giải phóng chậm' }, { key: 'crane3', label: 'Gốc: Cẩu B-03 hỏng' }],
    flow: ['🛠 Cẩu B-03', '📦 Bãi C', '🚪 Cổng', '💸 Chi phí/CO₂'],
    steps: [
      { t: 0, title: 'Cẩu B-03 ngừng', desc: 'Đang dỡ 60% thì hỏng — tàu MAERSK ALFA đứng hình tại bến.' },
      { t: 12, title: 'Tàu kế phải chờ', desc: 'Dwell B-03 +25′; tàu tiếp theo phải neo chờ ngoài luồng.' },
      { t: 25, title: 'Bãi C ùn ứ', desc: 'Container nhập giải phóng chậm, công suất bãi C dâng cao.' },
      { t: 40, title: 'Cổng kẹt', desc: 'Xe đầu kéo dồn lại, hàng chờ tại cổng tăng nhanh.' },
      { t: 55, title: 'Chi phí leo thang', desc: 'Demurrage + xe nổ máy chờ: chi phí & CO₂ tăng mạnh.' },
    ],
  },
  {
    id: 'VESSEL_SURGE', icon: '🚢', label: 'Dồn 3 tàu cùng lúc', cat: 'Điều phối',
    desc: '3 tàu cùng xin cập trong một cửa sổ thủy triều, chỉ 2 bến trống.',
    events: [{ t: 0, type: 'vessel_surge', count: 3 }],
    mitigation: [{ t: 0, type: 'jit_speed' }], mitLabel: 'JIT điều tốc tàu #3 đến đúng giờ',
    markers: [{ key: 'queue', label: '🚢 3 TÀU CHỜ — THIẾU BẾN', color: 0xF8B23C }],
    causal: [{ key: 'gate', label: 'Chi phí neo chờ tăng' }, { key: 'queue', label: 'Gốc: 3 tàu dồn, thiếu bến' }],
    flow: ['🚢 3 tàu dồn', '⚓ Vùng neo', '⏱ Chờ bến', '💸 Phí neo'],
    steps: [
      { t: 0, title: '3 tàu cùng xin cập', desc: 'Chỉ 2 bến trống trong cùng cửa sổ thủy triều.' },
      { t: 15, title: '1 tàu vào neo chờ', desc: 'JIT phát cảnh báo vàng cho tàu #3.' },
      { t: 35, title: 'Phí neo tích lũy', desc: '$30k/tàu/ngày nếu không điều tốc kịp thời.' },
      { t: 50, title: 'Chuỗi trễ lan rộng', desc: 'ETA các tàu phía sau bị đẩy lùi dây chuyền.' },
    ],
  },
  {
    id: 'STORM_SURGE', icon: '🌊', label: 'Bão + nước dâng', cat: 'Khí hậu',
    desc: 'Bão gió 55kt, nước dâng +2.4m tràn cầu bến và ngập trạm điện ngầm.',
    events: [{ t: 0, type: 'storm' }, { t: 8, type: 'sea_level', value: 1.8 }, { t: 16, type: 'sea_level', value: 2.4 }, { t: 20, type: 'power_outage' }],
    mitigation: [{ t: 0, type: 'power_renew' }, { t: 0, type: 'crane_reassign' }], mitLabel: 'Bơm thoát nước + chuyển nguồn dự phòng',
    storm: true, flood: 2.4, vignette: 'storm',
    markers: [{ key: 'sea', label: '🌊 NƯỚC DÂNG +2.4m', color: 0x34E0F0 }, { key: 'power', label: '⚡ TRẠM ĐIỆN NGẦM NGẬP', color: 0xff5468 }],
    causal: [{ key: 'gate', label: 'Cổng kẹt — về thủ công' }, { key: 'power', label: 'Trạm điện ngầm ngập → mất điện' }, { key: 'sea', label: 'Gốc: nước dâng +2.4m' }],
    flow: ['🌊 Nước dâng', '⚓ Bến ngập', '⚡ Điện ngầm', '🚪 Tê liệt'],
    steps: [
      { t: 0, title: 'Bão gió 55kt', desc: 'Cẩu STS ngừng (vượt ngưỡng gió), drone hạ cánh khẩn.' },
      { t: 8, title: 'Nước dâng +1.8m', desc: 'Triều cường tràn qua mép cầu bến.' },
      { t: 16, title: 'Nước +2.4m', desc: 'Trạm điện & bơm ngầm bắt đầu ngập (xuống Tầng Ngầm để thấy).' },
      { t: 20, title: 'Mất điện', desc: 'Cổng về thủ công, throughput toàn cảng ~25%.' },
      { t: 40, title: 'Tê liệt diện rộng', desc: 'Chi phí và phát thải vọt; chờ bơm thoát nước.' },
    ],
  },
  {
    id: 'GATE_CYBER', icon: '🛡', label: 'Tấn công mạng cổng', cat: 'An ninh',
    desc: 'Hệ thống ALPR/booking bị khóa, cổng phải về vận hành thủ công.',
    events: [{ t: 0, type: 'gate_cyber' }],
    mitigation: [{ t: 25, type: 'gate_restore' }], mitLabel: 'An ninh AI cô lập & khôi phục cổng',
    vignette: 'cyber',
    markers: [{ key: 'gate', label: '🛡 CỔNG BỊ TẤN CÔNG — THỦ CÔNG', color: 0xff5468 }],
    causal: [{ key: 'gate', label: 'Gốc: ALPR bị khóa → cổng thủ công' }],
    flow: ['🛡 ALPR khóa', '🚪 Cổng thủ công', '🚛 Hàng dài', '💸 Logistics'],
    steps: [
      { t: 0, title: 'ALPR/booking bị khóa', desc: 'Hệ thống nhận diện biển số tê liệt do tấn công.' },
      { t: 5, title: 'Cổng về thủ công', desc: 'Thông quan thủ công → throughput giảm còn 1/3.' },
      { t: 15, title: 'Hàng xe 30+', desc: 'Kéo dài ra đường vành đai, lan ra logistics.' },
      { t: 25, title: 'An ninh AI vào cuộc', desc: 'Cô lập phân hệ, mở làn thủ công dự phòng.' },
    ],
  },
  {
    id: 'POWER_OUTAGE', icon: '⚡', label: 'Mất điện lưới', cat: 'Năng lượng',
    desc: 'Lưới điện mất, cảng phải dựa vào nguồn tái tạo + cắt tải luân phiên.',
    events: [{ t: 0, type: 'power_outage' }],
    mitigation: [{ t: 0, type: 'power_renew' }], mitLabel: 'Điện mặt trời/gió gánh tải cốt lõi',
    vignette: 'power',
    markers: [{ key: 'power', label: '⚡ MẤT ĐIỆN LƯỚI', color: 0xff5468 }],
    causal: [{ key: 'gate', label: 'Throughput cảng tụt' }, { key: 'power', label: 'Gốc: mất điện lưới' }],
    flow: ['⚡ Mất lưới', '🏗 Cẩu giảm tải', '🚪 Cổng yếu', '🔋 Tái tạo gánh'],
    steps: [
      { t: 0, title: 'Lưới điện mất', desc: 'Cẩu và cổng được ưu tiên phân bổ tải còn lại.' },
      { t: 5, title: 'Nguồn tái tạo gánh', desc: 'Điện mặt trời + gió gánh tải tới hạn.' },
      { t: 20, title: 'Cắt tải luân phiên', desc: 'Khu không ưu tiên tạm ngắt để giữ tác nghiệp lõi.' },
      { t: 35, title: 'Throughput tụt', desc: 'Năng suất giảm, chi phí năng lượng tăng.' },
    ],
  },
];

/* ── 3D markers (pulsing ring + projected HTML label) ─────────────────────── */
let markerGroup = null, markerHost = null;
const markerObjs = [];
function ensureMarkers() {
  if (markerGroup) return;
  markerGroup = new THREE.Group(); scene.add(markerGroup);
  markerHost = document.createElement('div');
  markerHost.id = 'scn-markers';
  markerHost.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:58;';
  document.body.appendChild(markerHost);
}
function buildMarkers(list) {
  clearMarkers();
  list.forEach(m => {
    const pos = ANCH[m.key]; if (!pos) return;
    const ring = new THREE.Mesh(new THREE.RingGeometry(5, 7, 36),
      new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(pos);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 60, 8),
      new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.25, depthWrite: false }));
    beam.position.set(pos.x, pos.y + 30, pos.z);
    markerGroup.add(ring); markerGroup.add(beam);
    const el = document.createElement('div'); el.className = 'scn-mk';
    el.style.borderColor = '#' + m.color.toString(16).padStart(6, '0');
    el.textContent = m.label; markerHost.appendChild(el);
    markerObjs.push({ ring, beam, el, pos });
  });
}
function clearMarkers() {
  markerObjs.forEach(o => { markerGroup.remove(o.ring); markerGroup.remove(o.beam); o.el.remove(); });
  markerObjs.length = 0;
  if (markerHost) markerHost.innerHTML = '';
}
const _v = new THREE.Vector3();
function updateMarkers(dt, t) {
  const s = 1 + Math.sin(t * 4) * 0.12;
  markerObjs.forEach(o => {
    o.ring.scale.set(s, s, s);
    _v.copy(o.pos).project(camera);
    const on = _v.z < 1 && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.2;
    o.el.style.display = on ? 'block' : 'none';
    if (on) { o.el.style.left = ((_v.x * .5 + .5) * innerWidth) + 'px'; o.el.style.top = ((-_v.y * .5 + .5) * innerHeight) + 'px'; }
  });
}

/* ── Central simulation STAGE (steps · impact diagram · chart · KPI) ───────── */
let stage = null, chart = null, tilesEl = null, titleEl = null, catEl = null, descEl = null,
  stepsEl = null, flowEl = null, mitBtn = null, mitNote = null;

function ensureStage() {
  if (stage) return;
  stage = document.createElement('div'); stage.id = 'chronos-stage';
  stage.innerHTML = `
    <div class="cs-head">
      <span class="cs-ic" id="cs-ic">⚡</span>
      <div class="cs-htxt"><div id="cs-title">Fork</div><div id="cs-cat"></div></div>
      <div class="cs-uni"><span class="cs-run">● đang mô phỏng</span>GỐC&nbsp;<span class="cs-dot g"></span>&nbsp;vs&nbsp;PHẢN THỰC&nbsp;<span class="cs-dot r"></span></div>
      <button id="cs-min" title="Ẩn/hiện cửa sổ (vẫn chạy)">▁</button>
      <button id="cs-x" title="Dừng mô phỏng">✕</button>
    </div>
    <div class="cs-desc" id="cs-desc"></div>
    <div class="cs-grid">
      <div class="cs-col-steps"><div class="cs-cap">▶ Diễn biến từng bước</div><div class="cs-steps" id="cs-steps"></div></div>
      <div class="cs-col-right">
        <div class="cs-cap">🔗 Sơ đồ ảnh hưởng tới cảng</div>
        <div class="cs-flow" id="cs-flow"></div>
        <div class="cs-cap">📈 Chỉ số tác động tổng hợp (GỐC vs PHẢN THỰC)</div>
        <div class="cs-chart"><canvas id="cs-canvas"></canvas></div>
        <div class="cs-tiles" id="cs-tiles"></div>
      </div>
    </div>
    <div class="cs-foot"><button id="cs-mit">🤖 AI Hóa Giải</button><span id="cs-mitnote"></span>
      <span class="cs-hint">Bấm ô chỉ số / nút sơ đồ để xem <b>chuỗi nhân quả</b></span></div>`;
  document.body.appendChild(stage);
  titleEl = stage.querySelector('#cs-title');
  catEl = stage.querySelector('#cs-cat');
  descEl = stage.querySelector('#cs-desc');
  stepsEl = stage.querySelector('#cs-steps');
  flowEl = stage.querySelector('#cs-flow');
  tilesEl = stage.querySelector('#cs-tiles');
  mitBtn = stage.querySelector('#cs-mit');
  mitNote = stage.querySelector('#cs-mitnote');
  stage.querySelector('#cs-x').onclick = () => stopFork();
  stage.querySelector('#cs-min').onclick = () => {
    const min = stage.classList.toggle('min');
    stage.querySelector('#cs-min').textContent = min ? '▢' : '▁';
    stage.querySelector('#cs-min').title = min ? 'Mở rộng cửa sổ' : 'Ẩn/hiện cửa sổ (vẫn chạy)';
  };
  mitBtn.onclick = () => applyMitigation();
  if (window.Chart) {
    chart = new window.Chart(stage.querySelector('#cs-canvas').getContext('2d'), {
      type: 'line',
      data: { labels: [], datasets: [
        { label: 'Vũ trụ GỐC', data: [], borderColor: '#27C281', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: .3 },
        { label: 'Vũ trụ PHẢN THỰC', data: [], borderColor: '#ff5468', backgroundColor: 'rgba(255,84,104,.14)', fill: true, borderWidth: 2.6, pointRadius: 0, tension: .3 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { color: '#cfe', boxWidth: 12, font: { size: 11 } } } },
        scales: { x: { title: { display: true, text: 'phút sau sự cố', color: '#7a8aa0', font: { size: 9 } }, ticks: { color: '#9ab', maxTicksLimit: 7, font: { size: 9 } }, grid: { color: 'rgba(255,255,255,.05)' } },
          y: { beginAtZero: true, ticks: { color: '#9ab', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,.06)' } } } },
    });
  }
}

const TILE_DEFS = [
  { k: 'wait', name: 'Chờ tàu', unit: 'h', f: v => (v >= 0 ? '+' : '') + v.toFixed(1) },
  { k: 'queue', name: 'Kẹt cổng', unit: 'xe', f: v => (v >= 0 ? '+' : '') + v.toFixed(0) },
  { k: 'cost', name: 'Chi phí', unit: '', f: v => (v >= 0 ? '+$' : '-$') + Math.abs(v / 1000).toFixed(0) + 'k' },
  { k: 'co2', name: 'CO₂', unit: '%', f: v => (v >= 0 ? '+' : '') + v.toFixed(0) },
  { k: 'thru', name: 'Throughput', unit: '%', f: v => v.toFixed(0) },
  { k: 'esg', name: 'ESG', unit: '', f: v => (v >= 0 ? '+' : '') + v.toFixed(0) },
];
function renderTiles(d) {
  if (!tilesEl.children.length) {
    tilesEl.innerHTML = TILE_DEFS.map(t => `<div class="cf-tile" data-k="${t.k}"><div class="cf-tv" id="tv-${t.k}">–</div><div class="cf-tn">${t.name}</div></div>`).join('');
    tilesEl.querySelectorAll('.cf-tile').forEach(el => el.onclick = () => showCausal());
  }
  TILE_DEFS.forEach(t => {
    const el = tilesEl.querySelector('#tv-' + t.k); if (!el) return;
    const v = d[t.k]; el.textContent = t.f(v) + (t.unit && t.k !== 'cost' ? t.unit : '');
    const bad = (t.k === 'thru' || t.k === 'esg') ? v < 0 : v > 0.05;
    el.style.color = bad ? '#ff7a88' : '#3ce3a0';
  });
}

// Step-by-step timeline — highlight steps whose time the playhead has passed.
function renderSteps(scenarioSteps) {
  stepsEl.innerHTML = scenarioSteps.map((s, i) =>
    `<div class="cs-step" data-i="${i}"><div class="cs-st-time">+${s.t}′</div>
      <div class="cs-st-body"><div class="cs-st-title">${s.title}</div><div class="cs-st-desc">${s.desc}</div></div></div>`).join('');
}
function updateSteps(scenarioSteps, m) {
  let activeIdx = 0;
  scenarioSteps.forEach((s, i) => { if (m >= s.t) activeIdx = i; });
  stepsEl.querySelectorAll('.cs-step').forEach((el, i) => {
    el.classList.toggle('done', i < activeIdx);
    el.classList.toggle('active', i === activeIdx);
  });
}

// Impact flow diagram — boxes light up red as the cascade reaches each stage.
function renderFlow(flow) {
  flowEl.innerHTML = flow.map((label, i) =>
    `${i ? '<span class="cs-arr">→</span>' : ''}<button class="cs-node" data-i="${i}">${label}</button>`).join('');
  flowEl.querySelectorAll('.cs-node').forEach(el => el.onclick = () => showCausal());
}
function updateFlow(flow, m) {
  const lit = Math.min(flow.length, Math.floor(m / (HORIZON / flow.length)) + 1);
  flowEl.querySelectorAll('.cs-node').forEach((el, i) => el.classList.toggle('hit', i < lit));
}

/* ── Fork lifecycle ───────────────────────────────────────────────────────── */
let active = null, base = [], fork = [], pm = 0, playT = 0, mitigated = false, vignetteEl = null;

// Composite impact index so EVERY scenario shows a clear divergence on the chart
// (a vessel surge moves wait/cost but not the gate queue, etc.).
function impactIndex(s) {
  return s.queue * 1.0 + Math.max(0, s.wait - 0.4) * 8 + s.co2 * 0.5 + (100 - s.thru) * 0.4;
}

export function startFork(id) {
  const sc = SCENARIOS.find(s => s.id === id); if (!sc) return;
  ensureMarkers(); ensureStage();
  active = sc; mitigated = false; pm = 0; playT = 0;
  base = simulate([]);
  fork = simulate(sc.events);
  buildMarkers(sc.markers || []);
  stage.querySelector('#cs-ic').textContent = sc.icon;
  titleEl.textContent = sc.label;
  catEl.textContent = sc.cat;
  descEl.textContent = sc.desc;
  renderSteps(sc.steps || []);
  renderFlow(sc.flow || []);
  mitNote.textContent = ''; mitBtn.disabled = false; mitBtn.textContent = '🤖 ' + (sc.mitLabel || 'AI Hóa Giải');
  tilesEl.innerHTML = '';
  stage.classList.remove('min');
  stage.querySelector('#cs-min').textContent = '▁';
  stage.classList.add('show');
  setVignette(sc.vignette || null);
  glassbox.clear();
  return sc;
}

export function applyMitigation() {
  if (!active || mitigated) return;
  mitigated = true;
  fork = simulate(active.events.concat(active.mitigation || []));
  mitBtn.disabled = true;
  mitNote.textContent = '✓ Đã áp dụng: ' + (active.mitLabel || '') + ' — đường phản thực uốn lại gần baseline.';
}

export function stopFork() {
  active = null;
  if (stage) stage.classList.remove('show');
  clearMarkers();
  setVignette(null);
  glassbox.clear();
  const w = getWater(); if (w) w.position.y = 0;
  setFlood(0);
}

export function isForkActive() { return !!active; }

function showCausal() {
  if (!active || !active.causal) return;
  const chain = active.causal.map(c => ({ pos: ANCH[c.key] || ANCH.gate, label: c.label }));
  glassbox.trace(chain);
}

function setVignette(kind) {
  if (!vignetteEl) {
    vignetteEl = document.createElement('div'); vignetteEl.id = 'chronos-vignette';
    document.body.appendChild(vignetteEl);
  }
  vignetteEl.className = kind ? ('v-' + kind + ' on') : '';
}

// Per-frame: advance the playhead, update chart/tiles/markers/effects.
export function update(dt) {
  if (!active) return;
  playT += dt;
  pm = Math.min(HORIZON, playT * 5);           // reveal ~5 sim-min per real second
  const mi = Math.floor(pm);

  if (chart) {
    const n = mi + 1;
    chart.data.labels = base.slice(0, n).map(s => s.t + '′');
    chart.data.datasets[0].data = base.slice(0, n).map(impactIndex);
    chart.data.datasets[1].data = fork.slice(0, n).map(impactIndex);
    chart.update('none');
  }
  renderTiles(deltaAt(base, fork, mi));
  updateSteps(active.steps || [], pm);
  updateFlow(active.flow || [], pm);
  updateMarkers(dt, playT);

  // Resilience visual effects ramp with the playhead.
  const lvl = Math.min(1, pm / 22);
  if (active.flood || active.storm) {
    const rise = lvl * 15;                     // metres the sea climbs over the quay
    const w = getWater();
    if (w) w.position.y = rise;
    setFlood(lvl);
    // Vessels FLOAT with the rising sea (scene.js set their base y this frame;
    // we lift them on top so the water carries them instead of drowning them).
    for (const v of vessels) if (v.g) v.g.position.y += rise;
  }
  glassbox.update(dt);
}
