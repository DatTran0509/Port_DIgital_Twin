import { vessels } from '../ships.js';
import { showRadarShipPopover } from './radar-popover.js';

export let activeObjType = null;
export let activeObjData = null;

export function updateActivePanels(el) {
  const panel = document.getElementById('obj-info-panel');
  if (!panel || !panel.classList.contains('visible')) return;

  if (activeObjType === 'radar') {
    vessels.forEach((v, i) => {
      if (!v.ps) return;
      const blip = document.getElementById('r-blip-' + i);
      if (blip) {
        const dx = v.ps.x - 284;
        const dz = v.ps.z - 2;
        // Range 800 units mapped to 0-100%
        const pctX = 50 + (dx / 800) * 50;
        const pctY = 50 + (dz / 800) * 50;
        blip.style.left = pctX + '%';
        blip.style.top = pctY + '%';
      }
    });

    const popover = document.getElementById('radar-ship-popover');
    if (popover) {
      const idx = parseInt(popover.dataset.shipIdx);
      const v = vessels[idx];
      if (v && v.ps) {
         const dx = v.ps.x - 284;
         const dz = v.ps.z - 2;
         const pctX = 50 + (dx / 800) * 50;
         const pctY = 50 + (dz / 800) * 50;
         // Position popover near the blip, relative to radar map area
         // Since .radar-map-area is flex centering .radar-circle (400x400)
         // We can position the popover absolute to map area if we calculate properly,
         // but wait, map area isn't position:relative, radar-circle is.
         // Let's just append popover to radar-circle in showRadarShipPopover instead.
         popover.style.left = `calc(${pctX}% + 15px)`;
         popover.style.top = `calc(${pctY}% - 50px)`;

         const dot = popover.querySelector('.timeline-dot-moving');
         const statusText = popover.querySelector('.timeline-status-text');
         const etaText = popover.querySelector('.timeline-eta-text');
         if (dot && statusText && etaText) {
            dot.style.left = (v.ps.prgPct * 100) + '%';
            statusText.textContent = v.ps.progress;
            etaText.textContent = v.ps.etaText;
         }
      }
    }
  } else if (activeObjType === 'ship' && activeObjData && activeObjData.route) {
    const v = vessels.find(vs => vs.data === activeObjData);
    if (v && v.ps) {
      const dot = panel.querySelector('.timeline-dot-moving');
      const statusText = panel.querySelector('.timeline-status-text');
      const etaText = panel.querySelector('.timeline-eta-text');
      if (dot && statusText && etaText) {
        dot.style.left = (v.ps.prgPct * 100) + '%';
        statusText.textContent = v.ps.progress;
        etaText.textContent = v.ps.etaText;
      }
    }
  }
}

export function showObjectInfo(data, type) {
  const panel = document.getElementById('obj-info-panel');
  if (!panel) return;
  panel.classList.remove('radar-mode');
  activeObjType = type;
  activeObjData = data;

  if (type === 'radar') {
    panel.classList.add('radar-mode');
    document.getElementById('obj-icon').textContent = data.icon || '📡';
    document.getElementById('obj-name').textContent = data.name || 'Hệ Thống Radar';
    document.getElementById('obj-subtitle').textContent = data.subtitle || 'GIÁM SÁT HÀNH TRÌNH';

    // Determine alert ship: find the first ship that is holding
    let alertShipIdx = vessels.findIndex(v => v.mode === 'queue' || (v.ps && v.ps.st === 'hold'));
    if (alertShipIdx === -1) alertShipIdx = vessels.length - 1; // Fallback

    // Create blip HTML dynamically
    const blipsHtml = vessels.map((v, i) => {
      const isAlert = i === alertShipIdx;
      return `<div id="r-blip-${i}" class="radar-blip-real ${isAlert ? 'alert' : 'normal'}" title="${v.nm}" data-idx="${i}"></div>`;
    }).join('');

    const content = document.getElementById('obj-content');
    content.innerHTML = `
      <div class="radar-sim-container">
        <div class="radar-map-area">
          <div class="radar-circle-wrapper">
            <div class="radar-circle">
              <div class="radar-crosshair"></div>
              <div class="radar-sweep"></div>
              ${blipsHtml}
            </div>
          </div>
          <div class="radar-footer">RANGE 8.0km · SCAN 4s · ${vessels.length} contacts</div>
        </div>
        <div class="radar-side">
          <div class="radar-box">
            <div class="radar-box-title">● UAV Fleet Status <span style="float:right;color:#666">4 units</span></div>
            <div class="uav-row"><span>UAV-01 <span class="badge ready">READY</span></span><span>DOCK - ready</span></div>
            <div class="uav-row"><span>UAV-02 <span class="badge flying">FLYING</span></span><span>AIRBORNE - 10.52°N</span></div>
            <div class="uav-row"><span>UAV-03 <span class="badge chg">CHG</span></span><span>CHARGE - 68%</span></div>
            <div class="uav-row"><span>UAV-04 <span class="badge ready">READY</span></span><span>DOCK - ready</span></div>
          </div>
          <div class="radar-box alert-cam">
             <div class="cam-box">
               <div class="cam-target"></div>
               <div class="cam-label">UNKNOWN - 120m - 92%</div>
             </div>
             <div class="radar-footer" style="margin-top:10px;text-align:left;">THERMAL · 1 contact · weapon: unknown</div>
          </div>
          <div class="radar-box">
            <div class="radar-box-title">● Event Log <span style="float:right;color:#666">auto</span></div>
            <div class="log-row">02:14 - radar detect</div>
            <div class="log-row">02:14 - UAV-02 launch</div>
            <div class="log-row">02:16 - thermal acquired</div>
            <div class="log-row" style="color:#FF5468;font-weight:bold;">02:17 - alert → center</div>
          </div>
        </div>
      </div>
    `;

    // Bind click events to blips
    setTimeout(() => {
      vessels.forEach((v, i) => {
        const blip = document.getElementById('r-blip-' + i);
        if (blip) {
          blip.onclick = (e) => {
            e.stopPropagation();
            showRadarShipPopover(v, i);
          };
        }
      });
    }, 50);

    // Trigger security alert in 3D scene
    window.dispatchEvent(new CustomEvent('toggle-security-alert', { detail: true }));

  } else {
    // Normal Object Mode
    document.getElementById('obj-icon').textContent = data.icon || '📦';
    document.getElementById('obj-name').textContent = data.name || 'Unknown';
    document.getElementById('obj-subtitle').textContent = data.subtitle || type.toUpperCase();

    const content = document.getElementById('obj-content');
    content.innerHTML = '';

    if (data.route && type === 'ship') {
      const v = vessels.find(vs => vs.data === data);
      const prgPct = (v && v.ps) ? (v.ps.prgPct * 100) : 0;
      const progressTxt = (v && v.ps) ? v.ps.progress : '';
      const etaTxt = (v && v.ps) ? v.ps.etaText : '';

      const routePanel = document.createElement('div');
      routePanel.className = 'ship-route-panel';
      routePanel.innerHTML = `
        <div class="route-title">LỘ TRÌNH TÀU (LIVE)</div>
        <div class="rt-status-bar">
           <span class="timeline-status-text">${progressTxt}</span>
           <span class="timeline-eta-text">${etaTxt}</span>
        </div>
        <div class="rt-track-container">
           <div class="rt-track-line"></div>
           <div class="rt-node start">
             <div class="rt-node-dot"></div>
             <div class="rt-node-lbl">${data.route[0].port}</div>
           </div>
           <div class="rt-node mid">
             <div class="rt-node-dot active"></div>
             <div class="rt-node-lbl">${data.route[1].port}</div>
           </div>
           <div class="rt-node end">
             <div class="rt-node-dot"></div>
             <div class="rt-node-lbl">${data.route[2].port}</div>
           </div>
           <div class="timeline-dot-moving" style="left: ${prgPct}%;">
             🚢
           </div>
        </div>
      `;
      content.appendChild(routePanel);
    }

    const detailsBox = document.createElement('div');
    detailsBox.className = 'obj-details-box';
    if (data.details) {
      for (const [key, val] of Object.entries(data.details)) {
        const row = document.createElement('div');
        row.className = 'obj-row';
        row.innerHTML = `<span class="obj-lbl">${key}</span><span class="obj-val">${val}</span>`;
        detailsBox.appendChild(row);
      }
    }
    content.appendChild(detailsBox);
  }

  panel.classList.add('visible');
}

export function hideObjectInfo() {
  const panel = document.getElementById('obj-info-panel');
  if (panel) panel.classList.remove('visible');
  activeObjType = null;
  activeObjData = null;
  // Turn off alert when panel closes
  window.dispatchEvent(new CustomEvent('toggle-security-alert', { detail: false }));
}
