/* ──────────────────────────────────────────────────────────────────────────
 * sim/cinematic.js — Cinematic camera director (orbit + dolly zoom shots)
 *
 * Plays a timeline of camera SHOTS: each shot orbits the camera around a target
 * while dollying the radius/height (zoom in/out) and easing the entry from the
 * previous position — so a guided tour sweeps around every feature showing all
 * its best angles instead of flying to a point and stopping.
 *
 * Driven per-frame from chronos.endFrame(). Any user drag or other camera
 * command stops it (listens to orbit 'start' + 'clear-follow-target').
 * ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { camera, orbit } from '../core.js';

let shots = [], idx = 0, t = 0, active = false;
let notify = () => {};
let savedDamping = true;
const fromPos = new THREE.Vector3();
const _orbitPos = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export function initCinematic() {
  orbit.addEventListener('start', stopCinematic);             // user grabs the camera → end tour
  window.addEventListener('clear-follow-target', stopCinematic);
}

// shots: [{ look:[x,y,z], r0,r1, h0,h1, a0, aSpd, dur, msg }]; sayFn narrates each stop.
export function playCinematic(list, sayFn) {
  if (!list || !list.length) return '';
  notify = sayFn || (() => {});
  shots = list; idx = 0; t = 0; active = true;
  savedDamping = orbit.enableDamping;
  orbit.enableDamping = false;                                 // we drive the camera directly
  fromPos.copy(camera.position);
  return shots[0].msg || '';
}

export function stopCinematic() {
  if (!active) return;
  active = false; shots = []; idx = 0;
  orbit.enableDamping = savedDamping;
}
export function isCinematic() { return active; }

export function updateCinematic(dt) {
  if (!active || !shots.length) return;
  const s = shots[idx];
  t += Math.max(0, dt);
  const k = Math.min(t / s.dur, 1), e = ease(k);
  const ang = s.a0 + s.aSpd * t;                               // continuous orbit
  const r = s.r0 + (s.r1 - s.r0) * e;                          // dolly zoom
  const h = s.h0 + (s.h1 - s.h0) * e;
  _tgt.set(s.look[0], s.look[1], s.look[2]);
  _orbitPos.set(s.look[0] + Math.cos(ang) * r, s.look[1] + h, s.look[2] + Math.sin(ang) * r);
  const blend = Math.min(t / 1.3, 1);                          // smooth entry from previous shot
  camera.position.lerpVectors(fromPos, _orbitPos, blend);
  orbit.target.copy(_tgt);

  if (t >= s.dur) {                                            // advance to next shot
    idx++;
    if (idx >= shots.length) { stopCinematic(); return; }
    t = 0; fromPos.copy(camera.position);
    const nxt = shots[idx];
    if (nxt.msg) notify(nxt.msg);
  }
}
