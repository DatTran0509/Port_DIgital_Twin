import { scene, M, bx, cy } from '../core.js';
import { PARAMS, berthX } from '../layout.js';

/* ──────────────────────────────────────────────────────────────────────────
 * ships/berths.js — Berth line constants + quay-side berth structures.
 *
 * Owns the waterfront berth geometry: the widened berth platforms and the
 * fender/bollard cylinders + posts placed along the quay. The berth X
 * positions and berth line Z are the single source these structures (and the
 * vessel / STS-crane / berth-screen modules) align to.
 *
 * Positions now derive from the single layout source (layout.js): the berth
 * line Z is PARAMS.BERTH_Z and the berth X centers come from berthX(), which
 * spaces berths evenly across the quay independent of block count (Req 3.2,
 * 3.3). Consumers keep importing the public `BERTH_Z` and `berthXs` exports.
 *
 * Requirements: 3.2, 3.3, 10.1, 10.3, 10.4
 * ────────────────────────────────────────────────────────────────────────── */

export const BERTH_Z = PARAMS.BERTH_Z;
export const berthXs = berthX(); // layout-derived berth center x positions

// Build the berth platforms and crane-foot structures along the quay.
export function initBerths() {
  berthXs.forEach((bxv, i) => {
    // Widened berth platform
    bx(scene, 80, 1, 16, M.berth, bxv, 4, -7);
    cy(scene, .5, 14, M.crane, bxv - 35, -6, -14); cy(scene, .5, 14, M.crane, bxv + 35, -6, -14);
    [-35, 0, 35].forEach(ox => bx(scene, .8, 2.5, .8, M.crane, bxv + ox, 5, -5.5));
  });
}
