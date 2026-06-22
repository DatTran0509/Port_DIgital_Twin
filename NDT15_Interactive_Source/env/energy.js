// env/energy.js — Wind turbines + solar panels + per-frame energy animation
// (the energy-asset portion of main.js createFlagsAndEnergy + the windMixers/
// energyObjects updates from animate()). Flags are handled in env/flags.js.
import * as THREE from 'three';
import { scene, bx } from '../core.js';
import { apronBounds, sideOuterX } from '../layout.js';

const windMixers = [];
const energyObjects = [];

// Builds wind turbines (clone of the preloaded shared turbine) and solar panel
// arrays atop the warehouses. Returns animation handles for the orchestrator.
// Behavior preserved exactly from main.js.
export function initEnergy() {
  // Wind Turbines scattered around. Onshore turbine x is derived from the apron
  // bounds so the towers/rotors always clear the expanded yard, roads and quay
  // (Req 7.1, 7.5, 10.4). Offshore turbines stay far out at sea (large -z),
  // seaward of the berth line (BERTH_Z = -22) and the vessel anchorage/approach
  // (vessels queue around z ≈ -280..-350), so they overlap none of them.
  const ab = apronBounds();
  const TURB_CLEAR = 70;                          // gap beyond the side-yard outer edge
  const onX = Math.abs(sideOuterX('R')) + TURB_CLEAR; // ≈ 512 — beyond the lateral yards
  const wtPos = [
    // 3 trên bờ (phía phải) — beyond the RIGHT (equipment-depot) side yard
    [onX, 160], [onX, 100], [onX, 40],
    // 3 trên bờ (phía trái) — beyond the LEFT (container-storage) side yard
    [-onX, 160], [-onX, 100], [-onX, 40],
    // 6 ngoài khơi xa, dàn thành 1 hàng ngang tránh xa khu neo đậu tàu (-300)
    [-250, -520], [-150, -520], [-50, -520], [50, -520], [150, -520], [250, -520]
  ];

  window.pendingTurbines = [];
  wtPos.forEach(([wx, wz], i) => {
    const wGroup = new THREE.Group(); wGroup.position.set(wx, wz < -100 ? -2 : 0, wz); // Offshore is slightly lower
    scene.add(wGroup);

    const setupTurbine = () => {
      const clone = window.sharedTurbineMesh.clone();
      wGroup.add(clone);

      if (window.turbineAnimations && window.turbineAnimations.length > 0) {
        const mixer = new THREE.AnimationMixer(clone);
        const action = mixer.clipAction(window.turbineAnimations[0]);
        action.play();
        windMixers.push(mixer);
      } else {
        // Try to find a rotor node to spin manually
        let rotor = null;
        clone.traverse(c => {
          if (c.name.toLowerCase().match(/rotor|blade|spin|propeller/)) rotor = c;
        });
        if (rotor) energyObjects.push({ type: 'wind', rotor, speed: 0.8 + Math.random() * 0.4 });
      }
    };

    if (window.sharedTurbineMesh) setupTurbine();
    else window.pendingTurbines.push(setupTurbine);

    wGroup.userData = {
      isClickable: true, objType: 'energy',
      data: {
        icon: '🌬️', name: `Tuabin Gió ${wz < -100 ? 'Biển' : 'Bờ'} T${i + 1}`, subtitle: 'NĂNG LƯỢNG TÁI TẠO',
        details: { 'Công suất': '2.5 MW', 'Tốc độ gió': '6.2 m/s', 'Trạng thái': 'Đang hoạt động', 'Hiệu suất': '92%' }
      }
    };
  });

  // Solar Panels — relocated to sit atop the relocated warehouses (Req 7.3).
  // whX/whZ mirror env/buildings.js (apron-derived) so each array footprint
  // (x∈±35, z∈±10 about its center) lies within the warehouse roof footprint.
  const spMat = new THREE.MeshStandardMaterial({ color: 0x051030, roughness: 0.1, metalness: 0.8 });
  const WH_HALF_D = 14;                       // half warehouse roof depth (28 m)
  const WH_CLEAR = 12;                        // clearance from apron back edge
  const whZ = ab.maxZ + WH_CLEAR + WH_HALF_D; // ≈ 316 (matches buildings.js)
  const whX = 140;                            // matches buildings.js
  [[-whX, whZ], [whX, whZ]].forEach(([x, z], wIdx) => {
    const sGroup = new THREE.Group(); sGroup.position.set(x, 21.5, z);
    for (let px = -35; px <= 35; px += 15) {
      for (let pz = -10; pz <= 10; pz += 10) {
        const p = bx(sGroup, 12, 0.4, 8, spMat, px, 0, pz);
        p.rotation.x = Math.PI / 12; // tilt towards sun
      }
    }
    sGroup.userData = {
      isClickable: true, objType: 'energy',
      data: {
        icon: '☀️', name: `Hệ Thống Pin Mặt Trời Kho ${wIdx + 1}`, subtitle: 'NĂNG LƯỢNG TÁI TẠO',
        details: { 'Sản lượng hôm nay': '420 kWh', 'Nhiệt độ panel': '45°C', 'Trạng thái': 'Thu điện' }
      }
    };
    scene.add(sGroup);
  });

  return { windMixers, energyObjects };
}

// Per-frame turbine animation: GLB animation mixers + manual rotor fallback.
export function updateEnergy(dt) {
  windMixers.forEach(m => m.update(dt));
  energyObjects.forEach(eo => {
    if (eo.type === 'wind' && eo.rotor) eo.rotor.rotation.z += dt * eo.speed;
  });
}
