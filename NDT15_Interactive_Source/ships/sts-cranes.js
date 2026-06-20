import * as THREE from 'three';
import { scene, M, cMats, bx, cable, portLights } from '../core.js';
import { berthXs } from './berths.js';
import { berthMats } from './berth-screens.js';

/* ──────────────────────────────────────────────────────────────────────────
 * ships/sts-cranes.js — Ship-to-shore (STS) gantry cranes.
 *
 * Owns the long quay cranes: their structural build (legs, crossbeams,
 * trolley, spreader, cables, cargo), the LED screens mounted on the crossbeam,
 * the attached flood lights, and the longCranes registry that main.js animates
 * each frame.
 *
 * Behavior is preserved verbatim from the original ships.js.
 *
 * Requirements: 10.1, 10.3, 10.4
 * ────────────────────────────────────────────────────────────────────────── */

export const longCranes = [];

function buildLongCrane(x, idx) {
  const g = new THREE.Group(); g.position.set(x, 5, -1); scene.add(g);
  // Taller gantry: the structure read as too short, so stretch the whole crane
  // vertically (legs/beam/trolley/screens scale together; the trolley & spreader
  // animation in scene.js is in local y, so it scales with the crane too).
  g.scale.set(1, 1.45, 1);
  bx(g, 2, 42, 2, M.crane, -15, 0, -10); bx(g, 2, 42, 2, M.crane, 15, 0, -10);
  bx(g, 42, 3, 3.5, M.crane, 0, 42, -10);

  const trolley = bx(g, 5, 2.5, 5, M.craneY, 0, 44, 0);

  // Massive LED Screen fixed high on top of the STS crane crossbeam
  if (idx !== undefined) {
    // Support pillars
    bx(g, 0.8, 8, 0.8, M.crane, -14, 46, -10);
    bx(g, 0.8, 8, 0.8, M.crane, 14, 46, -10);
    // LED Screen facing sea
    const bsc = new THREE.Mesh(new THREE.PlaneGeometry(36, 5), berthMats[idx]);
    bsc.position.set(0, 50, -10.5);
    bsc.rotation.y = Math.PI;
    g.add(bsc);

    // LED Screen facing yard
    const bsc2 = new THREE.Mesh(new THREE.PlaneGeometry(36, 5), berthMats[idx]);
    bsc2.position.set(0, 50, -9.5);
    g.add(bsc2);
  }

  bx(g, 42, 3, 3.5, M.crane, 0, 42, 18);
  // Landward support frame (at the quay edge) carrying the long boom so the
  // cantilever over the yard is braced — placed in front of the first block row.
  bx(g, 2, 42, 2, M.crane, -15, 0, 15); bx(g, 2, 42, 2, M.crane, 15, 0, 15);
  bx(g, 42, 3, 3.5, M.crane, 0, 42, 15);
  // LONG trolley boom: spans from over the ship (−37) to DEEP into the yard
  // (+63), so the spreader carries cargo all the way into the container block
  // instead of stopping at the quay (Req: "phải thật dài ... vào thấu trong bãi").
  bx(g, 3.5, 2, 100, M.craneY, 0, 45, 13);
  // Stay cables bracing both cantilever ends (sea + land).
  cable(g, new THREE.Vector3(-10, 42, -10), new THREE.Vector3(-10, 47, -35), M.rope);
  cable(g, new THREE.Vector3(10, 42, -10), new THREE.Vector3(10, 47, -35), M.rope);
  cable(g, new THREE.Vector3(-10, 42, 15), new THREE.Vector3(-10, 47, 58), M.rope);
  cable(g, new THREE.Vector3(10, 42, 15), new THREE.Vector3(10, 47, 58), M.rope);

  const spreader = bx(g, 8.5, 1.5, 14, M.crane, 0, 38, 0);
  const rope = cable(g, new THREE.Vector3(0, 44, 0), new THREE.Vector3(0, 38, 0), M.rope);
  const cargo = bx(g, 3.4, 2.6, 6.4, cMats[1], 0, 36, 0);

  // Lights attached to portLights but positioned relative to this crane
  const lg = new THREE.Group();
  lg.position.set(x, 5, -1);
  const pl1 = new THREE.SpotLight(0xffeeb3, 4000, 200, Math.PI / 4, 0.5, 1.5);
  pl1.position.set(0, 46, -12);
  pl1.target.position.set(0, -5, -30); // Pointing at ship
  lg.add(pl1); lg.add(pl1.target);

  const pl2 = new THREE.SpotLight(0xffeeb3, 4000, 200, Math.PI / 4, 0.5, 1.5);
  pl2.position.set(0, 46, 12);
  pl2.target.position.set(0, -5, 30); // Pointing at yard
  lg.add(pl2); lg.add(pl2.target);

  portLights.add(lg);

  longCranes.push({ g, trolley, spreader, rope, cargo, cy: 0, bx: x });
  return g;
}

// Build one STS crane per berth and wire up its served berth + lift bookkeeping.
export function buildLongCranes() {
  berthXs.forEach((bxv, i) => {
    buildLongCrane(bxv, i);
    longCranes[i].servesBx = bxv;
  });
  longCranes.forEach(lc => Object.assign(lc, { prevDocked: false, lifts: 0, maxLifts: 2 }));
}
