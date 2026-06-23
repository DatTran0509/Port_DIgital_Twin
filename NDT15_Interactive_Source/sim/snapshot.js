/* ──────────────────────────────────────────────────────────────────────────
 * sim/snapshot.js — Ring-buffer state recorder for rewind (Phase 0)
 *
 * Ships are a pure function of time (vesselPose) so they rewind for free by
 * recomputing. The heavy movers — STS/RTG/transfer cranes, trucks, gate
 * barriers — are INTEGRATORS (they accumulate state with dt), so they cannot be
 * run backwards. Instead we record a lightweight transform snapshot every
 * RECORD_DT seconds while live, and during replay we INTERPOLATE the recorded
 * transforms straight onto the meshes (no physics runs). Because the integrator
 * LOGICAL state (truck.state, crane.scp, …) is never touched during replay, the
 * present resumes seamlessly the moment time returns to `now`.
 *
 * Per tracked object we store position, quaternion, scale, visibility (+ truck
 * opacity for the gate fade). One flat Float32Array per frame.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { longCranes, vessels } from '../ships.js';
import { rtgCranes, transferCranes } from '../yard.js';
import { trucks } from '../trucks.js';
import { setTruckOpacity } from '../trucks/truck-mesh.js';

const RECORD_DT = 0.5;                 // seconds between recorded frames
const STRIDE = 11;                     // floats per object: pos3 quat4 scale3 op1

let entries = null;                    // [{ obj, truck? }]
let N = 0;
const frames = [];                     // [{ t, data:Float32Array, vis:Uint8Array }]
let cap = 300;
let lastRec = -1e9;

const _qA = new THREE.Quaternion();
const _qB = new THREE.Quaternion();
const _q = new THREE.Quaternion();

// First mesh material opacity inside a truck group (for the gate fade replay).
function readTruckOpacity(tk) {
  let op = 1;
  tk.g.traverse(c => { if (c.isMesh && c.material && c.material.transparent) { op = c.material.opacity; return; } });
  return op;
}

// Build the flat tracked-object list once (after the scene is fully initialised).
function build() {
  entries = [];
  for (const lc of longCranes) for (const o of [lc.trolley, lc.spreader, lc.cargo, lc.rope]) if (o) entries.push({ obj: o });
  for (const rc of rtgCranes) for (const o of [rc.g, rc.trolley, rc.spreader, rc.cargo, rc.rope]) if (o) entries.push({ obj: o });
  for (const tc of transferCranes) for (const o of [tc.slew, tc.spreader, tc.cargo, tc.rope]) if (o) entries.push({ obj: o });
  for (const v of vessels) if (v.g) entries.push({ obj: v.g });
  for (const tk of trucks) entries.push({ obj: tk.g, truck: tk });
  N = entries.length;
  cap = Math.max(60, Math.ceil(150 / RECORD_DT) + 4);   // matches simClock.horizonPast
}

export function ready() { return !!entries; }

// Capture the current transforms into the ring (called once per live frame,
// internally throttled to RECORD_DT). `t` is simClock.time.
export function record(t) {
  if (!entries) build();
  if (N === 0) return;
  if (t - lastRec < RECORD_DT && frames.length) return;
  lastRec = t;

  const data = new Float32Array(N * STRIDE);
  const vis = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const e = entries[i], o = e.obj, b = i * STRIDE;
    data[b] = o.position.x; data[b + 1] = o.position.y; data[b + 2] = o.position.z;
    data[b + 3] = o.quaternion.x; data[b + 4] = o.quaternion.y; data[b + 5] = o.quaternion.z; data[b + 6] = o.quaternion.w;
    data[b + 7] = o.scale.x; data[b + 8] = o.scale.y; data[b + 9] = o.scale.z;
    data[b + 10] = e.truck ? readTruckOpacity(e.truck) : 1;
    vis[i] = o.visible ? 1 : 0;
  }
  frames.push({ t, data, vis });
  if (frames.length > cap) frames.shift();
}

// Binary-search the bracketing frames for time t and write interpolated
// transforms onto every tracked object. No-op until we have ≥ 1 frame.
export function apply(t) {
  if (!frames.length || N === 0) return;
  if (t <= frames[0].t) return applyFrame(frames[0]);
  const last = frames[frames.length - 1];
  if (t >= last.t) return applyFrame(last);

  let lo = 0, hi = frames.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (frames[mid].t <= t) lo = mid; else hi = mid; }
  const a = frames[lo], b = frames[hi];
  const f = (t - a.t) / Math.max(1e-6, b.t - a.t);

  for (let i = 0; i < N; i++) {
    const e = entries[i], o = e.obj, ba = i * STRIDE, da = a.data, db = b.data;
    o.position.set(
      da[ba] + (db[ba] - da[ba]) * f,
      da[ba + 1] + (db[ba + 1] - da[ba + 1]) * f,
      da[ba + 2] + (db[ba + 2] - da[ba + 2]) * f);
    _qA.set(da[ba + 3], da[ba + 4], da[ba + 5], da[ba + 6]);
    _qB.set(db[ba + 3], db[ba + 4], db[ba + 5], db[ba + 6]);
    _q.copy(_qA).slerp(_qB, f); o.quaternion.copy(_q);
    o.scale.set(
      da[ba + 7] + (db[ba + 7] - da[ba + 7]) * f,
      da[ba + 8] + (db[ba + 8] - da[ba + 8]) * f,
      da[ba + 9] + (db[ba + 9] - da[ba + 9]) * f);
    const src = f < 0.5 ? a : b;
    o.visible = !!src.vis[i];
    if (e.truck) setTruckOpacity(e.truck, da[ba + 10] + (db[ba + 10] - da[ba + 10]) * f);
  }
}

function applyFrame(fr) {
  for (let i = 0; i < N; i++) {
    const e = entries[i], o = e.obj, b = i * STRIDE, d = fr.data;
    o.position.set(d[b], d[b + 1], d[b + 2]);
    o.quaternion.set(d[b + 3], d[b + 4], d[b + 5], d[b + 6]);
    o.scale.set(d[b + 7], d[b + 8], d[b + 9]);
    o.visible = !!fr.vis[i];
    if (e.truck) setTruckOpacity(e.truck, d[b + 10]);
  }
}

export function oldestTime() { return frames.length ? frames[0].t : 0; }
export function frameCount() { return frames.length; }
