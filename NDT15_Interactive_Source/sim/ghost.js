/* ──────────────────────────────────────────────────────────────────────────
 * sim/ghost.js — Precognition / future ghost layer (Phase 1)
 *
 * When the scrub head is dragged past NOW into the future band, reality freezes
 * and we render a translucent cyan PREVIEW of where the vessels WILL be. Vessel
 * motion is a pure function of time (vesselPose), so the future is computed for
 * free — no prediction model needed for the headline visual. Each ghost is a
 * lightweight silhouette proxy (not a clone of the heavy GLB), plus a dotted
 * lane from the vessel's present position to its forecast position.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene } from '../core.js';
import { vessels, vesselPose, BERTH_Z } from '../ships.js';

const GHOST = 0x34E0F0;
let layer = null;
const proxies = [];

export function initGhost() {
  layer = new THREE.Group();
  layer.visible = false;
  scene.add(layer);

  const hullGeo = new THREE.BoxGeometry(46, 9, 13);
  const ringGeo = new THREE.RingGeometry(6, 7.4, 36);
  for (let i = 0; i < vessels.length; i++) {
    const hull = new THREE.Mesh(hullGeo, new THREE.MeshBasicMaterial(
      { color: GHOST, transparent: true, opacity: 0.30, depthWrite: false }));
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial(
      { color: GHOST, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({ color: GHOST, transparent: true, opacity: 0.5, dashSize: 6, gapSize: 4 }));
    layer.add(hull); layer.add(ring); layer.add(line);
    proxies.push({ hull, ring, line });
  }
}

// active → show ghosts posed at futureTime; otherwise hide the layer.
export function updateGhost(active, futureTime) {
  if (!layer) return;
  layer.visible = active;
  if (!active) return;
  for (let i = 0; i < vessels.length; i++) {
    const v = vessels[i], pr = proxies[i];
    const fp = vesselPose(v, futureTime);
    pr.hull.position.set(fp.x, 6, fp.z);
    pr.hull.rotation.y = fp.ry;
    pr.ring.position.set(fp.x, 6, fp.z);
    const np = v.ps || vesselPose(v, futureTime);     // present pose (set each frame in scene.js)
    const pos = pr.line.geometry.attributes.position;
    pos.setXYZ(0, np.x, 6, np.z); pos.setXYZ(1, fp.x, 6, fp.z); pos.needsUpdate = true;
    pr.line.computeLineDistances();
    const moved = Math.hypot(fp.x - np.x, fp.z - np.z) > 4;
    pr.line.visible = moved;
  }
}

export function ghostBerthForecast(futureTime) {
  let docked = 0;
  for (const v of vessels) if (vesselPose(v, futureTime).docked) docked++;
  return docked;
}
void BERTH_Z;
