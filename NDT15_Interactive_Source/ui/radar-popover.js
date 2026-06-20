export function showRadarShipPopover(v, idx) {
  let popover = document.getElementById('radar-ship-popover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'radar-ship-popover';
    popover.className = 'radar-ship-popover';
    const mapArea = document.querySelector('.radar-circle-wrapper');
    if (mapArea) mapArea.appendChild(popover);
  }

  popover.dataset.shipIdx = idx;

  const prgPct = (v && v.ps) ? (v.ps.prgPct * 100) : 0;
  const progressTxt = (v && v.ps) ? v.ps.progress : '';
  const etaTxt = (v && v.ps) ? v.ps.etaText : '';

  let routeHtml = '';
  if (v.data.route) {
    routeHtml = `
    <div class="ship-route-panel" style="margin-top: 10px; border: none; padding-top: 0;">
      <div class="rt-status-bar" style="margin-bottom: 12px; padding: 4px 8px;">
         <span class="timeline-status-text">${progressTxt}</span>
         <span class="timeline-eta-text">${etaTxt}</span>
      </div>
      <div class="rt-track-container" style="height: 30px; margin: 0 10px 10px 10px;">
         <div class="rt-track-line"></div>
         <div class="rt-node start"><div class="rt-node-dot"></div><div class="rt-node-lbl" style="font-size:9px;">${v.data.route[0].port}</div></div>
         <div class="rt-node mid"><div class="rt-node-dot active"></div><div class="rt-node-lbl" style="font-size:9px;">${v.data.route[1].port}</div></div>
         <div class="rt-node end"><div class="rt-node-dot"></div><div class="rt-node-lbl" style="font-size:9px;">${v.data.route[2].port}</div></div>
         <div class="timeline-dot-moving" style="left: ${prgPct}%; font-size:14px;">🚢</div>
      </div>
    </div>`;
  }

  popover.innerHTML = `
    <div class="popover-close" onclick="document.getElementById('radar-ship-popover').remove()">✕</div>
    <div class="popover-header">
      <div class="popover-title">${v.data.name}</div>
      <div class="popover-subtitle">${v.data.details ? v.data.details['Loại hàng'] : 'N/A'}</div>
    </div>
    ${routeHtml}
  `;
}
