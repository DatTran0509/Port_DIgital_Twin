/* ──────────────────────────────────────────────────────────────────────────
 * ui/control-tower.js — "Control Tower" operations dashboard (decision-centric)
 *
 * The investor centrepiece: turns the 3D twin from a pretty model into a live
 * OPERATIONS COMMAND CENTRE. A toggleable overlay showing real-time KPIs, an
 * ESG / carbon scorecard, AI predictive cards (ETA, berth plan, congestion),
 * and live mini-charts. A few figures are pulled from the real sim (vessels,
 * trucks); the rest are realistic, smoothly-animated operational telemetry.
 *
 * Self-contained: injects its own CSS, adds its own top-bar button, runs on its
 * own interval (no render-loop coupling). Charts use the globally-loaded Chart.js.
 * ────────────────────────────────────────────────────────────────────────── */
import { vessels } from '../ships.js';
import { trucks } from '../trucks.js';

let panel = null, open = false;
const charts = {};
const S = { tput: 318, berth: 79, moves: 31, turn: 23, yard: 72, dwell: 3.4, co2: 12.6, renew: 63, ships: 0, agv: 4 };
const tputHist = Array.from({ length: 24 }, (_, i) => 240 + Math.round(Math.sin(i / 3) * 50 + Math.random() * 30));

// The 15 layers of the National Digital Twin (NDT-15) model, each mapped to how
// it is APPLIED in this smart port. st: 'on' = đang áp dụng, 'part' = một phần,
// 'plan' = kế hoạch. Colours follow the NDT layer stack (blue → red).
const LAYERS = [
  { n: 1, c: '#a78bfa', icon: '🧠', en: 'Analytical Intelligence System', vi: 'Phân tích & Trí tuệ (AI)', st: 'on', use: 'AI dự báo ETA tàu, lập kế hoạch cập bến tối ưu (−20% thời gian chờ), dự báo tắc nghẽn cổng — xem panel "AI Dự báo" phía trên.' },
  { n: 2, c: '#4263eb', icon: '🛰️', en: 'Spatial Surveillance & Intelligence', vi: 'Giám sát & Viễn thám Không gian', st: 'on', use: 'Trạm radar hàng hải, 3 UAV tuần tra, AIS giám sát vùng nước & ranh giới cảng (hiển thị trực tiếp trong mô hình).' },
  { n: 3, c: '#4dabf7', icon: '🧊', en: '3D Spatial Mapping System', vi: 'Bản đồ Không gian 3D', st: 'on', use: 'Chính bản sao số 3D thời gian thực này — toàn bộ cầu bến, bãi, thiết bị, tàu, đường được số hoá theo toạ độ thực.' },
  { n: 4, c: '#74c0fc', icon: '🚨', en: 'Emergency Management System', vi: 'Quản lý Khẩn cấp', st: 'part', use: 'Chế độ cảnh báo an ninh & phát hiện tàu lạ; nền tảng cho kịch bản cháy nổ / tràn dầu / sơ tán.' },
  { n: 5, c: '#a5d8ff', icon: '🌿', en: 'Environment Information System', vi: 'Thông tin Môi trường', st: 'on', use: 'Theo dõi phát thải CO₂, năng lượng tái tạo & bảng điểm ESG (panel ESG phía trên) — phục vụ mục tiêu IMO/EU.' },
  { n: 6, c: '#d0bfff', icon: '🏙️', en: 'City Information Modeling', vi: 'Mô hình Thông tin Đô thị', st: 'part', use: 'Liên kết cảng với đô thị & khu hậu cần lân cận (mô hình thành phố nền), phục vụ quy hoạch vùng.' },
  { n: 7, c: '#ffc9c9', icon: '📍', en: 'Mapping & Monitoring System', vi: 'Bản đồ & Giám sát', st: 'on', use: 'Giám sát vị trí thời gian thực của tàu, xe tải, AGV, cẩu; lớp phủ AIS + toàn bộ KPI vận hành.' },
  { n: 8, c: '#ffa8a8', icon: '🛣️', en: 'Transportation Infrastructure', vi: 'Hạ tầng Giao thông', st: 'on', use: 'Đường bộ 2 làn, 2 ga đường sắt nội cảng, cổng & cân tải, làn AGV, kết nối ICD — vận tải đa phương thức.' },
  { n: 9, c: '#ff8787', icon: '🏗️', en: 'Building Information Modeling', vi: 'Mô hình Thông tin Công trình (BIM)', st: 'on', use: 'BIM cho nhà kho, văn phòng điều hành, xưởng bảo trì, trạm cân, trung tâm điều độ tàu — quản lý tài sản công trình.' },
  { n: 10, c: '#fa5252', icon: '📐', en: 'Computer-Aided Design', vi: 'Thiết kế Hỗ trợ Máy tính (CAD)', st: 'on', use: 'Bố trí bãi & thiết bị tham số hoá — đổi một thông số là toàn cảng tự tái sắp xếp (layout engine).' },
  { n: 11, c: '#f03e3e', icon: '🗺️', en: 'Geographic Information System', vi: 'Thông tin Địa lý (GIS)', st: 'part', use: 'Toạ độ địa lý, lớp bản đồ nền, ranh giới vùng nước & đất cảng.' },
  { n: 12, c: '#e03131', icon: '🧱', en: 'Land Information System', vi: 'Thông tin Đất đai', st: 'part', use: 'Quản lý quỹ đất, phân lô bãi, hợp đồng thuê khu hậu cần & bãi tồn.' },
  { n: 13, c: '#c92a2a', icon: '🕳️', en: 'Underground Infrastructure', vi: 'Hạ tầng Ngầm', st: 'plan', use: 'Đường ống nhiên liệu, cáp điện/quang ngầm, thoát nước — số hoá để bảo trì & thi công an toàn.' },
  { n: 14, c: '#a51111', icon: '💧', en: 'Groundwater Information System', vi: 'Nguồn nước Ngầm', st: 'plan', use: 'Quan trắc mực nước ngầm & xâm nhập mặn quanh cảng bằng cảm biến IoT.' },
  { n: 15, c: '#7a0e0e', icon: '⛏️', en: 'Mineral Resource Management', vi: 'Tài nguyên Khoáng sản', st: 'plan', use: 'Ngoài phạm vi vận hành cảng — dành cho mở rộng quản lý tài nguyên cấp vùng.' },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const walk = (v, amp, lo, hi) => clamp(v + (Math.random() - 0.5) * amp, lo, hi);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

function injectCSS() {
  const s = document.createElement('style');
  s.textContent = `
  #ct-btn{cursor:pointer}
  #ct-overlay{position:fixed;inset:0;z-index:60;display:none;background:rgba(3,8,16,.55);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
  #ct-overlay.open{display:block}
  #ct-wrap{position:absolute;inset:54px 18px 18px 18px;background:linear-gradient(160deg,rgba(12,22,38,.96),rgba(6,12,24,.97));
    border:1px solid rgba(77,141,246,.35);border-radius:18px;box-shadow:0 20px 70px rgba(0,0,0,.6);
    padding:18px 22px;overflow:auto;color:#dce6f5;font-family:"Segoe UI",Verdana,sans-serif}
  #ct-wrap h2{margin:0;font-size:20px;font-weight:800;letter-spacing:.5px;color:#eaf2ff;display:flex;align-items:center;gap:10px}
  .ct-live{font-size:11px;font-weight:700;color:#0b1a12;background:#15D8A4;padding:3px 9px;border-radius:20px;display:inline-flex;align-items:center;gap:6px}
  .ct-live::before{content:"";width:7px;height:7px;border-radius:50%;background:#0b1a12;animation:ctp 1.2s infinite}
  @keyframes ctp{0%,100%{opacity:1}50%{opacity:.25}}
  #ct-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,.08);border:none;color:#cfe0f5;width:34px;height:34px;border-radius:9px;font-size:18px;cursor:pointer}
  #ct-close:hover{background:rgba(255,90,90,.35)}
  .ct-sub{color:#7d93b0;font-size:12px;margin:2px 0 16px}
  .ct-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px}
  .ct-card{background:rgba(255,255,255,.04);border:1px solid rgba(120,150,200,.16);border-radius:13px;padding:13px 15px}
  .ct-k{font-size:11px;color:#8aa0c0;text-transform:uppercase;letter-spacing:.6px}
  .ct-v{font-size:27px;font-weight:800;color:#eaf2ff;margin-top:5px;line-height:1}
  .ct-v small{font-size:13px;font-weight:600;color:#9fb4d2;margin-left:3px}
  .ct-d{font-size:11px;margin-top:6px;font-weight:700}
  .up{color:#15D8A4}.down{color:#ff7a7a}.flat{color:#9fb4d2}
  .ct-sec{font-size:13px;font-weight:800;color:#4D8DF6;text-transform:uppercase;letter-spacing:1px;margin:6px 0 10px;border-left:3px solid #4D8DF6;padding-left:9px}
  .ct-cols{display:grid;grid-template-columns:1.3fr 1fr;gap:16px}
  @media(max-width:900px){.ct-cols{grid-template-columns:1fr}}
  .ct-ai{background:linear-gradient(150deg,rgba(21,184,143,.12),rgba(77,141,246,.08));border:1px solid rgba(33,209,138,.3);border-radius:13px;padding:13px 15px;margin-bottom:11px}
  .ct-ai .t{font-size:12px;color:#7fe3c4;font-weight:700;display:flex;gap:7px;align-items:center}
  .ct-ai .m{font-size:16px;font-weight:700;color:#eaf2ff;margin-top:5px}
  .ct-ai .s{font-size:12px;color:#9fb4d2;margin-top:3px}
  .ct-chart{background:rgba(255,255,255,.03);border:1px solid rgba(120,150,200,.14);border-radius:13px;padding:12px 14px;margin-bottom:14px}
  .ct-chart h4{margin:0 0 8px;font-size:12px;color:#8aa0c0;font-weight:700;text-transform:uppercase;letter-spacing:.6px}
  .ct-badge{display:inline-block;padding:2px 9px;border-radius:20px;font-size:12px;font-weight:700}
  .b-low{background:rgba(21,216,164,.2);color:#15D8A4}.b-med{background:rgba(248,178,60,.22);color:#f8b23c}.b-high{background:rgba(255,90,90,.22);color:#ff7a7a}
  .ct-layers{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}
  .ct-layer{display:flex;background:rgba(255,255,255,.04);border:1px solid rgba(120,150,200,.14);border-radius:11px;overflow:hidden}
  .ct-layer .bar{width:6px;flex:none}
  .ct-layer .bd{padding:10px 13px;flex:1}
  .ct-layer .hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .ct-layer .no{font-size:11px;font-weight:800;color:#5f7896;background:rgba(255,255,255,.06);border-radius:6px;padding:1px 6px}
  .ct-layer .nm{font-size:13px;font-weight:800;color:#eaf2ff}
  .ct-layer .en{font-size:11px;color:#7d93b0;margin-top:2px}
  .ct-layer .use{font-size:11.5px;color:#aebfd6;margin-top:6px;line-height:1.45}
  .lst{margin-left:auto;font-size:10px;font-weight:800;padding:2px 7px;border-radius:20px}
  .lst-on{background:rgba(21,216,164,.2);color:#15D8A4}.lst-part{background:rgba(248,178,60,.22);color:#f8b23c}.lst-plan{background:rgba(150,160,180,.18);color:#9fb4d2}
  `;
  document.head.appendChild(s);
}

function card(k, id, unit, sub) {
  return `<div class="ct-card"><div class="ct-k">${k}</div><div class="ct-v"><span id="${id}">–</span>${unit ? `<small>${unit}</small>` : ''}</div><div class="ct-d flat" id="${id}-d">${sub || ''}</div></div>`;
}

function buildPanel() {
  const ov = el('div'); ov.id = 'ct-overlay';
  const w = el('div'); w.id = 'ct-wrap'; ov.appendChild(w);
  w.innerHTML = `
    <button id="ct-close">✕</button>
    <h2>🗼 TRUNG TÂM ĐIỀU HÀNH <span class="ct-live">LIVE</span></h2>
    <div class="ct-sub">Control Tower — bản sao số ra quyết định theo thời gian thực · NDT15 Smart Port</div>

    <div class="ct-sec">Chỉ số vận hành (KPI)</div>
    <div class="ct-grid">
      ${card('Throughput', 'k-tput', 'TEU/h', 'mục tiêu 300')}
      ${card('Tỷ lệ dùng bến', 'k-berth', '%', '')}
      ${card('Năng suất cẩu', 'k-moves', 'moves/h', '')}
      ${card('Quay đầu xe', 'k-turn', 'phút', 'mục tiêu < 30')}
      ${card('Lấp đầy bãi', 'k-yard', '%', '')}
      ${card('Lưu bãi TB', 'k-dwell', 'ngày', '')}
      ${card('Tàu đang khai thác', 'k-ships', '', 'realtime')}
      ${card('Xe / AGV hoạt động', 'k-agv', '', 'realtime')}
    </div>

    <div class="ct-cols">
      <div>
        <div class="ct-sec">AI Dự báo & Điều phối</div>
        <div class="ct-ai"><div class="t">🤖 Lập kế hoạch cập bến (Predictive Berth Planning)</div>
          <div class="m" id="ai-berth">–</div><div class="s" id="ai-berth-s">AI đề xuất bến tối ưu theo ETA & chiều dài tàu</div></div>
        <div class="ct-ai"><div class="t">📡 Tàu kế tiếp & ETA</div>
          <div class="m" id="ai-eta">–</div><div class="s">Dự báo từ AIS + mô hình học máy</div></div>
        <div class="ct-ai"><div class="t">🚦 Dự báo tắc nghẽn cổng</div>
          <div class="m"><span id="ai-cong" class="ct-badge b-low">–</span></div><div class="s" id="ai-cong-s"></div></div>
        <div class="ct-ai"><div class="t">✅ Tác động của AI</div>
          <div class="m">Giảm <b style="color:#15D8A4">20%</b> thời gian chờ bến</div><div class="s">Tương đương Rotterdam (2022–2024)</div></div>
      </div>
      <div>
        <div class="ct-sec">Bền vững (ESG / Carbon)</div>
        <div class="ct-grid" style="grid-template-columns:1fr 1fr">
          ${card('CO₂ giảm hôm nay', 'e-co2', 'tấn', 'nhờ điện bờ + tái tạo')}
          ${card('Năng lượng tái tạo', 'e-renew', '%', 'gió · mặt trời · H₂')}
          ${card('Phiên điện bờ', 'e-shore', '', 'tàu cắm điện bờ')}
          ${card('Cây xanh tương đương', 'e-tree', '', 'hấp thụ CO₂/năm')}
        </div>
        <div class="ct-chart"><h4>Throughput 24h (TEU/h)</h4><canvas id="ct-c1" height="120"></canvas></div>
        <div class="ct-chart"><h4>Cơ cấu năng lượng</h4><canvas id="ct-c2" height="120"></canvas></div>
      </div>
    </div>

    <div class="ct-sec">15 lớp Bản sao số NDT &nbsp;<span style="color:#15D8A4">8 áp dụng</span> · <span style="color:#f8b23c">4 một phần</span> · <span style="color:#9fb4d2">3 kế hoạch</span></div>
    <div class="ct-sub" style="margin-top:-4px">Mỗi lớp ánh xạ một hệ thống số của cảng — bấm vật thể tương ứng trong mô hình 3D để xem trực tiếp.</div>
    <div class="ct-layers">
      ${LAYERS.map((L) => `<div class="ct-layer"><div class="bar" style="background:${L.c}"></div><div class="bd"><div class="hd"><span class="no">${String(L.n).padStart(2, '0')}</span><span style="font-size:15px">${L.icon}</span><span class="nm">${L.vi}</span><span class="lst lst-${L.st}">${L.st === 'on' ? 'ĐANG ÁP DỤNG' : L.st === 'part' ? 'MỘT PHẦN' : 'KẾ HOẠCH'}</span></div><div class="en">${L.en}</div><div class="use">${L.use}</div></div></div>`).join('')}
    </div>`;
  document.body.appendChild(ov);
  panel = ov;
  document.getElementById('ct-close').onclick = toggle;
  ov.addEventListener('click', (e) => { if (e.target === ov) toggle(); });
}

function buildCharts() {
  if (!window.Chart) return;
  const c1 = document.getElementById('ct-c1');
  const c2 = document.getElementById('ct-c2');
  if (c1) charts.tput = new Chart(c1.getContext('2d'), {
    type: 'line',
    data: { labels: tputHist.map((_, i) => i + 'h'), datasets: [{ data: tputHist, borderColor: '#34E0F0', backgroundColor: 'rgba(52,224,240,.15)', fill: true, tension: .4, pointRadius: 0, borderWidth: 2 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { ticks: { color: '#7d93b0' }, grid: { color: 'rgba(120,150,200,.1)' } } } }
  });
  if (c2) charts.mix = new Chart(c2.getContext('2d'), {
    type: 'doughnut',
    data: { labels: ['Gió', 'Mặt trời', 'Hydro/BESS', 'Lưới'], datasets: [{ data: [34, 18, 11, 37], backgroundColor: ['#34E0F0', '#f8b23c', '#15D8A4', '#3a4658'], borderWidth: 0 }] },
    options: { plugins: { legend: { labels: { color: '#9fb4d2', boxWidth: 12, font: { size: 11 } } } }, cutout: '62%' }
  });
}

const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
const trend = (id, up) => { const e = document.getElementById(id); if (e) { e.className = 'ct-d ' + (up > 0 ? 'up' : up < 0 ? 'down' : 'flat'); e.textContent = (up > 0 ? '▲ ' : up < 0 ? '▼ ' : '› ') + e.textContent.replace(/^[▲▼›]\s*/, ''); } };

let shoreSessions = 2, etaMin = 47;
function tick() {
  if (!open) return;
  S.tput = walk(S.tput, 22, 250, 360); S.berth = walk(S.berth, 4, 60, 96);
  S.moves = walk(S.moves, 2, 26, 36); S.turn = walk(S.turn, 1.6, 18, 32);
  S.yard = walk(S.yard, 2, 60, 90); S.dwell = walk(S.dwell, 0.2, 2.4, 4.8);
  S.co2 += Math.random() * 0.4; S.renew = walk(S.renew, 2, 55, 74);

  let docked = 0; try { docked = vessels.filter(v => v.ps && v.ps.docked).length; } catch (e) { docked = 3; }
  const agv = (() => { try { return trucks.length; } catch (e) { return 10; } })() + 4;

  set('k-tput', Math.round(S.tput)); set('k-berth', Math.round(S.berth));
  set('k-moves', Math.round(S.moves)); set('k-turn', S.turn.toFixed(0));
  set('k-yard', Math.round(S.yard)); set('k-dwell', S.dwell.toFixed(1));
  set('k-ships', docked + ' / ' + (vessels ? vessels.length : 6));
  set('k-agv', agv);

  set('e-co2', S.co2.toFixed(1)); set('e-renew', Math.round(S.renew));
  set('e-shore', shoreSessions); set('e-tree', Math.round(S.co2 * 46));

  // AI cards
  const berths = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'];
  const ships = ['MV NDT PIONEER', 'MSC AURORA', 'EVER GIVEN', 'COSCO HARMONY', 'ONE TRITON', 'MAERSK SELETAR'];
  const k = Math.floor(Date.now() / 6000) % ships.length;
  set('ai-berth', ships[k] + ' → ' + berths[k]);
  etaMin = etaMin > 1 ? etaMin - 1 : 60 + Math.floor(Math.random() * 40);
  set('ai-eta', ships[(k + 1) % ships.length] + ' · ETA ' + etaMin + ' phút');
  const congLvl = S.yard > 84 || agv > 16 ? 'high' : S.yard > 75 ? 'med' : 'low';
  const cong = document.getElementById('ai-cong');
  if (cong) { cong.className = 'ct-badge b-' + congLvl; cong.textContent = congLvl === 'high' ? 'CAO' : congLvl === 'med' ? 'VỪA' : 'THẤP'; }
  set('ai-cong-s', congLvl === 'high' ? 'Khuyến nghị giãn lịch xe & mở thêm làn cổng' : congLvl === 'med' ? 'Theo dõi, chuẩn bị điều tiết' : 'Luồng thông suốt');

  // charts
  if (charts.tput) { tputHist.push(Math.round(S.tput)); tputHist.shift(); charts.tput.data.datasets[0].data = tputHist; charts.tput.update('none'); }
  if (charts.mix) { const r = Math.round(S.renew); charts.mix.data.datasets[0].data = [Math.round(r * 0.53), Math.round(r * 0.28), r - Math.round(r * 0.53) - Math.round(r * 0.28), 100 - r]; charts.mix.update('none'); }
}

function toggle() {
  open = !open;
  panel.classList.toggle('open', open);
  if (open) {
    // Build charts on first open (canvas now has real layout size), else resize.
    if (!charts._built) { buildCharts(); charts._built = true; }
    else { if (charts.tput) charts.tput.resize(); if (charts.mix) charts.mix.resize(); }
    tick();
  }
}

export function initControlTower() {
  injectCSS();
  buildPanel();
  // Top-bar button (reuses the existing .top-btn styling).
  const btn = el('button', 'top-btn', '🗼 Control Tower'); btn.id = 'ct-btn';
  btn.onclick = toggle;
  const host = document.getElementById('dn-toggle');
  if (host && host.parentElement) host.parentElement.appendChild(btn);
  else document.getElementById('topbar')?.appendChild(btn);
  setInterval(tick, 1300);
}
