/* ──────────────────────────────────────────────────────────────────────────
 * trucks/collision.js — Same-lane following gap (3 m), provably freeze-proof
 *
 * A truck brakes ONLY for another truck directly ahead IN ITS OWN LANE (small
 * lateral offset) within the 3 m danger distance:
 *   - going the SAME way  → follow/queue at 3 m (also queues two trucks bound
 *     for the SAME block: the second stops 3 m behind), or
 *   - head-on in-lane (rare) → the LOWER-id keeps going, the other waits.
 *
 * It does NOT handle intersections — that is done separately by the router's
 * one-at-a-time crossing reservation. Keeping this rule to pure same-lane
 * following makes it FREEZE-PROOF: a truck only ever waits for a same-direction
 * leader right in front, and the front of any chain has clear road, so at least
 * one truck always advances.
 *
 * O(n²) over the small fleet; allocates nothing per frame. Signatures unchanged.
 * ────────────────────────────────────────────────────────────────────────── */

import { PARAMS } from '../layout.js';

const TRUCK_LEN = 11.0;                 // truck body length
const GAP       = 3.0;                  // required bumper gap (3 m, Req)
const DANGER    = TRUCK_LEN + GAP;      // 14 → 3 m bumper spacing
const LANE_HALF = PARAMS.LANE_HALF - 1; // ≈ 4: only trucks truly in my lane count

let _trucks = [];
export function prepareCollision(trucks) { _trucks = trucks; }

const _f = { x: 0, z: 0 }, _o = { x: 0, z: 0 };
function fwd(tk, out) { const a = tk.g.rotation.y - Math.PI; out.x = Math.sin(a); out.z = Math.cos(a); }

// true ⇢ tk may advance this frame (w.r.t. same-lane following only).
export function canProceed(tk) {
  fwd(tk, _f);
  for (let i = 0; i < _trucks.length; i++) {
    const o = _trucks[i];
    if (o === tk || o.pending) continue;
    const dx = o.x - tk.x, dz = o.z - tk.z;
    const fGap = dx * _f.x + dz * _f.z;            // forward distance to o
    if (fGap <= 0 || fGap >= DANGER) continue;     // behind, or far enough ahead
    const lat = Math.sqrt(Math.max(0, dx * dx + dz * dz - fGap * fGap));
    if (lat > LANE_HALF) continue;                 // not in my lane → ignore

    fwd(o, _o);
    const sameDir = (_o.x * _f.x + _o.z * _f.z) > 0.3;
    if (sameDir || o.id < tk.id) return false;     // follow at 3 m / head-on yield
  }
  return true;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Counter-flow overtake support (Req: "kẹt quá → đi ngược chiều để tránh rồi
 * trở lại lane của mình ngay"). A truck blocked behind a stalled leader in its
 * OWN lane may briefly borrow the opposing lane to pass, then merge back. The
 * router decides WHEN; these helpers tell it whether a lane is safe to use.
 *
 * laneClearAhead(tk, axis, laneLine, dist) — true when the lane whose center is
 * `laneLine` (a world x when axis==='x', a world z when axis==='z') has NO other
 * truck within `dist` ahead of tk (a small length behind too, to catch oncoming
 * traffic that is about to enter the swing-out window). Used two ways:
 *   - before pulling OUT: check the OPPOSING lane is clear far enough ahead,
 *   - before merging BACK: check the truck's OWN lane is clear of the blocker.
 * ────────────────────────────────────────────────────────────────────────── */
export function laneClearAhead(tk, axis, laneLine, dist) {
  fwd(tk, _f);
  for (let i = 0; i < _trucks.length; i++) {
    const o = _trucks[i];
    if (o === tk || o.pending) continue;
    const dx = o.x - tk.x, dz = o.z - tk.z;
    const fGap = dx * _f.x + dz * _f.z;             // forward distance to o
    if (fGap < -TRUCK_LEN || fGap > dist) continue; // outside the ahead window
    const coord = axis === 'x' ? o.x : o.z;
    if (Math.abs(coord - laneLine) <= LANE_HALF) return false; // someone in that lane
  }
  return true;
}
