/* ──────────────────────────────────────────────────────────────────────────
 * sim/timeline.js — CHRONOS temporal core (Phase 0) — DVR model, unified cursor
 *
 * REALITY NEVER STOPS: `now` (the live edge) advances with wall-clock time every
 * frame and the integrators always run + record snapshots.
 *
 * A SINGLE playback cursor `time` sweeps the whole span
 *       [ minTime()  ……  now  ……  maxTime() ]
 *        oldest past      present     furthest forecast
 * and what is shown is derived purely from where it sits:
 *   time <  now  → REPLAY (recorded snapshot)
 *   time ≈  now  → LIVE
 *   time >  now  → FUTURE (forecast ghost)
 *
 * The transport buttons map cleanly onto this:
 *   ◀◀ / ▶▶   change only the scrub VELOCITY (sign + ×2/×4/×8) — they work in
 *             past, present AND future without jumping anywhere.
 *   ⦿ Thực Tại pins the cursor back to the live edge (mode 'live').
 *   ⏮ / ⏭     jump to the oldest / furthest points.
 *   ❚❚ / ▶     freeze / resume the cursor.
 * ────────────────────────────────────────────────────────────────────────── */

const LITTLE = 0.05;

export const simClock = {
  time: 0,
  now: 0,
  dt: 0,
  rate: 1,                 // scrub velocity (sim-sec per real-sec); sign = direction
  playing: true,
  mode: 'live',            // 'live' (cursor pinned to now) | 'scrub' (free cursor)
  horizonPast: 150,
  horizonFuture: 120,

  minTime() { return Math.max(0, this.now - this.horizonPast); },
  maxTime() { return this.now + this.horizonFuture; },

  tick(dtWall) {
    this.now += dtWall;      // reality clock — never stops
    this.dt = dtWall;        // integrators always get the real dt

    if (this.mode === 'live') { this.time = this.now; return; }

    if (this.playing) {
      let t = this.time + dtWall * this.rate;
      const lo = this.minTime(), hi = this.maxTime();
      if (t <= lo) { t = lo; this.rate = 0; this.playing = false; }       // hit the oldest frame
      else if (t >= hi) { t = hi; this.rate = 0; this.playing = false; }  // hit the forecast horizon
      this.time = t;
    } else {
      // frozen cursor: keep it inside the (sliding) retained window
      this.time = Math.min(Math.max(this.time, this.minTime()), this.maxTime());
    }
  },

  // ◀◀ / ▶▶ — set scrub direction + speed only (never changes position/mode-jump).
  scrub(rate) { this.mode = 'scrub'; this.rate = rate; this.playing = rate !== 0; },

  // drag / jump the cursor to an absolute time.
  seek(t) { this.mode = 'scrub'; this.time = Math.min(Math.max(t, this.minTime()), this.maxTime()); },

  // ⦿ jump to the live present (real time).
  goLive() { this.mode = 'live'; this.time = this.now; this.rate = 1; this.playing = true; },

  pause() { if (this.mode === 'live') this.mode = 'scrub'; this.playing = false; },
  play()  { this.playing = true; if (this.rate === 0) this.rate = 1; },
  toggle() { this.playing ? this.pause() : this.play(); },

  // Back-compat helpers used by copilot.
  setRate(r) { this.scrub(r); },
  futureTime() { return this.time; },
  futureOffset() { return Math.max(0, this.time - this.now); },

  isPast() { return this.time < this.now - LITTLE; },
  isFuture() { return this.time > this.now + LITTLE; },
  isLive() { return this.mode === 'live'; },
};

// Map sim seconds → "HH:MM" (kept for any caller; chronos uses a wall-clock readout).
export function fmtClock(simSeconds) {
  const total = 8 * 60 + Math.floor(simSeconds);
  const h = Math.floor(total / 60) % 24, m = ((total % 60) + 60) % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
