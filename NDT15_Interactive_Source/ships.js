/* ──────────────────────────────────────────────────────────────────────────
 * ships.js — Ships barrel.
 *
 * The ship/berth subsystem was split into focused modules under ships/ (Req
 * 10.1). This file is now a thin re-export barrel so existing callers
 * (main.js, ui.js) keep importing from './ships.js' unchanged, and a single
 * initShips() that orchestrates the modules in the original order.
 *
 *   ships/berths.js        — berth line constants + quay-side structures
 *   ships/vessels.js       — vessel fleet + pose cycle logic
 *   ships/sts-cranes.js    — STS gantry cranes (build + registry)
 *   ships/berth-screens.js — per-berth LED status screens
 *
 * Requirements: 10.1, 10.3, 10.4
 * ────────────────────────────────────────────────────────────────────────── */

import { initBerths } from './ships/berths.js';
import { initVessels } from './ships/vessels.js';
import { buildLongCranes } from './ships/sts-cranes.js';

// Re-export the public surface the rest of the app depends on.
export { BERTH_Z, berthXs } from './ships/berths.js';
export { vessels, pings, aisEls, vesselPose } from './ships/vessels.js';
export { longCranes } from './ships/sts-cranes.js';
export { berthMats, updateBerthScreens } from './ships/berth-screens.js';

export function initShips(coLayer0) {
  initBerths();
  initVessels(coLayer0);
  buildLongCranes();
}
