import * as THREE from 'three';
import { renderer, scene, camera, orbit, M, mat, bx, cy, sp, waterMat, uT, clock, cMats } from './core.js';
import { initYard, updateRtgCranes, updateBlockScreens } from './yard.js';
import { initShips, vessels, vesselPose, updateBerthScreens, longCranes, pings, aisEls, berthXs, BERTH_Z } from './ships.js';
import { initGate, barriers, updateGateScreens } from './gate.js';
import { initTrucks, updateTrucks } from './trucks.js';
import { initUI, updateOverlays, isScanActive } from './ui.js';

/* ── MAIN INITIALIZATION ──────────────────────────── */

// Terrain
bx(scene, 10000, .5, 10000, M.seabed, 0, -9, -500); 
const wMesh = new THREE.Mesh(new THREE.PlaneGeometry(10000, 10000, 128, 128), waterMat);
wMesh.rotation.x = -Math.PI / 2; wMesh.position.set(0, 0, -500); scene.add(wMesh);

// Quay and Apron (expanded)
bx(scene, 600, 5, 14, M.quay, 0, 0, 1);
bx(scene, 600, .5, 14, M.apron, 0, 5, 1);

// Ground (expanded)
bx(scene, 600, .4, 68, M.yard, 0, 4.6, 40);
bx(scene, 100, .4, 255, M.road, 0, 4.6, 177.5); // Main crossroad expanded
bx(scene, 580, .4, 12, M.road, 0, 4.6, 62);

const m_white = mat(0xffffff, .9);
const m_yellow = mat(0xffcc00, .9);
// Vertical road lines
for (let z = 62; z < 300; z += 6) {
  bx(scene, 0.4, .45, 3, m_white, -20, 4.6, z);
  bx(scene, 0.4, .45, 3, m_yellow, 0, 4.6, z);
  bx(scene, 0.4, .45, 3, m_white, 20, 4.6, z);
}
// Horizontal road lines
for (let x = -280; x < 280; x += 6) {
  if (Math.abs(x) > 50) bx(scene, 3, .45, 0.4, m_white, x, 4.6, 62);
}

// Stars
const sfP = new Float32Array(1800 * 3);
for (let i = 0; i < 1800; i++) { sfP[i * 3] = (Math.random() - .5) * 1500; sfP[i * 3 + 1] = 80 + Math.random() * 320; sfP[i * 3 + 2] = (Math.random() - .5) * 1500; }
const sfG = new THREE.BufferGeometry(); sfG.setAttribute('position', new THREE.BufferAttribute(sfP, 3));
scene.add(new THREE.Points(sfG, new THREE.PointsMaterial({ color: 0xb0c8e0, size: 0.85, transparent: true, opacity: .5 })));

// Modules init
initYard();
initGate();
initShips(document.getElementById('colayer'));
initTrucks();

// Radar Mast
const radarG = new THREE.Group(); radarG.position.set(284, 5.0, 2); scene.add(radarG);
cy(radarG, .55, 24, M.crane, 0, 0, 0);
const radarDisk = bx(radarG, 15, .5, 5, M.radar, 0, 24, 0);
cy(radarG, .3, 4, M.crane, 0, 24, 0);
const sweepMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, .1), new THREE.MeshBasicMaterial({ color: 0x34E0F0, transparent: true, opacity: .55, side: THREE.DoubleSide }));
sweepMesh.rotation.x = -Math.PI / 2; sweepMesh.position.set(284, 29.6, 2); scene.add(sweepMesh);

// Sensor Buoys
const buoyMeshes = [];
[[-180, -26], [0, -19], [180, -23]].forEach(([bxv, bz]) => {
  cy(scene, .15, 3.5, M.crane, bxv, 1.5, bz);
  buoyMeshes.push(sp(scene, 1.3, M.buoy, bxv, 1.5, bz));
});

// Shore Power
const shorePowerGroup = new THREE.Group(); scene.add(shorePowerGroup);

// Scan Plane
const scanPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 3.5),
  new THREE.MeshBasicMaterial({ color: 0x00aaff, opacity: 0.0, transparent: true, side: THREE.DoubleSide, depthWrite: false })
);
scanPlane.rotation.x = -Math.PI / 2; scanPlane.position.y = 20; scanPlane.visible = false;
scene.add(scanPlane);

// Cityscape (expanded)
const cityscapeObjs = [];
{
  const winCanvas = document.createElement('canvas');
  winCanvas.width = 128; winCanvas.height = 128;
  const wCtx = winCanvas.getContext('2d');
  wCtx.fillStyle = '#000000'; wCtx.fillRect(0, 0, 128, 128);
  for (let y = 4; y < 128; y += 12) {
    for (let x = 4; x < 128; x += 12) {
      if (Math.random() > 0.3) {
        wCtx.fillStyle = `rgba(180, 220, 255, ${0.3 + Math.random() * 0.7})`;
        wCtx.fillRect(x, y, 6, 8);
      }
    }
  }
  const winTex = new THREE.CanvasTexture(winCanvas);
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;

  const bMat = (ei, op, w, h) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x111824, roughness: 0.5, metalness: 0.4 });
    const wt = winTex.clone(); wt.repeat.set(w / 4, h / 4); wt.needsUpdate = true;
    m.emissiveMap = wt; m.emissive = new THREE.Color(0xaaccff); m.emissiveIntensity = ei * 2.5;
    if (op < 1) { m.transparent = true; m.opacity = op; m.emissiveIntensity *= op; }
    return m;
  };

  for (let i = 0; i < 80; i++) {
    const isFront = i < 30;
    const w = 4 + Math.random() * 8, d = 4 + Math.random() * 8;
    const h = (isFront ? 12 : 30) + Math.random() * (isFront ? 20 : 60);
    const x = -280 + Math.random() * 560;
    const z = isFront ? 320 + Math.random() * 30 : 350 + Math.random() * 50;
    const ei = isFront ? (0.3 + Math.random() * 0.3) : (0.1 + Math.random() * 0.2);
    const op = isFront ? 1 : 0.7;
    
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bMat(ei, op, w, h));
    mesh.position.set(x, 5 + h / 2, z); scene.add(mesh);
    const entry = { mesh, ei: ei * 2.5 };
    if (h > 40) {
      const bm = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff1100 }));
      bm.position.set(x, 5 + h + 0.5, z); scene.add(bm); entry.beacon = bm;
    }
    cityscapeObjs.push(entry);
  }
  const cg = new THREE.Mesh(new THREE.PlaneGeometry(800, 150), new THREE.MeshStandardMaterial({ color: 0x0a1018 }));
  cg.rotation.x = -Math.PI / 2; cg.position.set(0, 4.9, 360); scene.add(cg);
}

// Warehouses
{
  const whMat = new THREE.MeshStandardMaterial({ color: 0xc8d8e8, roughness: 0.5, metalness: 0.1 }); 
  const rfMat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.8 });
  [{ x: -140, z: 148 }, { x: 140, z: 148 }].forEach(({ x, z }) => {
    bx(scene, 100, 14, 26, whMat, x, 5, z);
    bx(scene, 102, 2, 28, rfMat, x, 19, z);
    [-40, 40].forEach(ox => cy(scene, 0.3, 10, M.crane, x + ox, 5, z - 15));
  });
  bx(scene, 600, 0.3, 70, new THREE.MeshStandardMaterial({ color: 0x0f1720, roughness: 0.95 }), 0, 5.05, 160);
}

// UAV PATROL DRONES
const drones = [];
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
const emitPos = new Float32Array(emitN * 3);
const emitData = [];
for (let i = 0; i < emitN; i++) {
  const s = emitSrc[i % emitSrc.length];
  emitData.push({
    x: s[0] + (Math.random() - .5) * 5, base: s[1], z: s[2] + (Math.random() - .5) * 5,
    y: s[1] + Math.random() * 14, spd: 1.6 + Math.random() * 2.2
  });
}
const emitGeo = new THREE.BufferGeometry(); emitGeo.setAttribute('position', new THREE.BufferAttribute(emitPos, 3));
const emitPts = new THREE.Points(emitGeo, new THREE.PointsMaterial({ color: 0x90a4ba, size: 1.3, transparent: true, opacity: .28 })); scene.add(emitPts);

// Init UI with references to scene objects for highlights
initUI(orbit, null, null, null, radarG, buoyMeshes, shorePowerGroup, scanPlane);

/* ── ANIMATE ──────────────────────────────────────── */
let buoyT = 0;
const lerp = (a, b, t) => a + (b - a) * t;

(function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05), el = clock.getElapsedTime();
  orbit.update(); uT.value = el;

  if (Math.floor(el * 2) > Math.floor((el - dt) * 2)) {
     updateBerthScreens(el);
  }

  radarDisk.rotation.y += dt * .9; sweepMesh.rotation.y += dt * .9;

  const dockedBerths = {};

  vessels.forEach((v, i) => {
    const ps = vesselPose(v, el);
    v.ps = ps; // attach for UI to read
    if (ps.docked) dockedBerths[v.bx] = v;
    v.g.position.set(ps.x, Math.sin(el * .7 + i) * .3 + 4.8, ps.z);
    let diff = ps.ry - v.g.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    v.g.rotation.y += diff * Math.min(1, dt * 1.5);
    
    // Fade in/out effect based on progress p
    if (v.mode === 'cycle') {
      const p = ((((el - v.t0) % v.dur) + v.dur) % v.dur) / v.dur;
      let op = 1;
      if (p < 0.05) op = p / 0.05;
      else if (p > 0.95) op = (1.0 - p) / 0.05;
      v.g.traverse(c => {
        if (c.isMesh && c.material) {
          c.material.transparent = true;
          // Store original opacity to avoid overwriting glass/windows which might be < 1
          if (c.material.origOp === undefined) c.material.origOp = c.material.opacity;
          c.material.opacity = c.material.origOp * op;
          // Fix depth sorting for transparent objects
          c.material.depthWrite = op > 0.99;
        }
      });
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
      lc.scp = (prevScp + dt / 14.3) % 1; // 14.3s per cycle. 2 cycles = 28.6s. Ship docked for 30.6s
      if (lc.scp < prevScp) { lc.lifts++; lc.isImport = activeShip.action === 'import'; }
      const scp = lc.scp;
      
      const sz1 = lc.isImport ? -21 : 38;
      const sz2 = lc.isImport ? 38 : -21;
      const sh1 = lc.isImport ? 8.1 : 10;
      const sh2 = lc.isImport ? 10 : 8.1;

      if (scp < .08)       { sz = sz1; sh = lerp(32, sh1, scp / .08); }
      else if (scp < .16)  { sz = sz1; sh = lerp(sh1, 32, (scp - .08) / .08); }
      else if (scp < .46)  { sz = lerp(sz1, sz2, (scp - .16) / .30); sh = 32; }
      else if (scp < .54)  { sz = sz2;  sh = lerp(32, sh2, (scp - .46) / .08); }
      else if (scp < .62)  { sz = sz2;  sh = lerp(sh2, 32, (scp - .54) / .08); }
      else                 { sz = lerp(sz2, sz1, (scp - .62) / .38); sh = 32; }
      
      // Always hold container between pickup (0.08) and drop-off (0.54)
      lc.cargo.visible = (scp > .08 && scp < .54);
      lc.idleSz = sz; 
    } else {
      const th = 42;
      lc.spreader.position.y += (th - lc.spreader.position.y) * Math.min(1, dt * 2);
      lc.cargo.visible = false;
      sz = lc.trolley.position.z; sh = lc.spreader.position.y;
    }
    lc.trolley.position.z = sz; lc.spreader.position.z = sz;
    lc.cargo.position.z = sz;   lc.cargo.position.y = sh - 2;
    lc.spreader.position.y = sh;
    lc.rope.position.z = sz;    lc.rope.position.y = (44 + sh) / 2;
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

  cityscapeObjs.forEach((b, i) => {
    b.mesh.material.emissiveIntensity = b.ei + Math.sin(el * (0.28 + i * 0.065) + i * 1.3) * 0.045;
    if (b.beacon) b.beacon.visible = Math.sin(el * 1.4 + i * 0.9) > 0.72;
  });

  if (isScanActive()) {
    const sp = (el % 6) / 6;
    scanPlane.position.z = lerp(-45, 185, sp);
    scanPlane.material.opacity = 0.05 + Math.sin(sp * Math.PI) * 0.16;
  }

  updateOverlays(aisEls);
  renderer.render(scene, camera);
})();