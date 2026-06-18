import * as THREE from 'three';
import { renderer, scene, camera, orbit, M, mat, bx, cy, sp, clock, cMats, sun } from './core.js';
import { Water } from 'three/addons/objects/Water.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { initYard, updateRtgCranes, updateBlockScreens } from './yard.js';
import { initShips, vessels, vesselPose, updateBerthScreens, longCranes, pings, aisEls, berthXs, BERTH_Z } from './ships.js';
import { initGate, barriers, updateGateScreens } from './gate.js';
import { initTrucks, updateTrucks } from './trucks.js';
import { initUI, updateOverlays, isScanActive, showObjectInfo, hideObjectInfo } from './ui.js';

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
let energyObjects = [];
let windMixers = [];
let activeFollowTarget = null;
let followCamOffset = new THREE.Vector3();
let isFollowing = false;
let globalFlagGeo = null; // Store flag geometry for animation
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

orbit.addEventListener('start', () => { isFollowing = false; });

window.addEventListener('clear-follow-target', () => {
  activeFollowTarget = null;
});

window.addEventListener('pointerdown', (event) => {
  // Only process if it's a direct click on canvas or we're not clicking on UI elements
  if (event.button !== 0 || event.target.tagName !== 'CANVAS') return;
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObjects(scene.children, true);
  if (intersects.length > 0) {
    let curr = intersects[0].object;
    let clickedData = null;
    let clickedGroup = null;
    while(curr) {
      if (curr.userData && curr.userData.isClickable) {
        clickedData = curr.userData;
        clickedGroup = curr;
        break;
      }
      curr = curr.parent;
    }
    if (clickedData) {
      activeFollowTarget = clickedGroup;
      isFollowing = true;

      const targetPos = new THREE.Vector3();
      activeFollowTarget.getWorldPosition(targetPos);
      
      const dir = new THREE.Vector3().subVectors(camera.position, orbit.target).normalize();
      if(dir.lengthSq() < 0.1) dir.set(0, 0.5, 1).normalize();
      
      // Đảm bảo góc nhìn từ trên xuống một chút để bao quát toàn bộ
      if (dir.y < 0.35) {
         dir.y = 0.5;
         dir.normalize();
      }

      // Tính toán kích thước thật của vật thể (Bounding Box) để quyết định khoảng cách zoom
      const box = new THREE.Box3().setFromObject(clickedGroup);
      const size = new THREE.Vector3(); box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      
      let dist = maxDim * 1.5; 
      if (clickedData.objType === 'ship') dist = maxDim * 1.2;
      else if (clickedData.objType === 'uav') dist = maxDim * 3.5;
      if (dist < 15) dist = 15; 
      
      followCamOffset.copy(dir.multiplyScalar(dist));
      
      // Tính tâm Bounding Box để focus chính giữa vật thể thay vì origin (dưới sàn)
      const objOrigin = new THREE.Vector3();
      clickedGroup.getWorldPosition(objOrigin);
      const center = new THREE.Vector3();
      box.getCenter(center);
      window.followTargetOffset = center.clone().sub(objOrigin);
      
      showObjectInfo(clickedData.data, clickedData.objType);
    } else {
      activeFollowTarget = null;
      hideObjectInfo();
    }
  } else {
    activeFollowTarget = null;
    hideObjectInfo();
  }
});
const lerp = (a, b, t) => a + (b - a) * t;

function initEnvironment() {
  const loader = new EXRLoader();
  loader.setDataType(THREE.HalfFloatType);

  loader.load('assets/kloofendal_48d_partly_cloudy_puresky_1k.exr', function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
    if (scene.backgroundIntensity !== undefined) scene.backgroundIntensity = 1.0;
    if (scene.environmentIntensity !== undefined) scene.environmentIntensity = 1.0;
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
      waterColor: 0x00103a, // Xanh biển đậm hơn
      distortionScale: 3.7,
      fog: scene.fog !== undefined,
      alpha: 0.85
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
  
  // Preload Wind Turbine
  new GLTFLoader().load('assets/wind_turbine.glb', (gltf) => {
    const mesh = gltf.scene;
    // Normalize size
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3(); box.getSize(size);
    const scale = 50 / size.y; // Target height ~50
    mesh.scale.setScalar(scale);
    
    mesh.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3(); box2.getCenter(center);
    mesh.position.x -= center.x;
    mesh.position.z -= center.z;
    mesh.position.y -= box2.min.y;
    
    mesh.traverse(c => {
      if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
    });
    
    window.sharedTurbineMesh = mesh;
    window.turbineAnimations = gltf.animations;
    if (window.pendingTurbines) {
      window.pendingTurbines.forEach(t => t());
      window.pendingTurbines = [];
    }
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
  [{ c: 0xFF5468, r: 150, h: 41, s: .32, p: 0, task: 'Giám sát khu bến', id: 'UAV-01' }, { c: 0x34E0F0, r: 120, h: 35, s: .42, p: Math.PI, task: 'Quét vùng biển', id: 'UAV-02' }, { c: 0xF8B23C, r: 180, h: 49, s: .24, p: Math.PI / 2, task: 'Kiểm tra an ninh', id: 'UAV-03' }]
    .forEach(d => {
      const droneObj = buildDrone(d.c);
      droneObj.g.userData = {
        isClickable: true, objType: 'uav',
        data: {
          icon: '🚁', name: d.id, subtitle: 'DRONE GIÁM SÁT',
          details: {
            'Nhiệm vụ': d.task, 'Độ cao': d.h + ' m',
            'Pin': Math.floor(60 + Math.random() * 40) + '%',
            'Tốc độ': Math.floor(d.s * 100) + ' km/h'
          }
        }
      };
      drones.push({ ...droneObj, r: d.r, h: d.h, spd: d.s, ph: d.p });
    });

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

function createFlagsAndEnergy() {
  // Flags - Canvas Texture for White Fabric + Centered Logo
  const cvsFront = document.createElement('canvas');
  cvsFront.width = 1024; cvsFront.height = 682;
  const ctxF = cvsFront.getContext('2d');
  ctxF.fillStyle = '#ffffff'; ctxF.fillRect(0, 0, cvsFront.width, cvsFront.height);
  
  const cvsBack = document.createElement('canvas');
  cvsBack.width = 1024; cvsBack.height = 682;
  const ctxB = cvsBack.getContext('2d');
  ctxB.fillStyle = '#ffffff'; ctxB.fillRect(0, 0, cvsBack.width, cvsBack.height);
  
  const texF = new THREE.CanvasTexture(cvsFront); texF.colorSpace = THREE.SRGBColorSpace; texF.anisotropy = 16;
  const texB = new THREE.CanvasTexture(cvsBack); texB.colorSpace = THREE.SRGBColorSpace; texB.anisotropy = 16;
  
  const img = new Image();
  img.src = 'assets/logo_ndt.png';
  img.onload = () => {
    const lw = cvsFront.width * 0.65;
    const lh = (img.height / img.width) * lw;
    // Front
    ctxF.drawImage(img, (cvsFront.width - lw)/2, (cvsFront.height - lh)/2, lw, lh);
    texF.needsUpdate = true;
    
    // Back (flipped horizontally)
    ctxB.translate(cvsBack.width, 0);
    ctxB.scale(-1, 1);
    ctxB.drawImage(img, (cvsBack.width - lw)/2, (cvsBack.height - lh)/2, lw, lh);
    texB.needsUpdate = true;
  };
  
  globalFlagGeo = new THREE.PlaneGeometry(6, 4, 25, 12);
  globalFlagGeo.translate(3, 0, 0); // Move origin to left edge
  const fpos = globalFlagGeo.attributes.position;
  globalFlagGeo.userData = { initZ: new Float32Array(fpos.count) };
  for(let i=0; i<fpos.count; i++) globalFlagGeo.userData.initZ[i] = fpos.getZ(i);

  const matF = new THREE.MeshStandardMaterial({ map: texF, side: THREE.FrontSide, roughness: 0.9, metalness: 0.0 });
  const matB = new THREE.MeshStandardMaterial({ map: texB, side: THREE.BackSide, roughness: 0.9, metalness: 0.0 });

  // 3 vị trí: 2 đầu cảng và 1 trước cổng (hướng ra ngoài)
  // [x, z, rotationY]
  const flagPlacements = [
    [-280, -5, 0],             // Đầu càng trái
    [280, -5, Math.PI],        // Đầu càng phải
    [55, 140, 0]               // Cạnh phải đường vào, bay về bên phải
  ];

  flagPlacements.forEach(([fx, fz, ry]) => {
    cy(scene, 0.2, 20, mat(0x8899aa, 0.5, 0.9), fx, 0, fz); // Metal pole
    const fmFront = new THREE.Mesh(globalFlagGeo, matF);
    const fmBack = new THREE.Mesh(globalFlagGeo, matB);
    fmFront.castShadow = true; fmFront.receiveShadow = true;
    fmBack.castShadow = true; fmBack.receiveShadow = true;
    
    const fGroup = new THREE.Group();
    fGroup.add(fmFront); fGroup.add(fmBack);
    fGroup.position.set(fx, 18, fz);
    fGroup.rotation.y = ry;
    scene.add(fGroup);
  });

  // Wind Turbines scattered around
  const wtPos = [
    [260, 100], [260, 0], [260, -100], // Phía bờ phải
    [-260, 100], [-260, -100],         // Phía bờ trái
    [150, -450], [-150, -400], [0, -500] // Ngoài biển (Offshore)
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
        if (rotor) energyObjects.push({ type: 'wind', rotor, speed: 0.8 + Math.random()*0.4 });
      }
    };
    
    if (window.sharedTurbineMesh) setupTurbine();
    else window.pendingTurbines.push(setupTurbine);
    
    wGroup.userData = {
      isClickable: true, objType: 'energy',
      data: {
        icon: '🌬️', name: `Tuabin Gió ${wz < -100 ? 'Biển' : 'Bờ'} T${i+1}`, subtitle: 'NĂNG LƯỢNG TÁI TẠO',
        details: { 'Công suất': '2.5 MW', 'Tốc độ gió': '6.2 m/s', 'Trạng thái': 'Đang hoạt động', 'Hiệu suất': '92%' }
      }
    };
  });

  // Solar Panels
  const spMat = new THREE.MeshStandardMaterial({ color: 0x051030, roughness: 0.1, metalness: 0.8 });
  [[-140, 148], [140, 148]].forEach(([x, z], wIdx) => {
    const sGroup = new THREE.Group(); sGroup.position.set(x, 21.5, z);
    for(let px=-35; px<=35; px+=15) {
      for(let pz=-10; pz<=10; pz+=10) {
        const p = bx(sGroup, 12, 0.4, 8, spMat, px, 0, pz);
        p.rotation.x = Math.PI / 12; // tilt towards sun
      }
    }
    sGroup.userData = {
      isClickable: true, objType: 'energy',
      data: {
        icon: '☀️', name: `Hệ Thống Pin Mặt Trời Kho ${wIdx+1}`, subtitle: 'NĂNG LƯỢNG TÁI TẠO',
        details: { 'Sản lượng hôm nay': '420 kWh', 'Nhiệt độ panel': '45°C', 'Trạng thái': 'Thu điện' }
      }
    };
    scene.add(sGroup);
  });
}

// === MAIN EXECUTION ===
initEnvironment();
createOceanZone();
createLandmassZone();
loadModels();
setupCoreScene();
createFlagsAndEnergy();

initYard();
initGate();
initShips(document.getElementById('colayer'));
initTrucks();

initUI(orbit, null, null, null, radarG, buoyMeshes, shorePowerGroup, scanPlane);

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05), el = clock.getElapsedTime();

  // Follow target
  if (activeFollowTarget) {
    const objPos = new THREE.Vector3();
    activeFollowTarget.getWorldPosition(objPos);
    // Cộng thêm offset để điểm focus luôn nằm giữa tâm vật thể
    const targetPos = objPos.add(window.followTargetOffset || new THREE.Vector3());
    
    if (isFollowing) {
       orbit.target.lerp(targetPos, 0.08);
       const desiredCamPos = targetPos.clone().add(followCamOffset);
       camera.position.lerp(desiredCamPos, 0.08);
       
       if (orbit.target.distanceTo(targetPos) < 1.0) {
          isFollowing = false;
       }
    } else {
       const delta = targetPos.clone().sub(orbit.target);
       orbit.target.copy(targetPos);
       camera.position.add(delta);
    }
  }

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
  
  windMixers.forEach(m => m.update(dt));
  energyObjects.forEach(eo => {
    if (eo.type === 'wind' && eo.rotor) eo.rotor.rotation.z += dt * eo.speed;
  });

  // Flag wind cloth animation
  if (globalFlagGeo) {
    const pos = globalFlagGeo.attributes.position;
    const initZ = globalFlagGeo.userData.initZ;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      // The wave amplitude increases as x goes further right from the pole (x=0)
      const wave = Math.sin(el * 6 - x * 1.5) * (x / 6) * 0.7;
      const noise = Math.sin(el * 15 + x * 4) * (x / 6) * 0.15; // fast flutter
      pos.setZ(i, initZ[i] + wave + noise);
    }
    pos.needsUpdate = true;
    globalFlagGeo.computeVertexNormals();
  }

  renderer.render(scene, camera);
}

animate();