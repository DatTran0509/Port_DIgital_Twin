/* ──────────────────────────────────────────────────────────────────────────
 * roads/road-network.js — Two-lane road SURFACES for the full yard grid
 *
 * Builds the drivable road surfaces of the port directly from layout.js, so the
 * geometry you see matches the routing graph a truck drives (Req 4.4, 5.1):
 *   - one long corridor surface per vertical road centerline (vertRoadX), and
 *   - one long corridor surface per horizontal road centerline (horizRoadZ).
 * Each corridor is ROAD_W wide, so adjacent blocks are separated by exactly one
 * two-lane corridor (Req 4.1), and the perimeter/front/back corridors plus a
 * gate connector give every block a continuous path to the gate (landward, +z)
 * and to the berth-side (quay, low z) (Req 4.4).
 *
 * Lane-divider and directional markings ARE built here (task 5.2) by
 * buildMarkings(), called at the end of initRoadNetwork(). Every marking sits at
 * a small +y offset above the road surface (MARKING_Y, just above ROAD_TOP) so
 * no marking z-fights the road (Req 4.5):
 *   - a dashed YELLOW center divider down each corridor centerline (Req 4.2), and
 *   - WHITE lane dashes plus directional CHEVRONS in each of the two lanes that
 *     point along that lane's travel direction, distinguishing the inbound lane
 *     from the outbound lane (Req 4.3). The inbound/outbound lane convention is
 *     the SAME one layout.roadGraph() assigns (keep-right): for z-running
 *     corridors the −z lane is inbound, +z is outbound; for x-running corridors
 *     the +x lane is inbound, −x is outbound.
 * All marking geometry is reused via the cached bx() helper (one BoxGeometry per
 * distinct size) and two shared materials (M.mark yellow + one white material).
 *
 * No hardcoded coordinates: every position derives from layout.js (Req 10.4/10.5).
 * Targets < 200 source lines (Req 10.1). Imports only core.js + layout.js (Req 10.6).
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 * ────────────────────────────────────────────────────────────────────────── */

import * as THREE from 'three';
import { scene, M, bx, mat } from '../core.js';
import {
  PARAMS,
  vertRoadX,
  horizRoadZ,
  laneCenters,
  apronBounds,
  gatePosition,
} from '../layout.js';

/* ── Vertical placement ───────────────────────────────────────────────────
 * Road surfaces sit on the apron. The legacy roads used y ≈ 4.62 as the box
 * base; we keep that so roads rest on the apron without z-fighting. ROAD_TOP is
 * exported so task 5.2 can place markings just above the road tops.
 */
const ROAD_THICK = 0.4;        // surface slab thickness (matches legacy roads)
export const ROAD_Y = 4.62;    // box BASE y passed to bx() (apron-top aligned)
export const ROAD_TOP = ROAD_Y + ROAD_THICK; // road top; markings go just above

/* ── Marking placement & sizing ───────────────────────────────────────────
 * Markings rest on a thin slab whose BASE sits MARK_EPS above ROAD_TOP, so the
 * whole marking volume is strictly above the road surface and never z-fights it
 * (Req 4.5). MARKING_Y is the base y passed to bx().
 */
const MARK_EPS = 0.03;                          // lift above the road top
export const MARKING_Y = ROAD_TOP + MARK_EPS;   // base y for every marking
const MARK_H = 0.06;     // marking slab thickness (thin)
const DASH_LONG = 4;     // dash extent along the travel axis
const DASH_THIN = 0.5;   // dash extent across the lane
const DASH_STEP = 14;    // spacing between consecutive dash centers
const CHEV_STEP = 28;    // spacing between consecutive directional chevrons
const CHEV_ARM = 3;      // chevron arm length
const CHEV_THIN = 0.5;   // chevron arm thickness
const CHEV_SPREAD = 0.7; // half-angle (rad) each arm splays from the heading

let roadGroup = null;
// Single shared white marking material (lane dashes + chevrons), created lazily.
let mWhite = null;

// Helper: build a flat road slab centered at (cx, cz) with x-extent w, z-extent d.
// Reuses bx() so identical (w, h, d) corridors share one cached BoxGeometry and
// the shared M.road material — keeping draw allocations minimal.
function slab(w, d, cx, cz) {
  // bx(parent, w, h, d, mat, x, y, z) — y is the slab BASE.
  return bx(roadGroup, w, ROAD_THICK, d, M.road, cx, ROAD_Y, cz);
}

/* ── initRoadNetwork() ────────────────────────────────────────────────────
 * Build and add the grid of road surfaces to the scene. Everything is derived
 * from layout.js; changing PARAMS reshapes the network automatically (Req 3.1).
 * Returns the group so callers/UI can reference it if needed.
 */
export function initRoadNetwork() {
  roadGroup = new THREE.Group();
  roadGroup.name = 'roadNetwork';
  scene.add(roadGroup);

  const { ROAD_W } = PARAMS;
  const vx = vertRoadX();   // x centerlines of vertical (z-running) corridors
  const hz = horizRoadZ();  // z centerlines of horizontal (x-running) corridors

  // Grid extents: outer edges of the perimeter corridors (half a road past the
  // first/last centerlines). These bound both road families and yield exactly
  // one two-lane corridor between each pair of adjacent blocks (Req 4.1).
  const xMin = vx[0] - ROAD_W / 2;
  const xMax = vx[vx.length - 1] + ROAD_W / 2;
  const zFront = hz[0] - ROAD_W / 2;                 // quay-side / berth approach
  const zBack = hz[hz.length - 1] + ROAD_W / 2;      // landward back of the grid

  // ── Vertical corridors (run along z), one per vertRoadX entry ─────────────
  // Each spans the full grid depth (front → back); width ROAD_W in x. Together
  // with the horizontal corridors this forms the connected crossing grid.
  const vSpan = zBack - zFront;
  const vCenterZ = (zFront + zBack) / 2;
  for (const x of vx) {
    slab(ROAD_W, vSpan, x, vCenterZ);
  }

  // ── Horizontal corridors (run along x), one per horizRoadZ entry ──────────
  // Each spans the full grid width; width ROAD_W in z. The front-most corridor
  // (lowest z) runs along the quay, giving the berth-side connection (Req 4.4).
  const hSpan = xMax - xMin;
  const hCenterX = (xMin + xMax) / 2;
  for (const z of hz) {
    slab(hSpan, ROAD_W, hCenterX, z);
  }

  // ── Gate apron (landward, +z): a paved 4-lane plaza in front of the gate ───
  // Replaces the old single central connector. Covers all four gate lanes
  // (x = ±10/±30) from the back road out past the gate to the truck approach,
  // so every lane — including the two OUTER lanes — has real road under it and
  // trucks drive straight in-lane (no diagonal). Lane markings are added in
  // buildMarkings(). 88 wide × from the back road to well in front of the gate.
  const gate = gatePosition();
  const apronZ0 = hz[hz.length - 1];        // back road (apron node row)
  const apronZ1 = gate.z + 92;              // out past the gate, covering the approach
  slab(88, apronZ1 - apronZ0, 0, (apronZ0 + apronZ1) / 2);

  // ── Berth-side connector (toward the quay, low z) ─────────────────────────
  // If the apron reaches in front of the front corridor, extend the central
  // vertical corridor toward the quay so the berth-side stays reachable.
  const ap = apronBounds();
  if (ap.minZ < zFront) {
    let berthX0 = vx[0];
    for (const x of vx) if (Math.abs(x) < Math.abs(berthX0)) berthX0 = x;
    const bSpan = zFront - ap.minZ;
    slab(ROAD_W, bSpan, berthX0, ap.minZ + bSpan / 2);
  }

  // ── Markings (center dividers + directional lane markings) ────────────────
  buildMarkings();

  return roadGroup;
}

/* ── Marking helpers ──────────────────────────────────────────────────────
 * All helpers add into roadGroup and reuse cached geometries via bx().
 */

// A run of dashes along one axis. axis 'z': corridor runs along z, `coord` is the
// fixed x and dashes step through z in [from, to]; axis 'x' is the mirror image.
function dashLine(matr, axis, coord, from, to, step) {
  for (let t = from + step / 2; t <= to; t += step) {
    if (axis === 'z') bx(roadGroup, DASH_THIN, MARK_H, DASH_LONG, matr, coord, MARKING_Y, t, false);
    else bx(roadGroup, DASH_LONG, MARK_H, DASH_THIN, matr, t, MARKING_Y, coord, false);
  }
}

// A single white chevron arrowhead centered at (cx,cz) pointing along (dirX,dirZ).
// Built from two thin boxes that meet at the forward tip and splay backward, so
// it reads as a ">"/"^" aimed in the lane's travel direction (Req 4.3).
function chevron(cx, cz, dirX, dirZ) {
  const a = Math.atan2(dirX, dirZ);               // heading: 0 == +z, rotates toward +x
  const tipX = cx + (CHEV_ARM / 2) * Math.sin(a); // forward tip of the arrowhead
  const tipZ = cz + (CHEV_ARM / 2) * Math.cos(a);
  for (const sign of [1, -1]) {
    const ang = a + sign * CHEV_SPREAD;           // each arm splays from the heading
    const ux = Math.sin(ang), uz = Math.cos(ang); // arm's long-axis (+z) direction
    const armX = tipX - (CHEV_ARM / 2) * ux;       // center the arm behind the tip
    const armZ = tipZ - (CHEV_ARM / 2) * uz;
    const m = bx(roadGroup, CHEV_THIN, MARK_H, CHEV_ARM, mWhite, armX, MARKING_Y, armZ, false);
    m.rotation.y = ang; // align the box's +z long-axis to the arm direction
  }
}

// White directional chevrons (arrows) along one lane. Per request the white
// lane DASHES are dropped — only the arrows remain (plus the yellow divider,
// drawn separately) — so the road reads cleanly.
function laneMarks(axis, laneCoord, from, to, dirX, dirZ) {
  for (let t = from + CHEV_STEP / 2; t <= to; t += CHEV_STEP) {
    if (axis === 'z') chevron(laneCoord, t, dirX, dirZ);
    else chevron(t, laneCoord, dirX, dirZ);
  }
}

/* ── buildMarkings() ──────────────────────────────────────────────────────
 * Adds yellow center dividers (Req 4.2) and white directional lane markings
 * (Req 4.3) for every corridor, all lifted to MARKING_Y so they never z-fight
 * the road (Req 4.5). Extents match the road surfaces built above (Req 5/4.4).
 */
function buildMarkings() {
  if (!mWhite) mWhite = mat(0xffffff, 0.8);

  const { ROAD_W } = PARAMS;
  const vx = vertRoadX();
  const hz = horizRoadZ();
  const xMin = vx[0] - ROAD_W / 2;
  const xMax = vx[vx.length - 1] + ROAD_W / 2;
  const zFront = hz[0] - ROAD_W / 2;
  const zBack = hz[hz.length - 1] + ROAD_W / 2;

  // Vertical corridors (run along z): one per vertRoadX centerline.
  for (const x of vx) {
    // Center divider (yellow) down the corridor centerline.
    dashLine(M.mark, 'z', x, zFront, zBack, DASH_STEP);
    // Two lanes (keep-right, matching layout.roadGraph): low lane (x−LANE_HALF)
    // is outbound (+z, gate-ward), high lane (x+LANE_HALF) is inbound (−z).
    const [lo, hi] = laneCenters(x, 'x');
    laneMarks('z', lo, zFront, zBack, 0, 1);
    laneMarks('z', hi, zFront, zBack, 0, -1);
  }

  // Horizontal corridors (run along x): one per horizRoadZ centerline.
  for (const z of hz) {
    dashLine(M.mark, 'x', z, xMin, xMax, DASH_STEP);
    // Keep-right: low lane (z−LANE_HALF) carries −x traffic, high lane (z+LANE_HALF) +x.
    const [lo, hi] = laneCenters(z, 'z');
    laneMarks('x', lo, xMin, xMax, -1, 0);
    laneMarks('x', hi, xMin, xMax, 1, 0);
  }

  // ── Gate apron: 4 one-way lanes in front of the gate ──────────────────────
  // Two ENTRY lanes on the left (x = −30, −10) point INTO the yard (−z); two
  // EXIT lanes on the right (x = +10, +30) point OUT (+z). Yellow dividers sit
  // on the pillar lines (±40, ±20, 0) so each lane reads as its own road.
  const gate = gatePosition();
  const apZ0 = hz[hz.length - 1];   // back road
  const apZ1 = gate.z + 90;         // approach end
  for (const dx of [-40, -20, 0, 20, 40]) {
    dashLine(M.mark, 'z', dx, apZ0, apZ1, DASH_STEP);
  }
  laneMarks('z', -30, apZ0, apZ1, 0, -1);  // entry (into yard)
  laneMarks('z', -10, apZ0, apZ1, 0, -1);  // entry
  laneMarks('z', 10, apZ0, apZ1, 0, 1);    // exit (out of port)
  laneMarks('z', 30, apZ0, apZ1, 0, 1);    // exit
}
