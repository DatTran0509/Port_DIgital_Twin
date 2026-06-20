import * as THREE from 'three';
import { scene } from '../core.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BERTH_Z, berthXs } from './berths.js';

/* ──────────────────────────────────────────────────────────────────────────
 * ships/vessels.js — Vessel fleet + pose cycle logic.
 *
 * Owns the shared container-ship GLB (loaded once and cloned), the vessel
 * registry, the AIS overlay elements, the sonar "ping" rings, and the
 * vesselPose() state machine that drives the cycle / dock / queue motion.
 *
 * Behavior is preserved verbatim from the original ships.js.
 *
 * Requirements: 10.1, 10.3, 10.4
 * ────────────────────────────────────────────────────────────────────────── */

export const vessels = [];
export const pings = [];
export const aisEls = [];

let sharedShipMesh = null;
const pendingShipGroups = [];

new GLTFLoader().load('assets/container_ship.glb', (gltf) => {
  const mesh = gltf.scene;
  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.z > size.x) mesh.rotation.y = Math.PI / 2;

  mesh.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(mesh);
  const size2 = new THREE.Vector3();
  box2.getSize(size2);

  const scale = 62 / size2.x;
  mesh.scale.setScalar(scale);

  mesh.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(mesh);
  const center = new THREE.Vector3();
  box3.getCenter(center);

  mesh.position.x -= center.x;
  mesh.position.z -= center.z;
  mesh.position.y -= box3.min.y;
  mesh.position.y -= 8.5; // Submerge

  mesh.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  sharedShipMesh = mesh;
  pendingShipGroups.forEach(g => {
    const clone = sharedShipMesh.clone();
    clone.traverse(c => {
      if (c.isMesh && c.material) {
        c.material = c.material.clone();
        c.material.transparent = true;
        c.material.depthWrite = true;
      }
    });
    g.add(clone);
  });
  pendingShipGroups.length = 0;
});

function loadVesselGLB() {
  const g = new THREE.Group();
  g.scale.setScalar(0.7);
  g.userData = { isClickable: true, objType: 'ship' };
  scene.add(g);
  if (sharedShipMesh) {
    const clone = sharedShipMesh.clone();
    clone.traverse(c => {
      if (c.isMesh && c.material) {
        c.material = c.material.clone();
        c.material.transparent = true;
        c.material.depthWrite = true;
      }
    });
    g.add(clone);
  } else {
    pendingShipGroups.push(g);
  }
  return g;
}

function generateShipData(nm, action) {
  const ports = ['Thượng Hải', 'Singapore', 'Rotterdam', 'Los Angeles', 'Hamburg', 'Dubai', 'Busan', 'Antwerp'];
  const flags = ['Panama 🇵🇦', 'Liberia 🇱🇷', 'Singapore 🇸🇬', 'Marshall Islands 🇲🇭', 'Hong Kong 🇭🇰', 'Malta 🇲🇹'];
  const operators = ['MSC', 'Maersk Line', 'CMA CGM', 'COSCO Shipping', 'Hapag-Lloyd', 'Ocean Network Express', 'Evergreen'];
  const captains = ['Nguyễn Hải Đăng', 'Trần Quốc Bảo', 'Lê Minh Khôi', 'Phạm Văn Sơn', 'Andreas M.', 'Wei Zhang'];
  const goodsImp = ['Điện tử & gia dụng', 'Máy móc thiết bị', 'Ô tô & linh kiện', 'Hóa chất', 'Nguyên liệu nhựa'];
  const goodsExp = ['Nông sản & cà phê', 'Dệt may & da giày', 'Thủy sản đông lạnh', 'Đồ gỗ nội thất', 'Gạo & hạt điều'];
  const prevPort = ports[Math.floor(Math.random() * ports.length)];
  let nextPort = ports[Math.floor(Math.random() * ports.length)];
  if (nextPort === prevPort) nextPort = 'Tokyo';

  const teuCap = [8500, 11000, 14000, 18000, 23000][Math.floor(Math.random() * 5)];
  const teuOnboard = Math.round(teuCap * (0.5 + Math.random() * 0.4));
  const teuHandle = Math.round(teuOnboard * (0.15 + Math.random() * 0.3)); // handled at THIS port
  const loa = 250 + Math.floor(Math.random() * 150);                       // length overall (m)
  const beam = 40 + Math.floor(Math.random() * 22);
  const dwt = Math.round((teuCap * 13 + Math.random() * 20000) / 1000) * 1000;
  const draft = (11 + Math.random() * 5).toFixed(1);
  const speed = (8 + Math.random() * 13).toFixed(1);
  const berth = 'B-' + String(1 + Math.floor(Math.random() * 6)).padStart(2, '0');
  const opLabel = action === 'import' ? 'Dỡ hàng nhập (discharge)' : 'Bốc hàng xuất (load)';
  const handledKey = action === 'import' ? 'Đã dỡ tại cảng' : 'Đã bốc tại cảng';

  const data = {
    icon: '🚢', name: nm, subtitle: 'TÀU CONTAINER — ' + (action === 'import' ? 'NHẬP KHẨU' : 'XUẤT KHẨU'),
    action,
    _teuHandle: teuHandle, _teuOnboard: teuOnboard, _handledKey: handledKey,
    details: {
      'Số IMO': 'IMO ' + Math.floor(1000000 + Math.random() * 8999999),
      'Hô hiệu (Call sign)': '3' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 9),
      'Quốc tịch (cờ)': flags[Math.floor(Math.random() * flags.length)],
      'Hãng khai thác': operators[Math.floor(Math.random() * operators.length)],
      'Thuyền trưởng': captains[Math.floor(Math.random() * captains.length)],
      'Năm sản xuất': 2010 + Math.floor(Math.random() * 13),
      'Chiều dài (LOA)': loa + ' m',
      'Chiều rộng (beam)': beam + ' m',
      'Trọng tải (DWT)': dwt.toLocaleString('vi-VN') + ' tấn',
      'Sức chở thiết kế': teuCap.toLocaleString('vi-VN') + ' TEU',
      'Container trên tàu': teuOnboard.toLocaleString('vi-VN') + ' TEU',
      'Loại hàng': (action === 'import' ? goodsImp : goodsExp)[Math.floor(Math.random() * 5)],
      'Cảng đi': prevPort,
      'Cảng đến': nextPort,
      'Tác nghiệp tại cảng': opLabel,
      [handledKey]: '0 / ' + teuHandle + ' cont',
      'Cầu bến': berth,
      'Mớn nước': draft + ' m',
      'Tốc độ': speed + ' hải lý/giờ',
      'Trạng thái': 'Đang chờ dữ liệu...'
    },
    route: [
      { port: prevPort, status: 'past', time: '12 ngày trước' },
      { port: 'Cảng NDT15', status: 'current', time: 'ETA: ' + (Math.floor(Math.random() * 45) + 5) + ' phút' },
      { port: nextPort, status: 'future', time: 'ETA: ' + (Math.floor(Math.random() * 5) + 1) + ' ngày' }
    ]
  };
  return data;
}

// Populate the vessel registry, AIS overlay elements, and sonar ping rings.
export function initVessels(coLayer0) {
  // Snap each berthing reference (the x where a vessel docks at BERTH_Z) onto a
  // real berth position from the layout (berthXs = layout.berthX()), so every
  // docking/cycle vessel docks exactly on a berth within 0.1 units (Req 3.3).
  // Distinct berths are assigned to avoid two vessels sharing one slot.
  //   berthXs = [-150,-90,-30,30,90,150]
  vessels.push(
    { g: loadVesselGLB(), mode: 'cycle', bx: berthXs[1], t0: 0, dur: 110, cz: -120, nm: 'MSC ARIA', action: 'import', data: generateShipData('MSC ARIA', 'import') },
    { g: loadVesselGLB(), mode: 'cycle', bx: berthXs[3], t0: 36, dur: 110, cz: -200, nm: 'EVER LINK', action: 'export', data: generateShipData('EVER LINK', 'export') },
    { g: loadVesselGLB(), mode: 'cycle', bx: berthXs[5], t0: 73, dur: 110, cz: -280, nm: 'MAERSK ALFA', action: 'import', data: generateShipData('MAERSK ALFA', 'import') },
    { g: loadVesselGLB(), mode: 'dock', bx: berthXs[2], nm: 'OCEAN KING', action: 'export', data: generateShipData('OCEAN KING', 'export') },
    { g: loadVesselGLB(), mode: 'queue', qx: 80, qz: -300, nm: 'OOCL STAR', action: 'import', data: generateShipData('OOCL STAR', 'import') },
    { g: loadVesselGLB(), mode: 'queue', qx: 250, qz: -350, nm: 'MAERSK LINE', action: 'export', data: generateShipData('MAERSK LINE', 'export') },
    { g: loadVesselGLB(), mode: 'queue', qx: -200, qz: -280, nm: 'COSCO SHIPPING', action: 'import', data: generateShipData('COSCO SHIPPING', 'import') }
  );

  vessels.forEach((v, i) => {
    v.g.userData.data = v.data; // Bind mock data to group userData
    const el = document.createElement('div'); el.className = 'ais'; el.dataset.tr = 'translate(-50%, -180%)';
    el.innerHTML = `<span class="adot"></span><b>${v.nm}</b><span class="ast"></span>`; coLayer0.appendChild(el);
    aisEls.push(el);

    const ring = new THREE.Mesh(new THREE.RingGeometry(2, 2.5, 40),
      new THREE.MeshBasicMaterial({ color: 0x34E0F0, transparent: true, opacity: .55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 5; scene.add(ring);
    pings.push({ ring, v, off: i * 0.9 });
  });
}

export function vesselPose(v, el) {
  const lerp = (a, b, t) => a + (b - a) * t;
  if (v.mode === 'dock') return { x: v.bx, z: BERTH_Z, ry: Math.PI, st: 'dock', spd: 0, docked: true, progress: v.action === 'import' ? 'Đang dỡ hàng' : 'Đang bốc hàng', prgPct: 0.5, dockFrac: 0.5, etaText: 'ETA hoàn tất: 45 phút' };
  if (v.mode === 'queue') {
    const r = 25, a = el * .1;
    return { x: v.qx + Math.cos(a) * r, z: v.qz + Math.sin(a) * r, ry: -a + Math.PI, st: 'hold', spd: 0.5, docked: false, progress: 'Đang neo chờ', prgPct: 0.1, dockFrac: 0, etaText: 'ETA vào bến: 2 giờ' };
  }

  const p = ((((el - v.t0) % v.dur) + v.dur) % v.dur) / v.dur;
  const wp = [
    [0, 500, v.cz],
    [.25, v.bx, v.cz],
    [.35, v.bx, BERTH_Z],
    [.62, v.bx, BERTH_Z],
    [.72, v.bx, v.cz],
    [1, -500, v.cz]
  ];
  let x = v.bx, z = BERTH_Z, ry = Math.PI; // Always face left (direction of travel)
  for (let i = 0; i < wp.length - 1; i++) {
    if (p >= wp[i][0] && p <= wp[i + 1][0]) {
      const lt = (p - wp[i][0]) / (wp[i + 1][0] - wp[i][0]);
      x = lerp(wp[i][1], wp[i + 1][1], lt); z = lerp(wp[i][2], wp[i + 1][2], lt);
      break;
    }
  }
  const docked = p >= .35 && p <= .62;
  const dockFrac = Math.max(0, Math.min(1, (p - 0.35) / 0.27));

  let progressText, prgPct, etaText;
  if (p < 0.35) {
    progressText = 'Đang tiến vào cảng';
    prgPct = (p / 0.35) * 0.5;
    const minsLeft = Math.ceil((0.35 - p) * v.dur);
    etaText = `ETA cập bến: ${minsLeft} phút`;
  }
  else if (p <= 0.62) {
    progressText = v.action === 'import' ? 'Đang dỡ hàng' : 'Đang bốc hàng';
    prgPct = 0.5;
    const minsLeft = Math.ceil((0.62 - p) * v.dur);
    etaText = `Hoàn tất sau: ${minsLeft} phút`;
  }
  else {
    progressText = 'Đang rời cảng';
    prgPct = 0.5 + ((p - 0.62) / 0.38) * 0.5;
    const minsLeft = Math.ceil((1.0 - p) * v.dur);
    etaText = `Rời khỏi khu vực sau: ${minsLeft} phút`;
  }

  return { x, z, ry, st: docked ? 'berth' : (p < .35 ? 'inbound' : 'depart'), spd: docked ? 0 : 12, docked, progress: progressText, prgPct, dockFrac, etaText };
}
