/* ──────────────────────────────────────────────────────────────────────────
 * sim/highlight.js — Object highlighter (glowing box + beam + floating label)
 *
 * Highlights any scene object (or a synthetic box for objects without their own
 * group, e.g. yard blocks). A THREE.BoxHelper auto-refits each frame so the
 * outline follows moving entities (ships, trucks, trains). Used both by click
 * selection and by the Copilot when it locates an object.
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { scene, camera } from '../core.js';

let helper = null, ring = null, beam = null, labelEl = null, host = null;
let target = null, baseY = 0, t0 = 0, dur = 0, color = 0x34E0F0;
const _c = new THREE.Vector3(), _box = new THREE.Box3(), _size = new THREE.Vector3();

function ensureHost() {
  if (host) return;
  host = document.createElement('div');
  host.id = 'hl-host';
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:59;';
  document.body.appendChild(host);
}

export function clearHighlight() {
  if (helper) { scene.remove(helper); helper.geometry.dispose(); helper = null; }
  if (ring) { scene.remove(ring); ring = null; }
  if (beam) { scene.remove(beam); beam = null; }
  if (labelEl) { labelEl.remove(); labelEl = null; }
  target = null;
}

// obj: a THREE.Object3D, OR a plain box { x,y,z, sx,sy,sz }.
export function highlight(obj, opts = {}) {
  ensureHost();
  clearHighlight();
  color = opts.color || 0x34E0F0;
  dur = opts.dur || 0;            // 0 = persist until replaced/cleared
  t0 = 0;

  let center, maxXZ;
  if (obj && obj.isObject3D) {
    target = obj;
    helper = new THREE.BoxHelper(obj, color);
    helper.material.transparent = true; helper.material.depthTest = false;
    scene.add(helper);
    _box.setFromObject(obj); _box.getCenter(_c); _box.getSize(_size);
    center = _c.clone(); maxXZ = Math.max(_size.x, _size.z);
    baseY = _box.min.y;
  } else if (obj) {
    const g = new THREE.BoxGeometry(obj.sx || 20, obj.sy || 20, obj.sz || 20);
    helper = new THREE.LineSegments(new THREE.EdgesGeometry(g),
      new THREE.LineBasicMaterial({ color, transparent: true, depthTest: false }));
    helper.position.set(obj.x, obj.y, obj.z);
    scene.add(helper);
    center = new THREE.Vector3(obj.x, obj.y, obj.z);
    maxXZ = Math.max(obj.sx || 20, obj.sz || 20);
    baseY = obj.y - (obj.sy || 20) / 2;
  } else return;

  // base ring + vertical beam at the object footprint
  const r = Math.max(6, maxXZ * 0.7);
  ring = new THREE.Mesh(new THREE.RingGeometry(r, r * 1.18, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(center.x, baseY + 0.4, center.z); scene.add(ring);
  beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 70, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }));
  beam.position.set(center.x, baseY + 35, center.z); scene.add(beam);

  if (opts.label) {
    labelEl = document.createElement('div');
    labelEl.className = 'hl-label';
    labelEl.style.borderColor = '#' + color.toString(16).padStart(6, '0');
    labelEl.textContent = opts.label;
    host.appendChild(labelEl);
  }
  highlight._labelPos = center.clone(); highlight._labelPos.y = (obj.isObject3D ? _box.max.y : center.y + (obj.sy || 20) / 2);
}

export function updateHighlight(dt) {
  if (!helper) return;
  t0 += dt;
  if (dur && t0 > dur) { clearHighlight(); return; }
  const pulse = 0.55 + 0.45 * Math.sin(t0 * 4);
  helper.material.opacity = pulse;
  if (ring) { ring.material.opacity = 0.4 + 0.4 * pulse; const s = 1 + Math.sin(t0 * 4) * 0.08; ring.scale.set(s, s, 1); }
  // follow a moving target
  if (target && target.isObject3D) {
    helper.update();
    _box.setFromObject(target); _box.getCenter(_c);
    if (ring) ring.position.set(_c.x, _box.min.y + 0.4, _c.z);
    if (beam) beam.position.set(_c.x, _box.min.y + 35, _c.z);
    highlight._labelPos.set(_c.x, _box.max.y, _c.z);
  }
  if (labelEl) {
    const v = highlight._labelPos.clone().project(camera);
    const on = v.z < 1 && Math.abs(v.x) < 1.3 && Math.abs(v.y) < 1.3;
    labelEl.style.display = on ? 'block' : 'none';
    if (on) { labelEl.style.left = ((v.x * .5 + .5) * innerWidth) + 'px'; labelEl.style.top = ((-v.y * .5 + .5) * innerHeight) + 'px'; }
  }
}
