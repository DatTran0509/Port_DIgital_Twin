/* ──────────────────────────────────────────────────────────────────────────
 * process-theater.js — The Digital-Twin Simulation Theater.
 *
 * A full-screen cinematic modal launched by the feature panel's "auto-play"
 * button. It walks the viewer through a feature's end-to-end process, beat by
 * beat, with:
 *   · a left RAIL  — the process pipeline as connected nodes, with a data
 *                    packet that flows from the finished step to the active one
 *   · a center STAGE — an animated Canvas-2D visualization of the active step
 *                    (renderers live in process-viz.js) + narration
 *   · a right PANEL — live KPIs whose numbers count up each stage
 *   · a footer LOOP — the six Digital-Twin phases (sense → twin → ai → decide
 *                    → act …) with the active phase highlighted, teaching that
 *                    a digital twin is a continuous closed loop
 *   · transport controls — prev / play-pause / next, a scrub bar, speed
 *
 * Self-contained: builds its own DOM on first open, owns its own rAF loop while
 * open, and tears the loop down on close. No THREE; no scene coupling.
 * ────────────────────────────────────────────────────────────────────────── */

import { getScene, LOOP_PHASES } from './process-scenes.js';
import { renderViz, rgba } from './process-viz.js';

const DEFAULT_STAGE_DUR = 6.5;   // seconds per stage at 1× speed
let root, els, dpr = Math.min(devicePixelRatio || 1, 2);
let scene = null, feat = null;
let idx = 0, playing = true, speed = 1;
let stageStart = 0, t0 = 0, lastT = 0;
let raf = null;

/* ── one-time DOM construction ───────────────────────────────────────────── */
function build() {
  root = document.createElement('div');
  root.id = 'dt-theater';
  root.innerHTML = `
    <div class="dtt-backdrop"></div>
    <div class="dtt-window" role="dialog" aria-modal="true">
      <div class="dtt-head">
        <div class="dtt-badge" id="dtt-badge">01</div>
        <div class="dtt-head-txt">
          <div class="dtt-kicker">MÔ PHỎNG DIGITAL TWIN · LIVE</div>
          <div class="dtt-title" id="dtt-title">—</div>
        </div>
        <div class="dtt-head-right">
          <div class="dtt-clock" id="dtt-clock">00:00</div>
          <button class="dtt-x" id="dtt-x" title="Đóng (Esc)">✕</button>
        </div>
      </div>
      <div class="dtt-body">
        <div class="dtt-rail" id="dtt-rail"></div>
        <div class="dtt-stage">
          <div class="dtt-stage-top">
            <span class="dtt-stage-no" id="dtt-stage-no">01</span>
            <span class="dtt-stage-title" id="dtt-stage-title">—</span>
            <span class="dtt-phase-chip" id="dtt-phase-chip">—</span>
          </div>
          <div class="dtt-canvas-wrap">
            <canvas id="dtt-canvas"></canvas>
          </div>
          <div class="dtt-io-row">
            <div class="dtt-io dtt-io-in"><span class="dtt-io-lbl">VÀO</span><span id="dtt-io-in">—</span></div>
            <span class="dtt-io-arrow">→</span>
            <div class="dtt-io dtt-io-out"><span class="dtt-io-lbl">RA</span><span id="dtt-io-out">—</span></div>
          </div>
          <div class="dtt-narration" id="dtt-narration">—</div>
          <div class="dtt-insight" id="dtt-insight"></div>
        </div>
        <div class="dtt-side">
          <div class="dtt-side-title">CHỈ SỐ TRỰC TIẾP</div>
          <div class="dtt-kpis" id="dtt-kpis"></div>
          <div class="dtt-essence">
            <div class="dtt-essence-title">⟳ Bản chất Digital Twin</div>
            <div class="dtt-essence-txt">Bản sao số phản chiếu tài sản thật theo thời gian thực, để AI mô phỏng & ra quyết định, rồi điều khiển ngược lại thế giới vật lý — một vòng lặp không ngừng.</div>
          </div>
        </div>
      </div>
      <div class="dtt-loop" id="dtt-loop"></div>
      <div class="dtt-foot">
        <button class="dtt-ctrl" id="dtt-prev" title="Bước trước">⏮</button>
        <button class="dtt-ctrl dtt-play" id="dtt-play" title="Tạm dừng / Chạy">⏸</button>
        <button class="dtt-ctrl" id="dtt-next" title="Bước sau">⏭</button>
        <div class="dtt-scrub"><div class="dtt-scrub-fill" id="dtt-scrub-fill"></div></div>
        <div class="dtt-step-count" id="dtt-step-count">1 / 6</div>
        <button class="dtt-ctrl dtt-speed" id="dtt-speed" title="Tốc độ">1×</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  els = {
    badge: gid('dtt-badge'), title: gid('dtt-title'), clock: gid('dtt-clock'),
    rail: gid('dtt-rail'), stageNo: gid('dtt-stage-no'), stageTitle: gid('dtt-stage-title'),
    phaseChip: gid('dtt-phase-chip'), canvas: gid('dtt-canvas'),
    ioIn: gid('dtt-io-in'), ioOut: gid('dtt-io-out'), narration: gid('dtt-narration'),
    insight: gid('dtt-insight'),
    kpis: gid('dtt-kpis'), loop: gid('dtt-loop'), scrubFill: gid('dtt-scrub-fill'),
    stepCount: gid('dtt-step-count'), play: gid('dtt-play'), speed: gid('dtt-speed'),
  };
  els.ctx = els.canvas.getContext('2d');

  // loop phase chips (static structure, highlighted per stage)
  els.loop.innerHTML = LOOP_PHASES.map((ph, i) =>
    `<div class="dtt-loop-node" data-key="${ph.key}">
       <span class="dtt-loop-ic">${ph.icon}</span><span class="dtt-loop-lbl">${ph.label}</span>
     </div>${i < LOOP_PHASES.length - 1 ? '<span class="dtt-loop-arr">→</span>' : '<span class="dtt-loop-arr dtt-loop-loop">↺</span>'}`
  ).join('');

  // controls
  gid('dtt-x').onclick = close;
  root.querySelector('.dtt-backdrop').onclick = close;
  els.play.onclick = togglePlay;
  gid('dtt-prev').onclick = () => { goto(idx - 1); };
  gid('dtt-next').onclick = () => { goto(idx + 1); };
  els.speed.onclick = cycleSpeed;
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', sizeCanvas);
}

const gid = id => document.getElementById(id);

/* ── public API ──────────────────────────────────────────────────────────── */
export function openTheater(feature) {
  const sc = getScene(feature.id);
  if (!sc) return;
  if (!root) build();
  scene = sc; feat = feature;
  idx = 0; playing = true; speed = 1; els.speed.textContent = '1×';
  els.play.textContent = '⏸';
  els.play.onclick = togglePlay;

  // theme the whole modal with the feature accent color
  root.style.setProperty('--dtc', feature.color);
  els.badge.textContent = feature.id;
  els.title.textContent = feature.name;

  buildRail();
  root.classList.add('open');
  document.body.classList.add('dtt-lock');
  sizeCanvas();
  t0 = performance.now() / 1000;
  enterStage(0);

  if (raf) cancelAnimationFrame(raf);
  lastT = performance.now() / 1000;
  loop();
}

export function closeTheater() { close(); }

function close() {
  if (!root) return;
  root.classList.remove('open');
  document.body.classList.remove('dtt-lock');
  if (raf) { cancelAnimationFrame(raf); raf = null; }
}

/* ── rail (process pipeline) ─────────────────────────────────────────────── */
function buildRail() {
  els.rail.innerHTML = `<div class="dtt-rail-title">QUY TRÌNH</div>` +
    scene.map((s, i) => `
      <div class="dtt-rail-node" data-i="${i}">
        <div class="dtt-rail-dot"><span>${i + 1}</span></div>
        <div class="dtt-rail-txt">${s.title}</div>
      </div>${i < scene.length - 1 ? '<div class="dtt-rail-link"><span class="dtt-rail-pkt"></span></div>' : ''}`
    ).join('');
  els.rail.querySelectorAll('.dtt-rail-node').forEach(n => {
    n.onclick = () => goto(parseInt(n.dataset.i));
  });
}

/* ── stage transitions ───────────────────────────────────────────────────── */
function goto(n) {
  n = Math.max(0, Math.min(scene.length - 1, n));
  enterStage(n);
}

function enterStage(n) {
  idx = n;
  const s = scene[n];
  stageStart = performance.now() / 1000;

  els.stageNo.textContent = String(n + 1).padStart(2, '0');
  els.stageTitle.textContent = s.title;
  els.narration.textContent = s.narration || '';
  els.insight.innerHTML = s.insight ? `<span class="dtt-insight-ic">💡</span><span>${s.insight}</span>` : '';
  els.insight.style.display = s.insight ? 'flex' : 'none';
  els.ioIn.textContent = s.inLabel || '—';
  els.ioOut.textContent = s.outLabel || '—';
  els.stepCount.textContent = `${n + 1} / ${scene.length}`;

  const ph = LOOP_PHASES.find(p => p.key === s.loop);
  els.phaseChip.textContent = ph ? `${ph.icon} ${ph.label}` : s.loop;

  // rail active / done states + flowing packet up to the active node
  els.rail.querySelectorAll('.dtt-rail-node').forEach((node, i) => {
    node.classList.toggle('active', i === n);
    node.classList.toggle('done', i < n);
  });
  els.rail.querySelectorAll('.dtt-rail-link').forEach((lnk, i) => {
    lnk.classList.toggle('flow', i === n - 1);
    lnk.classList.toggle('done', i < n - 1);
  });

  // loop phase highlight (and mark phases already visited this run)
  const visited = new Set(scene.slice(0, n + 1).map(x => x.loop));
  els.loop.querySelectorAll('.dtt-loop-node').forEach(node => {
    const k = node.dataset.key;
    node.classList.toggle('active', k === s.loop);
    node.classList.toggle('lit', visited.has(k));
  });

  buildKpis(s);
}

/* ── KPI cards (numbers animate from 0 → target) ─────────────────────────── */
function parseNum(v) {
  const m = String(v).match(/^([^\d-]*)(-?[\d.,]+)(.*)$/);
  if (!m) return null;
  return { pre: m[1] || '', num: parseFloat(m[2].replace(/,/g, '')), post: m[3] || '', raw: m[2] };
}
function buildKpis(s) {
  els.kpis.innerHTML = (s.kpis || []).map((kp, i) => `
    <div class="dtt-kpi" style="animation-delay:${i * 80}ms">
      <div class="dtt-kpi-v" data-target="${kp.v}"><span class="dtt-kpi-num">${kp.v}</span><span class="dtt-kpi-u">${kp.u || ''}</span></div>
      <div class="dtt-kpi-k">${kp.k}</div>
    </div>`).join('');
  // cache parse info on the elements
  els.kpis.querySelectorAll('.dtt-kpi-v').forEach(v => {
    v._info = parseNum(v.dataset.target);
    v._numEl = v.querySelector('.dtt-kpi-num');
  });
}
function tickKpis(prog) {
  const k = Math.min(1, prog / 0.7); // finish counting at 70% of the stage
  const e = 1 - Math.pow(1 - k, 3);
  els.kpis.querySelectorAll('.dtt-kpi-v').forEach(v => {
    const info = v._info; if (!info) return;
    const dec = (info.raw.indexOf('.') >= 0) ? (info.raw.split('.')[1].length) : 0;
    const cur = info.num * e;
    v._numEl.textContent = info.pre + (dec ? cur.toFixed(dec) : Math.round(cur).toLocaleString('en-US'));
  });
}

/* ── playback ────────────────────────────────────────────────────────────── */
function togglePlay() { playing = !playing; els.play.textContent = playing ? '⏸' : '▶'; }
function cycleSpeed() {
  speed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : speed === 2 ? 0.5 : 1;
  els.speed.textContent = speed + '×';
}
function onKey(e) {
  if (!root || !root.classList.contains('open')) return;
  if (e.key === 'Escape') close();
  else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowRight') goto(idx + 1);
  else if (e.key === 'ArrowLeft') goto(idx - 1);
}

/* ── canvas sizing (HiDPI) ───────────────────────────────────────────────── */
// Measure the canvas's ACTUAL rendered CSS size (driven by CSS width/height:100%)
// and resize the HiDPI backing store only when it changes. Called every frame so
// the drawing space always matches what's on screen — regardless of the open
// transition, per-stage layout shifts, or window resizes (fixes the bug where
// the bottom caption appeared/disappeared as the layout settled).
function fitCanvas() {
  if (!els) return;
  const cw = els.canvas.clientWidth, ch = els.canvas.clientHeight;
  if (cw < 2 || ch < 2) return;
  if (cw === els.cssW && ch === els.cssH) return;
  els.cssW = cw; els.cssH = ch;
  els.canvas.width = Math.round(cw * dpr);
  els.canvas.height = Math.round(ch * dpr);
}
function sizeCanvas() { fitCanvas(); }

/* ── main animation loop ─────────────────────────────────────────────────── */
function loop() {
  raf = requestAnimationFrame(loop);
  const now = performance.now() / 1000;
  const dt = Math.min(now - lastT, 0.05); lastT = now;

  const s = scene[idx];
  const dur = (s.dur || DEFAULT_STAGE_DUR) / speed;
  let elapsed = now - stageStart;
  // advance stageStart manually so pausing freezes progress
  if (!playing) { stageStart += dt; elapsed = now - stageStart; }
  const prog = Math.min(1, elapsed / dur);

  // header clock = total wall time since open
  const tot = Math.floor(now - t0);
  els.clock.textContent = `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;

  // draw the stage viz
  const ctx = els.ctx;
  fitCanvas();                       // keep drawing space in sync with real size
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, els.cssW, els.cssH);
  renderViz(s.viz, ctx, els.cssW, els.cssH, feat.color, now - t0, prog, s.vp);

  tickKpis(prog);
  els.scrubFill.style.width = (prog * 100) + '%';

  // auto-advance
  if (playing && prog >= 1) {
    if (idx < scene.length - 1) enterStage(idx + 1);
    else { playing = false; els.play.textContent = '↺'; els.play.onclick = restart; }
  }
}

function restart() {
  els.play.onclick = togglePlay;
  playing = true; els.play.textContent = '⏸';
  enterStage(0);
}
