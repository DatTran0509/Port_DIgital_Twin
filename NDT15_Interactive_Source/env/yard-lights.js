/* ──────────────────────────────────────────────────────────────────────────
 * env/yard-lights.js — High-mast yard floodlighting (main terminal + side yards)
 *
 * Real container terminals are lit by tall HIGH-MAST towers (~35 m) carrying a
 * bank of floodlights, ringing the stacking yards so the crews can work at
 * night. This module adds that lighting WITHOUT ever standing a mast on a
 * drivable corridor (an earlier version blocked the truck lanes):
 *
 *   - MAIN terminal masts stand in the SERVICE BUFFER between the main apron and
 *     each side yard (x clear of every road lane), lighting the yard from the
 *     side — exactly how real terminals ring a block field with perimeter masts.
 *   - SIDE-YARD masts stand on the platform PERIMETER MARGIN (never on a block
 *     centre or an internal lane).
 *   - Each mast gets a concrete footing so it reads as planted whether it sits
 *     on the paved platform or on the open buffer ground.
 *   - STRUCTURE batches into 1 InstancedMesh PER PART (footing/pole/platform/
 *     lamp) → ~4 draw calls for the whole rig (same perf pattern as rtg.js).
 *   - A curated subset of masts gets a real downward THREE.SpotLight, parented
 *     under `portLights` (shown only at night). Count is kept low + shadowless.
 *   - `yardLampMats` is exported so ui/daynight.js switches the lamps on/off.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, mat, portLights, dummy } from '../core.js';
import {
  SIDE, apronBounds, blockCenterZ, sideYardBounds, railFlank, landwardZones,
} from '../layout.js';

const FOOT_TOP = 5;            // footing top (flush with apron / platform top)
const POLE_H = 33;             // pole height above the footing
const HEAD_Y = FOOT_TOP + POLE_H;          // y of the lamp-bank platform base

// Warm metal-halide lamp glow. emissiveIntensity starts at 0 (day); the
// day/night toggle raises it at night. Exported for ui/daynight.js.
const lampMat = mat(0xfff1cf, 0.45, 0.25, 0xffe2a0, 0.0);
export const yardLampMats = [lampMat];

/* ── Mast placement (all derived from layout.js, all clear of road lanes) ──── */
function mastPositions() {
  const ab = apronBounds();
  const out = [];
  const add = (x, z, lit = false) => out.push({ x, z, lit });

  // ── Main terminal: masts in the service buffers either side of the yard ────
  // x sits beyond the perimeter transfer-crane reach (~180) but short of the
  // side-yard platform, so it never overlaps a truck lane.
  const bufX = ab.maxX + SIDE.GAP / 2;           // ≈ 190
  [blockCenterZ(0), blockCenterZ(2), blockCenterZ(4)].forEach((z) => {
    add(-bufX, z, true);
    add(bufX, z, true);
  });

  // ── Side yards: masts on the platform perimeter margins (off the blocks) ───
  for (const side of ['L', 'R']) {
    const sb = sideYardBounds(side);
    const innerX = (side === 'L' ? sb.maxX : sb.minX) + (side === 'L' ? 3 : -3);
    const outerX = (side === 'L' ? sb.minX : sb.maxX) + (side === 'L' ? -3 : 3);
    [sb.minZ + (sb.maxZ - sb.minZ) * 0.25, sb.maxZ - (sb.maxZ - sb.minZ) * 0.25].forEach((z) => {
      add(innerX, z, true);     // every mast is lit at night (no ambient fill used)
      add(outerX, z, true);
    });
  }

  // ── Landward facilities: rail terminals + green hub + automated terminal ───
  // High masts so these areas are lit by real lamps at night too (not ambient).
  for (const side of ['L', 'R']) {
    const rf = railFlank(side);
    const ex = side === 'L' ? rf.outerX - 14 : rf.outerX + 14;   // outside the band (clear of train/RMG)
    [rf.minZ + (rf.maxZ - rf.minZ) * 0.3, rf.maxZ - (rf.maxZ - rf.minZ) * 0.3].forEach((z) => add(ex, z, true));
  }
  const lz = landwardZones();
  for (const zone of [lz.green, lz.auto]) {
    add(zone.minX + 12, zone.front + 24, true);
    add(zone.maxX - 12, zone.back - 24, true);
  }

  return out;
}

/* ── Build the instanced mast structures + the night spotlights ────────────── */
export function initYardLights() {
  const masts = mastPositions();
  const N = masts.length;

  // Shared geometries (one each → constant draw calls).
  const footGeo = new THREE.BoxGeometry(3.8, FOOT_TOP, 3.8);
  const poleGeo = new THREE.CylinderGeometry(0.7, 0.95, POLE_H, 10);
  const platGeo = new THREE.BoxGeometry(7, 1.2, 7);
  const lampGeo = new THREE.BoxGeometry(2.2, 0.9, 2.2);

  const steelMat = mat(0x9aa0a6, 0.55, 0.7);   // galvanised steel tower
  const footMat = mat(0x6b6f6c, 0.9, 0.05);    // concrete footing

  const footIM = new THREE.InstancedMesh(footGeo, footMat, N);
  const poleIM = new THREE.InstancedMesh(poleGeo, steelMat, N);
  const platIM = new THREE.InstancedMesh(platGeo, steelMat, N);
  const lampIM = new THREE.InstancedMesh(lampGeo, lampMat, N * 4);
  footIM.receiveShadow = poleIM.castShadow = platIM.castShadow = true;

  let li = 0;
  const setInst = (im, i, x, y, z) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  };

  masts.forEach((m, i) => {
    setInst(footIM, i, m.x, FOOT_TOP / 2, m.z);
    setInst(poleIM, i, m.x, FOOT_TOP + POLE_H / 2, m.z);
    setInst(platIM, i, m.x, HEAD_Y + 0.6, m.z);
    for (const ox of [-2, 2]) for (const oz of [-2, 2]) setInst(lampIM, li++, m.x + ox, HEAD_Y - 0.1, m.z + oz);
  });
  [footIM, poleIM, platIM, lampIM].forEach((im) => { im.instanceMatrix.needsUpdate = true; scene.add(im); });

  // ── Real spotlights for the lit masts (night only, no shadows) ─────────────
  // Parented under portLights so the day/night toggle reveals them at night.
  // Intensity / distance / decay mirror the existing quay + gate spots.
  masts.filter((m) => m.lit).forEach((m) => {
    const lg = new THREE.Group();
    lg.position.set(m.x, 0, m.z);
    const sp = new THREE.SpotLight(0xffe7b8, 3600, 280, 0.66, 0.55, 1.5);
    sp.position.set(0, HEAD_Y, 0);
    sp.target.position.set(0, 0, 0);            // straight down → circular pool
    sp.castShadow = false;
    lg.add(sp); lg.add(sp.target);
    portLights.add(lg);
  });
}
