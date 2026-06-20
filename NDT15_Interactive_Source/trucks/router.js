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
import { prepareCollision, canProceed } from './collision.js';
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

// Gate geometry for the (non-graph) approach / exit phases. Each truck carries
// its own inbound/outbound lane x (tk.inLaneX / tk.outLaneX, assigned in
// dispatch.js over the 4 gate lanes at x = ±10/±30), driven straight down/up its
// own lane so there is NO diagonal lane-merge at the gate.
const GP = gatePosition();
// Gate barriers sit ±4.5 from the gate center (see gate/gate.js). Trucks stop
// 2 m BEFORE their barrier: entry on the +z (approach) side, exit on the −z
// (inside) side — i.e. "check in / check out 2 m from the gate" (Req).
const CHECKIN_Z  = GP.z + 4.5 + 2;     // entry stop line: 2 m before entry barrier
const CHECKOUT_Z = GP.z - 4.5 - 2;     // exit  stop line: 2 m before exit barrier

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

// Advance along the current directed edge, pinned to its lane centerline.
// Scalar progress `s` still advances along the edge (arrival/handoff timing is
// unchanged); only the RENDERED tk.x/tk.z/rotation are eased toward the in-lane
// target so the lateral jump at z-edge ↔ x-edge intersections sweeps smoothly.
// Returns true when the final node of the path is reached (based on s/pathIdx,
// not the eased position).
function followPath(tk, step) {
  if (tk.pathIdx >= tk.path.length - 1) return true;
  const e = edgeBetween(tk.path[tk.pathIdx], tk.path[tk.pathIdx + 1]);
  const from = NODES[tk.path[tk.pathIdx]], to = NODES[tk.path[tk.pathIdx + 1]];
  const len = e.length || 1e-4;
  tk.s += step;
  const f = Math.min(1, tk.s / len);
  // The FORWARD coordinate follows progress exactly (no lag); the LATERAL
  // coordinate merges toward the lane center but is CLAMPED so the truck never
  // slides sideways faster than it drives forward (≤ 45° merge). This removes
  // the sudden sideways "jerk" when a wide gate lane (±10/±30) merges onto the
  // narrow central road lane (±5) — the merge now sweeps diagonally instead.
  const maxLat = step; // max lateral move per frame == forward step (45°)
  let hx = 0, hz = 0;
  if (e.laneCenterX !== undefined) {        // z-running: x is lateral, z forward
    tk.z = from.z + (to.z - from.z) * f;
    let dx = e.laneCenterX - tk.x;
    if (Math.abs(dx) > maxLat) dx = Math.sign(dx) * maxLat;
    tk.x += dx;
    hz = Math.sign(to.z - from.z);
  } else {                                  // x-running: z is lateral, x forward
    tk.x = from.x + (to.x - from.x) * f;
    let dz = e.laneCenterZ - tk.z;
    if (Math.abs(dz) > maxLat) dz = Math.sign(dz) * maxLat;
    tk.z += dz;
    hx = Math.sign(to.x - from.x);
  }
  tk.edgeId = e.id;
  tk.g.rotation.y = easeAngle(tk.g.rotation.y, Math.atan2(hx, hz) + Math.PI, TURN_K);
  if (tk.s >= len) { tk.s -= len; tk.pathIdx++; if (tk.pathIdx >= tk.path.length - 1) return true; }
  return false;
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
const FORCE_T   = 6.0;   // seconds blocked before forcing through (anti-freeze)

// Anti-freeze gate for the OFF-graph straight states: normally hold when the
// way ahead is not clear, but after FORCE_T seconds of being blocked, force a
// move so the fleet can NEVER lock up permanently (last resort).
function clearAhead(tk, dt) {
  if (canProceed(tk)) { tk.frozen = 0; return true; }
  tk.frozen = (tk.frozen || 0) + dt;
  if (tk.frozen >= FORCE_T) { tk.frozen = 0; return true; }
  return false;
}

function tryReroute(tk, dest, dir) {
  if (!tk.path || tk.pathIdx + 1 >= tk.path.length) return false;
  const cur = tk.path[tk.pathIdx];          // node just behind the truck
  const nxt = tk.path[tk.pathIdx + 1];      // blocked node ahead
  const np = pathfind(cur, dest, dir, nxt); // plan around the blocked node
  if (!np || np.length < 2 || np[1] === nxt) return false;
  tk.path = np; tk.pathIdx = 0; tk.s = 0;
  tk.reroute = true; tk.returnNode = cur;   // drive back to `cur`, then follow np
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
      if (!clearAhead(tk, dt)) return;       // keep 3 m behind (force after FORCE_T)
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
      if (!clearAhead(tk, dt)) return;
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
      if (tk.reroute) {                      // turning around to an alternate route
        tk.edgeId = -1;
        const rn = NODES[tk.returnNode];
        if (moveTowards(tk, rn.x, rn.z, step)) { tk.reroute = false; tk.s = 0; tk.pathIdx = 0; }
        return;
      }
      if (!canProceed(tk)) {                 // blocked ahead → wait / re-route / force
        // Queued for THIS truck's OWN block crane (final hop = its service node):
        // just wait 3 m behind until the crane frees — never re-route or force
        // (forcing would stack onto the truck being serviced).
        const atOwnBlock = tk.path && tk.path[tk.pathIdx + 1] === SERVICE[tk.assignedBlock];
        if (atOwnBlock) { tk.stuck = 0; return; }
        tk.stuck = (tk.stuck || 0) + dt;
        // Otherwise re-route AROUND the blocker (e.g. a truck busy loading on the
        // through-road); if still stuck after FORCE_T, force through (anti-freeze).
        if (tk.stuck > REROUTE_T && tryReroute(tk, SERVICE[tk.assignedBlock], 'inbound')) { tk.stuck = 0; return; }
        if (tk.stuck < FORCE_T) return;
      }
      tk.stuck = 0;
      if (followPath(tk, step)) tk.state = 3;   // keep edgeId so queued trucks see it
    } else if (tk.state === 3) {             // hand off to the block's RTG crane
      const rc = rtgCranes[tk.assignedBlock];
      if (rc && rc.state === 0 && !rc.tTrk) {
        tk.yardLane = tk.x - 1.5;            // so the crane trolley targets the truck
        rc.tTrk = tk; tk.servingRtg = rc; tk.state = 3.5;
      }                                       // else hold stationary at the node (Req 5.5)
    } else if (tk.state === 3.5) {           // being serviced; RTG sets state = 3.6
      /* wait */
    } else if (tk.state === 3.6) {           // released → plan outbound route
      const path = pathfind(SERVICE[tk.assignedBlock], APRON.get(tk.outLaneX), 'outbound');
      if (!path) { tk.hold = true; return; }
      tk.hold = false; tk.servingRtg = null;
      tk.path = path; tk.pathIdx = 0; tk.s = 0; tk.state = 6;
    } else if (tk.state === 6) {             // follow outbound path to the exit apron
      if (tk.reroute) {                      // turning around to an alternate route
        tk.edgeId = -1;
        const rn = NODES[tk.returnNode];
        if (moveTowards(tk, rn.x, rn.z, step)) { tk.reroute = false; tk.s = 0; tk.pathIdx = 0; }
        return;
      }
      if (!canProceed(tk)) {
        tk.stuck = (tk.stuck || 0) + dt;
        if (tk.stuck > REROUTE_T && tryReroute(tk, APRON.get(tk.outLaneX), 'outbound')) { tk.stuck = 0; return; }
        if (tk.stuck < FORCE_T) return;      // after FORCE_T, fall through (force move)
      }
      tk.stuck = 0;
      if (followPath(tk, step)) { tk.edgeId = -1; tk.state = 6.2; }
    } else if (tk.state === 6.2) {           // drive the apron→gate stub up (straight)
      tk.edgeId = -1;
      if (!clearAhead(tk, dt)) return;
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
      if (!clearAhead(tk, dt)) return;
      if (moveTowards(tk, tk.outLaneX, GP.z + 80, step)) reDispatch(tk);
    }
  });

  // Physically animate the gate barriers from the per-frame lift flags.
  for (let i = 0; i < barriers.length; i++) {
    const tgt = _barLift[i] ? -Math.PI / 2.2 : 0;
    barriers[i].grp.rotation.z += (tgt - barriers[i].grp.rotation.z) * Math.min(1, dt * 6);
  }
}
