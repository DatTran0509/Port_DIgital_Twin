import * as THREE from 'three';
import { scene, camera, M, ambLight, hemiLight, sun, renderer, portLights, camLight } from './core.js';
import { vessels, berthMats } from './ships.js';
import { blockMats } from './yard.js';
import { screenMat } from './gate.js';
import { trucks } from './trucks.js';

export const hsEls = [];
export const coEls = [];
let hlMeshes = [];
let scanActive = false;
let pChart = null, pChart2 = null, pChart3 = null, autoPlayTimer = null, isAutoPlaying = false;
let flyAf = null;
const FEATS = window.FEATS;
const PC = window.PC;
const nav = document.getElementById('fnav');
const hsLayer = document.getElementById('hslayer');
const coLayer = document.getElementById('colayer');
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

    hsEls.push({ el: hs, pos: new THREE.Vector3(...f.cp) });
  });

  document.getElementById('pcls').onclick = () => {
    panel.classList.remove('open'); resetHL();
    document.querySelectorAll('.fn').forEach(b => b.classList.remove('on'));
    setCallouts(null);
    document.getElementById('left-sidebar').classList.remove('open');
    scanActive = false; scanPlane.visible = false;
    document.body.classList.remove('has-active-feat');
    hsEls.forEach(h => h.el.classList.remove('active'));
  };

  let isDay = true;
  document.getElementById('dn-toggle').textContent = '☾ Night Mode';
  document.body.classList.add('day-mode');
  renderer.toneMappingExposure = 0.6;

  document.getElementById('dn-toggle').onclick = (e) => {
    isDay = !isDay;
    e.target.textContent = isDay ? '☾ Night Mode' : '☀ Day Mode';
    document.body.classList.toggle('day-mode', isDay);
    if (isDay) {
      renderer.toneMappingExposure = 0.8;
      ambLight.color.setHex(0xffffff); ambLight.intensity = 0.8;
      hemiLight.color.setHex(0xffffff); hemiLight.groundColor.setHex(0x444444); hemiLight.intensity = 0.8;
      sun.intensity = 1.8;
      camLight.intensity = 1.0;
      if (scene.backgroundIntensity !== undefined) scene.backgroundIntensity = 1.0;
      if (scene.environmentIntensity !== undefined) scene.environmentIntensity = 0.8;
      portLights.visible = false;
      M.mark.emissiveIntensity = 0; M.barr.emissiveIntensity = 0; M.radar.emissiveIntensity = 0; M.buoy.emissiveIntensity = 0; M.gate.emissiveIntensity = 0;
      trucks.forEach(tk => { if (tk.hl && tk.hl.mats) tk.hl.mats.forEach(m => m.emissiveIntensity = 0) });
      berthMats.forEach(m => m.color.setScalar(1));
      blockMats.forEach(m => m.color.setScalar(1));
      screenMat.color.setScalar(1);
    } else {
      renderer.toneMappingExposure = 0.3; // Night EXR handles the darkness
      ambLight.color.setHex(0x28456b); ambLight.intensity = 0.1;
      hemiLight.color.setHex(0x2a4c7c); hemiLight.groundColor.setHex(0x101f35); hemiLight.intensity = 0.1;
      sun.intensity = 0.0; // Moon light essentially
      camLight.intensity = 0.0; // Tắt đèn camera vào ban đêm
      if (scene.backgroundIntensity !== undefined) scene.backgroundIntensity = 0.3;
      if (scene.environmentIntensity !== undefined) scene.environmentIntensity = 0.3;
      portLights.visible = true;
      M.mark.emissiveIntensity = 0.18; M.barr.emissiveIntensity = 0.25; M.radar.emissiveIntensity = 0.7; M.buoy.emissiveIntensity = 0.5; M.gate.emissiveIntensity = 0.8;
      trucks.forEach(tk => { if (tk.hl && tk.hl.mats) tk.hl.mats.forEach(m => m.emissiveIntensity = 2.0) });
      berthMats.forEach(m => m.color.setScalar(5));
      blockMats.forEach(m => m.color.setScalar(5));
      screenMat.color.setScalar(5);
    }
  };

  let uiHidden = false;
  document.getElementById('ui-toggle').onclick = (e) => {
    uiHidden = !uiHidden;
    e.target.textContent = uiHidden ? '👁 Show UI' : '👁 Hide UI';
    document.body.classList.toggle('hide-ui', uiHidden);
  };
}

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

function selectFeat(i, orbit, berthMeshes, containerMeshes, gateg, radarG, buoyMeshes, shorePowerGroup, scanPlane) {
  const f = FEATS[i];
  document.querySelectorAll('.fn').forEach((b, j) => b.classList.toggle('on', j === i));
  hsEls.forEach((h, j) => h.el.classList.toggle('active', j === i));
  document.body.classList.add('has-active-feat');
  flyTo(new THREE.Vector3(...f.fp), new THREE.Vector3(...f.ft), orbit);
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

  if (pChart) pChart.destroy();
  if (pChart2) pChart2.destroy();
  if (pChart3) pChart3.destroy();
  const c1w = document.getElementById('pchart-wrapper');
  const c2w = document.getElementById('pchart2-wrapper');
  const c3w = document.getElementById('pchart3-wrapper');
  if (c1w) c1w.style.display = 'none';
  if (c2w) c2w.style.display = 'none';
  if (c3w) c3w.style.display = 'none';

  Chart.defaults.color = '#aabccf';
  Chart.defaults.borderColor = '#2a3b50';
  Chart.defaults.font.family = 'Inter, Arial, sans-serif';

  // Custom plugin to add a subtle glow
  const glowPlugin = {
    id: 'glow',
    beforeDraw: (chart) => {
      const ctx = chart.ctx;
      ctx.save();
      const glow = chart.config.options?.plugins?.glow;
      if (glow) {
        ctx.shadowColor = glow.color || 'rgba(0,0,0,0)';
        ctx.shadowBlur = glow.blur || 0;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
      }
      ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    },
    afterDraw: (chart) => { chart.ctx.restore(); }
  };
  Chart.register(glowPlugin);

  const commonOpt = (title) => ({
    responsive: true,
    plugins: {
      title: { display: true, text: title, color: '#fff', font: { size: 14, weight: 'bold' }, padding: { bottom: 15 } },
      legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true, color: '#ccc' } }
    }
  });

  if (f.id === '01') {
    leftSidebar.classList.add('open');
    if (c1w) c1w.style.display = 'block';
    if (c2w) c2w.style.display = 'block';

    pChart = new Chart(document.getElementById('pchart'), {
      type: 'line',
      data: {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
        datasets: [
          { label: 'Lưu lượng thực tế', data: [8, 4, 2, 6, 12, 7, 5], borderColor: f.color, backgroundColor: f.color + '40', tension: 0.4, fill: true },
          { label: 'Dự báo AI (JIT)', data: [7, 5, 3, 5, 10, 6, 6], borderColor: '#B07CFF', borderDash: [5, 5], tension: 0.4 }
        ]
      },
      options: { ...commonOpt('Mật độ Tàu Chờ Phao Số 0'), scales: { y: { beginAtZero: true } } }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'bar',
      data: {
        labels: ['Bến 1', 'Bến 2', 'Bến 3', 'Bến 4', 'Bến 5', 'Bến 6'],
        datasets: [{ label: 'Công suất bốc dỡ (TEU/h)', data: [120, 145, 90, 180, 150, 110], backgroundColor: '#F8B23C', borderRadius: 4 }]
      },
      options: { ...commonOpt('Hiệu Suất Cẩu STS Theo Bến'), scales: { y: { beginAtZero: true } } }
    });
  } else if (f.id === '02') {
    leftSidebar.classList.add('open');
    if (c1w) c1w.style.display = 'block';
    if (c2w) c2w.style.display = 'block';

    pChart = new Chart(document.getElementById('pchart'), {
      type: 'doughnut',
      data: {
        labels: ['Trống', 'Hàng Khô', 'Hàng Lạnh (Reefer)', 'Nguy Hiểm (IMDG)'],
        datasets: [{ data: [15, 60, 20, 5], backgroundColor: ['#2a3b50', f.color, '#34E0F0', '#FF5468'], borderWidth: 0 }]
      },
      options: { ...commonOpt('Cơ Cấu Sức Chứa Bãi (Theo Loại)'), cutout: '70%' }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'line',
      data: {
        labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
        datasets: [
          { label: 'Nhập (Import)', data: [4500, 5200, 4800, 6100, 5900, 4200, 3100], borderColor: '#15D8A4', tension: 0.3 },
          { label: 'Xuất (Export)', data: [3800, 4100, 5500, 4900, 6500, 5100, 2800], borderColor: '#B07CFF', tension: 0.3 }
        ]
      },
      options: { ...commonOpt('Lưu Lượng TEU Ra/Vào Bãi'), scales: { y: { beginAtZero: true } } }
    });
  } else if (f.id === '03') {
    leftSidebar.classList.add('open');
    if (c1w) c1w.style.display = 'block';
    if (c2w) c2w.style.display = 'block';

    pChart = new Chart(document.getElementById('pchart'), {
      type: 'bar',
      data: {
        labels: ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
        datasets: [
          { label: 'Xe có Booking', data: [120, 350, 280, 410, 220, 90], backgroundColor: f.color },
          { label: 'Xe Vãng Lai', data: [40, 80, 110, 95, 60, 20], backgroundColor: '#FF5468' }
        ]
      },
      options: { ...commonOpt('Tần Suất Xe Tải Qua Cổng'), scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'line',
      data: {
        labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
        datasets: [{ label: 'Thời gian chờ trung bình (Phút)', data: [12, 10, 8, 5, 2.5, 1.8], borderColor: '#F8B23C', backgroundColor: 'rgba(248,178,60,0.2)', fill: true, tension: 0.4 }]
      },
      options: { ...commonOpt('Hiệu Quả AI - Giảm Thời Gian Chờ') }
    });
  } else if (f.id === '05') {
    leftSidebar.classList.add('open');
    if (c1w) c1w.style.display = 'block';
    if (c2w) c2w.style.display = 'block';

    pChart = new Chart(document.getElementById('pchart'), {
      type: 'polarArea',
      data: {
        labels: ['Vùng Bắc', 'Vùng Nam', 'Luồng Lạch', 'Khu Bến'],
        datasets: [{ data: [12, 5, 28, 8], backgroundColor: ['#34E0F070', '#15D8A470', '#FF546870', '#F8B23C70'], borderWidth: 1, borderColor: '#fff' }]
      },
      options: { ...commonOpt('Phát Hiện Xâm Nhập (30 Ngày)'), scales: { r: { ticks: { display: false }, grid: { color: '#334' } } } }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'bar',
      data: {
        labels: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'],
        datasets: [
          { label: 'Tuần Tra Tự Động (UAV)', data: [45, 50, 48, 55], backgroundColor: '#B07CFF', borderRadius: 2 },
          { label: 'Canô Thủ Công', data: [20, 15, 12, 8], backgroundColor: '#FF5468', borderRadius: 2 }
        ]
      },
      options: { ...commonOpt('Chuyển Đổi Phương Thức Tuần Tra') }
    });
  } else if (f.id === '08') {
    leftSidebar.classList.add('open');
    if (c1w) c1w.style.display = 'block';
    if (c2w) c2w.style.display = 'block';

    pChart = new Chart(document.getElementById('pchart'), {
      type: 'doughnut',
      data: {
        labels: ['CO2 (Carbon)', 'SOx (Lưu Huỳnh)', 'NOx (Nitơ)', 'PM2.5 (Bụi Mịn)'],
        datasets: [{ data: [65, 12, 18, 5], backgroundColor: ['#FF5468', '#F8B23C', '#34E0F0', '#B07CFF'], borderWidth: 0 }]
      },
      options: { ...commonOpt('Phân Bổ Khí Thải (Real-time)'), cutout: '65%' }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'line',
      data: {
        labels: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6'],
        datasets: [
          { label: 'Chỉ số WQI (Nước Biển)', data: [75, 78, 82, 80, 85, 88], borderColor: '#15D8A4', tension: 0.4 },
          { label: 'Mục Tiêu ESG', data: [80, 80, 80, 80, 80, 80], borderColor: '#FF5468', borderDash: [5, 5], pointRadius: 0 }
        ]
      },
      options: { ...commonOpt('Cải Thiện Chất Lượng Nước Biển (WQI)') }
    });
  } else if (f.id === '09') {
    leftSidebar.classList.add('open');
    if (c1w) c1w.style.display = 'block';
    if (c2w) c2w.style.display = 'block';

    pChart = new Chart(document.getElementById('pchart'), {
      type: 'line',
      data: {
        labels: ['06:00', '09:00', '12:00', '15:00', '18:00'],
        datasets: [
          { label: 'Điện Mặt Trời (MW)', data: [0.5, 2.2, 3.5, 2.8, 0.4], borderColor: '#F8B23C', backgroundColor: 'rgba(248,178,60,0.1)', fill: true, tension: 0.3 },
          { label: 'Tiêu Thụ (MW)', data: [1.2, 2.5, 2.8, 3.0, 2.2], borderColor: '#FF5468', borderDash: [5, 2], tension: 0.3 }
        ]
      },
      options: { ...commonOpt('Cung - Cầu Năng Lượng Tái Tạo (Day)') }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'bar',
      data: {
        labels: ['Cẩu STS', 'Cẩu Bãi eRTG', 'Chiếu Sáng', 'Tòa Nhà', 'Điện Bờ (AMP)'],
        datasets: [{ label: 'Tỷ lệ tiêu thụ (%)', data: [35, 25, 10, 5, 25], backgroundColor: ['#34E0F0', '#15D8A4', '#B07CFF', '#F8B23C', '#FF5468'] }]
      },
      options: { ...commonOpt('Phân Bổ Tiêu Thụ Điện Năng'), indexAxis: 'y' }
    });
  } else if (f.id === '10') {
    leftSidebar.classList.add('open');
    if (c1w) c1w.style.display = 'block';
    if (c2w) c2w.style.display = 'block';

    pChart = new Chart(document.getElementById('pchart'), {
      type: 'bar',
      data: {
        labels: ['2023', '2024', '2025', '2026 (Dự Kiến)'],
        datasets: [
          { label: 'Sản Lượng Cảng (Triệu TEU)', data: [5.2, 6.8, 8.5, 11.2], backgroundColor: '#15D8A4' }
        ]
      },
      options: { ...commonOpt('Tăng Trưởng Sản Lượng Logistics') }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'doughnut',
      data: {
        labels: ['Nội Địa', 'Châu Á', 'Châu Âu', 'Châu Mỹ'],
        datasets: [{ data: [20, 45, 20, 15], backgroundColor: ['#F8B23C', '#34E0F0', '#B07CFF', '#FF5468'], borderWidth: 0 }]
      },
      options: { ...commonOpt('Tỷ Trọng Tuyến Dịch Vụ'), cutout: '50%' }
    });
  }

  if (f.id === '10') {
    flyTo(new THREE.Vector3(150, 80, 280), new THREE.Vector3(0, 0, 0), orbit);
    resetHL();
  } else {
    highlightFeat(i, f.color, berthMeshes, containerMeshes, gateg, radarG, buoyMeshes, shorePowerGroup);
  }
  setCallouts(i);
  scanActive = f.id === '05';
  scanPlane.visible = scanActive;
}

function setEmissive(m, col) {
  if (!m || !m.isMesh || !m.material || !m.material.emissive) return;
  const orig = m.material;
  const cl = orig.clone(); cl.emissive.copy(col); cl.emissiveIntensity = 0.6;
  m.material = cl; hlMeshes.push({ mesh: m, orig });
}

function highlightFeat(fi, col, berthMeshes, containerMeshes, gateg, radarG, buoyMeshes, shorePowerGroup) {
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

function resetHL() {
  hlMeshes.forEach(({ mesh, orig }) => { const c = mesh.material; mesh.material = orig; if (c && c !== orig && c.dispose) c.dispose(); });
  hlMeshes = [];
}

function flyTo(tPos, tLook, orbit, dur = 2200) {
  if (flyAf) cancelAnimationFrame(flyAf);
  const sp2 = camera.position.clone(), sl = orbit.target.clone(), st = performance.now();
  const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  (function tk() {
    const p = Math.min((performance.now() - st) / dur, 1), et = eio(p);
    camera.position.lerpVectors(sp2, tPos, et); orbit.target.lerpVectors(sl, tLook, et); orbit.update();
    if (p < 1) flyAf = requestAnimationFrame(tk);
  })();
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

export function isScanActive() { return scanActive; }

export function showObjectInfo(data, type) {
  const panel = document.getElementById('obj-info-panel');
  if (!panel) return;
  document.getElementById('obj-icon').textContent = data.icon || '📦';
  document.getElementById('obj-name').textContent = data.name || 'Unknown';
  document.getElementById('obj-subtitle').textContent = data.subtitle || type.toUpperCase();
  
  const content = document.getElementById('obj-content');
  content.innerHTML = '';
  if (data.details) {
    for (const [key, val] of Object.entries(data.details)) {
      const row = document.createElement('div');
      row.className = 'obj-row';
      row.innerHTML = `<span class="obj-lbl">${key}</span><span class="obj-val">${val}</span>`;
      content.appendChild(row);
    }
  }
  panel.classList.add('visible');
}

export function hideObjectInfo() {
  const panel = document.getElementById('obj-info-panel');
  if (panel) panel.classList.remove('visible');
}
