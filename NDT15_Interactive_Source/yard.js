/* ──────────────────────────────────────────────────────────────────────────
 * yard.js — Yard barrel (re-export hub)
 *
 * The yard logic now lives in three focused modules under ./yard/:
 *   - yard/blocks.js        container instancing + static ground markings
 *   - yard/rtg.js           RTG crane build + state machine (states 0–15)
 *   - yard/block-screens.js per-block signboard screens
 *
 * This file preserves the original public API so existing callers (main.js,
 * trucks.js, ui.js) keep working unchanged. initYard() orchestrates the split
 * modules in the same order the original single-file implementation used.
 *
 * Requirements: 10.1, 10.3, 10.4
 * ────────────────────────────────────────────────────────────────────────── */
import { initBlocks } from './yard/blocks.js';
import { initRtgCranes } from './yard/rtg.js';

// Re-export the original public API (live bindings).
export { blockX, yardLanes } from './yard/blocks.js';
export { updateRtgCranes, rtgCranes } from './yard/rtg.js';
export { updateBlockScreens, blockCanvases, blockTexs, blockMats } from './yard/block-screens.js';

export function initYard() {
  initBlocks();
  initRtgCranes();
}
