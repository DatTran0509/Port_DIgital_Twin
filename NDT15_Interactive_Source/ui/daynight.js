import { scene, M, ambLight, hemiLight, sun, renderer, portLights, camLight } from '../core.js';
import { berthMats } from '../ships.js';
import { blockMats } from '../yard.js';
import { screenMat } from '../gate.js';
import { trucks } from '../trucks.js';

// Wires up the day/night toggle button and applies the initial day-mode state.
// Behavior-preserving extraction of the day/night block from initUI in ui.js.
export function initDayNight() {
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
}
