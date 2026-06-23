/* ──────────────────────────────────────────────────────────────────────────
 * sim/copilot.js — Natural-language command layer (Phase 4)
 *
 * Because Phases 0–3 expose a clean API (simClock.seek, startFork, mitigation,
 * flyTo), the copilot is a thin intent parser: it maps a typed question to a
 * sequence of those calls and narrates what it did — answering by ACTING in the
 * scene. Rule/keyword based (no network); an LLM can be slotted in later behind
 * the same parse() contract.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { simClock } from './timeline.js';
import { SCENARIOS, startFork, applyMitigation, stopFork } from './scenario.js';
import { flyTo } from './camera.js';
import { PARAMS, berthX, gatePosition } from '../layout.js';

const BX = berthX(), gp = gatePosition();
const FOCUS = {
  CRANE_FAIL: { eye: new THREE.Vector3(BX[2] + 60, 60, 60), look: new THREE.Vector3(BX[2], 20, PARAMS.BERTH_Z) },
  VESSEL_SURGE: { eye: new THREE.Vector3(120, 90, -180), look: new THREE.Vector3(60, 5, -300) },
  STORM_SURGE: { eye: new THREE.Vector3(0, 120, 140), look: new THREE.Vector3(0, 0, PARAMS.BERTH_Z) },
  GATE_CYBER: { eye: new THREE.Vector3(60, 70, gp.z + 90), look: new THREE.Vector3(0, 6, gp.z) },
  POWER_OUTAGE: { eye: new THREE.Vector3(180, 90, 340), look: new THREE.Vector3(100, 6, 320) },
};

function match(text) {
  const t = text.toLowerCase();
  if (/(bão|storm|nước dâng|ngập|flood|triều)/.test(t)) return 'STORM_SURGE';
  if (/(tấn công|cyber|hack|mạng|an ninh cổng)/.test(t)) return 'GATE_CYBER';
  if (/(mất điện|cúp điện|power|lưới điện|blackout)/.test(t)) return 'POWER_OUTAGE';
  if (/(dồn|surge|nhiều tàu|3 tàu|kẹt tàu|neo chờ)/.test(t)) return 'VESSEL_SURGE';
  if (/(cẩu|crane|sts|b-?0?3|bốc dỡ)/.test(t)) return 'CRANE_FAIL';
  return null;
}

// Returns a narration string; performs the actions.
export function parse(text) {
  const t = text.toLowerCase().trim();
  if (!t) return '';

  if (/(hóa giải|giảm thiệt hại|khắc phục|mitigat|cứu|xử lý)/.test(t)) {
    applyMitigation();
    return '🤖 Đã áp dụng phương án hóa giải — theo dõi đường phản thực uốn lại gần baseline.';
  }
  if (/(dừng|tạm dừng|pause|đứng)/.test(t)) { simClock.pause(); return '⏸ Đã tạm dừng dòng thời gian.'; }
  if (/(tiếp tục|chạy|play|resume)/.test(t)) { simClock.play(); return '▶ Tiếp tục dòng thời gian.'; }
  if (/(tua lại|quay lại|quá khứ|rewind|replay|lùi)/.test(t)) {
    simClock.scrub(-4);
    return '⏪ Đang tua lại quá khứ của cảng…';
  }
  if (/(tương lai|tiên tri|dự báo|future|sắp tới|2 giờ|90 phút)/.test(t)) {
    simClock.seek(simClock.now + Math.min(simClock.horizonFuture, 90));
    return '🔮 Hé lộ tương lai — lớp bóng ma cyan cho thấy tàu sẽ ở đâu.';
  }
  if (/(đóng|tắt|hủy|bình thường|reset|kết thúc)/.test(t)) {
    stopFork(); simClock.goLive(); return '↩ Đã đóng kịch bản, về thực tại.';
  }

  const id = match(t);
  if (id) {
    const sc = startFork(id);
    const f = FOCUS[id]; if (f) flyTo(f.eye, f.look, 1600);
    return `⚡ Phân nhánh thực tại: ${sc.icon} ${sc.label}. Đang mô phỏng cascade — bấm "AI Hóa Giải" hoặc hỏi tôi cách giảm thiệt hại.`;
  }
  return '🤔 Tôi chưa rõ. Thử: "nếu cẩu B3 hỏng?", "bão nước dâng", "tấn công mạng cổng", "mất điện", "dồn 3 tàu", "tua lại", "tương lai", "hóa giải".';
}

export const EXAMPLES = [
  'Nếu cẩu B3 hỏng lúc này thì sao?',
  'Bão và nước dâng tràn cảng',
  'Tấn công mạng vào cổng',
  'Mất điện lưới',
  'Tua lại 1 phút trước',
  'Cho tôi xem tương lai',
];
