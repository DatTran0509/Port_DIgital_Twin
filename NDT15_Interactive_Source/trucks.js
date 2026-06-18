import * as THREE from 'three';
import { scene, mat, sp, bx, cy, cMats } from './core.js';
import { yardLanes, rtgCranes } from './yard.js';

export const truckGroup = new THREE.Group();
scene.add(truckGroup);
export const trucks = [];

export function initTrucks() {
  for (let i = 0; i < 8; i++) { // Increased trucks to 8
    const tk = buildTruck(cMats[i % 4]);
    const isOutbound = i >= 4;
    const laneX = isOutbound ? (i % 2 === 0 ? 10 : 30) : (i % 2 === 0 ? -30 : -10);
    const isImport = isOutbound ? false : Math.random() > 0.5;
    tk.cargo.visible = isOutbound ? true : isImport; // Outbound trucks are already full, inbound trucks are full if importing
    
    trucks.push({
      g: tk.g, cargo: tk.cargo, hl: tk.hl, plate: tk.plate,
      x: laneX,
      outLane: isOutbound ? laneX : (laneX === -30 ? 10 : 30),
      // Spawn outbound trucks inside the port (z=10, 25, 40, 55) so they drive OUT normally.
      z: isOutbound ? (10 + (i - 4) * 15) : (140 + i * 40),
      spd: 20, // sped up slightly
      wait: 0,
      scanned: false,
      state: isOutbound ? 5 : 0,
      yardLane: yardLanes[i % 5],
      isImport: isImport
    });
  }
}

function buildTruck(col) {
  const g = new THREE.Group();
  const headCol = [0xff2222, 0xffaa00, 0x11cc44, 0x0088ff][Math.floor(Math.random() * 4)];
  const hMat = mat(headCol, 0.3, 0.6);
  
  bx(g, 3.4, 2.0, 2.5, hMat, 0, 1.4, -2.5); 
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 3.4, 16, 1, false, 0, Math.PI), hMat);
  hood.rotation.z = Math.PI / 2; hood.position.set(0, 2.4, -2.5); g.add(hood);
  
  bx(g, 3.5, 1.0, 1.4, mat(0x050d1a, 0.1, 0.9), 0, 2.2, -3.1);

  bx(g, 3.6, 0.8, 7.6, mat(0x101c2c, .7), 0, 0.8, 2.6);
  const cargo = bx(g, 3.4, 2.6, 6.4, col, 0, 2.5, 2.6);
  
  [[-2.0, -2.8], [2.0, -2.8], [-2.0, 1.5], [2.0, 1.5], [-2.0, 4.5], [2.0, 4.5]].forEach(([wx, wz]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .6, 16), mat(0x111111, .8, .1));
    w.rotation.z = Math.PI / 2; w.position.set(wx, .8, wz); g.add(w);
  });
  
  const hlMat = mat(0xffffff, 0.1, 0.1, 0xffffff, 2.0);
  const tlMat = mat(0xff0000, 0.1, 0.1, 0xff0000, 1.5);
  const rlMat = mat(0xffaa00, 0.1, 0.1, 0xffaa00, 1.5);
  
  sp(g, 0.35, hlMat, -1.2, 1.2, -3.8);
  sp(g, 0.35, hlMat, 1.2, 1.2, -3.8);
  bx(g, 0.6, 0.3, 0.2, tlMat, -1.3, 1.0, 6.5);
  bx(g, 0.6, 0.3, 0.2, tlMat, 1.3, 1.0, 6.5);
  [-1, 0, 1].forEach(lx => bx(g, 0.2, 0.15, 0.2, rlMat, lx, 4.2, -2.8));

  const hl = { mats: [hlMat, tlMat, rlMat] };
  
  const plateNum = Math.floor(10000 + Math.random() * 90000);
  const platePrefix = ['51C', '51D', '60C', '61C'][Math.floor(Math.random() * 4)];
  const plate = `${platePrefix}-${plateNum.toString().slice(0,3)}.${plateNum.toString().slice(3)}`;
  
  const drivers = ['Nguyễn Văn A', 'Trần Thị B', 'Lê Hoàng C', 'Phạm D'];
  const companies = ['Gemadept Logistics', 'Tân Cảng', 'Vinafco', 'Sotrans'];
  
  g.userData = {
    isClickable: true,
    objType: 'truck',
    data: {
      icon: '🚛', name: `Xe Tải ${plate}`, subtitle: 'PHƯƠNG TIỆN ĐƯỜNG BỘ',
      details: {
        'Biển số': plate,
        'Tài xế': drivers[Math.floor(Math.random() * drivers.length)],
        'Đơn vị vận tải': companies[Math.floor(Math.random() * companies.length)],
        'Mức nhiên liệu': Math.floor(30 + Math.random() * 70) + '%'
      }
    }
  };

  truckGroup.add(g); return { g, cargo, hl, plate };
}

function setTruckOpacity(tk, alpha) {
  if (tk.lastAlpha === alpha) return;
  tk.lastAlpha = alpha;
  const isTrans = alpha < 0.99;
  tk.g.traverse(c => {
    if (c.isMesh && c.material) {
      if (!c.userData.origMat) {
         c.userData.origMat = c.material;
         c.material = c.material.clone();
      }
      c.material.transparent = isTrans;
      c.material.opacity = alpha;
    }
  });
}

export function updateTrucks(dt, barriers, updateGateScreens) {
  const barLift = [0, 0, 0, 0];
  const tLanes = [-30, -10, 10, 30]; // Updated gate lanes
  
  trucks.forEach(tk => {
    tk.g.position.set(tk.x, 5.0, tk.z);
    
    // Lift barriers logic
    if ((tk.state === 0.5 && tk.valid) || (tk.state === 1 && tk.z > 60)) {
      const li = tLanes.findIndex(lx => Math.abs(lx - tk.x) < 2);
      if (li >= 0) barLift[li] = 1;
    }
    if ((tk.state === 6.5) || (tk.state === 7 && tk.z < 85)) {
      const li = tLanes.findIndex(lx => Math.abs(lx - tk.x) < 2);
      if (li >= 0) barLift[li] = 1;
    }

    if (tk.wait > 0) { tk.wait -= dt; return; }
    const tdt = dt * tk.spd;

    // Smart collision avoidance (All lanes & yard)
    let safeDist = true;
    for (const o of trucks) {
      if (o !== tk) {
        const d = Math.hypot(o.x - tk.x, o.z - tk.z);
        if (d < 24) { 
           const fwdX = -Math.sin(tk.g.rotation.y);
           const fwdZ = -Math.cos(tk.g.rotation.y);
           
           const o_fwdX = -Math.sin(o.g.rotation.y);
           const o_fwdZ = -Math.cos(o.g.rotation.y);
           
           // Chỉ tránh nhau nếu đang đi cùng hướng (cùng lane)
           const sameDir = (fwdX * o_fwdX + fwdZ * o_fwdZ) > 0.5;
           
           if (sameDir) {
               const rightX = fwdZ, rightZ = -fwdX;
               const toOX = o.x - tk.x, toOZ = o.z - tk.z;
               const dotFwd = fwdX * toOX + fwdZ * toOZ;
               const dotRight = rightX * toOX + rightZ * toOZ;
               // Nếu xe KIA nằm phía TRƯỚC (dotFwd > 10) và cùng làn đường (dotRight < 5)
               if (dotFwd > 10 && Math.abs(dotRight) < 5.0) safeDist = false;
           }
        }
      }
    }
    if (!safeDist) return;
    
    // Alpha fading effect when entering/leaving far away
    let alpha = 1.0;
    if (tk.state === 7 && tk.z > 250) alpha = Math.max(0, (300 - tk.z) / 50.0);
    else if (tk.state === 0 && tk.z > 250) alpha = Math.max(0, (300 - tk.z) / 50.0);
    setTruckOpacity(tk, alpha);

    let reached = false;
    
    function moveTowards(obj, tx, tz, maxD) {
      const dx = tx - obj.x, dz = tz - obj.z;
      const d = Math.hypot(dx, dz);
      if (d <= maxD) { 
        obj.x = tx; obj.z = tz; 
        if (d > 0.001) obj.g.rotation.y = Math.atan2(dx, dz) + Math.PI; 
        return true; 
      }
      obj.x += (dx / d) * maxD; obj.z += (dz / d) * maxD;
      obj.g.rotation.y = Math.atan2(dx, dz) + Math.PI;
      return false;
    }

    switch (tk.state) {
      case 0: // Approach gate
        reached = moveTowards(tk, tk.x, 95, tdt);
        if (reached) {
          tk.valid = Math.random() > 0.25;
          tk.state = 0.5; tk.wait = 1.0;
          const li = tLanes.findIndex(lx => Math.abs(lx - tk.x) < 2);
          if (li >= 0) {
            barriers[li].status = tk.valid ? 1 : -1; barriers[li].plate = tk.plate;
            updateGateScreens();
            tk.assignedBarrier = barriers[li];
          }
        }
        break;
      case 0.5:
        if (tk.wait <= 0) {
          if (tk.valid) tk.state = 1;
          else { tk.state = 0.6; tk.wait = 1.0; }
        }
        break;
      case 0.6:
        if (tk.assignedBarrier) {
          tk.assignedBarrier.status = 0;
          updateGateScreens(); tk.assignedBarrier = null;
        }
        reached = moveTowards(tk, -50, 130, tdt);
        if (reached) tk.state = 7;
        break;
      case 1: // Pass gate
        // Wait for barrier to physically lift
        if (tk.assignedBarrier && tk.assignedBarrier.grp.rotation.z > -1.0) break;
        reached = moveTowards(tk, tk.x, 70, tdt);
        if (reached) {
          tk.state = 2;
          if (tk.assignedBarrier) {
             tk.assignedBarrier.status = 0; tk.assignedBarrier.plate = null;
             updateGateScreens(); tk.assignedBarrier = null;
          }
        }
        break;
      case 2: // Turn to yard lane
        reached = moveTowards(tk, tk.yardLane + 1.5, 62, tdt);
        if (reached) { tk.state = 3; tk.tgtZ = 25 + Math.random() * 25; }
        break;
      case 3: // Drive into slot
        reached = moveTowards(tk, tk.yardLane + 1.5, tk.tgtZ || 35, tdt);
        if (reached) { tk.state = 3.1; }
        break;
      case 3.1: // Idle waiting for a crane
        // The difference between yardLanes and blockX is 19, so search distance must be < 25
        const idleRtg = rtgCranes.find(r => r.state === 0 && !r.tTrk && Math.abs(r.bxv - tk.yardLane) < 25);
        if (idleRtg) { idleRtg.tTrk = tk; tk.state = 3.5; }
        break;
      case 3.5: // Being serviced by crane
        break;
      case 3.6: // Drive to end of block for U-Turn
        reached = moveTowards(tk, tk.yardLane + 1.5, 18, tdt);
        if (reached) { tk.state = 3.7; tk.uAngle = 0; }
        break;
      case 3.7: // Perform U-Turn curve
        tk.uAngle += dt * 1.5;
        if (tk.uAngle >= Math.PI) { tk.uAngle = Math.PI; tk.state = 3.8; }
        tk.x = tk.yardLane + 1.5 * Math.cos(tk.uAngle);
        tk.z = 18 - 2.5 * Math.sin(tk.uAngle);
        tk.g.rotation.y = tk.uAngle;
        break;
      case 3.8: // Drive back up the outbound lane
        reached = moveTowards(tk, tk.yardLane - 1.5, 35, tdt);
        if (reached) tk.state = 4;
        break;
      case 4: // Exit yard
        reached = moveTowards(tk, tk.yardLane - 1.5, 62, tdt);
        if (reached) tk.state = 5;
        break;
      case 5: // Turn to gate
        reached = moveTowards(tk, tk.outLane, 70, tdt);
        if (reached) tk.state = 6;
        break;
      case 6: // Drive to gate
        reached = moveTowards(tk, tk.outLane, 76, tdt);
        if (reached) { 
          tk.wait = 1.2; 
          tk.state = 6.5; 
          const li = tLanes.findIndex(lx => Math.abs(lx - tk.x) < 2);
          if (li >= 0) {
            barriers[li].status = 1;
            barriers[li].plate = tk.plate;
            updateGateScreens();
          }
        }
        break;
      case 6.5:
        if (tk.wait <= 0) tk.state = 7;
        break;
      case 7: // Drive away
        if (tk.z > 85) {
           const li = tLanes.findIndex(lx => Math.abs(lx - tk.x) < 2);
           if (li >= 0 && barriers[li].plate === tk.plate) {
             barriers[li].status = 0;
             updateGateScreens();
           }
        }
        reached = moveTowards(tk, tk.outLane, 300, tdt);
        if (reached) {
          let newX = [-30, -10][Math.floor(Math.random() * 2)];
          let newZ = 300;
          
          // Tránh lỗi sinh ra đè lên nhau: lùi xe lại nếu vị trí spawn đang có xe khác
          let conflict = true;
          while (conflict) {
             conflict = false;
             for (const o of trucks) {
                if (o !== tk && o.state === 0 && Math.abs(o.x - newX) < 2 && Math.abs(o.z - newZ) < 30) {
                   newZ += 30;
                   conflict = true;
                   break;
                }
             }
          }

          tk.x = newX;
          tk.z = newZ;
          tk.yardLane = yardLanes[Math.floor(Math.random() * yardLanes.length)];
          tk.outLane = tk.x === -30 ? 10 : 30;
          tk.state = 0; 
          tk.isImport = Math.random() > 0.5; // True = Nhập (Truck->Yard), False = Xuất (Yard->Truck)
          tk.cargo.visible = tk.isImport;
        }
        break;
    }
  });
  
  // Physically animate barriers based on barLift
  barriers.forEach((b, i) => { const tgt = barLift[i] ? -Math.PI / 2.2 : 0; b.grp.rotation.z += (tgt - b.grp.rotation.z) * Math.min(1, dt * 6); });
}
