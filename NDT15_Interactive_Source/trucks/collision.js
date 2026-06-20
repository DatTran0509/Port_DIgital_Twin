/* ──────────────────────────────────────────────────────────────────────────
 * trucks/collision.js — 3 m following gap + tight, freeze-proof crossing yield
 *
 * Decompose each pair into a FORWARD gap (along travel) and LATERAL gap:
 *
 *   • IN-LANE (lateral ≤ LANE_HALF): the truck ahead going the SAME way → follow
 *     at 3 m (also queues two trucks bound for the SAME block); head-on in-lane
 *     → the LOWER-id keeps going.
 *   • CROSSING / opposite (lateral > LANE_HALF): yield ONLY to a lower-id truck
 *     that is CLOSE (≤ CROSS) *and actually MOVING*. Gating on "moving" is what
 *     makes this freeze-proof: a stopped truck (being serviced, or itself stuck)
 *     never makes anyone wait, so a stall can't cascade into a frozen fleet.
 *
 * FREEZE-PROOF: the globally-lowest id never yields to anyone (no lower id), so
 * it only ever follows a same-direction leader — and the front of a following
 * chain always has clear road. Hence at least one truck always advances; a
 * permanent lock is impossible. Brief waits (behind a servicing truck) clear
 * when that truck finishes, and the router re-routes around persistent blockers.
 *
 * O(n²) over the small fleet; per-truck _moving is computed once per frame in
 * prepareCollision from the previous position. Signatures unchanged.
 * ────────────────────────────────────────────────────────────────────────── */

import { PARAMS } from '../layout.js';

const TRUCK_LEN = 11.0;                 // truck body length
const GAP       = 3.0;                  // required bumper gap (3 m, Req)
const DANGER    = TRUCK_LEN + GAP;      // 14 → 3 m bumper spacing (following)
const CROSS     = TRUCK_LEN;            // ~11: tighter range for crossing yield
const LANE_HALF = PARAMS.LANE_HALF + 1; // ≈ 6: lateral tolerance for "my lane"

let _trucks = [];

// Capture the fleet and flag which trucks actually MOVED since last frame.
export function prepareCollision(trucks) {
  _trucks = trucks;
  for (let i = 0; i < trucks.length; i++) {
    const t = trucks[i];
    t._moving = (t._px === undefined) ? true
      : (Math.abs(t.x - t._px) + Math.abs(t.z - t._pz)) > 0.02;
    t._px = t.x; t._pz = t.z;
  }
}

const _f = { x: 0, z: 0 }, _o = { x: 0, z: 0 };
function fwd(tk, out) { const a = tk.g.rotation.y - Math.PI; out.x = Math.sin(a); out.z = Math.cos(a); }

// true ⇢ tk may advance this frame.
export function canProceed(tk) {
  fwd(tk, _f);
  for (let i = 0; i < _trucks.length; i++) {
    const o = _trucks[i];
    if (o === tk || o.pending) continue;
    const dx = o.x - tk.x, dz = o.z - tk.z;
    const fGap = dx * _f.x + dz * _f.z;            // forward distance to o
    if (fGap <= 0 || fGap >= DANGER) continue;     // behind, or far enough ahead
    const lat = Math.sqrt(Math.max(0, dx * dx + dz * dz - fGap * fGap));

    if (lat <= LANE_HALF) {                        // o is ahead IN my lane
      fwd(o, _o);
      const sameDir = (_o.x * _f.x + _o.z * _f.z) > 0.3;
      if (sameDir || o.id < tk.id) return false;   // follow at 3 m / head-on yield
    } else if (fGap < CROSS && o.id < tk.id && o._moving) {
      return false;                                // give way to active cross-traffic
    }
  }
  return true;
}
