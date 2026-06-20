/* ──────────────────────────────────────────────────────────────────────────
 * gate.js — re-export barrel (behavior-preserving split, Req 10.3, 10.5)
 *
 * The gate implementation now lives under ./gate/:
 *   - gate/gate.js         → gate structure + barriers (initGate, barriers)
 *   - gate/gate-screens.js → gate screen rendering (screenMat, updateGateScreens)
 *
 * This barrel preserves the original public API so existing importers
 * (main.js, ui.js) keep working unchanged.
 * ────────────────────────────────────────────────────────────────────────── */

export { initGate, barriers } from './gate/gate.js';
export { screenMat, updateGateScreens } from './gate/gate-screens.js';
