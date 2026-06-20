// env/ocean.js — Water plane + per-frame water time update (from main.js createOceanZone)
import * as THREE from 'three';
import { scene, sun } from '../core.js';
import { Water } from 'three/addons/objects/Water.js';

let water = null;

// Builds the large ocean Water plane. Returns the water mesh so the orchestrator
// can keep a handle. Behavior preserved exactly from main.js.
export function initOcean() {
  const waterGeometry = new THREE.PlaneGeometry(20000, 20000);
  water = new Water(
    waterGeometry,
    {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load('assets/waternormals.jpg', function (texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }),
      sunDirection: sun.position.clone().normalize(),
      sunColor: 0xffffff,
      waterColor: 0x00103a, // Xanh biển đậm hơn
      distortionScale: 3.7,
      fog: scene.fog !== undefined,
      alpha: 0.85
    }
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0, -10000);
  scene.add(water);
  return water;
}

export function getWater() {
  return water;
}

// Per-frame water animation. Uses a steady time step (as in main.js) to avoid
// jerking; the dt argument is accepted for a uniform update signature.
export function updateOcean(_dt) {
  if (water) {
    water.material.uniforms['time'].value += 1.0 / 60.0;
  }
}
