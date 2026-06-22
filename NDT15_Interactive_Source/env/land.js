// env/land.js — Landmass ground plane, textured with the "coast sand rocks 02"
// PBR set:
//   - coast_sand_rocks_02_diff_1k.jpg   → map (albedo / colour, sRGB)
//   - coast_sand_rocks_02_nor_gl_1k.exr → normalMap (surface relief, OpenGL)
//
// NOT used on purpose:
//   - *_rough_1k.exr : its low-roughness (glossy) pixels made the SUN produce
//     bright sparkly specular glints that tracked the light direction. For a
//     huge background ground we want a fully MATTE surface, so we force
//     roughness = 1.0 and skip the roughness map entirely — this removes the
//     twinkling specks. (Re-add it only if you accept some sun glints.)
//   - *_disp_1k.exr  : displacement needs a finely tessellated mesh to show,
//     which a 20000-unit ground plane can't afford.
//
// Remaining anti-aliasing: max anisotropic filtering + trilinear mipmaps on the
// maps, a gentle normalScale, and damped environment specular.
import * as THREE from 'three';
import { scene, renderer } from '../core.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

const REPEAT = 320;   // tiling across the 20000-unit plane
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

function tile(tex) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(REPEAT, REPEAT);
  tex.anisotropy = MAX_ANISO;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function initLand() {
  const tl = new THREE.TextureLoader();
  const exr = new EXRLoader();
  exr.setDataType(THREE.HalfFloatType);

  // Albedo (colour) — sRGB so the sand/rock hues read correctly.
  const diff = tl.load('assets/coast_sand_rocks_02_diff_1k.jpg', tile);
  diff.colorSpace = THREE.SRGBColorSpace;

  const landMat = new THREE.MeshStandardMaterial({
    map: diff,
    color: 0xffffff,        // no tint → faithful to the diffuse texture
    roughness: 1.0,         // fully matte → no sharp sun glints (no roughnessMap)
    metalness: 0.0,
    envMapIntensity: 0.25,  // damp IBL specular too
  });

  // Normal (relief only) — kept gentle so micro-facets don't mirror the sun.
  exr.load('assets/coast_sand_rocks_02_nor_gl_1k.exr', (n) => {
    landMat.normalMap = tile(n);
    landMat.normalScale.set(0.3, 0.3);
    landMat.needsUpdate = true;
  });

  const landGeo = new THREE.PlaneGeometry(20000, 20000);
  const land = new THREE.Mesh(landGeo, landMat);
  land.rotation.x = -Math.PI / 2;
  land.position.set(0, 0.5, 10000);
  land.receiveShadow = true;
  scene.add(land);
  return land;
}
