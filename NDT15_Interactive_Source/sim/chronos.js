/* ──────────────────────────────────────────────────────────────────────────
 * sim/chronos.js — CHRONOS orchestrator + UI (binds Phases 0–4)
 *
 * Owns the bottom CHRONOS bar (transport + scrub + Fork + Future), the scenario
 * picker, and the Copilot box, and exposes the per-frame hooks the scene's
 * animation loop calls. With no user interaction it leaves simClock in live/1×,
 * so the app runs exactly as before.
 *
 * scene.js contract:
 *   initChronos()           once, after every subsystem is built
 *   beginFrame(dtWall) → { el, dt, past }   advance time; el/dt drive updaters
 *   applyPast(el)           replay recorded transforms (when past)
 *   record(el)              capture a snapshot (when live)
 *   endFrame(dt)            update UI, ghost, scenario overlay
 * ────────────────────────────────────────────────────────────────────────── */
import { simClock } from './timeline.js';
import * as snapshot from './snapshot.js';
import { initGhost, updateGhost, ghostBerthForecast } from './ghost.js';
import { updateHighlight } from './highlight.js';
import { initCinematic, updateCinematic } from './cinematic.js';
import { initGlassbox } from './glassbox.js';
import { SCENARIOS, startFork, stopFork, isForkActive, update as updateFork } from './scenario.js';
import { parse, EXAMPLES, setNotifier } from './copilot.js';

let bar = null, scrub = null, timeEl = null, playBtn = null, modeEl = null;
let dragging = false;
let picker = null, copilotLog = null;

// Wall-clock readout: the present shows the REAL current time; past/future are
// that time offset by (t − now) minutes (1 sim-second is presented as 1 minute).
function clockStr(deltaMin) {
  const d = new Date(Date.now() + deltaMin * 60000);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
// Scrub track maps NOW to the exact centre (0.5). The LEFT half spans the
// ACTUALLY AVAILABLE history (oldest recorded frame → now) rather than the full
// 150 s horizon, so ⏮ "oldest" parks the handle at the far left even early in a
// session; the RIGHT half spans the forecast horizon.
function pastFloor() {
  const o = snapshot.oldestTime ? snapshot.oldestTime() : 0;
  return Math.max(simClock.minTime(), o);
}
function timeToFrac(t) {
  if (t <= simClock.now) {
    const span = Math.max(1, simClock.now - pastFloor());
    return Math.max(0, 0.5 - (simClock.now - t) / span * 0.5);
  }
  return Math.min(1, 0.5 + (t - simClock.now) / simClock.horizonFuture * 0.5);
}
function fracToTime(frac) {
  if (frac <= 0.5) return simClock.now - (0.5 - frac) / 0.5 * (simClock.now - pastFloor());
  return simClock.now + (frac - 0.5) / 0.5 * simClock.horizonFuture;
}

// ◀◀ / ▶▶ cycle the scrub speed ×2 → ×4 → ×8 each press (per direction).
const SPEEDS = [2, 4, 8];
function cycleSpeed(dir) {
  const cur = Math.abs(simClock.rate);
  const sameDir = Math.sign(simClock.rate) === dir && simClock.playing;
  const idx = SPEEDS.indexOf(cur);
  const next = (sameDir && idx >= 0) ? SPEEDS[(idx + 1) % SPEEDS.length] : 4;
  simClock.scrub(dir * next);   // direction + speed only; never jumps zones
}

export function initChronos() {
  injectCSS();
  initGhost();
  initGlassbox();
  initCinematic();
  buildBar();
  buildPicker();
  buildCopilot();
}

/* ── per-frame hooks (called by scene.js) ─────────────────────────────────────
 * Reality always advances at the live edge (`now`): integrators run every frame
 * with the real wall dt and snapshots record continuously. `past` only governs
 * what is DISPLAYED — when scrubbing history, applyPast() overrides the movers'
 * transforms with the recorded frame AFTER the live update has run. */
export function beginFrame(dtWall) {
  simClock.tick(dtWall);
  return { el: simClock.now, dt: simClock.dt, past: simClock.isPast() };
}
export function applyPast() { snapshot.apply(simClock.time); }
export function record() { snapshot.record(simClock.now); }

export function endFrame(dt) {
  // Ghost / precognition
  const fut = simClock.isFuture();
  updateGhost(fut, simClock.futureTime());
  // Scenario overlay (chart/markers/effects/glassbox)
  updateFork(Math.max(0, dt) || 0.016);
  // Object highlight (pulse + follow moving entities + projected label)
  updateHighlight(Math.max(0, dt) || 0.016);
  // Cinematic guided-tour camera (orbit + dolly zoom around each feature)
  updateCinematic(Math.max(0, dt) || 0.016);
  // UI readouts
  if (!dragging) refreshBar();
}

/* ── CHRONOS bar ──────────────────────────────────────────────────────────── */
function buildBar() {
  bar = document.createElement('div'); bar.id = 'chronos-bar';
  bar.innerHTML = `
    <div class="cb-left">
      <button class="cb-b" data-a="oldest" title="Về mốc sớm nhất">⏮</button>
      <button class="cb-b" data-a="rew" title="Tua ngược (bấm lại: ×2→×4→×8)">◀◀</button>
      <button class="cb-b cb-play" data-a="play" title="Chạy / Dừng">❚❚</button>
      <button class="cb-b" data-a="ff" title="Tua tới (bấm lại: ×2→×4→×8)">▶▶</button>
      <button class="cb-b" data-a="latest" title="Tới mốc muộn nhất (cuối dự báo)">⏭</button>
    </div>
    <div class="cb-center">
      <div class="cb-clock"><span id="cb-time">08:00</span><span id="cb-mode" class="cb-mode live">● LIVE</span></div>
      <input id="cb-scrub" type="range" min="0" max="1000" value="556" step="1">
      <div class="cb-track-lbl"><span>◀ QUÁ KHỨ</span><span>HIỆN TẠI</span><span>TƯƠNG LAI ▶</span></div>
    </div>
    <div class="cb-right">
      <button class="cb-act cb-nowbtn" data-a="now" title="Quay về thời gian thực">⦿ Thực Tại</button>
      <button class="cb-act cb-fork" data-a="fork" title="Phân nhánh thực tại">⚡ Fork Reality</button>
    </div>`;
  document.body.appendChild(bar);
  scrub = bar.querySelector('#cb-scrub');
  timeEl = bar.querySelector('#cb-time');
  modeEl = bar.querySelector('#cb-mode');
  playBtn = bar.querySelector('.cb-play');

  bar.querySelectorAll('[data-a]').forEach(b => b.onclick = () => action(b.dataset.a));

  scrub.addEventListener('pointerdown', () => { dragging = true; });
  scrub.addEventListener('pointerup', () => { dragging = false; });
  scrub.addEventListener('input', () => { simClock.seek(fracToTime(scrub.value / 1000)); refreshBar(); });
}

function action(a) {
  switch (a) {
    case 'oldest': simClock.seek(pastFloor()); simClock.pause(); break;   // ⏮ earliest recorded
    case 'rew': cycleSpeed(-1); break;        // ◀◀ scrub backward (cycle ×2→×4→×8) — works in any zone
    case 'play': simClock.toggle(); break;
    case 'ff': cycleSpeed(1); break;          // ▶▶ scrub forward (cycle ×2→×4→×8) — past, present AND future
    case 'latest': simClock.seek(simClock.maxTime()); simClock.pause(); break;  // ⏭ furthest forecast
    case 'now': simClock.goLive(); break;     // ⦿ back to real-time present
    case 'fork': togglePicker(); break;
  }
  refreshBar();
}

function refreshBar() {
  const t = simClock.time;
  timeEl.textContent = clockStr(t - simClock.now);     // real wall-clock at the present; offset elsewhere
  // mode badge — zone + scrub direction/speed + minutes from the present
  let cls = 'live', txt = '● LIVE';
  const off = Math.round(simClock.now - t);            // >0 in the past, <0 in the future
  const mul = Math.abs(simClock.rate);
  const spd = (simClock.playing && mul > 1) ? ' ×' + mul : '';
  if (simClock.isFuture()) {
    const dir = (simClock.playing && simClock.rate !== 0) ? (simClock.rate > 0 ? '⏩' : '⏪') : '🔮';
    cls = 'future'; txt = dir + spd + ' +' + (-off) + 'p · dự báo ' + ghostBerthForecast(t) + ' tàu cập';
  } else if (simClock.isPast()) {
    const dir = !simClock.playing ? '❚❚' : (simClock.rate < 0 ? '⏪' : '⏩');
    cls = !simClock.playing ? 'pause' : (simClock.rate < 0 ? 'past' : (mul > 1 ? 'fast' : 'past'));
    txt = dir + spd + ' −' + off + 'p';
  } else if (!simClock.playing && simClock.mode === 'scrub') {
    cls = 'pause'; txt = '❚❚ PAUSE';
  }
  modeEl.className = 'cb-mode ' + cls; modeEl.textContent = txt;
  playBtn.textContent = (simClock.mode === 'live' || simClock.playing) ? '❚❚' : '▶';
  if (!dragging) scrub.value = Math.max(0, Math.min(1000, timeToFrac(t) * 1000));
}

/* ── Scenario picker ──────────────────────────────────────────────────────── */
function buildPicker() {
  picker = document.createElement('div'); picker.id = 'chronos-picker';
  picker.innerHTML = `<div class="cp-h">⚡ Chọn kịch bản phân nhánh thực tại</div>
    <div class="cp-grid">${SCENARIOS.map(s => `<button class="cp-item" data-id="${s.id}">
      <div class="cp-ic">${s.icon}</div><div class="cp-lb">${s.label}</div>
      <div class="cp-cat">${s.cat}</div><div class="cp-ds">${s.desc}</div></button>`).join('')}</div>`;
  document.body.appendChild(picker);
  picker.querySelectorAll('.cp-item').forEach(b => b.onclick = () => {
    startFork(b.dataset.id); picker.classList.remove('show');
    simClock.goLive();   // play the fork from the present
  });
}
function togglePicker() {
  if (isForkActive()) { stopFork(); return; }
  picker.classList.toggle('show');
}

/* ── Copilot box ──────────────────────────────────────────────────────────── */
function buildCopilot() {
  const box = document.createElement('div'); box.id = 'chronos-copilot';
  box.innerHTML = `
    <div class="cc-h">🤖 Trợ lý ảo Cảng NDT15 <button id="cc-min">—</button></div>
    <div class="cc-log" id="cc-log"></div>
    <div class="cc-chips">${EXAMPLES.slice(0, 6).map(e => `<button class="cc-chip">${e}</button>`).join('')}</div>
    <div class="cc-in"><input id="cc-input" placeholder="Hỏi bất cứ điều gì về cảng…"><button id="cc-send">➤</button></div>`;
  document.body.appendChild(box);
  copilotLog = box.querySelector('#cc-log');
  const input = box.querySelector('#cc-input');
  const send = () => { const v = input.value.trim(); if (!v) return; ask(v); input.value = ''; };
  box.querySelector('#cc-send').onclick = send;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  box.querySelectorAll('.cc-chip').forEach(c => c.onclick = () => ask(c.textContent));
  box.querySelector('#cc-min').onclick = () => box.classList.toggle('min');
  setNotifier(msg => log('bot', msg));     // lets the copilot narrate the guided tour over time
  log('bot', 'Xin chào! Tôi là Trợ lý ảo Cảng NDT15 — hỏi tôi mọi thứ: giới thiệu, giải thích vật thể, chạy luồng vận hành, dẫn đi tham quan, tua thời gian hay mô phỏng sự cố. Thử bấm một gợi ý bên dưới 👇');
}
function ask(text) { log('user', text); const r = parse(text); if (r) setTimeout(() => log('bot', r), 250); refreshBar(); }
function log(who, msg) {
  const d = document.createElement('div'); d.className = 'cc-msg ' + who; d.textContent = msg;
  copilotLog.appendChild(d); copilotLog.scrollTop = copilotLog.scrollHeight;
}

/* ── styles ───────────────────────────────────────────────────────────────── */
function injectCSS() {
  const css = `
  #chronos-bar{position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:55;
    display:flex;align-items:center;gap:14px;padding:10px 16px;border-radius:16px;
    background:rgba(11,18,32,.82);backdrop-filter:blur(14px);border:1px solid rgba(52,224,240,.22);
    box-shadow:0 10px 40px rgba(0,0,0,.5);font-family:inherit;color:#dff;width:min(880px,94vw)}
  #chronos-bar .cb-left,#chronos-bar .cb-right{display:flex;gap:6px;align-items:center}
  #chronos-bar .cb-center{flex:1;display:flex;flex-direction:column;gap:3px}
  .cb-b{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#cfe;
    width:34px;height:30px;border-radius:8px;cursor:pointer;font-size:13px;transition:.15s}
  .cb-b:hover{background:rgba(52,224,240,.18);border-color:#34E0F0}
  .cb-play{background:rgba(52,224,240,.16)}
  .cb-clock{display:flex;justify-content:space-between;align-items:center;font-variant-numeric:tabular-nums}
  #cb-time{font-size:18px;font-weight:700;letter-spacing:1px;color:#fff}
  .cb-mode{font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px}
  .cb-mode.live{color:#27C281;background:rgba(39,194,129,.14)}
  .cb-mode.past{color:#F8B23C;background:rgba(248,178,60,.14)}
  .cb-mode.future{color:#34E0F0;background:rgba(52,224,240,.14)}
  .cb-mode.fast{color:#9cf;background:rgba(120,160,255,.16)}
  .cb-mode.pause{color:#bbb;background:rgba(255,255,255,.08)}
  #cb-scrub{width:100%;accent-color:#34E0F0;cursor:pointer}
  .cb-track-lbl{display:flex;justify-content:space-between;font-size:9px;color:#7a8aa0;letter-spacing:.5px}
  .cb-act{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#dff;
    padding:7px 12px;border-radius:10px;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;transition:.15s}
  .cb-act:hover{border-color:#34E0F0;background:rgba(52,224,240,.14)}
  .cb-act.on{background:rgba(52,224,240,.22);border-color:#34E0F0;color:#fff}
  .cb-nowbtn{background:rgba(39,194,129,.18);border-color:rgba(39,194,129,.5);color:#bdf5e0}
  .cb-nowbtn:hover{background:rgba(39,194,129,.32);border-color:#27C281;color:#fff}
  .cb-fork{background:linear-gradient(135deg,rgba(255,84,104,.25),rgba(176,124,255,.25));border-color:rgba(255,84,104,.5)}
  .cb-fork:hover{background:linear-gradient(135deg,rgba(255,84,104,.4),rgba(176,124,255,.4))}

  #chronos-picker{position:fixed;left:50%;bottom:146px;transform:translateX(-50%) translateY(12px);
    z-index:56;width:min(720px,94vw);padding:16px;border-radius:16px;opacity:0;pointer-events:none;transition:.22s;
    background:rgba(11,18,32,.94);backdrop-filter:blur(16px);border:1px solid rgba(255,84,104,.3);box-shadow:0 16px 50px rgba(0,0,0,.6)}
  #chronos-picker.show{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}
  .cp-h{color:#fff;font-weight:700;margin-bottom:12px;font-size:14px}
  .cp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
  .cp-item{text-align:left;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);
    border-radius:12px;padding:12px;cursor:pointer;color:#cfe;transition:.15s}
  .cp-item:hover{border-color:#34E0F0;background:rgba(52,224,240,.1);transform:translateY(-2px)}
  .cp-ic{font-size:24px}.cp-lb{font-weight:700;color:#fff;margin-top:4px}
  .cp-cat{font-size:10px;color:#34E0F0;text-transform:uppercase;letter-spacing:.5px;margin:2px 0 6px}
  .cp-ds{font-size:11px;color:#9ab;line-height:1.4}

  #chronos-stage{position:fixed;left:50%;top:50%;transform:translate(-50%,-46%) scale(.96);z-index:57;
    width:min(880px,94vw);max-height:86vh;overflow:auto;padding:18px 20px;border-radius:20px;
    background:rgba(9,15,28,.96);backdrop-filter:blur(18px);border:1px solid rgba(255,84,104,.34);
    box-shadow:0 24px 80px rgba(0,0,0,.7);color:#dff;opacity:0;pointer-events:none;transition:.28s cubic-bezier(.16,1,.3,1)}
  #chronos-stage.show{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1)}
  .cs-head{display:flex;align-items:center;gap:12px}
  .cs-ic{font-size:30px}
  .cs-htxt{flex:1}
  #cs-title{font-weight:800;color:#fff;font-size:18px;line-height:1.1}
  #cs-cat{font-size:11px;color:#ff8a96;text-transform:uppercase;letter-spacing:.6px;margin-top:2px}
  .cs-uni{font-size:10px;color:#9ab}
  .cs-dot{display:inline-block;width:9px;height:9px;border-radius:50%;vertical-align:middle}
  .cs-dot.g{background:#27C281}.cs-dot.r{background:#ff5468}
  #cs-min,#cs-x{background:rgba(255,255,255,.08);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px;line-height:1}
  #cs-min:hover{background:rgba(52,224,240,.25)} #cs-x:hover{background:rgba(255,84,104,.3)}
  .cs-run{display:none;font-size:10px;font-weight:700;color:#ff7a88;margin-right:8px}
  .cs-run::before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:#ff5468;margin-right:4px;animation:csblink 1.1s infinite}
  @keyframes csblink{0%,100%{opacity:1}50%{opacity:.25}}
  /* minimised: collapse to a compact title bar pinned to the top so the map is visible while the scenario keeps running */
  #chronos-stage.min{top:72px;transform:translate(-50%,0);width:min(560px,92vw);max-height:none;padding:8px 14px;overflow:visible}
  #chronos-stage.min .cs-desc,#chronos-stage.min .cs-grid,#chronos-stage.min .cs-foot{display:none}
  #chronos-stage.min .cs-ic{font-size:22px}
  #chronos-stage.min #cs-title{font-size:14px}
  #chronos-stage.min .cs-run{display:inline-block}
  .cs-desc{font-size:12.5px;color:#bcd;margin:8px 0 14px;line-height:1.5}
  .cs-grid{display:grid;grid-template-columns:1fr 1.25fr;gap:18px}
  .cs-cap{font-size:11px;font-weight:700;color:#7df3cf;letter-spacing:.4px;margin:0 0 8px}
  .cs-col-right .cs-cap{margin-top:14px}
  .cs-col-right .cs-cap:first-child{margin-top:0}
  .cs-steps{display:flex;flex-direction:column;gap:2px}
  .cs-step{display:flex;gap:10px;padding:9px;border-radius:10px;border-left:3px solid rgba(255,255,255,.12);opacity:.45;transition:.25s}
  .cs-step.done{opacity:.7;border-left-color:#27C281}
  .cs-step.active{opacity:1;border-left-color:#ff5468;background:rgba(255,84,104,.12)}
  .cs-st-time{font-size:11px;font-weight:700;color:#ffd070;min-width:34px;font-variant-numeric:tabular-nums}
  .cs-st-title{font-size:12.5px;font-weight:700;color:#fff}
  .cs-st-desc{font-size:11px;color:#9ab;line-height:1.4;margin-top:2px}
  .cs-flow{display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-bottom:4px}
  .cs-node{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);color:#bcd;
    border-radius:9px;padding:7px 9px;font-size:11px;font-weight:600;cursor:pointer;transition:.25s}
  .cs-node.hit{background:rgba(255,84,104,.22);border-color:#ff5468;color:#fff;box-shadow:0 0 14px rgba(255,84,104,.35)}
  .cs-arr{color:#5a6a82;font-weight:700}
  .cs-chart{height:150px;position:relative}
  .cs-tiles{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:12px}
  .cf-tile{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:9px;
    padding:7px 3px;text-align:center;cursor:pointer;transition:.15s}
  .cf-tile:hover{border-color:#ffd070;background:rgba(255,208,112,.1)}
  .cf-tv{font-size:14px;font-weight:700}.cf-tn{font-size:8.5px;color:#9ab;margin-top:2px}
  .cs-foot{display:flex;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap}
  #cs-mit{background:linear-gradient(135deg,rgba(39,194,129,.32),rgba(52,224,240,.32));
    border:1px solid rgba(39,194,129,.5);color:#fff;padding:10px 16px;border-radius:11px;cursor:pointer;font-weight:700;font-size:13px}
  #cs-mit:disabled{opacity:.5;cursor:default}
  #cs-mitnote{font-size:11px;color:#3ce3a0;line-height:1.4;flex:1;min-width:160px}
  .cs-hint{font-size:10px;color:#7a8aa0}
  @media(max-width:720px){.cs-grid{grid-template-columns:1fr}.cs-tiles{grid-template-columns:repeat(3,1fr)}}

  #chronos-copilot{position:fixed;left:16px;bottom:24px;z-index:54;width:300px;border-radius:16px;
    background:rgba(11,18,32,.9);backdrop-filter:blur(16px);border:1px solid rgba(176,124,255,.32);
    box-shadow:0 12px 40px rgba(0,0,0,.5);color:#dff;overflow:hidden}
  #chronos-copilot.min .cc-log,#chronos-copilot.min .cc-chips,#chronos-copilot.min .cc-in{display:none}
  .cc-h{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;font-weight:700;font-size:13px;
    background:rgba(176,124,255,.16);color:#fff}
  #cc-min{background:none;border:none;color:#cfe;cursor:pointer;font-size:14px}
  .cc-log{max-height:200px;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:7px}
  .cc-msg{font-size:11.5px;line-height:1.45;padding:7px 10px;border-radius:10px;max-width:92%;white-space:pre-line}
  .cc-msg.user{align-self:flex-end;background:rgba(52,224,240,.16);color:#dff}
  .cc-msg.bot{align-self:flex-start;background:rgba(255,255,255,.06);color:#cfe}
  .cc-chips{display:flex;flex-wrap:wrap;gap:5px;padding:0 10px 8px}
  .cc-chip{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#9cf;
    font-size:10px;padding:4px 8px;border-radius:14px;cursor:pointer}
  .cc-chip:hover{border-color:#B07CFF;color:#fff}
  .cc-in{display:flex;gap:6px;padding:10px;border-top:1px solid rgba(255,255,255,.08)}
  #cc-input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:9px;
    padding:8px;color:#fff;font-size:12px;font-family:inherit}
  #cc-send{background:rgba(176,124,255,.3);border:1px solid rgba(176,124,255,.5);color:#fff;
    width:38px;border-radius:9px;cursor:pointer}

  .scn-mk{position:absolute;transform:translate(-50%,-140%);background:rgba(11,18,32,.9);
    border:1.5px solid #ff5468;border-radius:8px;padding:4px 9px;font-size:11px;font-weight:700;color:#fff;
    white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.5)}
  .hl-label{position:absolute;transform:translate(-50%,-150%);background:rgba(11,18,32,.92);border:1.5px solid #34E0F0;
    border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;color:#fff;white-space:nowrap;box-shadow:0 4px 18px rgba(0,0,0,.5)}
  .gb-label{position:absolute;transform:translate(-50%,-130%);background:rgba(20,14,8,.92);
    border:1px solid #ffd070;border-radius:8px;padding:4px 9px;font-size:11px;color:#ffe;white-space:nowrap}
  .gb-step{display:inline-block;background:#ffd070;color:#221;border-radius:50%;width:16px;height:16px;
    text-align:center;line-height:16px;font-weight:700;font-size:10px;margin-right:4px}

  #chronos-vignette{position:fixed;inset:0;z-index:40;pointer-events:none;opacity:0;transition:opacity .8s;
    box-shadow:inset 0 0 240px 60px rgba(0,0,0,.6)}
  #chronos-vignette.on{opacity:1}
  #chronos-vignette.v-storm{background:radial-gradient(ellipse at center,transparent 40%,rgba(20,40,80,.45) 100%);box-shadow:inset 0 0 300px 80px rgba(10,30,70,.7)}
  #chronos-vignette.v-cyber{box-shadow:inset 0 0 300px 70px rgba(120,10,20,.6)}
  #chronos-vignette.v-power{background:radial-gradient(ellipse at center,transparent 30%,rgba(0,0,0,.55) 100%)}
  @media(max-width:760px){#chronos-fork,#chronos-copilot{width:min(92vw,330px)}}
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

export { simClock };
