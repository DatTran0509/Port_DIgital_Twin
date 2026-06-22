/* ──────────────────────────────────────────────────────────────────────────
 * gate/gate.js — Gate structure + barriers
 *
 * Builds the auto-gate: arch, pillars, lane barriers, lane screens, and gate
 * lighting. Owns the `barriers` state list consumed by the router/UI and by
 * gate-screens.js. Screen rendering lives in ./gate-screens.js.
 *
 * Behavior-preserving split of the original gate.js (Req 10.1, 10.3). The gate
 * group is positioned at layout.gatePosition() — the landward (+z) end beyond
 * the last block row — so every inbound truck passes the gate before any block
 * (Req 7.2). Internal lane/pillar/screen/barrier geometry remains local to the
 * group; the gate lighting groups copy gateg.position and follow automatically.
 *
 * Requirements: 7.2, 10.1, 10.3, 10.4
 * ────────────────────────────────────────────────────────────────────────── */

import * as THREE from 'three';
import { scene, M, bx, mat, portLights } from '../core.js';
import { screenMat, updateGateScreens } from './gate-screens.js';
import { gatePosition } from '../layout.js';

export const barriers = [];

export function initGate() {
  // Position the gate at the landward (+z) end beyond the last block row so
  // every inbound truck passes the gate before any block (Req 7.2). Position
  // derives from layout.gatePosition(); y stays at the baseline 5.0.
  const gp = gatePosition();
  const gateg = new THREE.Group(); gateg.position.set(gp.x, 5.0, gp.z); scene.add(gateg);
  const archCol = mat(0xffffff, 0.4, 0.1);
  const darkMet = mat(0x1a2530, 0.3, 0.8);

  // Widened the gate arch
  bx(gateg, 100, 4.0, 7, archCol, 0, 13, 0);
  bx(gateg, 100, 0.8, 7.2, mat(0x4D8DF6, 0.2, 0.5, 0x4D8DF6, 1.5), 0, 12.5, 0, false);

  // Pillar positions (widened to match 4 massive lanes)
  [-40, -20, 0, 20, 40].forEach(px => {
    bx(gateg, 3.0, 13, 6.0, darkMet, px, 0, 0);
    bx(gateg, 0.3, 10, 6.2, mat(0x34E0F0, 0.2, 0.5, 0x34E0F0, 1.0), px, 2.0, 0, false);
  });

  // Màn hình cho 4 làn
  [-30, -10, 10, 30].forEach((x, i) => {
    const isOutbound = (x > 0);
    const bZ = isOutbound ? -4.5 : 4.5;

    const scW = 12, scH = 3.5; // Made screens larger

    const scM1 = new THREE.Mesh(new THREE.PlaneGeometry(scW, scH), screenMat);
    scM1.position.set(x, 10, 3.6);
    gateg.add(scM1);
    const scM2 = new THREE.Mesh(new THREE.PlaneGeometry(scW, scH), screenMat);
    scM2.position.set(x, 10, -3.6);
    scM2.rotation.y = Math.PI;
    gateg.add(scM2);

    const uvs1 = scM1.geometry.attributes.uv;
    for (let j = 0; j < uvs1.count; j++) { uvs1.setX(j, (i * 0.25) + uvs1.getX(j) * 0.25); }
    const uvs2 = scM2.geometry.attributes.uv;
    for (let j = 0; j < uvs2.count; j++) { uvs2.setX(j, (i * 0.25) + uvs2.getX(j) * 0.25); }

    const bgrp = new THREE.Group();
    bgrp.position.set(x + 7.5, 4, bZ);
    gateg.add(bgrp);

    const armMat = mat(0xffffff, 0.5, 0.2, 0x4D8DF6, 2.0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(15.0, 0.4, 0.4), armMat);
    arm.position.set(-7.5, 0, 0);
    bgrp.add(arm);

    // Add gate lighting
    const pl = new THREE.SpotLight(0xfff0c0, 2000, 150, Math.PI / 3, 0.5, 1.5);
    pl.position.set(x, 17, 0); // Above the arch
    pl.target.position.set(x, 0, bZ * 1.5); // Pointing at the lane
    const lg = new THREE.Group();
    lg.position.copy(gateg.position);
    lg.add(pl); lg.add(pl.target);
    portLights.add(lg);

    barriers.push({ grp: bgrp, armMat: armMat, lane: x, screenIdx: i, status: 0 });
  });

  updateGateScreens();
  bx(gateg, 100, .4, 7, M.road, 0, 0, 0);
}
