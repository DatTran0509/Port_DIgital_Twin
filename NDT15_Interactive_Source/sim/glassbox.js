/* ──────────────────────────────────────────────────────────────────────────
 * sim/glassbox.js — Causal "X-ray" threads (Phase 2.5)
 *
 * Click a consequence (a KPI tile) and the twin draws the chain of CAUSES as
 * glowing threads connecting the real 3D locations involved, with flowing light
 * and floating labels — turning the black box into a glass box. The chain is
 * supplied by the active scenario (consequence → … → root cause).
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, camera } from '../core.js';

let group = null, line = null, mat = null, host = null;
const nodeMeshes = [];
let chain = [];
let phase = 0;

export function initGlassbox() {
  group = new THREE.Group(); group.visible = false; scene.add(group);
  mat = new THREE.LineDashedMaterial({ color: 0xffd070, transparent: true, opacity: 0.9, dashSize: 5, gapSize: 3, linewidth: 2 });
  line = new THREE.Line(new THREE.BufferGeometry(), mat);
  group.add(line);

  host = document.createElement('div');
  host.id = 'gb-labels';
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;';
  document.body.appendChild(host);
}

// chain: [{ pos:THREE.Vector3, label, kind:'cause'|'effect' }] ordered effect→cause.
export function trace(newChain) {
  chain = newChain || [];
  // (re)build node markers + labels
  nodeMeshes.forEach(m => group.remove(m)); nodeMeshes.length = 0;
  host.innerHTML = '';
  const pts = [];
  chain.forEach((n, i) => {
    pts.push(n.pos.clone());
    const col = i === chain.length - 1 ? 0xff5468 : (i === 0 ? 0x34E0F0 : 0xffd070);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 12),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9 }));
    ball.position.copy(n.pos); group.add(ball); nodeMeshes.push(ball);

    const d = document.createElement('div');
    d.className = 'gb-label';
    d.innerHTML = `<span class="gb-step">${chain.length - i}</span> ${n.label}`;
    host.appendChild(d);
    n._el = d;
  });
  line.geometry.setFromPoints(pts);
  line.computeLineDistances();
  group.visible = chain.length > 0;
}

export function clear() { chain = []; if (group) group.visible = false; if (host) host.innerHTML = ''; }
export function active() { return chain.length > 0; }

const _v = new THREE.Vector3();
export function update(dt) {
  if (!group || !group.visible) return;
  phase = (phase + dt * 14) % 1000;
  mat.dashOffset = -phase;
  // project labels to screen
  for (const n of chain) {
    if (!n._el) continue;
    _v.copy(n.pos).project(camera);
    const onScreen = _v.z < 1 && _v.x > -1.2 && _v.x < 1.2 && _v.y > -1.2 && _v.y < 1.2;
    n._el.style.display = onScreen ? 'block' : 'none';
    if (onScreen) {
      n._el.style.left = ((_v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      n._el.style.top = ((-_v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    }
  }
}
