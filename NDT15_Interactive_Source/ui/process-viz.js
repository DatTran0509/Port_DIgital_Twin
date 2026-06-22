/* ──────────────────────────────────────────────────────────────────────────
 * process-viz.js — Canvas 2D visualization engine for the Digital-Twin Theater
 *
 * A registry of parametric, time-animated renderers. Each renderer has the
 * signature  fn(ctx, w, h, color, t, prog, p)  where:
 *   ctx   : CanvasRenderingContext2D (already scaled to CSS pixels)
 *   w, h  : stage size in CSS pixels
 *   color : the feature accent color (#hex)
 *   t     : continuously increasing elapsed seconds (for looping motion)
 *   prog  : 0..1 progress through the CURRENT stage (for fill-ins / reveals)
 *   p     : per-stage params object (labels, values, nodes…) — all optional
 *
 * The renderers are intentionally self-contained and defensive (sensible
 * defaults) so a scene can omit params without crashing. No THREE, no DOM.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── color helpers ───────────────────────────────────────────────────────── */
function hexRgb(hex) {
  let h = (hex || '#34E0F0').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function mix(hexA, hexB, t) {
  const a = hexRgb(hexA), b = hexRgb(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
const TXT = '#cfe6ff', DIM = 'rgba(170,200,235,.55)', GRID = 'rgba(100,150,220,.12)';
// Global font scale — bumps every canvas label uniformly for readability.
const FS = 1.2;

/* ── drawing primitives ──────────────────────────────────────────────────── */
function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function label(ctx, txt, x, y, size, col, align = 'left', weight = '500') {
  ctx.font = `${weight} ${(size * FS).toFixed(1)}px Inter, Arial, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = col; ctx.fillText(txt, x, y);
}
function glowDot(ctx, x, y, r, col) {
  ctx.save();
  ctx.shadowColor = col; ctx.shadowBlur = r * 2.4;
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.restore();
}
const easeOut = t => 1 - Math.pow(1 - t, 3);
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* ── 1. radarScan — rotating sweep + contact blips ───────────────────────── */
function radar(ctx, w, h, color, t, prog, p) {
  const bottom = 34;                                  // chừa chỗ cho caption
  const cx = w / 2, cy = (h - bottom) / 2, R = Math.min(w * 0.38, (h - bottom) / 2 - 8);
  // range rings
  ctx.strokeStyle = GRID; ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, 7); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
  // sweep
  const ang = (t * 1.4) % (Math.PI * 2);
  const grad = ctx.createConicGradient ? ctx.createConicGradient(ang, cx, cy) : null;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R, ang - 0.5, ang); ctx.closePath();
  if (grad) { grad.addColorStop(0, rgba(color, 0)); grad.addColorStop(1, rgba(color, .35)); ctx.fillStyle = grad; }
  else ctx.fillStyle = rgba(color, .2);
  ctx.fill();
  ctx.strokeStyle = rgba(color, .8); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); ctx.stroke();
  ctx.restore();
  // blips (params: blips:[{a,r,alert}])
  const blips = p.blips || [{ a: 0.7, r: 0.8 }, { a: 2.1, r: 0.55 }, { a: 3.9, r: 0.7, alert: true }, { a: 5.2, r: 0.4 }, { a: 4.6, r: 0.9 }];
  blips.forEach((b, i) => {
    const bx = cx + Math.cos(b.a) * R * b.r, by = cy + Math.sin(b.a) * R * b.r;
    // ping when sweep passes
    let da = (ang - b.a + Math.PI * 2) % (Math.PI * 2);
    const fresh = clamp01(1 - da / 0.9);
    const col = b.alert ? '#FF5468' : color;
    glowDot(ctx, bx, by, 3 + fresh * 3, col);
    if (fresh > 0.05) { ctx.strokeStyle = rgba(b.alert ? '#FF5468' : color, fresh * .6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx, by, 6 + (1 - fresh) * 16, 0, 7); ctx.stroke(); }
  });
  label(ctx, p.caption || 'RADAR · 360° · 5km', cx, h - 14, 12, DIM, 'center');
}

/* ── 2. dataStream — packets flowing between source → sink nodes ─────────── */
function stream(ctx, w, h, color, t, prog, p) {
  const srcLbl = p.src || 'NGUỒN', dstLbl = p.dst || 'TRUNG TÂM DỮ LIỆU';
  const sx = w * 0.16, dx = w * 0.84, my = h / 2;
  // nodes
  [[sx, srcLbl, color], [dx, dstLbl, '#B07CFF']].forEach(([x, lbl, c]) => {
    ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 16; rrect(ctx, x - 46, my - 26, 92, 52, 10);
    ctx.fillStyle = rgba(c, .14); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(c, .7); ctx.stroke(); ctx.restore();
    label(ctx, lbl, x, my + 4, 11, TXT, 'center', '600');
  });
  // wire
  ctx.strokeStyle = GRID; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx + 46, my); ctx.lineTo(dx - 46, my); ctx.stroke();
  // packets
  const N = 6, span = (dx - 46) - (sx + 46);
  for (let i = 0; i < N; i++) {
    const f = ((t * 0.5 + i / N) % 1);
    const px = sx + 46 + f * span;
    glowDot(ctx, px, my, 4, color);
  }
  // floating data tokens (params: tokens:[str])
  const tokens = p.tokens || ['GPS', 'SOG', 'COG', 'IMO', 'ETA'];
  tokens.forEach((tok, i) => {
    const f = ((t * 0.4 + i / tokens.length) % 1);
    const px = sx + 46 + f * span;
    const a = Math.sin(f * Math.PI);
    label(ctx, tok, px, my - 16, 10, rgba(color, a), 'center', '600');
  });
  label(ctx, p.caption || '', w / 2, h - 14, 12, DIM, 'center');
}

/* ── 3. mapGrid — top-down grid of cells filling / heat-mapping ──────────── */
function grid(ctx, w, h, color, t, prog, p) {
  const cols = p.cols || 8, rows = p.rows || 5;
  const padX = 30, padTop = 22, padBottom = 42;       // padBottom chừa chỗ caption
  const gw = w - padX * 2, gh = h - padTop - padBottom;
  const cw = gw / cols, ch = gh / rows, gx = padX, gy = padTop;
  let idx = 0; const total = cols * rows;
  const filled = Math.floor(easeOut(prog) * total);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++, idx++) {
    const x = gx + c * cw, y = gy + r * ch;
    const on = idx < filled;
    // pseudo-random heat
    const heat = (Math.sin(idx * 12.9898) * 43758.5453) % 1;
    const hv = (heat + 1) % 1;
    let cellCol;
    if (p.heat) cellCol = hv > 0.8 ? '#FF5468' : hv > 0.55 ? '#F8B23C' : color;
    else cellCol = color;
    rrect(ctx, x + 2, y + 2, cw - 4, ch - 4, 4);
    ctx.fillStyle = on ? rgba(cellCol, p.heat ? (.18 + hv * .5) : .22) : 'rgba(255,255,255,.03)';
    ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = on ? rgba(cellCol, .6) : GRID; ctx.stroke();
    if (on && idx === filled - 1) glowDot(ctx, x + cw / 2, y + ch / 2, 3, cellCol);
  }
  // scanning highlight line
  const sx = gx + ((t * 0.4) % 1) * gw;
  ctx.strokeStyle = rgba(color, .5); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, gy); ctx.lineTo(sx, gy + gh); ctx.stroke();
  label(ctx, p.caption || `${filled}/${total} ô đã số hóa`, w / 2, h - 16, 12, DIM, 'center');
}

/* ── 4. aiCore — neural hub: inputs → pulsing core → outputs ─────────────── */
function ai(ctx, w, h, color, t, prog, p) {
  const cx = w / 2, cy = h / 2;
  const ins = p.inputs || ['Lịch tàu', 'Tồn bãi', 'Ưu tiên', 'Trọng tải'];
  const outs = p.outputs || ['Slot tối ưu', 'Lệnh cẩu'];
  const lx = w * 0.13, rx = w * 0.87;
  // input nodes
  ins.forEach((s, i) => {
    const y = h * (0.22 + 0.56 * (ins.length === 1 ? 0.5 : i / (ins.length - 1)));
    const f = ((t * 0.7 + i * 0.3) % 1);
    ctx.strokeStyle = rgba(color, .3); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(lx + 8, y); ctx.bezierCurveTo(cx - 60, y, cx - 60, cy, cx - 26, cy); ctx.stroke();
    glowDot(ctx, lx + 8 + (cx - 34 - lx) * f, y + (cy - y) * easeOut(f), 3, color);
    label(ctx, s, lx - 4, y + 4, 11, DIM, 'right');
  });
  // core
  const pulse = 1 + Math.sin(t * 4) * 0.06;
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 30;
  ctx.fillStyle = rgba(color, .18); ctx.beginPath(); ctx.arc(cx, cy, 30 * pulse, 0, 7); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke(); ctx.restore();
  // inner spinning nodes
  for (let i = 0; i < 6; i++) { const a = t * 1.5 + i * Math.PI / 3; glowDot(ctx, cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 2, color); }
  label(ctx, 'AI', cx, cy + 5, 14, '#fff', 'center', '700');
  // outputs
  outs.forEach((s, i) => {
    const y = h * (0.32 + 0.36 * (outs.length === 1 ? 0.5 : i / (outs.length - 1)));
    const f = ((t * 0.7 + i * 0.4) % 1);
    ctx.strokeStyle = rgba('#B07CFF', .35); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx + 26, cy); ctx.bezierCurveTo(cx + 60, cy, cx + 60, y, rx - 8, y); ctx.stroke();
    glowDot(ctx, cx + 26 + (rx - 34 - cx) * easeOut(f), cy + (y - cy) * f, 3.2, '#B07CFF');
    label(ctx, s, rx + 2, y + 4, 11, TXT, 'left', '600');
  });
  label(ctx, p.caption || 'Mô hình AI suy luận real-time', w / 2, h - 12, 12, DIM, 'center');
}

/* ── 5. gaugeCluster — circular gauges with needles ──────────────────────── */
function gauges(ctx, w, h, color, t, prog, p) {
  const items = p.gauges || [{ l: 'CO₂', v: 0.32, u: 'ppm' }, { l: 'SOx', v: 0.18, u: '%' }, { l: 'NOx', v: 0.45, u: 'ppb' }];
  const n = items.length, gap = w / n;
  items.forEach((g, i) => {
    const cx = gap * (i + 0.5), cy = h / 2 - 4, R = Math.min(gap, h) * 0.3;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    ctx.lineWidth = 7; ctx.strokeStyle = rgba(color, .12);
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
    const val = clamp01(g.v) * easeOut(clamp01(prog * 1.2)) + Math.sin(t * 2 + i) * 0.01;
    const c = val > 0.8 ? '#FF5468' : val > 0.6 ? '#F8B23C' : color;
    ctx.strokeStyle = c; ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + (a1 - a0) * val); ctx.stroke(); ctx.restore();
    label(ctx, Math.round(val * 100) + '', cx, cy + 2, 17, '#fff', 'center', '700');
    label(ctx, g.u || '', cx, cy + 18, 10, DIM, 'center');
    label(ctx, g.l, cx, cy + R + 24, 12, TXT, 'center', '600');
  });
  label(ctx, p.caption || '', w / 2, h - 10, 12, DIM, 'center');
}

/* ── 6. barrierGate — ALPR + barrier opening ─────────────────────────────── */
function gate(ctx, w, h, color, t, prog, p) {
  const groundY = h * 0.72;
  ctx.strokeStyle = GRID; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke();
  // lane dashes
  ctx.setLineDash([14, 12]); ctx.strokeStyle = rgba(color, .25);
  ctx.beginPath(); ctx.moveTo(0, groundY + 22); ctx.lineTo(w, groundY + 22); ctx.stroke(); ctx.setLineDash([]);
  // gate post
  const postX = w * 0.62;
  ctx.fillStyle = rgba(color, .25); rrect(ctx, postX - 6, groundY - 70, 12, 70, 3); ctx.fill();
  ctx.strokeStyle = rgba(color, .7); ctx.stroke();
  // barrier arm — rises with prog
  const open = easeOut(clamp01((prog - 0.4) / 0.5));
  const armAng = -open * Math.PI / 2.2;
  ctx.save(); ctx.translate(postX, groundY - 62); ctx.rotate(armAng);
  const grdA = ctx.createLinearGradient(0, 0, 90, 0); grdA.addColorStop(0, '#FF5468'); grdA.addColorStop(1, '#fff');
  ctx.fillStyle = grdA; rrect(ctx, 0, -5, 90, 10, 4); ctx.fill(); ctx.restore();
  // truck approaching
  const tx = w * (0.05 + clamp01(prog * 1.1) * (open > 0.6 ? 0.7 : 0.42));
  const ty = groundY - 4;
  ctx.fillStyle = rgba(color, .9); rrect(ctx, tx, ty - 26, 30, 26, 4); ctx.fill();
  ctx.fillStyle = rgba('#B07CFF', .9); rrect(ctx, tx + 30, ty - 18, 22, 18, 3); ctx.fill();
  ctx.fillStyle = '#0a1426'; ctx.beginPath(); ctx.arc(tx + 10, ty, 5, 0, 7); ctx.arc(tx + 44, ty, 5, 0, 7); ctx.fill();
  // ALPR scan box over plate
  const scan = (Math.sin(t * 3) + 1) / 2;
  ctx.strokeStyle = rgba('#7df3cf', .9); ctx.lineWidth = 1.5;
  rrect(ctx, tx - 4, ty - 30, 60, 36, 5); ctx.stroke();
  ctx.fillStyle = rgba('#7df3cf', .12 + scan * .12); ctx.fill();
  label(ctx, p.plate || '51C-678.90', tx + 26, ty - 34, 11, '#7df3cf', 'center', '700');
  // status
  const ok = open > 0.6;
  label(ctx, ok ? (p.okText || '✓ HỢP LỆ · MỞ BARRIER') : (p.scanText || '⟳ ĐANG XÁC THỰC ALPR…'),
    w / 2, 34, 14, ok ? '#7df3cf' : '#F8B23C', 'center', '700');
  label(ctx, p.caption || '', w / 2, h - 10, 12, DIM, 'center');
}

/* ── 7. cameraScan — thermal / camera viewport locking a target ──────────── */
function camera(ctx, w, h, color, t, prog, p) {
  const m = 30, vw = w - m * 2, vh = h - m * 2 - 18, vx = m, vy = m;
  rrect(ctx, vx, vy, vw, vh, 8); ctx.save(); ctx.clip();
  // thermal gradient bg
  const g = ctx.createRadialGradient(vx + vw * 0.62, vy + vh * 0.5, 10, vx + vw * 0.62, vy + vh * 0.5, vw * 0.5);
  g.addColorStop(0, rgba(p.thermal ? '#FF5468' : color, .35)); g.addColorStop(0.5, rgba('#B07CFF', .12)); g.addColorStop(1, 'rgba(5,11,24,.6)');
  ctx.fillStyle = g; ctx.fillRect(vx, vy, vw, vh);
  // scanlines
  ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
  for (let y = vy; y < vy + vh; y += 4) { ctx.beginPath(); ctx.moveTo(vx, y); ctx.lineTo(vx + vw, y); ctx.stroke(); }
  // target reticle locking on
  const lock = easeOut(clamp01((prog - 0.2) / 0.6));
  const tcx = vx + vw * 0.62, tcy = vy + vh * 0.5, sz = 60 - lock * 26 + Math.sin(t * 6) * (1 - lock) * 8;
  const col = p.thermal ? '#FF5468' : '#7df3cf';
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sxn, syn]) => {
    const cx = tcx + sxn * sz, cy = tcy + syn * sz;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - sxn * 14, cy); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - syn * 14); ctx.stroke();
  });
  glowDot(ctx, tcx, tcy, 4, col);
  ctx.restore();
  rrect(ctx, vx, vy, vw, vh, 8); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(color, .5); ctx.stroke();
  label(ctx, (p.thermal ? '◉ THERMAL' : '◉ REC') + '  ' + (p.feed || 'UAV-02 FEED'), vx + 10, vy + 18, 11, col, 'left', '700');
  label(ctx, p.target || 'TARGET LOCK ' + Math.round(lock * 100) + '%', tcx, tcy + sz + 18, 11, col, 'center', '600');
  label(ctx, p.caption || '', w / 2, h - 6, 12, DIM, 'center');
}

/* ── 8. droneLaunch — UAV rising along a path to a waypoint ───────────────── */
function drone(ctx, w, h, color, t, prog, p) {
  const padX = w * 0.16, padY = h * 0.8, tgtX = w * 0.82, tgtY = h * 0.26;
  // pad
  ctx.fillStyle = rgba(color, .15); rrect(ctx, padX - 34, padY, 68, 10, 4); ctx.fill();
  ctx.strokeStyle = rgba(color, .6); ctx.stroke();
  label(ctx, 'DOCK', padX, padY + 26, 11, DIM, 'center');
  // target
  glowDot(ctx, tgtX, tgtY, 4, '#FF5468');
  ctx.strokeStyle = rgba('#FF5468', .5); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(tgtX, tgtY, 14 + Math.sin(t * 4) * 4, 0, 7); ctx.stroke();
  label(ctx, p.target || 'MỤC TIÊU LẠ', tgtX, tgtY - 22, 11, '#FF5468', 'center', '600');
  // flight path
  const fly = easeOut(clamp01(prog * 1.1));
  ctx.setLineDash([6, 8]); ctx.strokeStyle = rgba(color, .35);
  ctx.beginPath(); ctx.moveTo(padX, padY); ctx.quadraticCurveTo(w / 2, tgtY - 40, tgtX, tgtY); ctx.stroke(); ctx.setLineDash([]);
  // drone position along quad bezier
  const u = fly, mx = w / 2, myc = tgtY - 40;
  const dx = (1 - u) * (1 - u) * padX + 2 * (1 - u) * u * mx + u * u * tgtX;
  const dy = (1 - u) * (1 - u) * padY + 2 * (1 - u) * u * myc + u * u * tgtY;
  // body + spinning rotors
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 14;
  ctx.fillStyle = '#dfeeff'; rrect(ctx, dx - 9, dy - 4, 18, 8, 3); ctx.fill(); ctx.restore();
  for (let i = -1; i <= 1; i += 2) {
    const rxp = dx + i * 12;
    ctx.strokeStyle = rgba(color, .9); ctx.lineWidth = 2;
    const ra = t * 30; ctx.beginPath();
    ctx.moveTo(rxp - Math.cos(ra) * 8, dy - 6 - Math.sin(ra) * 2); ctx.lineTo(rxp + Math.cos(ra) * 8, dy - 6 + Math.sin(ra) * 2); ctx.stroke();
  }
  label(ctx, p.caption || `UAV cất cánh · ${Math.round(fly * 100)}%`, w / 2, h - 12, 12, DIM, 'center');
}

/* ── 9. lineFlow — animated area/line chart with forecast split ──────────── */
function line(ctx, w, h, color, t, prog, p) {
  const m = 36, gx = m, gy = 24, gw = w - m * 2, gh = h - 56;
  ctx.strokeStyle = GRID; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = gy + gh * i / 4; ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke(); }
  const data = p.data || [0.3, 0.5, 0.42, 0.7, 0.55, 0.8, 0.62, 0.9];
  const n = data.length, step = gw / (n - 1);
  const shown = clamp01(prog * 1.15);
  const upto = shown * (n - 1);
  // area
  ctx.beginPath(); ctx.moveTo(gx, gy + gh);
  for (let i = 0; i < n; i++) { if (i > upto) break; ctx.lineTo(gx + i * step, gy + gh - data[i] * gh); }
  const lastX = gx + Math.min(upto, n - 1) * step;
  ctx.lineTo(lastX, gy + gh); ctx.closePath();
  const ag = ctx.createLinearGradient(0, gy, 0, gy + gh); ag.addColorStop(0, rgba(color, .35)); ag.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = ag; ctx.fill();
  // line
  ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 10;
  ctx.beginPath();
  for (let i = 0; i < n; i++) { if (i > upto) break; const x = gx + i * step, y = gy + gh - data[i] * gh; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke(); ctx.restore();
  // forecast dashed overlay
  if (p.forecast) {
    ctx.setLineDash([5, 5]); ctx.strokeStyle = rgba('#B07CFF', .8); ctx.lineWidth = 1.8; ctx.beginPath();
    for (let i = 0; i < n; i++) { const x = gx + i * step, y = gy + gh - p.forecast[i] * gh; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  // moving head dot
  const hi = Math.min(Math.round(upto), n - 1);
  glowDot(ctx, gx + hi * step, gy + gh - data[hi] * gh, 4, color);
  label(ctx, p.caption || '', w / 2, h - 10, 12, DIM, 'center');
}

/* ── 10. stackBuild — isometric container stacking (BIM 3D) ───────────────── */
function stack(ctx, w, h, color, t, prog, p) {
  const cols = p.cols || 6, tiers = p.tiers || 4;
  const bw = 26, bh = 12, dx = 13, dy = -7; // iso offsets
  const ox = w * 0.32, oy = h * 0.72;
  const total = cols * tiers; const built = Math.floor(easeOut(prog) * total);
  const palette = [color, '#4D8DF6', '#B07CFF', '#F8B23C'];
  let k = 0;
  for (let c = 0; c < cols; c++) {
    for (let tt = 0; tt < tiers; tt++, k++) {
      if (k >= built) continue;
      const x = ox + c * (bw + 4), y = oy - tt * (bh + 3);
      const col = palette[(c + tt) % palette.length];
      // top
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw + dx, y + dy); ctx.lineTo(x + dx, y + dy); ctx.closePath();
      ctx.fillStyle = rgba(col, .5); ctx.fill();
      // front
      ctx.fillStyle = rgba(col, .3); ctx.fillRect(x, y, bw, bh);
      // side
      ctx.beginPath(); ctx.moveTo(x + bw, y); ctx.lineTo(x + bw + dx, y + dy); ctx.lineTo(x + bw + dx, y + dy + bh); ctx.lineTo(x + bw, y + bh); ctx.closePath();
      ctx.fillStyle = rgba(col, .18); ctx.fill();
      ctx.strokeStyle = rgba(col, .7); ctx.lineWidth = 1; ctx.strokeRect(x, y, bw, bh);
    }
  }
  // descending crane spreader placing the latest block
  if (built < total) {
    const c = built % cols, tt = Math.floor(built / cols);
    const x = ox + c * (bw + 4), targetY = oy - tt * (bh + 3);
    const drop = (t % 1.2) / 1.2;
    const y = (h * 0.08) + drop * (targetY - h * 0.08);
    ctx.strokeStyle = rgba(color, .6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + bw / 2, 0); ctx.lineTo(x + bw / 2, y); ctx.stroke();
    ctx.fillStyle = rgba('#F8B23C', .8); ctx.fillRect(x, y, bw, bh);
  }
  label(ctx, p.caption || `Mô hình BIM 3D · ${built}/${total} container`, w / 2, h - 12, 12, DIM, 'center');
}

/* ── 11. notify — stacked notification / report cards appearing ──────────── */
function notify(ctx, w, h, color, t, prog, p) {
  const raw = p.cards || [{ t: 'ETA xác nhận', s: '±10 phút' }, { t: 'Đã gửi hãng tàu', s: 'API · OK' }, { t: 'Lịch cập bến', s: 'Bến B3 · 14:20' }];
  // accept both [{t,s}] and [['title','sub']] shapes (defensive against undefined)
  const cards = raw.map(c => Array.isArray(c) ? { t: c[0], s: c[1] } : c);
  const cw = w * 0.66, cx = (w - cw) / 2, ch = 46, gap = 12, top = 40;
  const reveal = prog * cards.length;
  cards.forEach((cd, i) => {
    if (i > reveal) return;
    const a = clamp01(reveal - i);
    const y = top + i * (ch + gap);
    ctx.globalAlpha = a;
    ctx.save(); ctx.shadowColor = rgba(color, .4); ctx.shadowBlur = 14;
    rrect(ctx, cx, y, cw, ch, 9); ctx.fillStyle = rgba(color, .1); ctx.fill();
    ctx.lineWidth = 1.3; ctx.strokeStyle = rgba(color, .5); ctx.stroke(); ctx.restore();
    // check icon
    glowDot(ctx, cx + 22, y + ch / 2, 9, rgba(color, .25));
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(cx + 17, y + ch / 2); ctx.lineTo(cx + 21, y + ch / 2 + 4); ctx.lineTo(cx + 28, y + ch / 2 - 5); ctx.stroke();
    label(ctx, cd.t || '', cx + 42, y + ch / 2 - 2, 13, TXT, 'left', '600');
    label(ctx, cd.s || '', cx + 42, y + ch / 2 + 14, 11, DIM, 'left');
    ctx.globalAlpha = 1;
  });
  label(ctx, p.caption || '', w / 2, h - 10, 12, DIM, 'center');
}

/* ── 12. sankey — energy flow distribution sources → loads ───────────────── */
function sankey(ctx, w, h, color, t, prog, p) {
  const srcs = p.sources || [{ l: 'Điện mặt trời', v: 0.4, c: '#F8B23C' }, { l: 'Điện gió', v: 0.25, c: '#34E0F0' }, { l: 'Lưới quốc gia', v: 0.35, c: '#B07CFF' }];
  const loads = p.loads || [{ l: 'Cẩu STS', v: 0.45 }, { l: 'Điện bờ', v: 0.3 }, { l: 'Chiếu sáng', v: 0.25 }];
  const lx = w * 0.2, rx = w * 0.8; let sy = 36, ly = 36;
  const colH = h - 80;
  srcs.forEach(s => { const bh = s.v * colH; rrect(ctx, lx - 70, sy, 70, bh - 6, 4); ctx.fillStyle = rgba(s.c, .5); ctx.fill(); label(ctx, s.l, lx - 76, sy + bh / 2, 10, TXT, 'right'); s._y = sy; s._h = bh; sy += bh; });
  loads.forEach(l => { const bh = l.v * colH; rrect(ctx, rx, ly, 70, bh - 6, 4); ctx.fillStyle = rgba(color, .4); ctx.fill(); label(ctx, l.l, rx + 76, ly + bh / 2, 10, TXT, 'left'); l._y = ly; l._h = bh; ly += bh; });
  // flowing ribbons
  srcs.forEach((s, si) => {
    const y0 = s._y + s._h / 2;
    loads.forEach((l, li) => {
      const y1 = l._y + l._h / 2;
      ctx.strokeStyle = rgba(s.c, .12); ctx.lineWidth = Math.max(2, s._h * l.v * 0.5);
      ctx.beginPath(); ctx.moveTo(lx, y0); ctx.bezierCurveTo(w / 2, y0, w / 2, y1, rx, y1); ctx.stroke();
    });
    // pulse along to first load
    const f = (t * 0.4 + si * 0.3) % 1;
    const y1 = loads[0]._y + loads[0]._h / 2;
    const u = f, bx = (1 - u) * (1 - u) * lx + 2 * (1 - u) * u * (w / 2) + u * u * rx;
    const by = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * ((y0 + y1) / 2) + u * u * y1;
    glowDot(ctx, bx, by, 3, s.c);
  });
  label(ctx, p.caption || 'Tối ưu phân bổ nguồn điện', w / 2, h - 12, 12, DIM, 'center');
}

export const VIZ = { radar, stream, grid, ai, gauges, gate, camera, drone, line, stack, notify, sankey };

export function renderViz(type, ctx, w, h, color, t, prog, p) {
  const fn = VIZ[type] || VIZ.ai;
  fn(ctx, w, h, color, t, prog, p || {});
}
