// env/sky.js — EXR sky / environment loading (extracted from main.js initEnvironment)
import * as THREE from 'three';
import { scene } from '../core.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

// Loads the equirectangular EXR sky and uses it as both scene background and
// environment map. Behavior preserved exactly from main.js.
export function initSky() {
  const loader = new EXRLoader();
  loader.setDataType(THREE.HalfFloatType);

  loader.load('assets/kloofendal_48d_partly_cloudy_puresky_1k.exr', function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
    if (scene.backgroundIntensity !== undefined) scene.backgroundIntensity = 1.0;
    if (scene.environmentIntensity !== undefined) scene.environmentIntensity = 1.0;
  });
}
