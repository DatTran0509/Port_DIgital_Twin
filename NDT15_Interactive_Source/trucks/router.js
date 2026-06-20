/* ──────────────────────────────────────────────────────────────────────────
 * trucks/router.js — Waypoint-graph truck router + driving state machine
 *
 * Replaces the old hardcoded-lane state machine with routing over the road
 * graph from layout.roadGraph(). Trucks are dispatched from the gate, follow an
 * INBOUND path of directed lane edges to their assigned block's service node,
 * are handed to that block's RTG crane, then follow an OUTBOUND path back to the
 * gate and re-dispatch. (Req 5.1, 5.2, 5.3, 5.4, 5.5, 5.7)
 *
 * Pathfinding (BFS over roadGraph().adj):
 *   pathfind(fromNodeId, toNodeId, dirFilter) returns an array of node ids, or
 *   null when no route exists. The direction filter is enforced on the
 *   GATE-AXIS (z-running) corridors — an inbound journey may only traverse
 *   inbound (quay-ward) z-edges and an outbound journey only outbound
 *   (gate-ward) z-edges, so a truck never reverses toward/away from the gate on
 *   the wrong flow. Lateral (x-running) cross-road edges are traversable in
 *   either direction but ALWAYS on that edge's own lane centerline, so the truck
 *   still keeps right and never crosses the divider (Req 5.3, Property 8).
 *
 *   NOTE on the literal "inbound edges only" wording (Req 5.1/Property 7): the
 *   road graph tags x-running lanes with a fixed +x=inbound / -x=outbound
 *   convention (see layout.roadGraph), so a STRICT single-tag BFS cannot reach
 *   blocks left of the centered gate (they require -x travel). The design itself
 *   states the gate/quay semantics live on the z-running corridors, so the
 *   filter is applied there and lateral lanes stay bidirectional. This keeps the
 *   safety-relevant invariant (correct lane on every edge) intact while making
 *   every block reachable.
 *
 * Driving: a truck advances scalar progress `s` along its current directed edge
 * toward the next node, pinned to that edge's lane centerline (laneCenterX for
 * z-running edges, laneCenterZ for x-running edges) so it stays in lane. g
 * position/rotation are updated to face travel direction.
 *
 * Unroutable handling (Req 5.7): if pathfind returns null the truck sets
 * `hold = true`, stays at the gate, and retries on later frames — it is NEVER
 * removed from trucks[].
 *
 * Interim coupling: collision spacing still defers to collision.js (reworked in
 * task 6.4) and re-dispatch to dispatch.js (reworked in task 6.8).
 *
 * Requirements: 5.1, 5.2, 5.3, 5.7
 * ────────────────────────────────────────────────────────────────────────── */

import { rtgCranes } from '../yard.js';
import { trucks, reDispatch, tryPlacePending } from './dispatch.js';
import { prepareCollision, canProceed, laneClearAhead } from './collision.js';
import { setTruckOpacity } from './truck-mesh.js';
import { roadGraph, gatePosition } from '../layout.js';

/* ── Build the routing graph once (derived entirely from layout.js) ───────── */
const G = roadGraph();
const NODES = G.nodes;
const ADJ = G.adj;
const N = NODES.length;

// Directed-edge lookup by (from,to). Encoded as from*N+to.
const EDGE = new Map();
for (const e of G.edges) EDGE.set(e.fromNode * N + e.toNode, e);
const edgeBetween = (a, b) => EDGE.get(a * N + b);

// Service node ids in row-major order — matches rtgCranes index & blockId order
// (rtgCranes[i] ↔ SERVICE[i] ↔ block index i). Plus the per-lane gate apron
// nodes, keyed by their gate-lane x so the router can start/end a route on the
// SAME lane the truck physically used at the gate.
const SERVICE = [];
const APRON = new Map();               // gate lane x  ->  apron node id
for (const n of NODES) {
  if (n.kind === 'service') SERVICE.push(n.id);
  else if (n.kind === 'gateapron') APRON.set(n.gateLane, n.id);
}
// z of the landward apron row (all apron nodes share it) — the on-graph end of
// each gate lane. Trucks drive the gate↔apron stub OFF-graph, straight in-lane.
const APRON_Z = NODES[APRON.values().next().value].z;

// The OUTBOUND (exit) gate lanes — the apron lanes on the exit side (x > 0).
// The router routes an exiting truck to whichever of these is NEAREST by path
// cost, instead of a fixed pre-assigned lane (avoids the drive-past-then-U-turn).
const OUT_APRON = [...APRON.keys()].filter(x => x > 0);

// Gate geometry for the (non-graph) approach / exit phases. Each truck carries
// its own inbound/outbound lane x (tk.inLaneX / tk.outLaneX, assigned in
// dispatch.js over the 4 gate lanes at x = ±10/±30), driven straight down/up its
// own lane so there is NO diagonal lane-merge at the gate.
const GP = gatePosition();
// Gate barriers sit ±4.5 from the gate center (see gate/gate.js). Trucks stop
// 3 m BEFORE their barrier: entry on the +z (approach) side, exit on the −z
// (inside) side — i.e. "check in / check out 3 m from the barrier" (Req).
const CHECKIN_Z  = GP.z + 4.5 + 3;     // entry stop line: 3 m before entry barrier
const CHECKOUT_Z = GP.z - 4.5 - 3;     // exit  stop line: 3 m before exit barrier

// Shared fade band keyed to the gate z. A truck is fully visible (1) at/in the
// gate (z ≤ GP.z) and fully invisible (0) once it is ≥ FADE_LEN landward of it.
// dispatch.js seats spawns at GP.z + 80 (> GP.z + FADE_LEN), so the inbound
// spawn position, the exit drive-away, and the re-dispatch lane teleport ALL
// happen inside this invisible band — trucks never pop between lanes.
const FADE_LEN = 40;                  // visible distance in front of the gate

// Corner-easing factor: the RENDERED position/heading eases toward the in-lane
// target each frame so intersection lane changes and U-turns sweep smoothly
// instead of snapping (lower = gentler/smoother turn).
const TURN_K = 0.15;

// Ease an angle toward target along the SHORT way (handles wrap-around).
function easeAngle(cur, target, k) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * k;
}

/* ── BFS scratch (reused across calls; pathfind only runs on state changes) ── */
const _prev = new Int32Array(N);
const _seen = new Uint8Array(N);
const _q = new Int32Array(N);
const _barLift = [];

/* ── Intersection reservation (one truck through a crossing at a time) ───────
 * Yard junctions are single-lane, so to keep trucks from overlapping AS they
 * cross, each crossing node is reserved by the CLOSEST contending truck (tie:
 * lowest id). A truck within ENTER_DIST of a crossing it does NOT own must hold
 * just before it; the owner drives through, and once it pulls away the next
 * closest truck becomes owner. Because a truck releases a crossing (its nearest
 * crossing changes) BEFORE it gets within ENTER_DIST of the next one, it never
 * holds two crossings at once → no box-gridlock. The router's re-route + force
 * fallbacks cover any residual edge case, so the fleet can't lock up. */
const CROSS_NODES = NODES.filter(n => n.kind === 'crossing');
const _crossOwner = new Int32Array(N);
const _crossBestD = new Float32Array(N);
const CLAIM_DIST = 24;   // start contending for a crossing within this distance
const ENTER_DIST = 14;   // must OWN the crossing to come within this distance (≈3 m clear)
const INSIDE_DIST = 8;   // a truck this close is physically INSIDE the crossing box

// Nearest crossing within CLAIM_DIST → {id, d}; id = -1 when none close.
function nearestCross(tk) {
  let bid = -1, bd = CLAIM_DIST;
  for (let i = 0; i < CROSS_NODES.length; i++) {
    const n = CROSS_NODES[i];
    const dx = n.x - tk.x, dz = n.z - tk.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bd) { bd = d; bid = n.id; }
  }
  return { id: bid, d: bd };
}

// Forward component of (node − tk) along the truck's heading: > 0 ⇢ the node is
// AHEAD of the truck (it is approaching), ≤ 0 ⇢ the node is BEHIND (the truck has
// already passed it and is driving away). Used so a truck EXITING a junction is
// never held by it — that false hold made trucks freeze just past a junction /
// right in front of their block, stalling everyone behind.
function headingDot(tk, node) {
  const a = tk.g.rotation.y - Math.PI;
  return (node.x - tk.x) * Math.sin(a) + (node.z - tk.z) * Math.cos(a);
}

// A truck only RESERVES (locks) a crossing it can ACTUALLY clear this moment:
// it must be actively driving a yard path (state 2/6) AND not stalled behind a
// same-lane leader. A truck that is itself blocked must NOT hold the junction —
// THAT is the bug that made everyone "chờ nhau tới chết": the closest truck
// owned the crossing even while frozen, so perpendicular traffic waited forever.
// (A truck already INSIDE the box is handled separately so it can finish.)
function crossEligible(tk) {
  return (tk.state === 2 || tk.state === 6) && canProceed(tk);
}

// Once per frame: assign each crossing to the truck that should go through it.
// Priority: a truck already INSIDE the box (must clear out) beats approaching
// trucks; among the rest only ELIGIBLE trucks that are APPROACHING (crossing
// ahead of them) contend, closest first, ties to the lowest id. Frozen/idle
// trucks and trucks EXITING the junction reserve nothing.
function reserveCrossings(trucks) {
  for (let i = 0; i < CROSS_NODES.length; i++) {
    const id = CROSS_NODES[i].id;
    _crossOwner[id] = -1; _crossBestD[id] = Infinity;
  }
  for (let i = 0; i < trucks.length; i++) {
    const tk = trucks[i];
    if (tk.pending) { tk._claimCross = -1; tk._claimAhead = false; continue; }
    const c = nearestCross(tk);
    tk._claimCross = c.id; tk._claimD = c.d;
    if (c.id < 0) { tk._claimAhead = false; continue; }
    const node = NODES[c.id];
    const inside = c.d < INSIDE_DIST;
    const ahead = headingDot(tk, node) > 0;
    tk._claimAhead = ahead;
    if (!inside && !(crossEligible(tk) && ahead)) continue;  // exiting/blocked → reserves nothing
    // Inside trucks rank ahead of approaching ones (score shifted well below 0).
    const score = inside ? c.d - 1000 : c.d;
    if (score < _crossBestD[c.id] - 1e-3 ||
        (Math.abs(score - _crossBestD[c.id]) <= 1e-3 && tk.id < _crossOwner[c.id])) {
      _crossBestD[c.id] = score; _crossOwner[c.id] = tk.id;
    }
  }
}

// A truck must yield before a crossing ONLY when it is APPROACHING that crossing
// (it is ahead) AND someone else currently owns it. A crossing the truck has
// already passed (behind it) never blocks — the truck drives on out of it. An
// unowned crossing is free to enter.
function crossingClear(tk) {
  const cid = tk._claimCross;
  if (cid === undefined || cid < 0) return true;
  if (!tk._claimAhead) return true;                 // crossing behind us → exiting
  const owner = _crossOwner[cid];
  return !(tk._claimD <= ENTER_DIST && owner !== -1 && owner !== tk.id);
}

// Combined "may I move this frame?" — same-lane following AND crossing turn.
function wayBlocked(tk) {
  return !canProceed(tk) || !crossingClear(tk);
}

// A z-running (gate-axis) edge carries laneCenterX and must match the journey
// direction; a lateral (x-running) edge carries laneCenterZ and is bidirectional.
function traversable(e, dir) {
  if (!e) return false;
  if (e.laneCenterX !== undefined) return e.dir === dir;
  return true;
}

// BFS over ADJ honoring the direction filter. Returns node-id path or null.
// `avoid` (optional) marks a node impassable so re-routing can plan AROUND a
// truck blocking the road ahead (Req: "kẹt thì lập tức tìm đường khác").
function pathfind(from, to, dir, avoid = -1) {
  if (from === to) return [from];
  _seen.fill(0);
  if (avoid >= 0 && avoid !== to && avoid !== from) _seen[avoid] = 1;
  let head = 0, tail = 0;
  _q[tail++] = from; _seen[from] = 1; _prev[from] = -1;
  while (head < tail) {
    const u = _q[head++];
    if (u === to) break;
    const nb = ADJ[u];
    for (let k = 0; k < nb.length; k++) {
      const v = nb[k];
      if (_seen[v] || !traversable(edgeBetween(u, v), dir)) continue;
      _seen[v] = 1; _prev[v] = u; _q[tail++] = v;
    }
  }
  if (!_seen[to]) return null;
  const path = [];
  for (let c = to; c !== -1; c = _prev[c]) path.push(c);
  return path.reverse();
}

// Total driving length of a node-id path (sum of its directed-edge lengths).
// Used to pick the NEAREST exit gate among the candidate exit lanes.
function pathCost(p) {
  let c = 0;
  for (let i = 0; i + 1 < p.length; i++) { const e = edgeBetween(p[i], p[i + 1]); if (e) c += e.length; }
  return c;
}

// Plan the shortest OUTBOUND route from a service node to ANY exit gate lane,
// returning { path, lane } for the nearest reachable gate, or null. The truck
// adopts that gate as its outLaneX so the gate-stub drive (state 6.2+) matches.
function planNearestExit(fromService) {
  let best = null;
  for (const lane of OUT_APRON) {
    const p = pathfind(fromService, APRON.get(lane), 'outbound');
    if (!p) continue;
    const cost = pathCost(p);
    if (!best || cost < best.cost) best = { path: p, lane, cost };
  }
  return best;
}

/* ── Movement helpers ─────────────────────────────────────────────────────── */

// Straight move toward a world point (used for the gate approach/exit and the
// re-route U-turn). The heading EASES toward the travel direction (TURN_K) so
// turns/U-turns sweep smoothly instead of snapping (Req: smoother turn anim).
function moveTowards(tk, tx, tz, maxD) {
  const dx = tx - tk.x, dz = tz - tk.z, d = Math.hypot(dx, dz);
  if (d <= maxD) {
    tk.x = tx; tk.z = tz;
    if (d > 1e-3) tk.g.rotation.y = easeAngle(tk.g.rotation.y, Math.atan2(dx, dz) + Math.PI, TURN_K);
    return true;
  }
  tk.x += dx / d * maxD; tk.z += dz / d * maxD;
  tk.g.rotation.y = easeAngle(tk.g.rotation.y, Math.atan2(dx, dz) + Math.PI, TURN_K);
  return false;
}

// Advance along the current directed edge. Scalar progress `s` still advances
// along the edge (arrival/handoff timing unchanged); the RENDERED position is
// the edge's lane rail on straights, but is rounded into a smooth quadratic
// CORNER as the path turns at a junction. The corner spans CORNER metres BEFORE
// the node and CORNER metres AFTER it, so the truck begins easing into the turn
// before it reaches the yellow centre line and sweeps through a curve instead of
// snapping 90° past it. Returns true when the path's final node is reached.
const CORNER = 10;                       // corner half-length (metres) each side of a junction

function railPoint(e, from, to, frac) {  // point on an edge's lane at fraction frac
  frac = Math.max(0, Math.min(1, frac));
  if (e.laneCenterX !== undefined) return { x: e.laneCenterX, z: from.z + (to.z - from.z) * frac };
  return { x: from.x + (to.x - from.x) * frac, z: e.laneCenterZ };
}
function isTurn(e1, e2) {                 // perpendicular edges → a real turn
  return (e1.laneCenterX !== undefined) !== (e2.laneCenterX !== undefined);
}
function cornerCtrl(e1, e2) {             // intersection of the two lane lines
  if (e1.laneCenterX !== undefined) return { x: e1.laneCenterX, z: e2.laneCenterZ };
  return { x: e2.laneCenterX, z: e1.laneCenterZ };
}
function cornerR(e1, e2) {                // corner radius, clamped to both edge lengths
  return Math.min(CORNER, (e1.length || 1e-4) * 0.45, (e2.length || 1e-4) * 0.45);
}
function bez(p0, p1, p2, t) {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, z: u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z };
}
function bezHead(p0, p1, p2, t) {
  const u = 1 - t;
  const tx = 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
  const tz = 2 * u * (p1.z - p0.z) + 2 * t * (p2.z - p1.z);
  return Math.atan2(tx, tz) + Math.PI;
}

function followPath(tk, step, forward) {
  if (tk.pathIdx >= tk.path.length - 1) return true;
  const path = tk.path, i = tk.pathIdx;
  const e = edgeBetween(path[i], path[i + 1]);
  const from = NODES[path[i]], to = NODES[path[i + 1]];
  const len = e.length || 1e-4;

  // Ease the lateral OFFSET toward its target (overtake pull-out / merge-back).
  const maxLat = Math.max(step, 0.4);
  let dl = (tk.latTarget || 0) - (tk.lat || 0);
  if (Math.abs(dl) > maxLat) dl = Math.sign(dl) * maxLat;
  tk.lat = (tk.lat || 0) + dl;

  if (forward) tk.s += step;
  const f = Math.min(1, tk.s / len);

  // Neighbour edges for corner rounding (entering the next turn / leaving the last).
  const eNext = (i + 2 <= path.length - 1) ? edgeBetween(path[i + 1], path[i + 2]) : null;
  const ePrev = (i - 1 >= 0) ? edgeBetween(path[i - 1], path[i]) : null;
  const Rn = eNext ? cornerR(e, eNext) : 0;
  const Rp = ePrev ? cornerR(ePrev, e) : 0;

  if (eNext && isTurn(e, eNext) && tk.s > len - Rn) {
    // FIRST half of the upcoming corner (before the node): sweep e → eNext.
    const t = 0.5 * (tk.s - (len - Rn)) / Rn;
    const p0 = railPoint(e, from, to, (len - Rn) / len);
    const p2 = railPoint(eNext, NODES[path[i + 1]], NODES[path[i + 2]], Rn / (eNext.length || 1e-4));
    const p1 = cornerCtrl(e, eNext);
    const p = bez(p0, p1, p2, t);
    tk.x = p.x; tk.z = p.z;
    tk.g.rotation.y = easeAngle(tk.g.rotation.y, bezHead(p0, p1, p2, t), 0.4);
  } else if (ePrev && isTurn(ePrev, e) && tk.s < Rp) {
    // SECOND half of the corner (after the node): finish the sweep ePrev → e.
    const lenP = ePrev.length || 1e-4;
    const t = 0.5 + 0.5 * (tk.s / Rp);
    const p0 = railPoint(ePrev, NODES[path[i - 1]], NODES[path[i]], (lenP - Rp) / lenP);
    const p2 = railPoint(e, from, to, Rp / len);
    const p1 = cornerCtrl(ePrev, e);
    const p = bez(p0, p1, p2, t);
    tk.x = p.x; tk.z = p.z;
    tk.g.rotation.y = easeAngle(tk.g.rotation.y, bezHead(p0, p1, p2, t), 0.4);
  } else {
    // Straight rail: forward coordinate by progress, lateral eased toward the
    // lane centre (+ overtake offset), clamped so it never slides > 45°/frame.
    let hx = 0, hz = 0;
    if (e.laneCenterX !== undefined) {        // z-running: x lateral, z forward
      if (forward) tk.z = from.z + (to.z - from.z) * f;
      let dx = (e.laneCenterX + tk.lat) - tk.x;
      if (Math.abs(dx) > maxLat) dx = Math.sign(dx) * maxLat;
      tk.x += dx;
      hz = Math.sign(to.z - from.z);
    } else {                                  // x-running: z lateral, x forward
      if (forward) tk.x = from.x + (to.x - from.x) * f;
      let dz = (e.laneCenterZ + tk.lat) - tk.z;
      if (Math.abs(dz) > maxLat) dz = Math.sign(dz) * maxLat;
      tk.z += dz;
      hx = Math.sign(to.x - from.x);
    }
    tk.g.rotation.y = easeAngle(tk.g.rotation.y, Math.atan2(hx, hz) + Math.PI, TURN_K);
  }

  tk.edgeId = e.id;
  if (forward && tk.s >= len) {
    tk.s -= len; tk.pathIdx++;
    // Clear any overtake offset at the junction (next edge's lateral axis differs).
    tk.lat = 0; tk.latTarget = 0; tk.overtaking = false;
    if (tk.pathIdx >= tk.path.length - 1) return true;
  }
  return false;
}

// Lane geometry of the truck's CURRENT directed edge: which world axis is
// lateral, the truck's OWN lane center, the OPPOSING lane center (mirror of own
// across the corridor centerline), and `rem` — the distance still to drive on
// this edge. Returns null when off-path. Used by the overtake logic to know
// where to swing out to, how far to come back, and whether there is ROOM left on
// the edge to overtake (so an overtake never spills across a junction onto an
// edge whose lateral axis differs).
function curLane(tk) {
  if (!tk.path || tk.pathIdx >= tk.path.length - 1) return null;
  const e = edgeBetween(tk.path[tk.pathIdx], tk.path[tk.pathIdx + 1]);
  const from = NODES[tk.path[tk.pathIdx]];
  const rem = (e.length || 1e-4) - tk.s;
  if (e.laneCenterX !== undefined) {        // z-running edge (from.x == to.x)
    return { axis: 'x', own: e.laneCenterX, opp: 2 * from.x - e.laneCenterX, rem };
  }
  return { axis: 'z', own: e.laneCenterZ, opp: 2 * from.z - e.laneCenterZ, rem }; // x-running
}

// Nearest gate barrier (by lane x) to the truck's current x.
function barrierFor(barriers, tk) {
  let bi = -1, bd = Infinity;
  for (let i = 0; i < barriers.length; i++) {
    const d = Math.abs(barriers[i].lane - tk.x);
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}

// Re-routing: when a truck is blocked on the road ahead for too long, replan a
// path to the same destination that AVOIDS the node it is currently trying to
// reach (where the blocker sits). The truck then turns around to the node behind
// it and follows the new path. Returns true when a genuinely different route was
// adopted. (Req: congested ahead → immediately find another way.)
const REROUTE_T = 2.2;   // seconds blocked before trying to re-route around
const OVERTAKE_T = 1.0;  // seconds blocked by an in-lane leader before pulling out
const OVERTAKE_LOOK = 26; // opposing lane must be clear this far ahead to pull out
const RETURN_LOOK = 18;  // own lane must be clear this far ahead before merging back
const GIVEUP_T  = 30.0;  // absolute last-resort deadlock break (rare; trucks no longer vanish on normal jams)

// Off-graph straight states (gate lanes): hold while the way ahead is blocked.
// NEVER push through (that caused trucks to stack) and — per the new behavior —
// NEVER vanish a truck that is merely queued: it simply waits its turn. Returns
// true only when the way is genuinely clear.
function clearAhead(tk) {
  return !wayBlocked(tk);
}

/* ── Counter-flow overtake + re-route driving leg ─────────────────────────────
 * driveLeg() drives a truck along its current path toward `dest` (direction
 * filter `dir`), handling a blocked road WITHOUT ever freezing-then-vanishing:
 *
 *   1. If a truck is stalled directly ahead in the truck's OWN lane for
 *      OVERTAKE_T seconds AND the OPPOSING lane is clear far enough ahead, the
 *      truck borrows the opposing lane (sets a lateral offset) to pass — exactly
 *      "kẹt quá → đi ngược chiều để tránh". It merges BACK to its own lane the
 *      moment that lane is clear of the blocker ("trở lại lane của mình ngay").
 *   2. If overtaking isn't possible (oncoming traffic), it re-routes around the
 *      blocker once per stuck episode.
 *   3. Forward motion is gated by wayBlocked(): while pulling sideways out of the
 *      lane the truck does NOT drive forward into the blocker; once it has
 *      cleared its lane (or merged into the clear opposing lane) it drives on.
 *
 * Trucks queued for THEIR OWN block's crane just wait in lane (never overtake /
 * re-route). Returns true when the path's final node is reached.
 * ──────────────────────────────────────────────────────────────────────────── */
function driveLeg(tk, dt, step, dest, dir) {
  const ln = curLane(tk);
  const laneBlocked  = !canProceed(tk);      // a truck sits ahead in MY lane
  const crossBlocked = !crossingClear(tk);   // waiting for a junction reservation
  const atOwnBlock = dir === 'inbound' && tk.path && tk.path[tk.pathIdx + 1] === SERVICE[tk.assignedBlock];

  if (tk.overtaking && ln) {
    // Mid-overtake: hug the opposing lane. Merge BACK as soon as EITHER the own
    // lane is clear ahead (we've passed the blocker) OR oncoming traffic appears
    // in the opposing lane (yield: tuck back behind the blocker, never head-on).
    const ownClear = laneClearAhead(tk, ln.axis, ln.own, RETURN_LOOK);
    const oncoming = !laneClearAhead(tk, ln.axis, ln.opp, OVERTAKE_LOOK);
    tk.latTarget = ln.opp - ln.own;
    if (ownClear || oncoming) {
      tk.overtaking = false; tk.latTarget = 0; tk.blockT = 0;
    }
  } else {
    tk.overtaking = false; tk.latTarget = 0;
    // Decide to pull out only for a same-lane blocker (not a crossing wait) and
    // never when queuing for our own crane.
    if (laneBlocked && !crossBlocked && !atOwnBlock && ln) {
      tk.blockT = (tk.blockT || 0) + dt;
      if (tk.blockT > OVERTAKE_T && ln.rem > OVERTAKE_LOOK * 0.6 &&
          laneClearAhead(tk, ln.axis, ln.opp, OVERTAKE_LOOK)) {
        tk.overtaking = true; tk.latTarget = ln.opp - ln.own;
      }
    } else {
      tk.blockT = 0;
    }
  }

  // Re-route around a persistent PHYSICAL blocker (a stalled truck in our lane)
  // when we can't overtake it. We do NOT re-route merely because we're waiting
  // our turn at a junction (crossBlocked) — that wait clears on its own, and
  // re-routing on it is what made trucks "đổi hướng" oddly at 4-ways.
  if (!tk.overtaking && laneBlocked && !atOwnBlock) {
    tk.stuck = (tk.stuck || 0) + dt;
    if (!tk.rerouted && tk.stuck > REROUTE_T && tryReroute(tk, dest, dir)) {
      tk.rerouted = true; tk.stuck = 0; return false;
    }
    // Absolute last resort: genuinely wedged for GIVEUP_T → re-dispatch (rare).
    if (tk.stuck > GIVEUP_T) { tk.stuck = 0; tk.rerouted = false; tk.lat = 0; tk.latTarget = 0; tk.overtaking = false; reDispatch(tk); return false; }
  } else if (!tk.overtaking) {
    tk.stuck = 0; tk.rerouted = false;
  }

  const moving = !wayBlocked(tk);            // true once the lane (own/opposing) is clear
  const arrived = followPath(tk, step, moving);
  if (arrived) {
    tk.lat = 0; tk.latTarget = 0; tk.overtaking = false;
    tk.blockT = 0; tk.stuck = 0; tk.rerouted = false;
  }
  return arrived;
}

// Re-routing WITHOUT reversing (so a truck never backs into the queue behind
// it): when blocked, replan the route FROM the next node, avoiding the node
// beyond it, and splice it on — the truck keeps its current edge and simply
// diverges at the upcoming junction. Returns true if a different route was found.
function tryReroute(tk, dest, dir) {
  if (!tk.path || tk.pathIdx + 2 >= tk.path.length) return false;
  const cur = tk.path[tk.pathIdx];
  const nxt = tk.path[tk.pathIdx + 1];      // node the truck is heading to
  const after = tk.path[tk.pathIdx + 2];    // node beyond (currently-planned) — avoid it
  const np = pathfind(nxt, dest, dir, after);
  if (!np || np.length < 2 || np[1] === after) return false;
  tk.path = [cur].concat(np);               // keep current edge cur→nxt, diverge at nxt
  tk.pathIdx = 0;                            // s preserved → continue current edge
  return true;
}

/* ── Frame update + driving state machine ─────────────────────────────────── */
export function updateTrucks(dt, barriers, updateGateScreens) {
  for (let i = 0; i < barriers.length; i++) _barLift[i] = 0;

  // Re-seat any deferred (pending) trucks now that earlier trucks may have
  // cleared the spawn slots, and count down each pending truck's staggered entry
  // delay (Req 6.6: defer-and-retry + Problem 2 staggered entry, once per frame).
  tryPlacePending(dt);

  // Evaluate collision/intersection state ONCE per frame into preallocated
  // scratch; each truck's canProceed(tk) below only reads that scratch.
  prepareCollision(trucks);
  reserveCrossings(trucks);    // one-at-a-time junction ownership (anti-overlap)

  trucks.forEach(tk => {
    // Deferred trucks hold off-lane (parked invisibly by dispatch) until a
    // non-overlapping spawn slot frees — never run the driving state machine.
    if (tk.pending) return;
    tk.g.position.set(tk.x, 5.0, tk.z);

    // Fade in/out across the gate's fade band (spawn / exit). Fully visible by
    // FADE_FULL (just landward of the gate) and fully invisible FADE_LEN beyond,
    // so the spawn/respawn teleport at GP.z+80 is hidden but the truck is solid
    // for the whole gate approach/exit.
    const FADE_FULL = GP.z + 10;
    let alpha = 1.0;
    if ((tk.state === 0 || tk.state === 7) && tk.z > FADE_FULL) {
      alpha = Math.max(0, Math.min(1, (FADE_FULL + FADE_LEN - tk.z) / FADE_LEN));
    }
    setTruckOpacity(tk, alpha);

    const step = dt * tk.spd;

    if (tk.state === 0) {                    // approach the gate on THIS lane
      tk.edgeId = -1;
      if (!clearAhead(tk)) return;           // keep 3 m behind; never push/stack
      if (moveTowards(tk, tk.inLaneX, CHECKIN_Z, step)) {
        tk.state = 1; tk.wait = 0.8;
        tk.barIdx = barrierFor(barriers, tk);
        if (tk.barIdx >= 0) {
          barriers[tk.barIdx].status = 1; barriers[tk.barIdx].plate = tk.plate;
          updateGateScreens();
        }
      }
    } else if (tk.state === 1) {             // wait for lift (check-in, 2 m out)
      tk.edgeId = -1;
      if (tk.barIdx >= 0) _barLift[tk.barIdx] = 1;
      if (tk.wait > 0) { tk.wait -= dt; return; }
      if (tk.barIdx >= 0 && barriers[tk.barIdx].grp.rotation.z > -1.0) return;
      tk.state = 1.7;                        // proceed straight down the lane stub
    } else if (tk.state === 1.7) {           // drive the gate→apron stub (straight)
      tk.edgeId = -1;
      if (tk.barIdx >= 0) _barLift[tk.barIdx] = 1;   // hold barrier up while passing
      if (!clearAhead(tk)) return;
      if (moveTowards(tk, tk.inLaneX, APRON_Z, step)) {
        const path = pathfind(APRON.get(tk.inLaneX), SERVICE[tk.assignedBlock], 'inbound');
        if (!path) { tk.hold = true; return; }       // Req 5.7: hold, retry
        tk.hold = false; tk.path = path; tk.pathIdx = 0; tk.s = 0; tk.state = 2;
        if (tk.barIdx >= 0) {
          barriers[tk.barIdx].status = 0; barriers[tk.barIdx].plate = null;
          updateGateScreens();
        }
        tk.barIdx = -1;
      }
    } else if (tk.state === 2) {             // follow inbound path to service node
      if (driveLeg(tk, dt, step, SERVICE[tk.assignedBlock], 'inbound')) tk.state = 3;
    } else if (tk.state === 3) {             // hand off to the block's RTG crane
      const rc = rtgCranes[tk.assignedBlock];
      if (rc && rc.state === 0 && !rc.tTrk) {
        tk.yardLane = tk.x - 1.5;            // so the crane trolley targets the truck
        rc.tTrk = tk; tk.servingRtg = rc; tk.state = 3.5;
      }                                       // else hold stationary at the node (Req 5.5)
    } else if (tk.state === 3.5) {           // being serviced; RTG sets state = 3.6
      /* wait */
    } else if (tk.state === 3.6) {           // released → plan nearest-exit outbound route
      const exit = planNearestExit(SERVICE[tk.assignedBlock]);
      if (!exit) { tk.hold = true; return; }
      tk.hold = false; tk.servingRtg = null;
      tk.outLaneX = exit.lane;               // adopt the nearest gate's lane for the stub drive
      tk.path = exit.path; tk.pathIdx = 0; tk.s = 0; tk.state = 6;
    } else if (tk.state === 6) {             // follow outbound path to the exit apron
      if (driveLeg(tk, dt, step, APRON.get(tk.outLaneX), 'outbound')) { tk.edgeId = -1; tk.state = 6.2; }
    } else if (tk.state === 6.2) {           // drive the apron→gate stub up (straight)
      tk.edgeId = -1;
      if (!clearAhead(tk)) return;
      if (moveTowards(tk, tk.outLaneX, CHECKOUT_Z, step)) {
        tk.state = 6.5; tk.wait = 1.0;
        tk.barIdx = barrierFor(barriers, tk);
        if (tk.barIdx >= 0) {
          barriers[tk.barIdx].status = 1; barriers[tk.barIdx].plate = tk.plate;
          updateGateScreens();
        }
      }
    } else if (tk.state === 6.5) {           // wait for lift (check-out, 2 m in)
      tk.edgeId = -1;
      if (tk.barIdx >= 0) _barLift[tk.barIdx] = 1;
      if (tk.wait > 0) { tk.wait -= dt; return; }
      if (tk.barIdx >= 0 && barriers[tk.barIdx].grp.rotation.z > -1.0) return;
      if (tk.barIdx >= 0) {
        barriers[tk.barIdx].status = 0; barriers[tk.barIdx].plate = null;
        updateGateScreens();
      }
      tk.barIdx = -1; tk.state = 7;
    } else if (tk.state === 7) {             // drive away landward, then re-dispatch
      tk.edgeId = -1;
      if (!clearAhead(tk)) return;
      if (moveTowards(tk, tk.outLaneX, GP.z + 80, step)) reDispatch(tk);
    }
  });

  // Physically animate the gate barriers from the per-frame lift flags.
  for (let i = 0; i < barriers.length; i++) {
    const tgt = _barLift[i] ? -Math.PI / 2.2 : 0;
    barriers[i].grp.rotation.z += (tgt - barriers[i].grp.rotation.z) * Math.min(1, dt * 6);
  }
}
