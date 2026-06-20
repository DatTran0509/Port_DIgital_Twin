import * as THREE from 'three';
import { camera } from '../core.js';
import { setCallouts, setScanActive, hsEls } from './overlays.js';
import { renderFeatureCharts } from './charts.js';
import {
  PARAMS, apronBounds, berthX, blockCenterX, blockCenterZ, gatePosition,
} from '../layout.js';

const FEATS = window.FEATS;
const PC = window.PC;
const panel = document.getElementById('panel');

/* ── Camera presets, COMPUTED from the shared layout bounds (Req 8.1–8.4) ───
 * Semantics (matching the requirements glossary):
 *   ft = look-at target     → the CENTER of the represented element. Always
 *                             inside the element's horizontal+depth bounds.
 *   fp = focus position     → a point of interest INSIDE the element's bounds.
 *   cp = camera start/end   → the elevated vantage the camera flies to and ends
 *                             at (Req 8.3). nav.js also projects each feature's
 *                             hotspot ring to this anchor.
 *
 * selectFeat() flies the camera POSITION to `cp` and the look-at to `ft`, so a
 * transition ends with the camera at `cp` oriented toward `ft` (Req 8.3).
 * `fp` and `ft` are kept within the represented element's bounds (Req 8.1).
 * The overview ('10') vantage is pulled far back over the water and high enough
 * that the whole port (yard, roads, quay, berths) stays in view (Req 8.4).
 *
 * Values derive from layout.js accessors, so they track the expanded layout
 * automatically instead of relying on the old hardcoded numbers.
 */
/* frame() — the core framing primitive (fixes the mis-framing bug).
 *
 * Given an element's axis-aligned footprint {minX,maxX,minZ,maxZ}, a viewing
 * direction `dir` (a 3-D vector pointing from the element CENTER toward where
 * the camera should sit; its y component supplies the elevation), and a margin,
 * it returns { cp, ft } where:
 *   ft = the element CENTER (look-at, on the ground plane) — always inside the
 *        element's bounds (Req 8.1).
 *   cp = the camera position placed back along `dir` by a distance computed so
 *        the element's WHOLE horizontal + depth extent fits inside the camera
 *        frustum for the active fov/aspect (Req 8.4). The distance scales with
 *        the element's bounding radius — it is NOT a fixed offset — which is the
 *        root-cause fix for the old hand-picked offsets.
 *
 * Fit math: model the footprint as a disc of radius = half the footprint
 * diagonal. To fit a disc of radius r centered on the look-at into a symmetric
 * half-angle θ, the camera must be at straight-line distance ≥ r / tan(θ). The
 * binding half-angle is the SMALLER of the vertical half-fov and the horizontal
 * half-fov (horizontal = atan(tan(vfov/2)·aspect)). For a wide viewport the
 * vertical fov binds; for a narrow one the horizontal does. We take the larger
 * of the two required distances so both axes are guaranteed to fit, then apply
 * the safety margin and a small bump for the element's vertical height.
 */
const VFOV = ((camera && camera.fov) || 44) * Math.PI / 180; // vertical fov (rad)
// Conservative aspect: never assume wider than 1.6, so a window narrower than
// the build-time aspect (e.g. after a resize) still keeps the element framed.
const ASPECT = Math.max(0.2, Math.min((camera && camera.aspect) || 1.6, 1.6));
const HHALF = Math.atan(Math.tan(VFOV / 2) * ASPECT);        // horizontal half-fov

function frame(elem, dir, margin = 1.3, elemHeight = 24) {
  const cx = (elem.minX + elem.maxX) / 2;
  const cz = (elem.minZ + elem.maxZ) / 2;
  const ex = elem.maxX - elem.minX;
  const ez = elem.maxZ - elem.minZ;
  const radius = 0.5 * Math.hypot(ex, ez);          // half the footprint diagonal
  const distV = radius / Math.tan(VFOV / 2);         // fit to vertical fov
  const distH = radius / Math.tan(HHALF);            // fit to horizontal fov
  // Straight-line camera distance that satisfies BOTH axes, plus margin + a
  // little extra for the element's vertical bulk.
  const dist = Math.max(distV, distH) * margin + 0.5 * elemHeight;
  // Normalize the full 3-D direction so `dist` is the true camera→center range
  // (using the 3-D length keeps the horizontal projection ≤ dist, so the fit
  // guarantee above stays conservative even with the elevated vantage).
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const ux = dir.x / len, uy = dir.y / len, uz = dir.z / len;
  return {
    cp: [cx + ux * dist, Math.max(15, uy * dist), cz + uz * dist],
    ft: [cx, 5, cz],
    fp: [cx, 5, cz],
    center: [cx, cz],
    dist,
  };
}

function buildPresets() {
  const ap = apronBounds();
  const bx = berthX();
  const gate = gatePosition();

  // ── Element bounds (horizontal x / depth z) per represented feature ──────
  // All bounds derive from layout.js so they track the expanded layout.

  // '01' Berth coordination → the berth line / quay band, full quay width.
  const berths = {
    minX: bx[0], maxX: bx[bx.length - 1],
    minZ: PARAMS.BERTH_Z, maxZ: PARAMS.QUAY_Z,
  };
  // '02' Container yard → the block-grid footprint.
  const yard = {
    minX: blockCenterX(0) - PARAMS.BLOCK_W / 2,
    maxX: blockCenterX(PARAMS.COLS - 1) + PARAMS.BLOCK_W / 2,
    minZ: blockCenterZ(0) - PARAMS.BLOCK_D / 2,
    maxZ: blockCenterZ(PARAMS.ROWS - 1) + PARAMS.BLOCK_D / 2,
  };
  // '03' Gate → a box ±35 around the landward gate position.
  const gateB = {
    minX: gate.x - 35, maxX: gate.x + 35,
    minZ: gate.z - 35, maxZ: gate.z + 35,
  };
  // '05' Security/radar → the relocated radar station. env/buildings.js places
  // it at x = apronBounds().maxX + 17 (= ab.maxX + RADAR_CLEAR + RADAR_HALF),
  // z ≈ horizRoadZ()[0] (the front waterfront band, ~12). horizRoadZ isn't
  // imported here, so approximate z ≈ 12. Frame a ±40 box around that point.
  const RADAR = { x: ap.maxX + 17, z: 12 };
  const radar = {
    minX: RADAR.x - 40, maxX: RADAR.x + 40,
    minZ: RADAR.z - 40, maxZ: RADAR.z + 40,
  };
  // '08' Environment → the waterfront band, from the berth line up to the yard
  // front edge; framed broadly.
  const water = {
    minX: bx[0], maxX: bx[bx.length - 1],
    minZ: PARAMS.BERTH_Z, maxZ: yard.minZ,
  };
  // '09' Energy/warehouses → the landward warehouse + rooftop-solar band.
  // env/buildings.js & env/energy.js place the warehouses at z = apronBounds()
  // .maxZ + 26 and x = ±140; frame a box around (±150 x, that z ±30).
  const WH_Z = ap.maxZ + 26;
  const energy = {
    minX: -150, maxX: 150,
    minZ: WH_Z - 30, maxZ: WH_Z + 30,
  };
  // '10' Overview → the FULL port: union of the yard grid, the road/apron, the
  // quay and the berths (Req 8.4).
  const full = {
    minX: Math.min(ap.minX, bx[0]), maxX: Math.max(ap.maxX, bx[bx.length - 1]),
    minZ: Math.min(PARAMS.BERTH_Z, ap.minZ), maxZ: ap.maxZ,
  };

  // ── Compose presets from frame(), one viewing direction per feature ──────
  // dir = {x,y,z}: x/z choose the ground vantage, y the elevation. With these
  // ratios the camera looks down ~35–42°, elevated, as required.
  const p01 = frame(berths, { x: 0, y: 0.7, z: -1 }, 1.3, 16);   // from the water (−z)
  const p02 = frame(yard, { x: 0.7, y: 0.9, z: 0.8 }, 1.3, 22);  // elevated corner (+x,+z)
  const p03 = frame(gateB, { x: 0, y: 0.75, z: 1 }, 1.3, 20);    // city side (+z)
  const p05 = frame(radar, { x: 0.8, y: 0.7, z: -0.5 }, 1.3, 40);// waterfront-east vantage
  const p08 = frame(water, { x: 0, y: 0.6, z: -1 }, 1.35, 14);   // broad, from the water
  const p09 = frame(energy, { x: 0, y: 0.75, z: 1 }, 1.3, 26);   // city side (+z)
  const p10 = frame(full, { x: 0, y: 0.9, z: -1 }, 1.35, 60);    // from water, high, landward

  return {
    '01': { cp: p01.cp, fp: p01.fp, ft: p01.ft },
    '02': { cp: p02.cp, fp: p02.fp, ft: p02.ft },
    '03': { cp: p03.cp, fp: p03.fp, ft: p03.ft },
    '05': { cp: p05.cp, fp: p05.fp, ft: p05.ft },
    '08': { cp: p08.cp, fp: p08.fp, ft: p08.ft },
    '09': { cp: p09.cp, fp: p09.fp, ft: p09.ft },
    '10': { cp: p10.cp, fp: p10.fp, ft: p10.ft },
  };
}

const PRESETS = buildPresets();

export function getPreset(id) {
  return PRESETS[id] || { cp: [0, 0, 0], fp: [0, 0, 0], ft: [0, 0, 0] };
}

let hlMeshes = [];
let autoPlayTimer = null, isAutoPlaying = false;
let flyAf = null;

function stopAutoPlay() {
  if (autoPlayTimer) clearInterval(autoPlayTimer);
  isAutoPlaying = false;
  const btn = document.getElementById('btn-autoplay');
  if (btn) {
    btn.classList.remove('playing');
    btn.textContent = '▶ Auto-play';
  }
  document.querySelectorAll('.stp-vis').forEach(e => e.remove());
}

export function selectFeat(i, orbit, berthMeshes, containerMeshes, gateg, radarG, buoyMeshes, shorePowerGroup, scanPlane) {
  const f = FEATS[i];
  const preset = getPreset(f.id);
  document.querySelectorAll('.fn').forEach((b, j) => b.classList.toggle('on', j === i));
  hsEls.forEach((h, j) => h.el.classList.toggle('active', j === i));
  document.body.classList.add('has-active-feat');
  // End the transition at the preset's start position cp, oriented toward ft (Req 8.3).
  flyTo(new THREE.Vector3(...preset.cp), new THREE.Vector3(...preset.ft), orbit);
  panel.classList.add('open');
  document.getElementById('pnum').textContent = `TÍNH NĂNG ${f.id}`;
  document.getElementById('pnum').style.color = f.color;
  document.getElementById('ptitle').textContent = f.name;
  document.getElementById('psub').textContent = f.desc;

  stopAutoPlay();

  const ppainBox = document.getElementById('ppain-box');
  const ppain = document.getElementById('ppain');
  const pmechBox = document.getElementById('pmech-box');
  const pmech = document.getElementById('pmech');
  const pdetails = document.getElementById('pdetails');

  let hasDetails = false;
  if (f.painPoints) { ppain.textContent = f.painPoints; ppainBox.style.display = 'block'; hasDetails = true; } else { ppainBox.style.display = 'none'; }
  if (f.mechanism) { pmech.textContent = f.mechanism; pmechBox.style.display = 'block'; hasDetails = true; } else { pmechBox.style.display = 'none'; }

  if (hasDetails) {
    pdetails.style.display = 'block';
    pdetails.removeAttribute('open');
  } else {
    pdetails.style.display = 'none';
  }

  const tagEl = document.getElementById('ptag');
  tagEl.textContent = `GIAI ĐOẠN ${f.phase}`;
  tagEl.style.cssText = `background:${PC[f.phase]}18;border:1px solid ${PC[f.phase]}44;color:${PC[f.phase]};display:inline-block;font-family:Arial,sans-serif;font-size:10.5px;font-weight:600;padding:4px 9px;border-radius:5px;letter-spacing:.1em;margin-bottom:16px`;
  const mm = document.getElementById('pmets'); mm.innerHTML = '';
  f.mets.forEach(([l, v]) => { const d = document.createElement('div'); d.className = 'met'; d.innerHTML = `<div class="mv" style="color:${f.color}">${v}</div><div class="ml">${l}</div>`; mm.appendChild(d); });

  const ss = document.getElementById('psteps');
  if (ss) {
    ss.innerHTML = '';
    f.steps.forEach((s, si) => {
      const d = document.createElement('div');
      d.className = 'stp';
      d.style.setProperty('--c', f.color);
      const title = typeof s === 'object' ? s.title : s;
      const desc = typeof s === 'object' ? s.desc : '';
      d.innerHTML = `<div class="stp-header"><div class="n">${si + 1}</div><span class="t">${title}</span></div>${desc ? '<div class="stp-desc">' + desc + '</div>' : ''}`;
      ss.appendChild(d);
    });

    const stpEls = ss.querySelectorAll('.stp');
    function activateStep(idx) {
      stpEls.forEach((el, j) => {
        el.classList.toggle('active', j === idx);
        const vis = el.querySelector('.stp-vis');
        if (vis) vis.remove();
      });
      const activeEl = stpEls[idx];
      if (activeEl) {
        if (isAutoPlaying) {
          const descEl = activeEl.querySelector('.stp-desc');
          if (descEl) {
            const vis = document.createElement('div');
            vis.className = 'stp-vis';
            descEl.appendChild(vis);
          }
        }
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    stpEls.forEach((el, idx) => { el.onclick = () => { stopAutoPlay(); activateStep(idx); }; });

    const btnAutoPlay = document.getElementById('btn-autoplay');
    if (btnAutoPlay) {
      btnAutoPlay.onclick = () => {
        if (isAutoPlaying) {
          stopAutoPlay();
        } else {
          isAutoPlaying = true;
          btnAutoPlay.classList.add('playing');
          btnAutoPlay.textContent = '⏹ Dừng Auto-play';
          let currentStep = 0;
          activateStep(0);
          autoPlayTimer = setInterval(() => {
            currentStep++;
            if (currentStep >= stpEls.length) {
              stopAutoPlay();
              return;
            }
            activateStep(currentStep);
          }, 3000); // 3 seconds per step
        }
      };
    }
  }

  const leftSidebar = document.getElementById('left-sidebar');
  leftSidebar.style.setProperty('--cc', f.color);
  leftSidebar.classList.remove('open');

  renderFeatureCharts(f);

  if (f.id === '10') {
    // Overview: the computed '10' preset already framed the whole port above;
    // no element highlight for the overview.
    resetHL();
  } else {
    highlightFeat(i, f.color, berthMeshes, containerMeshes, gateg, radarG, buoyMeshes, shorePowerGroup);
  }
  setCallouts(i);
  const sa = f.id === '05';
  setScanActive(sa);
  scanPlane.visible = sa;
}

function setEmissive(m, col) {
  if (!m || !m.isMesh || !m.material || !m.material.emissive) return;
  const orig = m.material;
  const cl = orig.clone(); cl.emissive.copy(col); cl.emissiveIntensity = 0.6;
  m.material = cl; hlMeshes.push({ mesh: m, orig });
}

export function highlightFeat(fi, col, berthMeshes, containerMeshes, gateg, radarG, buoyMeshes, shorePowerGroup) {
  resetHL();
  const c = new THREE.Color(col).multiplyScalar(.15);
  const setG = (g) => { if (g) g.traverse(m => setEmissive(m, c)); };
  if (fi === 0) { if (berthMeshes) berthMeshes.forEach(m => setEmissive(m, c)); }
  else if (fi === 1) { if (containerMeshes) containerMeshes.forEach(m => setEmissive(m, c)); }
  else if (fi === 2) setG(gateg);
  else if (fi === 3) setG(radarG);
  else if (fi === 4) {
    if (buoyMeshes) buoyMeshes.forEach(m => setEmissive(m, c));
    setG(shorePowerGroup);
  }
}

export function resetHL() {
  hlMeshes.forEach(({ mesh, orig }) => { const c = mesh.material; mesh.material = orig; if (c && c !== orig && c.dispose) c.dispose(); });
  hlMeshes = [];
}

// dur defaults to 2000 ms so every preset transition completes within 2 s (Req 8.2).
export function flyTo(tPos, tLook, orbit, dur = 2000) {
  if (flyAf) cancelAnimationFrame(flyAf);
  const sp2 = camera.position.clone(), sl = orbit.target.clone(), st = performance.now();
  const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  (function tk() {
    const p = Math.min((performance.now() - st) / dur, 1), et = eio(p);
    camera.position.lerpVectors(sp2, tPos, et); orbit.target.lerpVectors(sl, tLook, et); orbit.update();
    if (p < 1) flyAf = requestAnimationFrame(tk);
  })();
}
