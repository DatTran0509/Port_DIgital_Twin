/* ──────────────────────────────────────────────────────────────────────────
 * yard/rtg.js — RTG gantry cranes: build + state machine
 *
 * Builds exactly ONE rubber-tyred gantry crane per Yard_Block (Req 1.5), in the
 * canonical `blocks` order so rtgCranes[i] ↔ blocks[i] ↔ blockMats[i] (the
 * shared contract task 4.3 also follows).
 *
 * PERFORMANCE (Req 9.4): the STATIC structural members — the 4 legs, the 2 top
 * beams and the 4 wheels — are batched into ONE InstancedMesh PER PART across
 * ALL cranes (leg: BLOCK_COUNT*4, beam: BLOCK_COUNT*2, wheel: BLOCK_COUNT*4),
 * each with a single shared geometry + material. This keeps RTG draw calls
 * constant as the block count grows. The small MOVING group per crane (trolley,
 * spreader, rope, cargo + the per-block signboard, which needs its unique
 * blockMats[i] material) stays as individual per-crane objects because it
 * animates / carries unique materials.
 *
 * Behaviour-preserving simplification (documented): in the original the WHOLE
 * crane (legs included) translated in z during state 1. Now the batched legs/
 * beams/wheels stay fixed and only the moving group translates in z. The moving
 * group is anchored at (block.x, 5.0, block.z - 11) so the trolley (relative
 * z = 11, unchanged) sits over the block center at rest, and the EXACT original
 * motion math (tZ = truck.z - 11) still lands the trolley on the truck.
 *
 * Coordinates come from ./blocks.js (block centers, derived from layout.js). The
 * signboard texture materials come from ./block-screens.js (intentional runtime
 * cycle — blockMats is only read inside the build function).
 *
 * Requirements: 1.5, 9.4
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, M, cMats, bx, cable, dummy } from '../core.js';
import { blocks, BLOCK_COUNT } from './blocks.js';
import { blockMats } from './block-screens.js';

export const rtgCranes = [];

/* ── Shared geometries (one per repeated structure type — Req 9.4) ────────── */
const legGeo = new THREE.BoxGeometry(1.8, 20, 1.8);
const beamGeo = new THREE.BoxGeometry(50, 2.5, 2);
const wheelGeo = new THREE.BoxGeometry(2.5, 0.8, 2.5);
const signGeo = new THREE.PlaneGeometry(12, 3);

/* Write one instance matrix (axis-aligned, unit scale) using the shared dummy. */
function setInst(im, i, x, y, z) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  im.setMatrixAt(i, dummy.matrix);
}

/* Batch every crane's static legs/beams/wheels into 3 InstancedMeshes.
 * Anchor per crane = (block.x, 5.0, block.z - 11) — the same origin the moving
 * group uses — with the EXACT original relative offsets, so the re-anchored
 * crane is visually identical to the baseline, just centered on its block. */
function buildStatic() {
  const legIM = new THREE.InstancedMesh(legGeo, M.crane, BLOCK_COUNT * 4);
  const beamIM = new THREE.InstancedMesh(beamGeo, M.craneY, BLOCK_COUNT * 2);
  const wheelIM = new THREE.InstancedMesh(wheelGeo, M.crane, BLOCK_COUNT * 4);
  [legIM, beamIM, wheelIM].forEach(im => { im.castShadow = im.receiveShadow = true; });

  let li = 0, bi = 0, wi = 0;
  blocks.forEach(b => {
    const sx = b.x, sy = 5.0, sz = b.z - 11; // static anchor (matches moving group)
    // 4 legs: x ±23, z {0,22}; box 1.8×20×1.8 → center y = 5 + 10
    for (const lx of [-23, 23]) for (const lz of [0, 22]) setInst(legIM, li++, sx + lx, sy + 10, sz + lz);
    // 2 top beams: x 0, z {0,22}; box 50×2.5×2 → center y = 5 + 21.25
    for (const bz of [0, 22]) setInst(beamIM, bi++, sx, sy + 21.25, sz + bz);
    // 4 wheels: x ±23, z {-1,22}; box 2.5×0.8×2.5 → center y = 5 + 0.4
    for (const wx of [-23, 23]) for (const wz of [-1, 22]) setInst(wheelIM, wi++, sx + wx, sy + 0.4, sz + wz);
  });

  [legIM, beamIM, wheelIM].forEach(im => { im.instanceMatrix.needsUpdate = true; scene.add(im); });
}

/* Build the per-crane MOVING group + signboard + state record for one block.
 * Relative offsets inside the group are IDENTICAL to the baseline crane, so the
 * preserved state machine (which mutates trolley/spreader/rope/cargo + g.z) runs
 * unchanged. Group origin (block.x, 5.0, block.z - 11) keeps tZ = truck.z - 11. */
function buildMoving(b, idx) {
  const g = new THREE.Group();
  g.position.set(b.x, 5.0, b.z - 11);
  scene.add(g);

  const trolley = bx(g, 3.5, 2.5, 3.5, M.craneY, 0, 19, 11);

  // Per-block signboard: shared base + unique-material screen (blockMats[idx]).
  bx(g, 1.2, 8, 1.2, M.crane, 23.5, 8, 22);
  const signScreen = new THREE.Mesh(signGeo, blockMats[idx]);
  signScreen.position.set(18, 12, 22.7);
  g.add(signScreen);

  const spreader = bx(g, 3.4, 0.4, 6.4, M.craneY, 0, 15, 11);
  const rope = cable(g, new THREE.Vector3(0, 19, 11), new THREE.Vector3(0, 15, 11), M.rope);
  const cargo = bx(g, 3.4, 2.4, 6.4, cMats[2], 0, 13.5, 11);
  cargo.visible = false;

  rtgCranes.push({ g, trolley, spreader, rope, cargo, bxv: b.x, state: 0, tTrk: null, tZ: b.z - 11, h: 15, trX: 0 });
}

/* Build all cranes: batched static InstancedMeshes + per-crane moving groups.
 * One RTG per block, in `blocks` order (rtgCranes[i] ↔ blocks[i]). */
export function initRtgCranes() {
  buildStatic();
  blocks.forEach((b, i) => buildMoving(b, i));
}

export function updateRtgCranes(dt) {
  rtgCranes.forEach(rc => {
    if (rc.tTrk) {
      if (rc.state === 0) {
        rc.tZ = rc.tTrk.z - 11;
        rc.state = 1;
        rc.cargo.visible = false;
        rc.cargo.material = rc.tTrk.cargo.material;
      }
      else if (rc.state === 1) {
        rc.g.position.z += (rc.tZ - rc.g.position.z) * Math.min(1, dt * 2.5);
        if (Math.abs(rc.g.position.z - rc.tZ) < 0.2) {
          rc.state = rc.tTrk.isImport ? 6 : 2;
        }
      }
      // EXPORT ONLY: Pick up from block
      else if (rc.state === 2) {
        rc.h -= dt * 7;
        if (rc.h <= 8) { rc.h = 8; rc.state = 3; }
      }
      else if (rc.state === 3) {
        rc.cargo.visible = true;
        rc.state = 4;
      }
      else if (rc.state === 4) {
        rc.h += dt * 7;
        if (rc.h >= 15) { rc.h = 15; rc.state = 6; }
      }
      // COMMON: Move to truck
      else if (rc.state === 6) {
        const trkTgtX = rc.tTrk.yardLane + 1.5 - rc.bxv;
        rc.trX += (trkTgtX - rc.trX) * Math.min(1, dt * 2.5);
        if (Math.abs(rc.trX - trkTgtX) < 0.2) rc.state = 7;
      }
      // COMMON: Lower to truck
      else if (rc.state === 7) {
        rc.h -= dt * 7;
        if (rc.h <= 2) { rc.h = 2; rc.state = 8; }
      }
      // COMMON: Swap cargo with truck
      else if (rc.state === 8) {
        if (rc.tTrk.isImport) {
          rc.cargo.visible = true;
          rc.tTrk.cargo.visible = false;
        } else {
          rc.cargo.visible = false;
          rc.tTrk.cargo.visible = true;
        }
        rc.state = 9;
      }
      // COMMON: Raise from truck
      else if (rc.state === 9) {
        rc.h += dt * 7;
        if (rc.h >= 15) { rc.h = 15; rc.state = 10; }
      }
      // COMMON: Move X to block center
      else if (rc.state === 10) {
        rc.trX += (0 - rc.trX) * Math.min(1, dt * 2.5);
        if (Math.abs(rc.trX) < 0.2) {
          rc.state = rc.tTrk.isImport ? 11 : 15;
        }
      }
      // IMPORT ONLY: Drop to block
      else if (rc.state === 11) {
        rc.h -= dt * 7;
        if (rc.h <= 8) { rc.h = 8; rc.state = 12; }
      }
      else if (rc.state === 12) {
        rc.cargo.visible = false;
        rc.state = 13;
      }
      else if (rc.state === 13) {
        rc.h += dt * 7;
        if (rc.h >= 15) { rc.h = 15; rc.state = 15; }
      }
      // COMMON: Reset
      else if (rc.state === 15) {
        rc.state = 0;
        rc.tTrk.state = 3.6; // Release truck
        rc.tTrk = null;
      }
    }
    rc.trolley.position.x = rc.trX;
    rc.spreader.position.x = rc.trX; rc.spreader.position.y = rc.h;
    rc.cargo.position.x = rc.trX; rc.cargo.position.y = rc.h - 1.5;
    rc.rope.position.x = rc.trX; rc.rope.position.y = (19 + rc.h) / 2;
    rc.rope.scale.y = Math.max(0.01, (19 - rc.h) / 10);
  });
}
