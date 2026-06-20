import * as THREE from 'three';
import { camera } from '../core.js';
import { vessels } from '../ships.js';

const FEATS = window.FEATS;
const coLayer = document.getElementById('colayer');

export const hsEls = [];
export const coEls = [];

let scanActive = false;

export function isScanActive() { return scanActive; }
export function setScanActive(v) { scanActive = v; }

export function setCallouts(fi) {
  coEls.forEach(c => c.el.remove()); coEls.length = 0;
  if (fi == null) return;
  const f = FEATS[fi];
  (f.co || []).forEach(c => {
    const el = document.createElement('div'); el.className = 'co'; el.style.setProperty('--cc', f.color); el.dataset.tr = 'translate(-50%, -100%)';
    el.innerHTML = `<div class="cobox">${c.t}</div><div class="costem"></div><div class="codot"></div>`;
    coLayer.appendChild(el);
    coEls.push({ el, pos: new THREE.Vector3(...c.p) });
  });
}

const _v = new THREE.Vector3();
export function projAt(el, x, y, z, padL, padR) {
  _v.set(x, y, z).project(camera);
  const sx = (_v.x * .5 + .5) * innerWidth, sy = (-_v.y * .5 + .5) * innerHeight;
  // Hardware-accelerated 3D transform with rounded subpixels for max performance
  el.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) ${el.dataset.tr || ''}`;
  return _v.z < 1 && sx > padL && sx < innerWidth - padR && sy > 60 && sy < innerHeight - 60;
}

export function updateOverlays(aisEls) {
  hsEls.forEach(({ el, pos }) => el.classList.toggle('vis', projAt(el, pos.x, pos.y, pos.z, 80, 100)));
  coEls.forEach(({ el, pos }) => el.classList.toggle('vis', projAt(el, pos.x, pos.y, pos.z, 60, 60)));

  const ST = { inbound: 'đang vào', depart: 'đang rời đi', hold: 'đang neo chờ · ETA 8m' };

  if (aisEls) {
    vessels.forEach((v, i) => {
      const ps = v.ps; // assume ps is attached to v during animate
      if (!ps) return;
      const a = aisEls[i];
      if (!a) return;
      a.classList.toggle('vis', projAt(a, ps.x, 10, ps.z, 70, 70));

      let stTxt = ST[ps.st];
      if (ps.st === 'berth' || ps.st === 'dock') {
        stTxt = 'đang cập bến · ' + (v.action === 'import' ? 'dỡ hàng' : 'nhận hàng');
      }

      a.querySelector('.ast').textContent = '· ' + stTxt + (ps.spd ? ` · ${ps.spd}kn` : '');
    });
  }
}
