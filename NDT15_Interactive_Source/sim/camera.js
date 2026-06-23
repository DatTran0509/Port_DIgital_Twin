/* sim/camera.js — smooth camera fly-to (shared by Copilot + scenario focus). */
import * as THREE from 'three';
import { camera, orbit } from '../core.js';

let anim = null;
const eio = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function flyTo(pos, look, dur = 1400) {
  if (anim) cancelAnimationFrame(anim);
  const p0 = camera.position.clone(), t0 = orbit.target.clone(), st = performance.now();
  const p1 = pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(pos.x, pos.y, pos.z);
  const l1 = look instanceof THREE.Vector3 ? look : new THREE.Vector3(look.x, look.y, look.z);
  (function tick() {
    const k = Math.min((performance.now() - st) / dur, 1), e = eio(k);
    camera.position.lerpVectors(p0, p1, e);
    orbit.target.lerpVectors(t0, l1, e);
    orbit.update();
    if (k < 1) anim = requestAnimationFrame(tick); else anim = null;
  })();
}
