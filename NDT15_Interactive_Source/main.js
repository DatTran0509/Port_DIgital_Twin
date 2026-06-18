import * as THREE from 'three';
import { renderer, scene, camera, orbit, M, mat, bx, cy, sp, clock, cMats, sun } from './core.js';
import { Water } from 'three/addons/objects/Water.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { initYard, updateRtgCranes, updateBlockScreens } from './yard.js';
import { initShips, vessels, vesselPose, updateBerthScreens, longCranes, pings, aisEls, berthXs, BERTH_Z } from './ships.js';
import { initGate, barriers, updateGateScreens } from './gate.js';
import { initTrucks, updateTrucks } from './trucks.js';
import { initUI, updateOverlays, isScanActive } from './ui.js';

let water;
let cityscapeObjs = [];
let buoyMeshes = [];
let radarDisk, sweepMesh, radarG;
let shorePowerGroup;
let scanPlane;
let drones = [];
let emitData = [];
let emitPos, emitGeo, emitPts;
let buoyT = 0;
const lerp = (a, b, t) => a + (b - a) * t;

function initEnvironment() {
  const loader = new EXRLoader();
  loader.setDataType(THREE.HalfFloatType);

  loader.load('assets/HdrSkyMorning004_HDR_8K.exr', function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
  });
}

function createOceanZone() {
  const waterGeometry = new THREE.PlaneGeometry(20000, 20000);
  water = new Water(
    waterGeometry,
    {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load('assets/waternormals.jpg', function (texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }),
      sunDirection: sun.position.clone().normalize(),
      sunColor: 0xffffff,
      waterColor: 0x002c5c,
      distortionScale: 3.7,
      fog: scene.fog !== undefined
    }
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0, -10000);
  scene.add(water);
}

function createLandmassZone() {
  const tl = new THREE.TextureLoader();
  const diffuse = tl.load('assets/ground_color.jpg');
  const normal = tl.load('assets/ground_normal.png');
  diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  // Increase repeat significantly to avoid white spots but retain texture
  diffuse.repeat.set(400, 400);
  normal.repeat.set(400, 400);

  const landGeo = new THREE.PlaneGeometry(20000, 20000);
  const landMat = new THREE.MeshStandardMaterial({
    map: diffuse,
    normalMap: normal,
    color: 0x8899aa, // Tint to blend with lighting
    roughness: 1.0,
    metalness: 0.0
  });

  const land = new THREE.Mesh(landGeo, landMat);
  land.rotation.x = -Math.PI / 2;
  land.position.set(0, 0.5, 10000);
  land.receiveShadow = true;
  scene.add(land);
}

function loadModels() {
  new GLTFLoader().load('assets/low_poly_night_city_building_skyline.glb', (gltf) => {
    const city = gltf.scene;

    city.rotation.y = Math.PI;
    city.scale.setScalar(4);
    city.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(city);
    const center = new THREE.Vector3();
    box.getCenter(center);

    city.position.x -= center.x;
    city.position.z -= center.z;
    city.position.z += 1000;
    city.position.y -= box.min.y;
    city.position.y += 0.5;

    city.traverse(c => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    scene.add(city);
  });
}

function setupCoreScene() {
  // Quay and Apron
  bx(scene, 600, 5, 14, M.quay, 0, 0, 1);
  bx(scene, 600, .5, 14, M.apron, 0, 5, 1);

  // Ground Base
  bx(scene, 600, .4, 68, M.yard, 0, 4.6, 40);
  bx(scene, 100, .4, 255, M.road, 0, 4.62, 177.5); // Main crossroad expanded
  bx(scene, 580, .4, 12, M.road, 0, 4.62, 62);

  const m_white = mat(0xffffff, .9);
  const m_yellow = mat(0xffcc00, .9);
  // Vertical road lines
  for (let z = 62; z < 300; z += 6) {
    bx(scene, 0.4, .45, 3, m_white, -20, 4.65, z);
    bx(scene, 0.4, .45, 3, m_yellow, 0, 4.65, z);
    bx(scene, 0.4, .45, 3, m_white, 20, 4.65, z);
  }
  // Horizontal road lines
  for (let x = -280; x < 280; x += 6) {
    if (Math.abs(x) > 50) bx(scene, 3, .45, 0.4, m_white, x, 4.65, 62);
  }

  // Radar Mast
  radarG = new THREE.Group(); radarG.position.set(284, 5.0, 2); scene.add(radarG);
  cy(radarG, .55, 24, M.crane, 0, 0, 0);
  radarDisk = bx(radarG, 15, .5, 5, M.radar, 0, 24, 0);
  cy(radarG, .3, 4, M.crane, 0, 24, 0);
  sweepMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, .1), new THREE.MeshBasicMaterial({ color: 0x34E0F0, transparent: true, opacity: .55, side: THREE.DoubleSide }));
  sweepMesh.rotation.x = -Math.PI / 2; sweepMesh.position.set(284, 29.6, 2); scene.add(sweepMesh);

  // Sensor Buoys
  [[-180, -26], [0, -19], [180, -23]].forEach(([bxv, bz]) => {
    cy(scene, .15, 3.5, M.crane, bxv, 1.5, bz);
    buoyMeshes.push(sp(scene, 1.3, M.buoy, bxv, 1.5, bz));
  });

  // Shore Power
  shorePowerGroup = new THREE.Group(); scene.add(shorePowerGroup);

  // Scan Plane
  scanPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 3.5),
    new THREE.MeshBasicMaterial({ color: 0x00aaff, opacity: 0.0, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  );
  scanPlane.rotation.x = -Math.PI / 2; scanPlane.position.y = 20; scanPlane.visible = false;
  scene.add(scanPlane);

  // Warehouses
  {
    const whMat = new THREE.MeshStandardMaterial({ color: 0xc8d8e8, roughness: 0.5, metalness: 0.1 });
    const rfMat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.8 });
    [{ x: -140, z: 148 }, { x: 140, z: 148 }].forEach(({ x, z }) => {
      bx(scene, 100, 14, 26, whMat, x, 5, z);
      bx(scene, 102, 2, 28, rfMat, x, 19, z);
      [-40, 40].forEach(ox => cy(scene, 0.3, 10, M.crane, x + ox, 5, z - 15));
    });
    bx(scene, 600, 0.3, 70, new THREE.MeshStandardMaterial({ color: 0x0f1720, roughness: 0.95 }), 0, 4.5, 160);
  }

  // UAV PATROL DRONES
  function buildDrone(col) {
    const g = new THREE.Group();
    bx(g, 2.4, .7, 2.4, M.crane, 0, 0, 0);
    const belly = bx(g, .7, .4, .7, mat(col, .4, .5, col, .8), 0, -.6, 0);
    const arms = [];
    [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]].forEach(([rx, rz]) => {
      bx(g, .25, .25, .25, M.crane, rx, .25, rz);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, .06, 14), new THREE.MeshStandardMaterial({ color: 0x2a3a52, transparent: true, opacity: .45 }));
      r.position.set(rx, .45, rz); g.add(r); arms.push(r);
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(3.5, 9, 18, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .08, side: THREE.DoubleSide }));
    cone.position.set(0, -5, 0); g.add(cone);
    scene.add(g); return { g, arms, belly, cone };
  }
  [{ c: 0xFF5468, r: 150, h: 41, s: .32, p: 0 }, { c: 0x34E0F0, r: 120, h: 35, s: .42, p: Math.PI }, { c: 0xF8B23C, r: 180, h: 49, s: .24, p: Math.PI / 2 }]
    .forEach(d => drones.push({ ...buildDrone(d.c), r: d.r, h: d.h, spd: d.s, ph: d.p }));

  // CO2 Particles
  const emitSrc = [[-100, 5, -9], [-50, 5, -6], [0, 5, -8], [50, 5, -5], [100, 24, 28], [-150, 17, -4]];
  const emitN = 70;
  emitPos = new Float32Array(emitN * 3);
  for (let i = 0; i < emitN; i++) {
    const s = emitSrc[i % emitSrc.length];
    emitData.push({
      x: s[0] + (Math.random() - .5) * 5, base: s[1], z: s[2] + (Math.random() - .5) * 5,
      y: s[1] + Math.random() * 14, spd: 1.6 + Math.random() * 2.2
    });
  }
  emitGeo = new THREE.BufferGeometry(); emitGeo.setAttribute('position', new THREE.BufferAttribute(emitPos, 3));
  emitPts = new THREE.Points(emitGeo, new THREE.PointsMaterial({ color: 0x90a4ba, size: 1.3, transparent: true, opacity: .28 })); scene.add(emitPts);
}

// === MAIN EXECUTION ===
initEnvironment();
createOceanZone();
createLandmassZone();
loadModels();
setupCoreScene();

initYard();
initGate();
initShips(document.getElementById('colayer'));
initTrucks();

initUI(orbit, null, null, null, radarG, buoyMeshes, shorePowerGroup, scanPlane);

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05), el = clock.getElapsedTime();
  orbit.update();

  if (water) {
    water.material.uniforms['time'].value += 1.0 / 60.0; // Steady time step avoids jerking
  }

  if (Math.floor(el * 2) > Math.floor((el - dt) * 2)) {
    updateBerthScreens(el);
  }

  radarDisk.rotation.y += dt * .9; sweepMesh.rotation.y += dt * .9;

  const dockedBerths = {};

  vessels.forEach((v, i) => {
    const ps = vesselPose(v, el);
    v.ps = ps;
    if (ps.docked) dockedBerths[v.bx] = v;
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
    const activeShip = dockedBerths[lc.servesBx];
    const isDocked = !!activeShip;
    if (isDocked && !lc.prevDocked) { lc.lifts = 0; lc.scp = 0; lc.isImport = activeShip.action === 'import'; }
    lc.prevDocked = isDocked;
    let sz, sh;
    if (isDocked && lc.lifts < lc.maxLifts) {
      const prevScp = lc.scp || 0;
      lc.scp = (prevScp + dt / 14.3) % 1;
      if (lc.scp < prevScp) { lc.lifts++; lc.isImport = activeShip.action === 'import'; }
      const scp = lc.scp;

      const sz1 = lc.isImport ? -21 : 38;
      const sz2 = lc.isImport ? 38 : -21;
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
  updateGateScreens();
  updateBerthScreens(el);
  updateBlockScreens();
  updateTrucks(dt, barriers, updateGateScreens);

  drones.forEach((d, i) => {
    const a = el * d.spd + d.ph;
    d.g.position.set(Math.cos(a) * d.r, d.h + Math.sin(el * 1.3 + i) * 1.6, Math.sin(a) * d.r + 6);
    d.g.rotation.y = -a; d.g.rotation.z = Math.cos(a) * .16;
    d.arms.forEach(r => r.rotation.y += dt * 45);
    d.belly.material.emissiveIntensity = .5 + Math.sin(el * 5 + i) * .4;
  });

  buoyT += dt;
  emitData.forEach((p, i) => { p.y += dt * p.spd; if (p.y > p.base + 16) p.y = p.base; emitPos[i * 3] = p.x; emitPos[i * 3 + 1] = p.y; emitPos[i * 3 + 2] = p.z; });
  emitGeo.attributes.position.needsUpdate = true;
  buoyMeshes.forEach((b, i) => b.position.y = 1.5 + Math.sin(buoyT + i * 1.6) * .44);

  if (isScanActive()) {
    const sp = (el % 6) / 6;
    scanPlane.position.z = lerp(-45, 185, sp);
    scanPlane.material.opacity = 0.05 + Math.sin(sp * Math.PI) * 0.16;
  }

  updateOverlays(aisEls);
  renderer.render(scene, camera);
}

animate();