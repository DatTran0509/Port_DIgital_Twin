// env/buildings.js — Static port structures (from main.js setupCoreScene, minus drones/particles)
// Includes: quay/apron + ground/road planes, radar station, sensor buoys,
// shore-power group, scan plane, and warehouses. Per-frame updates for the
// rotating radar, bobbing buoys, and the moving scan plane live here too.
import * as THREE from 'three';
import { scene, M, mat, bx, cy, sp } from '../core.js';
import { apronBounds, horizRoadZ } from '../layout.js';

let radarDisk, sweepMesh, radarG;
let shorePowerGroup;
let scanPlane;
const buoyMeshes = [];
let buoyT = 0;
const lerp = (a, b, t) => a + (b - a) * t;

// Builds all static building/structure environment objects. Returns handles the
// orchestrator needs (e.g. for initUI wiring). Behavior preserved from main.js.
export function initBuildings() {
  // ── Apron + Quay (sized from layout.js — Req 2.1, 2.3, 2.4) ──────────────
  // The apron is a single large ground slab sized from apronBounds(), which is
  // the bounding box of every block + road corridor expanded by APRON_MARGIN
  // (≥2 m). Sizing from it guarantees every block and road segment lies inside
  // the apron with that clearance baked in (Req 2.1).
  const ab = apronBounds();
  const apW = ab.maxX - ab.minX;                 // apron width  (x extent)
  const apD = ab.maxZ - ab.minZ;                 // apron depth  (z extent)
  const apCX = (ab.minX + ab.maxX) / 2;          // apron center x
  const apCZ = (ab.minZ + ab.maxZ) / 2;          // apron center z
  const GROUND_TOP = 5;                          // ground surface height (unchanged)
  const APRON_T = 0.5;                           // apron slab thickness (as before)
  const QUAY_H = 5;                              // quay platform height (as before)

  // Quay: the raised waterfront platform along the sea-facing (low-z) edge.
  // Its sea edge is placed at the apron's sea edge (ab.minZ) so the two
  // waterfront edges are coincident with no gap/overlap (Req 2.4). Width spans
  // the full apron x-extent; depth is the waterfront band up to the front-most
  // road — both derived from layout, not magic numbers.
  const waterfrontZ = ab.minZ;                       // shared sea-facing edge
  const quayDepth = horizRoadZ()[0] - waterfrontZ;   // layout-derived band depth
  const quayCZ = waterfrontZ + quayDepth / 2;
  // bx() leaves castShadow = receiveShadow = true by default → quay receives
  // shadows each frame (Req 2.3). Top sits at GROUND_TOP (y = 0 + QUAY_H).
  bx(scene, apW, QUAY_H, quayDepth, M.quay, apCX, 0, quayCZ);

  // Apron ground slab: covers the whole apronBounds rectangle. Its top is flush
  // with the quay top (GROUND_TOP) and its sea edge sits at ab.minZ, coincident
  // with the quay's sea edge (Req 2.4). receiveShadow stays on via bx() default
  // (Req 2.3). Replaces the old hardcoded 600×14 apron strip + 600×68 yard base.
  bx(scene, apW, APRON_T, apD, M.apron, apCX, GROUND_TOP - APRON_T, apCZ);

  // Radar Station — relocated to the WATERFRONT side, between the quay edge and
  // the nearest yard block (Req 7.4), without overlapping the quay, roads,
  // blocks or berths (Req 7.1). All derived from layout bounds (Req 10.4).
  //  - x: just beyond the apron x-edge (ab.maxX) so the ~22 m-wide building
  //    clears the full-width quay slab and the vertical road corridor.
  //  - z: centered on the front waterfront band (horizRoadZ()[0] ≈ 12) so the
  //    footprint spans z≈[1,23], staying on the water side of the first block
  //    row (front edge ≈ 24) and clear of the berth line (z = BERTH_Z).
  const RADAR_HALF = 11;        // half the radar roof footprint (22 m)
  const RADAR_CLEAR = 6;        // gap from apron x-edge to the building
  const radarX = ab.maxX + RADAR_CLEAR + RADAR_HALF;   // ≈ 175
  const radarZ = horizRoadZ()[0];                      // ≈ 12 (front waterfront band)
  radarG = new THREE.Group(); radarG.position.set(radarX, 5.0, radarZ); scene.add(radarG);
  radarG.userData = { isClickable: true, objType: 'radar', data: { icon: '📡', name: 'Trạm Kiểm Soát Radar', subtitle: 'TRUNG TÂM GIÁM SÁT HÀNH TRÌNH' } };

  // Building Base
  bx(radarG, 20, 15, 20, mat(0x1a2530, 0.5, 0.1), 0, 0, 0);
  // Control Room (glassy look)
  bx(radarG, 18, 5, 18, mat(0x4D8DF6, 0.2, 0.8, 0x113355, 0.4), 0, 15, 0);
  // Roof
  bx(radarG, 22, 1, 22, mat(0x111111, 0.8, 0.1), 0, 20, 0);

  // Radar Tower on roof
  cy(radarG, 1.5, 8, M.crane, 0, 21, 0);

  // Rotating Radar Dish
  radarDisk = bx(radarG, 24, 1.0, 6, M.radar, 0, 29, 0);
  cy(radarDisk, 1, 4, M.crane, 0, 1, 0); // Antenna details

  sweepMesh = new THREE.Mesh(new THREE.PlaneGeometry(45, .2), new THREE.MeshBasicMaterial({ color: 0x34E0F0, transparent: true, opacity: .55, side: THREE.DoubleSide }));
  // Sweep plane follows the relocated radar (sits above its dish).
  sweepMesh.rotation.x = -Math.PI / 2; sweepMesh.position.set(radarX, 35.6, radarZ); scene.add(sweepMesh);

  // Sensor Buoys
  [[-180, -26], [0, -19], [180, -23]].forEach(([bxv, bz]) => {
    cy(scene, .15, 3.5, M.crane, bxv, 1.5, bz);
    buoyMeshes.push(sp(scene, 1.3, M.buoy, bxv, 1.5, bz));
  });

  // Shore Power — relocated to the WATERFRONT side opposite the radar (Req 7.4),
  // mirrored just beyond the -x apron edge so the units sit between the quay and
  // the nearest block without overlapping the quay/road/blocks/berths (Req 7.1).
  shorePowerGroup = new THREE.Group();
  shorePowerGroup.position.set(-radarX, 5.0, radarZ);
  scene.add(shorePowerGroup);
  // Bind the relocated shore-power group to its info panel (Req 7.6, 7.7). The
  // clickable flag lives on the GROUP so a click on any pedestal child walks up
  // to it in the raycast handler. objType:'energy' matches the other relocated
  // Energy_Assets so it renders with icon/name/subtitle + a details box.
  shorePowerGroup.userData = {
    isClickable: true, objType: 'energy',
    data: {
      icon: '🔌', name: 'Trạm Điện Bờ', subtitle: 'NĂNG LƯỢNG TÁI TẠO',
      details: { 'Công suất': '6.6 MW', 'Điện áp': '6.6 kV', 'Trạng thái': 'Đang cấp điện', 'Tàu kết nối': '2' }
    }
  };
  // A short row of simple shore-power pedestals (feeder cabinets) along the band.
  const spMat = mat(0x2a3a4a, 0.4, 0.3, 0x113355, 0.3);
  [-8, 0, 8].forEach(ox => {
    bx(shorePowerGroup, 4, 6, 4, spMat, ox, 3, 0);
    bx(shorePowerGroup, 4.4, 0.6, 4.4, M.radar, ox, 6.3, 0, false);
  });

  // Scan Plane
  scanPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 3.5),
    new THREE.MeshBasicMaterial({ color: 0x00aaff, opacity: 0.0, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  );
  scanPlane.rotation.x = -Math.PI / 2; scanPlane.position.y = 20; scanPlane.visible = false;
  scene.add(scanPlane);

  // Warehouses — relocated to the CITY / landward side, beyond the back edge of
  // the apron (Req 7.1, 7.3). Placed at z = apronBounds.maxZ + clearance so the
  // ~28 m-deep footprint clears the back road corridor and the last block row,
  // and at x = ±whX which straddles the gate (gate spans only x∈[-50,50]).
  // Solar arrays (env/energy.js) reuse the same whX/whZ so each array sits atop
  // its warehouse roof (Req 7.3). All derived from layout bounds (Req 10.4).
  {
    const whMat = new THREE.MeshStandardMaterial({ color: 0xc8d8e8, roughness: 0.5, metalness: 0.1 });
    const rfMat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.8 });
    const WH_HALF_D = 14;       // half the warehouse roof depth (28 m)
    const WH_CLEAR = 12;        // clearance from apron back edge to warehouse front
    const whZ = ab.maxZ + WH_CLEAR + WH_HALF_D;   // ≈ 316 (landward of the yard)
    const whX = 140;            // x-offset; clears the gate footprint (|x| ≤ 50)
    [{ x: -whX, z: whZ }, { x: whX, z: whZ }].forEach(({ x, z }) => {
      bx(scene, 100, 14, 26, whMat, x, 5, z);
      bx(scene, 102, 2, 28, rfMat, x, 19, z);
      [-40, 40].forEach(ox => cy(scene, 0.3, 10, M.crane, x + ox, 5, z - 15));
    });
    // Warehouse tarmac apron beneath the buildings — kept landward of the back
    // road edge so it no longer overlaps the expanded yard/roads.
    bx(scene, 420, 0.3, 50, new THREE.MeshStandardMaterial({ color: 0x0f1720, roughness: 0.95 }), 0, 4.5, whZ);
  }

  return { radarG, radarDisk, sweepMesh, buoyMeshes, shorePowerGroup, scanPlane };
}

// Per-frame radar dish + sweep rotation (from animate()).
export function updateRadar(dt) {
  if (!radarDisk) return;
  radarDisk.rotation.y += dt * .9;
  sweepMesh.rotation.y += dt * .9;
}

// Per-frame buoy bobbing (from animate()).
export function updateBuoys(dt) {
  buoyT += dt;
  buoyMeshes.forEach((b, i) => b.position.y = 1.5 + Math.sin(buoyT + i * 1.6) * .44);
}

// Per-frame scan plane sweep. `active` mirrors main.js's isScanActive() so the
// orchestrator can pass UI state without env depending on the UI module.
export function updateScan(el, active) {
  if (!scanPlane || !active) return;
  const sProg = (el % 6) / 6;
  scanPlane.position.z = lerp(-45, 185, sProg);
  scanPlane.material.opacity = 0.05 + Math.sin(sProg * Math.PI) * 0.16;
}
