/* ──────────────────────────────────────────────────────────────────────────
 * sim/copilot.js — NDT15 virtual assistant (Phase 4)
 *
 * Thin orchestration layer over the knowledge base (knowledge.js) and the
 * CHRONOS / scenario API. It (1) handles time & disruption COMMANDS, then (2)
 * falls back to fuzzy Q&A over the port knowledge base — and executes whatever
 * ACTION the matched answer carries (fly the camera, open a feature flow, run a
 * guided tour, descend underground, jump to the future, fork a scenario).
 *
 * Scenario forks require an explicit disruption cue ("hỏng / sự cố / bão / mất
 * điện / tấn công / nếu…"), so informational questions like "cẩu RTG là gì?"
 * resolve to an explanation instead of accidentally breaking a crane.
 * ────────────────────────────────────────────────────────────────────────── */
import { simClock } from './timeline.js';
import { startFork, applyMitigation, stopFork, isForkActive } from './scenario.js';
import { flyTo } from './camera.js';
import { gatePosition, landwardStrip, landwardZones } from '../layout.js';
import * as kb from './knowledge.js';
import { answerLive, surface } from './locate.js';
import { playCinematic } from './cinematic.js';

const strip = s => (s || '').toLowerCase().normalize('NFD').split('').map(c=>{const k=c.charCodeAt(0);return (k>=768&&k<=879)?'':(k===273?'d':c);}).join('');

const gp = gatePosition(), lz = landwardStrip().midZ;
const POI = {
  overview: { eye: [170, 175, 450], look: [0, 5, 60] },
  berth: { eye: [10, 95, 140], look: [0, 5, -22] },
  yard: { eye: [0, 150, 280], look: [0, 5, 160] },
  gate: { eye: [10, 75, gp.z + 95], look: [0, 6, gp.z] },
  energy: { eye: [320, 165, 130], look: [520, 8, 110] },
  rail: { eye: [-310, 130, 210], look: [-380, 5, 200] },
  auto: { eye: [300, 130, lz], look: [200, 6, lz] },
};
const fly = k => {
  const p = POI[k]; if (!p) return;
  surface();
  window.dispatchEvent(new Event('clear-follow-target'));   // release any object follow before moving to a cluster
  flyTo({ x: p.eye[0], y: p.eye[1], z: p.eye[2] }, { x: p.look[0], y: p.look[1], z: p.look[2] }, 1600);
};

// Map a "take me to X" phrase to a cluster POI (or a descend request).
function navTarget(t) {
  if (/tang ngam|duoi long dat|underground|ham/.test(t)) return 'descend';
  if (/cong|gate/.test(t)) return 'gate';
  if (/ben|cau ben|quay|tau cap/.test(t)) return 'berth';
  if (/bai|yard|container/.test(t)) return 'yard';
  if (/nang luong|dien|tuabin|mat troi|gio|solar/.test(t)) return 'energy';
  if (/duong sat|tau hoa|rail|ga tau/.test(t)) return 'rail';
  if (/tu dong|agv|asc/.test(t)) return 'auto';
  if (/tong quan|toan canh|tong the|bao quat/.test(t)) return 'overview';
  return null;
}

// Map a phrase to a FEATURE index in window.FEATS (for run-demo / explain).
function idxByShort(sh) { const F = window.FEATS || []; return F.findIndex(f => f.short === sh); }
function featureIndex(t) {
  if (/dieu phoi|cap ben|\bben\b|berth|jit/.test(t)) return idxByShort('BẾN');
  if (/\bbai\b|yard|xep chong|bai container so/.test(t)) return idxByShort('BÃI');
  if (/\bcong\b|gate|alpr|barrier|booking/.test(t)) return idxByShort('CỔNG');
  if (/an ninh|drone|uav|radar|security/.test(t)) return idxByShort('AN NINH');
  if (/moi truong|esg|carbon|quan trac|cang xanh|\bxanh\b/.test(t)) return idxByShort('MÔI TRƯỜNG');
  if (/nang luong|\bdien\b|solar|tuabin|dien gio|mat troi|\bpin\b/.test(t)) return idxByShort('NĂNG LƯỢNG');
  if (/tong quan|toan canh|tong the|overview/.test(t)) return idxByShort('TỔNG QUAN');
  return -1;
}
// Run-the-simulation cue (vs just "là gì / ở đâu" which only selects the feature).
const RUN_CUE = /(chay|demo|mo phong|run|trinh dien|trinh chieu|chay thu|dien thu|chay luong|bat dau mo phong|xem mo phong|mo phong digital)/;

/* ── async narration (tour steps) ─────────────────────────────────────────── */
let notify = () => {};
export function setNotifier(fn) { notify = fn; }

const FOCUS = { CRANE_FAIL: 'berth', VESSEL_SURGE: 'berth', STORM_SURGE: 'berth', GATE_CYBER: 'gate', POWER_OUTAGE: 'energy' };

function scenarioId(t) {
  if (/bao|nuoc dang|ngap|trieu|storm|lut/.test(t)) return 'STORM_SURGE';
  if (/tan cong|cyber|hack|tin tac|an ninh cong/.test(t)) return 'GATE_CYBER';
  if (/mat dien|cup dien|power|luoi dien|blackout/.test(t)) return 'POWER_OUTAGE';
  if (/don|surge|nhieu tau|3 tau|neo cho|ket tau/.test(t)) return 'VESSEL_SURGE';
  if (/cau|crane|sts|rtg|boc do/.test(t)) return 'CRANE_FAIL';
  return null;
}

function openFeature(ref, autoplay) {
  const F = window.FEATS || [];
  const idx = typeof ref === 'number' ? ref : F.findIndex(f => f.short === ref || (f.name || '').includes(ref));
  const btns = document.querySelectorAll('#fnav .fn');
  if (idx >= 0 && btns[idx]) {
    btns[idx].click();
    if (autoplay) setTimeout(() => { const b = document.getElementById('btn-autoplay'); if (b) b.click(); }, 1300);
  }
}
function openPicker() { const b = document.querySelector('[data-a="fork"]'); if (b) b.click(); }

function exec(a) {
  if (!a) return;
  if (a.fly) fly(a.fly);
  if (a.feature !== undefined) { surface(); openFeature(a.feature, a.autoplay); }
  if (a.descend) window.dispatchEvent(new Event('ug-descend'));
  if (a.future) simClock.seek(simClock.now + a.future);
  if (a.picker) openPicker();
  if (a.fork) { startFork(a.fork); simClock.goLive(); if (FOCUS[a.fork]) fly(FOCUS[a.fork]); }
}

/* ── cinematic guided tour (orbit + dolly zoom around each feature) ────────── */
const _gx = (landwardZones().green.minX + landwardZones().green.maxX) / 2;
const _ax = (landwardZones().auto.minX + landwardZones().auto.maxX) / 2;
function tourShots() {
  return [
    { look: [0, 8, 90], r0: 520, r1: 430, h0: 250, h1: 205, a0: -2.2, aSpd: 0.12, dur: 7, msg: '🧭 Bắt đầu tham quan Cảng NDT15! Đây là toàn cảnh — bản sao số 3D của một cảng biển thông minh.' },
    { look: [0, 10, -22], r0: 195, r1: 92, h0: 88, h1: 40, a0: 0.6, aSpd: 0.34, dur: 8, msg: '🚢 Khu cầu bến: tàu cập theo điều phối Just-in-Time, cẩu STS giàn cao bốc/dỡ container — đang xoay quanh & zoom cận.' },
    { look: [0, 12, 160], r0: 280, r1: 150, h0: 155, h1: 88, a0: 0.9, aSpd: 0.30, dur: 8, msg: '📦 Bãi container số hóa: cẩu RTG xếp dỡ, AI tối ưu xếp chồng để không đảo chuyển vô ích.' },
    { look: [gp.x, 8, gp.z], r0: 125, r1: 50, h0: 72, h1: 30, a0: 1.6, aSpd: 0.42, dur: 7, msg: '🚪 Cổng tự động: camera ALPR nhận diện biển số, mở barrier dưới 2 giây.' },
    { look: [360, 22, lz], r0: 175, r1: 88, h0: 122, h1: 52, a0: 0.4, aSpd: 0.36, dur: 7, msg: '☀️ Năng lượng tái tạo: pin mặt trời trên mái kho + tuabin gió tạo microgrid cấp điện sạch.' },
    { look: [_gx, 12, lz], r0: 150, r1: 76, h0: 95, h1: 42, a0: 2.0, aSpd: 0.36, dur: 7, msg: '🟢 Green Energy Hub: sản xuất & lưu trữ hydro xanh, pin BESS, trạm sạc e-truck/e-RTG.' },
    { look: [_ax, 12, lz], r0: 150, r1: 80, h0: 95, h1: 46, a0: -1.0, aSpd: 0.40, dur: 7, msg: '🤖 Bến tự động hóa: đội AGV không người lái + cẩu ASC xếp dỡ tự động 24/7.' },
    { look: [0, 8, 90], r0: 430, r1: 520, h0: 205, h1: 255, a0: 1.0, aSpd: 0.10, dur: 6, msg: '⏳ Và đặc biệt là CHRONOS — cỗ máy thời gian: tua quá khứ, xem tương lai, mô phỏng sự cố. Cứ hỏi tôi bất cứ điều gì về cảng nhé!' },
  ];
}
function startTour() {
  surface();
  window.dispatchEvent(new Event('clear-follow-target'));   // release any follow/highlight first
  const first = playCinematic(tourShots(), notify);
  return first + '\n(Tôi sẽ xoay quanh & zoom qua từng khu trong ~55 giây — bạn chạm chuột bất kỳ lúc nào để dừng.)';
}

/* ── main entry ───────────────────────────────────────────────────────────── */
export function parse(text) {
  const raw = (text || '').trim();
  const t = strip(raw);
  if (!t) return kb.help();

  // — control / time commands —
  if (/(bo focus|bo theo doi|thoi theo doi|huy chon|ngung bam|bo chon|khong theo doi|thoat focus|huy focus)/.test(t)) {
    window.dispatchEvent(new Event('clear-follow-target'));
    return '✓ Đã bỏ theo dõi & bỏ chọn vật thể. Camera tự do trở lại.';
  }
  if (/(hoa giai|giam thiet hai|khac phuc|mitigat|cuu nguy|xu ly su co)/.test(t)) { applyMitigation(); return '🤖 Đã áp dụng phương án hóa giải — theo dõi đường phản thực uốn lại gần baseline.'; }
  if (/(tam dung|tam ngung|pause|dung lai)/.test(t)) { simClock.pause(); return '⏸ Đã tạm dừng con trỏ thời gian (thực tại vẫn tiếp diễn).'; }
  if (/(tiep tuc|resume|chay tiep|play)/.test(t)) { simClock.play(); return '▶ Tiếp tục.'; }
  if (/(tua lai|tua nguoc|quay lai|qua khu|rewind|replay|lui lai)/.test(t)) { simClock.scrub(-4); return '⏪ Đang tua ngược thời gian của cảng… (bấm ⦿ Thực Tại để quay về hiện tại)'; }
  if (/(tuong lai|tien tri|du bao tuong lai|future|sap toi|90 phut)/.test(t)) { simClock.seek(simClock.now + 90); return '🔮 Đang hé lộ tương lai — lớp bóng ma cyan cho thấy tàu sẽ ở đâu.'; }
  if (/(thuc tai|ve hien tai|hien tai|bay gio|live|realtime)/.test(t) && !/tuong lai|qua khu/.test(t)) { simClock.goLive(); return '⦿ Đã về thời gian thực (hiện tại).'; }
  if (/(dong kich ban|tat mo phong|huy mo phong|ket thuc|reset)/.test(t) && isForkActive()) { stopFork(); simClock.goLive(); return '↩ Đã đóng kịch bản, về thực tại.'; }
  if (/(tham quan|dao quanh|tour|gioi thieu di|di mot vong|dan toi di tham|dan di mot vong)/.test(t)) return startTour();

  // — RUN a feature's Digital-Twin simulation ("chạy/demo/mô phỏng tính năng X") —
  // Must come before the live-entity & disruption checks because "mô phỏng" is
  // also a disruption cue. Plain "tính năng X là gì / ở đâu" has no RUN cue, so it
  // falls through to the knowledge base which just SELECTS the feature.
  {
    const fIdx = featureIndex(t);
    if (fIdx >= 0 && RUN_CUE.test(t)) {
      surface();
      window.dispatchEvent(new Event('clear-follow-target'));
      openFeature(fIdx, true);
      return `▶ Đang chạy mô phỏng Digital Twin của tính năng "${(window.FEATS || [])[fIdx].short}" — cửa sổ mô phỏng sẽ mở ra.`;
    }
  }

  // — live entity lookup (specific objects: bãi 15, tàu OCEAN, xe ở bãi 3, tàu hỏa…) —
  const live = answerLive(raw);
  if (live.handled) return live.text;

  // — navigation: "dẫn/đưa tôi tới/ra X" (surfaces from the basement first) —
  if (/(dan toi|dua toi|cho toi (den|toi|ra|qua)|di den|di toi|den khu|^ra |^toi |^den |^di den|bay (den|toi)|chi (toi |cho toi )?(den|toi)|focus|xem khu|den khu vuc|cho xem)/.test(t)) {
    const poi = navTarget(t);
    if (poi === 'descend') { window.dispatchEvent(new Event('ug-descend')); return '⬇ Đang đưa bạn xuống tầng hạ tầng ngầm.'; }
    if (poi) { fly(poi); return '🎥 Đang đưa bạn tới khu vực đó (camera đã nổi lên mặt đất nếu đang ở tầng ngầm).'; }
  }
  if (/^(menu|giup|help|ban giup gi|lam duoc gi|ban lam duoc|tro giup)$/.test(t) || /\b(ban lam duoc gi|giup duoc gi|menu)\b/.test(t)) return kb.help();

  // — disruption → scenario fork —
  if (/(neu |^neu|hong|hu hong|su co|sự|kich ban|fork|tan cong|cyber|hack|tin tac|bao|nuoc dang|trieu cuong|ngap|mat dien|cup dien|blackout|don tau|surge|chay no|what if|chuyen gi.*neu|dieu gi.*neu)/.test(t)) {
    const id = scenarioId(t);
    if (id) { exec({ fork: id }); const F = window.FEATS; void F; return '⚡ Phân nhánh thực tại: đang mô phỏng kịch bản. Mở cửa sổ mô phỏng ở giữa màn hình — bấm "AI Hóa Giải" hoặc hỏi tôi cách giảm thiệt hại.'; }
    openPicker();
    return '⚡ Bạn muốn mô phỏng sự cố nào? Tôi vừa mở bảng kịch bản (cẩu hỏng · dồn tàu · bão+ngập · tấn công mạng · mất điện).';
  }

  // — knowledge base Q&A (the bulk: 500–1000 phrasings) —
  const r = kb.answer(raw);
  exec(r.action);
  return r.text;
}

export const EXAMPLES = kb.CHIPS;
