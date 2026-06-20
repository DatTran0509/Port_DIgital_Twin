import * as THREE from 'three';
import { hsEls, setCallouts, setScanActive } from './overlays.js';
import { selectFeat, resetHL, getPreset } from './feature-presets.js';
import { hideObjectInfo } from './object-info.js';
import { initDayNight } from './daynight.js';

const FEATS = window.FEATS;
const nav = document.getElementById('fnav');
const hsLayer = document.getElementById('hslayer');
const panel = document.getElementById('panel');

export function initUI(orbit, berthMeshes, containerMeshes, gateg, radarG, buoyMeshes, shorePowerGroup, scanPlane) {
  const objInfoClose = document.getElementById('obj-info-close');
  if (objInfoClose) objInfoClose.onclick = () => {
    hideObjectInfo();
    // Dispatch a custom event to notify main.js to clear activeFollowTarget
    window.dispatchEvent(new Event('clear-follow-target'));
  };

  FEATS.forEach((f, i) => {
    const btn = document.createElement('button');
    btn.className = 'fn'; btn.style.setProperty('--c', f.color);
    btn.innerHTML = `<span class="d"></span>${f.short}` + (f.core ? '<span class="core">CORE</span>' : '');
    btn.onclick = () => selectFeat(i, orbit, berthMeshes, containerMeshes, gateg, radarG, buoyMeshes, shorePowerGroup, scanPlane);
    nav.appendChild(btn);

    const hs = document.createElement('div');
    hs.className = 'hs'; hs.style.setProperty('--c', f.color); hs.dataset.tr = 'translate(-50%, -50%)';
    hs.innerHTML = `<div class="ring"></div><div class="lbl">${f.id} · ${f.name}${f.core ? '  ◆' : ''}</div>`;
    hs.onclick = () => selectFeat(i, orbit, berthMeshes, containerMeshes, gateg, radarG, buoyMeshes, shorePowerGroup, scanPlane);
    hsLayer.appendChild(hs);

    hsEls.push({ el: hs, pos: new THREE.Vector3(...getPreset(f.id).cp) });
  });

  document.getElementById('pcls').onclick = () => {
    panel.classList.remove('open'); resetHL();
    document.querySelectorAll('.fn').forEach(b => b.classList.remove('on'));
    setCallouts(null);
    document.getElementById('left-sidebar').classList.remove('open');
    setScanActive(false); scanPlane.visible = false;
    document.body.classList.remove('has-active-feat');
    hsEls.forEach(h => h.el.classList.remove('active'));
  };

  initDayNight();

  let uiHidden = false;
  document.getElementById('ui-toggle').onclick = (e) => {
    uiHidden = !uiHidden;
    e.target.textContent = uiHidden ? '👁 Show UI' : '👁 Hide UI';
    document.body.classList.toggle('hide-ui', uiHidden);
  };
}
