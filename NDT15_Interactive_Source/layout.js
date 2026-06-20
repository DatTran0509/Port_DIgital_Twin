/* ──────────────────────────────────────────────────────────────────────────
 * layout.js — Layout Import Hub (the keystone)
 *
 * Single source of truth for every coordinate in the port. Exposes ONLY pure,
 * deterministic derivations of the named parameters in PARAMS: numbers and
 * plain data — never THREE.js objects. This keeps the module directly testable
 * (see Properties 1–6 in design.md) and lets the whole port be resized by
 * editing PARAMS alone.
 *
 * Axis convention (from the existing codebase):
 *   - water / berths sit at negative z (BERTH_Z = -22)
 *   - city / gate sit at positive z
 *   - "toward the city" therefore means INCREASING z
 *
 * This file is a designated Import_Hub and may exceed ~200 lines (Req 10.2).
 * It does NOT import THREE — it produces plain numbers/data only.
 *
 * Requirements: 3.1, 1.1, 1.2, 1.4, 2.1, 2.2, 7.2
 * ────────────────────────────────────────────────────────────────────────── */

/* ── PARAMETERS ───────────────────────────────────────────────────────────
 * The ONLY place the layout is "decided". Defaults yield COLS*ROWS = 24 blocks
 * (20 ≤ 24 ≤ 30, Req 1.1). All accessors below read live from this object so
 * that changing a parameter repositions every derived element (Req 3.1, 3.2).
 */
export const PARAMS = {
  // Grid shape
  COLS: 6,            // number of block columns (along x)
  ROWS: 4,            // number of block rows (along z, growing toward the city)

  // Block footprint
  BLOCK_W: 24,        // block width  (x extent)
  BLOCK_D: 42,        // block depth  (z extent)

  // Road corridor
  ROAD_W: 24,         // two-lane corridor width (2 lanes + markings + clearance)
  LANE_HALF: 5,       // lane centerline offset from the corridor center

  // Pitches (corridor-to-corridor spacing) — derived from footprint + road
  COL_PITCH: 24 + 24, // BLOCK_W + ROAD_W = 48
  ROW_PITCH: 42 + 24, // BLOCK_D + ROAD_W = 66

  // Anchors
  YARD_Z0: 45,        // center z of row 0 (just inland of the quay)
  QUAY_Z: 1,          // quay surface reference z (unchanged waterfront)
  BERTH_Z: -22,       // berth line z (unchanged waterfront)

  // Quay length reference (kept for the waterfront sizing / validation surface).
  // NOTE: berthX() now aligns berths one-per-yard-column (see berthX below) so
  // the STS cranes line up with the yard rows; QUAY_LEN / BERTH_SPACING are no
  // longer used to position berths and are retained only as layout metadata.
  QUAY_LEN: 360,      // total quay length along x (waterfront sizing reference)
  BERTH_SPACING: 60,  // legacy nominal berth spacing (no longer positions berths)

  // Gate & apron
  GATE_GAP: 90,       // gap from the last block row to the gate, in +z (long entry road)
  APRON_MARGIN: 2,    // clearance (≥ 2) from outermost element edge to apron edge
};

/* ── INTERNAL 1-D HELPERS ─────────────────────────────────────────────────
 * Small building blocks the public accessors compose. Exported so consumers
 * and tests can derive single-axis values without allocating a {x,z} object.
 */

// Center x of a block column: columns are symmetric about x = 0.
//   blockCenterX(col) = (col - (COLS-1)/2) * COL_PITCH
// e.g. COLS=6 → [-120,-72,-24,24,72,120]
export function blockCenterX(col) {
  const { COLS, COL_PITCH } = PARAMS;
  return (col - (COLS - 1) / 2) * COL_PITCH;
}

// Center z of a block row: row 0 sits at YARD_Z0 and rows grow toward the city.
//   blockCenterZ(row) = YARD_Z0 + row * ROW_PITCH
// e.g. ROWS=4 → [45,111,177,243]
export function blockCenterZ(row) {
  const { YARD_Z0, ROW_PITCH } = PARAMS;
  return YARD_Z0 + row * ROW_PITCH;
}

/* ── PUBLIC ACCESSORS (pure functions of PARAMS) ─────────────────────────── */

// Grid position of a block as plain data.
export function blockCenter(col, row) {
  return { x: blockCenterX(col), z: blockCenterZ(row) };
}

// Unique id for a block, 1 .. COLS*ROWS (row-major). (Req 1.4)
export function blockId(col, row) {
  return row * PARAMS.COLS + col + 1;
}

// Vertical road centerlines (roads running along z), one between/around every
// column. Returns COLS+1 x-values: perimeter + midpoints between columns.
//   COLS=6 → [-144,-96,-48,0,48,96,144]
export function vertRoadX() {
  const { COLS, COL_PITCH } = PARAMS;
  const start = blockCenterX(0) - COL_PITCH / 2; // perimeter road before column 0
  const out = [];
  for (let k = 0; k <= COLS; k++) out.push(start + k * COL_PITCH);
  return out;
}

// Horizontal road centerlines (roads running along x), one between/around every
// row. Returns ROWS+1 z-values: front (quay-side) + midpoints + gate cross.
//   ROWS=4 → [12,78,144,210,276]
export function horizRoadZ() {
  const { ROWS, ROW_PITCH } = PARAMS;
  const start = blockCenterZ(0) - ROW_PITCH / 2; // front road just inland of quay
  const out = [];
  for (let k = 0; k <= ROWS; k++) out.push(start + k * ROW_PITCH);
  return out;
}

// The two lane centerlines of a corridor, offset ±LANE_HALF from its center.
//   axis 'x' → roadCenter is an x (vertical road); returned values are x's.
//   axis 'z' → roadCenter is a z (horizontal road); returned values are z's.
// Returns [low, high] (the lower-coordinate lane first). The router assigns
// inbound/outbound direction per edge; this accessor only supplies geometry.
export function laneCenters(roadCenter, axis = 'x') {
  const h = PARAMS.LANE_HALF;
  // axis is informational (which world axis the offsets apply to); the offset
  // math is identical, so we keep it explicit for the caller's clarity.
  void axis;
  return [roadCenter - h, roadCenter + h];
}

// Berth x-positions, aligned ONE-PER-COLUMN with the yard blocks so the quay
// cranes (built one per berth) line up directly in front of the yard rows
// (Problem 2: "thu khoảng cách cần cẩu lại để hợp nhất với hàng của bãi").
// Berth COUNT therefore equals COLS and the spacing equals COL_PITCH (48),
// pulled in from the previous independent 60-unit spacing.
export function berthCount() {
  return PARAMS.COLS;
}
export function berthX() {
  const out = [];
  for (let i = 0; i < PARAMS.COLS; i++) out.push(blockCenterX(i));
  return out;
}

// Map a block (many) to its nearest berth (fewer) by x-proximity. (Req 3.1)
// Decouples berth count from block count; ties resolve to the lower index.
export function blockToBerth(col, row) {
  const x = blockCenterX(col);
  const bx = berthX();
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < bx.length; i++) {
    const d = Math.abs(bx[i] - x);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// Gate position: landward end, in +z beyond the last block row (Req 7.2).
//   gateZ = blockCenterZ(ROWS-1) + BLOCK_D/2 + GATE_GAP  → 243 + 21 + 90 = 354
export function gatePosition() {
  const { ROWS, BLOCK_D, GATE_GAP } = PARAMS;
  return { x: 0, z: blockCenterZ(ROWS - 1) + BLOCK_D / 2 + GATE_GAP };
}

// Gate lane x-values, aligned to the central vertical road so inbound trucks
// feed straight onto the grid. Uses the corridor closest to x = 0.
export function gateLaneX() {
  const roads = vertRoadX();
  // pick the vertical road nearest the centerline (x = 0)
  let centerRoad = roads[0];
  for (const r of roads) if (Math.abs(r) < Math.abs(centerRoad)) centerRoad = r;
  return laneCenters(centerRoad, 'x');
}

// Axis-aligned apron bounds: bounding box of all blocks + roads, expanded by
// APRON_MARGIN on every side (Req 2.1). Used to size the apron/quay surfaces.
export function apronBounds() {
  const { BLOCK_W, BLOCK_D, ROAD_W, APRON_MARGIN, COLS, ROWS } = PARAMS;

  // outermost block edges
  const blockMinX = blockCenterX(0) - BLOCK_W / 2;
  const blockMaxX = blockCenterX(COLS - 1) + BLOCK_W / 2;
  const blockMinZ = blockCenterZ(0) - BLOCK_D / 2;
  const blockMaxZ = blockCenterZ(ROWS - 1) + BLOCK_D / 2;

  // outermost road edges (corridor half-width beyond each centerline)
  const vx = vertRoadX();
  const hz = horizRoadZ();
  const roadMinX = vx[0] - ROAD_W / 2;
  const roadMaxX = vx[vx.length - 1] + ROAD_W / 2;
  const roadMinZ = hz[0] - ROAD_W / 2;
  const roadMaxZ = hz[hz.length - 1] + ROAD_W / 2;

  return {
    minX: Math.min(blockMinX, roadMinX) - APRON_MARGIN,
    maxX: Math.max(blockMaxX, roadMaxX) + APRON_MARGIN,
    minZ: Math.min(blockMinZ, roadMinZ) - APRON_MARGIN,
    maxZ: Math.max(blockMaxZ, roadMaxZ) + APRON_MARGIN,
  };
}

/* ── VALIDATION ───────────────────────────────────────────────────────────
 * validateLayout() — finiteness/completeness check (Req 3.4).
 *
 * Runs before any positioning pass. Verifies that (1) every required PARAMS key
 * is present and a finite number, and (2) the key derived accessor outputs are
 * finite. Returns {ok:true} when everything checks out, otherwise
 * {ok:false, badKey:'<name>'} naming the first offending parameter or derived
 * value. Consumers treat a failed validation as a no-op: they skip positioning
 * and retain the last valid transforms (the design also has them log
 * console.error naming badKey — that logging lives in the consumer, not here).
 *
 * Pure function: no THREE.js, no side effects.
 */

// The complete set of PARAMS keys the layout depends on. Listed explicitly so a
// MISSING key is detected as a failure (rather than silently treated as absent).
const REQUIRED_PARAM_KEYS = [
  'COLS', 'ROWS',
  'BLOCK_W', 'BLOCK_D',
  'ROAD_W', 'LANE_HALF',
  'COL_PITCH', 'ROW_PITCH',
  'YARD_Z0', 'QUAY_Z', 'BERTH_Z',
  'QUAY_LEN', 'BERTH_SPACING',
  'GATE_GAP', 'APRON_MARGIN',
];

// True when v is a real, finite number (rejects NaN, ±Infinity, undefined,
// null, strings, etc.).
function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// True when every number in an array (or every numeric field of a plain object)
// is finite. Returns false for empty/❌ shapes so derived-value checks fail loud.
function allFinite(values) {
  if (!Array.isArray(values) || values.length === 0) return false;
  for (const v of values) if (!isFiniteNumber(v)) return false;
  return true;
}

export function validateLayout() {
  // (1) Completeness + finiteness of every required parameter.
  for (const key of REQUIRED_PARAM_KEYS) {
    if (!(key in PARAMS) || !isFiniteNumber(PARAMS[key])) {
      return { ok: false, badKey: key };
    }
  }

  // (2) Sanity-check key derived values are finite. If a param interacts badly
  // (e.g. produces NaN through a division), surface the derived accessor name.
  // Guarded so a thrown accessor is reported rather than crashing the caller.
  try {
    const { COLS, ROWS } = PARAMS;

    // Block centers across the whole grid.
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const c = blockCenter(col, row);
        if (!isFiniteNumber(c.x) || !isFiniteNumber(c.z)) {
          return { ok: false, badKey: 'blockCenter' };
        }
      }
    }

    if (!allFinite(vertRoadX())) return { ok: false, badKey: 'vertRoadX' };
    if (!allFinite(horizRoadZ())) return { ok: false, badKey: 'horizRoadZ' };
    if (!allFinite(berthX())) return { ok: false, badKey: 'berthX' };
    if (!allFinite(gateLaneX())) return { ok: false, badKey: 'gateLaneX' };

    const gate = gatePosition();
    if (!isFiniteNumber(gate.x) || !isFiniteNumber(gate.z)) {
      return { ok: false, badKey: 'gatePosition' };
    }

    const ap = apronBounds();
    if (!isFiniteNumber(ap.minX) || !isFiniteNumber(ap.maxX) ||
        !isFiniteNumber(ap.minZ) || !isFiniteNumber(ap.maxZ)) {
      return { ok: false, badKey: 'apronBounds' };
    }
  } catch (e) {
    return { ok: false, badKey: 'derived' };
  }

  return { ok: true };
}

/* ── ROAD GRAPH (routing model) ───────────────────────────────────────────
 * roadGraph() — builds the waypoint graph the truck router drives over.
 *
 * Returns plain data: { nodes, edges, adj } (no THREE.js). The graph is derived
 * entirely from the accessors above so a road you can see is a road a truck can
 * drive (Req 4.4).
 *
 *   Node = { id, x, z, kind: 'crossing'|'gate'|'service'|'berthside', ...meta }
 *   Edge = { id, fromNode, toNode, dir: 'inbound'|'outbound',
 *            laneCenterX | laneCenterZ, length }
 *   RoadGraph = { nodes: Node[], edges: Edge[], adj: number[][] }
 *
 * Topology:
 *   - 'crossing' nodes: the full (COLS+1)×(ROWS+1) intersection grid at every
 *     (vertRoadX[i], horizRoadZ[j]).
 *   - 'gate' node: at gatePosition() (landward, +z beyond the last block row),
 *     joined to the nearest crossing so every inbound route starts here (Req 7.2).
 *   - 'service' node: one per block at blockCenter(col,row), joined to the four
 *     crossings bounding its block so a truck can pull up to be served by the RTG.
 *   - 'berthside' node: one per berth at (berthX[i], QUAY_Z), joined to the
 *     nearest front-row crossing, representing the quay/berth side of the port.
 *
 * Edges (Req 4.1): every physical corridor — each adjacent-crossing link plus
 * each gate/service/berthside connector — yields EXACTLY TWO opposing directed
 * edges (one per travel direction). Each directed edge carries the lane
 * centerline it should track (laneCenters()) and a direction label:
 *   - z-running corridors: travelling −z (toward the quay) is 'inbound',
 *     travelling +z (toward the gate) is 'outbound'.
 *   - x-running corridors: travelling +x is labelled 'inbound', −x 'outbound'
 *     (a stable convention so each lane bucket has a consistent tag; the
 *     quay/gate semantics live on the dominant z-running corridors).
 * Lane assignment follows right-hand driving: the lane offset to the traveller's
 * right of the corridor centerline (high lane for inbound, low lane for outbound).
 *
 * Connectivity (Req 4.4): the crossing grid is fully linked, the gate hangs off
 * it, and every service/berthside node attaches to it, so every block service
 * node can reach both the gate node and a berth-side node.
 *
 * Pure function: no THREE.js, no side effects.
 */
export function roadGraph() {
  const { COLS, ROWS, LANE_HALF, QUAY_Z } = PARAMS;

  const nodes = [];
  const edges = [];
  const adj = [];

  // ── node factory ────────────────────────────────────────────────────────
  function addNode(x, z, kind, meta = {}) {
    const id = nodes.length;
    nodes.push({ id, x, z, kind, ...meta });
    adj.push([]);
    return id;
  }

  // ── directed-edge factory (one lane / one travel direction) ───────────────
  function makeEdge(fromId, toId) {
    const from = nodes[fromId];
    const to = nodes[toId];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);

    const edge = { id: edges.length, fromNode: fromId, toNode: toId, length };

    if (Math.abs(dx) >= Math.abs(dz)) {
      // x-running corridor: lanes are offset in z about the corridor centerline.
      const roadCenterZ = (from.z + to.z) / 2;
      const [lo, hi] = laneCenters(roadCenterZ, 'z');
      const movingPositiveX = dx > 0;
      edge.dir = movingPositiveX ? 'inbound' : 'outbound';
      edge.laneCenterZ = movingPositiveX ? hi : lo; // keep right (right-hand traffic)
    } else {
      // z-running corridor: lanes are offset in x about the corridor centerline.
      const roadCenterX = (from.x + to.x) / 2;
      const [lo, hi] = laneCenters(roadCenterX, 'x');
      const movingTowardQuay = dz < 0; // −z heads toward the quay
      edge.dir = movingTowardQuay ? 'inbound' : 'outbound';
      edge.laneCenterX = movingTowardQuay ? hi : lo; // keep right (right-hand traffic)
    }

    edges.push(edge);
    adj[fromId].push(toId);
    return edge.id;
  }

  // A physical corridor = two opposing directed edges (Req 4.1).
  function addCorridor(aId, bId) {
    makeEdge(aId, bId);
    makeEdge(bId, aId);
  }

  // ── 1. crossing grid (vertRoadX × horizRoadZ) ─────────────────────────────
  const vx = vertRoadX();   // length COLS+1
  const hz = horizRoadZ();  // length ROWS+1
  // cross[i][j] = node id of the crossing at (vx[i], hz[j])
  const cross = [];
  for (let i = 0; i < vx.length; i++) {
    cross.push([]);
    for (let j = 0; j < hz.length; j++) {
      cross[i].push(addNode(vx[i], hz[j], 'crossing', { col: i, row: j }));
    }
  }

  // Grid corridors: link adjacent crossings along x and along z.
  for (let i = 0; i < vx.length; i++) {
    for (let j = 0; j < hz.length; j++) {
      if (i + 1 < vx.length) addCorridor(cross[i][j], cross[i + 1][j]); // x-running
      if (j + 1 < hz.length) addCorridor(cross[i][j], cross[i][j + 1]); // z-running
    }
  }

  // ── 2. gate apron nodes — ONE per physical gate lane ──────────────────────
  // Each of the 4 gate lanes (x = ±10 / ±30, mirroring gate/gate.js + dispatch)
  // gets its OWN node on the back (landward) road. Each apron node connects to
  // the TWO back-row crossings NEAREST its own lane x, so a truck reaches (or
  // leaves) the gate through whichever junction is closest to the column it is
  // on — no driving past the gate and U-turning back. The router then picks the
  // nearest gate by path cost (see router state 3.6), so exits stay short.
  const GATE_LANES = [-30, -10, 10, 30];
  const backRow = hz.length - 1;            // index of the landward (gate-side) row
  for (const lane of GATE_LANES) {
    const apId = addNode(lane, hz[backRow], 'gateapron', { gateLane: lane });
    // rank back-row crossings by |x - lane|, connect the two nearest.
    const ranked = [];
    for (let i = 0; i < vx.length; i++) {
      ranked.push({ id: cross[i][backRow], d: Math.abs(nodes[cross[i][backRow]].x - lane) });
    }
    ranked.sort((a, b) => a.d - b.d);
    addCorridor(apId, ranked[0].id);
    if (ranked[1]) addCorridor(apId, ranked[1].id);
  }

  // ── 3. service nodes (one per block), placed ON the block's left-side road ──
  // The node sits on vertRoadX[col] at the block's z and connects ONLY to the
  // two crossings on that road (above/below the block) via vertical, in-lane
  // connectors. A truck therefore drives the road lane BESIDE the block and is
  // serviced by the RTG reaching over — it never crosses the block interior.
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const c = blockCenter(col, row);
      const svcId = addNode(vx[col], c.z, 'service', { blockId: blockId(col, row), col, row });
      addCorridor(svcId, cross[col][row]);
      addCorridor(svcId, cross[col][row + 1]);
    }
  }

  // ── 4. berth-side nodes (one per berth) joined to nearest front-row crossing
  // Front row of crossings is j=0 (quay side, lowest z).
  const bx = berthX();
  for (let b = 0; b < bx.length; b++) {
    const bsId = addNode(bx[b], QUAY_Z, 'berthside', { berthIndex: b });
    let frontId = cross[0][0];
    let frontD = Infinity;
    for (let i = 0; i < vx.length; i++) {
      const n = nodes[cross[i][0]];
      const d = Math.abs(n.x - bx[b]);
      if (d < frontD) { frontD = d; frontId = cross[i][0]; }
    }
    addCorridor(bsId, frontId);
  }

  return { nodes, edges, adj };
}
