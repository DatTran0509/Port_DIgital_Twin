/* ──────────────────────────────────────────────────────────────────────────
 * scene.js — Orchestrator Import_Hub (Req 10.2)
 *
 * This module is the application entry point. It composes the already-extracted
 * env / boards / interaction modules and the domain feature barrels (yard,
 * ships, gate, trucks, ui) into the exact init sequence and per-frame animation
 * loop that previously lived inline in main.js — without containing any of that
 * feature logic itself.
 *
 * As the single orchestrator it is the ONLY module that imports the feature
 * modules; every other module imports only from core.js (and layout.js) so the
 * import graph stays acyclic (Req 10.6). As an Import_Hub it is permitted to
 * exceed the ~200-line target (Req 10.2, 10.3).
 *
 * NOTE: the vessels pose/ping loop and the STS longCranes animation loop are
 * not yet extracted into their own update functions; their exact inline logic
 * (and the `lerp` helper + magic numbers) is preserved here verbatim, driven by
 * the `vessels`, `vesselPose`, `pings`, and `longCranes` bindings from ships.js.
 *
 * Requirements: 10.2, 10.3, 10.6
 * ────────────────────────────────────────────────────────────────────────── */

import { renderer, scene, camera, orbit, clock } from './core.js';

// ── Environment modules ──────────────────────────────────────────────────
import { initSky } from './env/sky.js';
import { initOcean, updateOcean } from './env/ocean.js';
import { initLand } from './env/land.js';
import { loadModels } from './env/models.js';
import { initBuildings, updateRadar, updateBuoys, updateScan } from './env/buildings.js';
import { initEnergy, updateEnergy } from './env/energy.js';
import { initFlags, updateFlags } from './env/flags.js';
import { initDrones, updateDrones } from './env/drones.js';
import { initParticles, updateParticles } from './env/particles.js';
import { initSideYards } from './env/side-yards.js';
import { initYardLights } from './env/yard-lights.js';
import { initRailTerminal, updateRail } from './env/rail-terminal.js';
import { initGreenHub } from './env/green-hub.js';
import { initAutomation, updateAutomation } from './env/automation.js';
import { initConnections } from './env/connections.js';
import { initUnderground, updateUnderground } from './env/underground.js';

// ── Road network ─────────────────────────────────────────────────────────
import { initRoadNetwork } from './roads/road-network.js';

// ── Boards + interaction modules ─────────────────────────────────────────
import { initElectronicBoards, updateBoards } from './boards/electronic-boards.js';
import { initRaycastFollow, updateFollow } from './interaction/raycast-follow.js';

// ── Domain feature barrels ───────────────────────────────────────────────
import { initYard, updateRtgCranes, updateTransferCranes, updateBlockScreens } from './yard.js';
import { initShips, vessels, vesselPose, updateBerthScreens, longCranes, pings, aisEls } from './ships.js';
import { initGate, barriers, updateGateScreens } from './gate.js';
import { initTrucks, updateTrucks } from './trucks.js';
import { initUI, updateOverlays, isScanActive, updateActivePanels } from './ui.js';

// Preserved inline helper (used by the vessels + longCranes loops below).
const lerp = (a, b, t) => a + (b - a) * t;

// Reused docked-berth lookup keyed by vessel berth x (v.bx). Hoisted to module
// scope and cleared via .clear() at the top of each frame so the animation loop
// allocates no new object per frame (Req 9.3). .clear() reuses the same Map.
const dockedBerths = new Map();

// === MAIN EXECUTION (init order mirrors the original main.js) =============
initSky();          // was initEnvironment()
initOcean();        // was createOceanZone()
initLand();         // was createLandmassZone()
loadModels();
// was setupCoreScene() structures; returns handles for UI wiring + frame updates
const { radarG, buoyMeshes, shorePowerGroup, scanPlane } = initBuildings();
// Road surfaces for the full yard grid, rendered over the apron (Req 4.1, 4.4)
initRoadNetwork();
// was createFlagsAndEnergy(): flags built before energy, as in main.js
initFlags();
initEnergy();
initDrones();       // was inside setupCoreScene()
initParticles();    // was inside setupCoreScene()

// Lateral logistics expansion: LEFT container storage + RIGHT equipment depot,
// plus the high-mast floodlight rig over the main + side yards (night spots are
// parented under portLights). Built before initUI so the day/night controller
// can pick up the lamp materials.
initSideYards();
initYardLights();

// Landward expansion belt (investor-facing next-gen facilities):
//   green energy hub · on-dock rail terminal · automated terminal.
initGreenHub();
initRailTerminal();
initAutomation();
// Visible integration links tying every landward facility back to the port.
initConnections();
// Underground infrastructure level (NDT layer 13) — hidden until you descend.
initUnderground();

initYard();
initGate();
initShips(document.getElementById('colayer'));
initTrucks();
initElectronicBoards();

initUI(orbit, null, null, null, radarG, buoyMeshes, shorePowerGroup, scanPlane);

// Register pointer / click-to-follow / follow-camera listeners (was inline in main.js).
initRaycastFollow();

// === ANIMATION LOOP (order mirrors the original main.js animate()) ========
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05), el = clock.getElapsedTime();

  // Follow target (formerly the inline follow block)
  updateFollow();

  orbit.update();

  // Water time (steady step inside updateOcean, as in main.js)
  updateOcean(dt);

  // Throttled berth screens redraw (preserved exactly, including the later
  // unconditional call below — not "fixed")
  if (Math.floor(el * 2) > Math.floor((el - dt) * 2)) {
    updateBerthScreens(el);
  }
  updateBoards(el);

  // Radar dish + sweep rotation
  updateRadar(dt);

  dockedBerths.clear();

  vessels.forEach((v, i) => {
    const ps = vesselPose(v, el);
    v.ps = ps;
    if (ps.docked) dockedBerths.set(v.bx, v);
    v.g.position.set(ps.x, Math.sin(el * .7 + i) * .3 + 4.8, ps.z);
    let diff = ps.ry - v.g.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    v.g.rotation.y += diff * Math.min(1, dt * 1.5);

    if (v.mode === 'cycle') {
      const p = ((((el - v.t0) % v.dur) + v.dur) % v.dur) / v.dur;
      let op = 1;
      if (p < 0.05) op = p / 0.05;
      else if (p > 0.95) op = (1.0 - p) / 0.05;
      if (v.op !== op) {
        v.op = op;
        v.g.traverse(c => {
          if (c.isMesh && c.material) {
            if (c.material.origOp === undefined) c.material.origOp = c.material.opacity;
            c.material.opacity = c.material.origOp * op;
          }
        });
      }
    }

    const pg = pings[i], ph = ((el + pg.off) % 2.6) / 2.6, s = 1 + ph * 9;
    pg.ring.position.set(ps.x, 5, ps.z); pg.ring.scale.set(s, s, s); pg.ring.material.opacity = .5 * (1 - ph);
  });

  longCranes.forEach((lc) => {
    const activeShip = dockedBerths.get(lc.servesBx);
    const isDocked = !!activeShip;
    if (isDocked && !lc.prevDocked) { lc.lifts = 0; lc.scp = 0; lc.isImport = activeShip.action === 'import'; }
    lc.prevDocked = isDocked;
    let sz, sh;
    if (isDocked && lc.lifts < lc.maxLifts) {
      const prevScp = lc.scp || 0;
      lc.scp = (prevScp + dt / 14.3) % 1;
      if (lc.scp < prevScp) { lc.lifts++; lc.isImport = activeShip.action === 'import'; }
      const scp = lc.scp;

      const sz1 = lc.isImport ? -21 : 48;
      const sz2 = lc.isImport ? 48 : -21;
      const sh1 = lc.isImport ? 8.1 : 10;
      const sh2 = lc.isImport ? 10 : 8.1;

      if (scp < .08) { sz = sz1; sh = lerp(32, sh1, scp / .08); }
      else if (scp < .16) { sz = sz1; sh = lerp(sh1, 32, (scp - .08) / .08); }
      else if (scp < .46) { sz = lerp(sz1, sz2, (scp - .16) / .30); sh = 32; }
      else if (scp < .54) { sz = sz2; sh = lerp(32, sh2, (scp - .46) / .08); }
      else if (scp < .62) { sz = sz2; sh = lerp(sh2, 32, (scp - .54) / .08); }
      else { sz = lerp(sz2, sz1, (scp - .62) / .38); sh = 32; }

      lc.cargo.visible = (scp > .08 && scp < .54);
      lc.idleSz = sz;
    } else {
      const th = 42;
      lc.spreader.position.y += (th - lc.spreader.position.y) * Math.min(1, dt * 2);
      lc.cargo.visible = false;
      sz = lc.trolley.position.z; sh = lc.spreader.position.y;
    }
    lc.trolley.position.z = sz; lc.spreader.position.z = sz;
    lc.cargo.position.z = sz; lc.cargo.position.y = sh - 2;
    lc.spreader.position.y = sh;
    lc.rope.position.z = sz; lc.rope.position.y = (44 + sh) / 2;
    lc.rope.scale.y = (44 - sh) / 10;
  });

  updateRtgCranes(dt);
  updateTransferCranes(dt);
  updateGateScreens();
  updateBerthScreens(el);
  updateBlockScreens();
  updateTrucks(dt, barriers, updateGateScreens);
  updateActivePanels(el);

  // Drones
  updateDrones(dt, el);

  // CO2 particles + sensor buoys (emit first, then buoys, as in main.js)
  updateParticles(dt);
  updateBuoys(dt);

  // Scan plane sweep (active state from the UI module)
  updateScan(el, isScanActive());

  updateOverlays(aisEls);

  // Wind turbines (mixers + manual rotors)
  updateEnergy(dt);

  // Landward expansion animations: creeping train + RMG trolleys, AGV loop + ASC.
  updateRail(dt);
  updateAutomation(dt);
  // Underground level activity + in-basement camera confinement (when descended).
  updateUnderground(dt);

  // Flag cloth wave
  updateFlags(el);

  renderer.render(scene, camera);
}

animate();
