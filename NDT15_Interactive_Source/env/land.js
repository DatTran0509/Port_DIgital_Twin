// env/land.js — Landmass ground plane (from main.js createLandmassZone)
import * as THREE from 'three';
import { scene } from '../core.js';

// Builds the textured landmass plane behind the city. Returns the mesh.
// Behavior preserved exactly from main.js.
export function initLand() {
  const tl = new THREE.TextureLoader();
  const diffuse = tl.load('assets/ground_color.jpg');
  const normal = tl.load('assets/ground_normal.png');
  diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  // Increase repeat significantly to avoid white spots but retain texture
  diffuse.repeat.set(400, 400);
  normal.repeat.set(400, 400);

  const landGeo = new THREE.PlaneGeometry(20000, 20000);
  const landMat = new THREE.MeshStandardMaterial({
    map: diffuse,
    normalMap: normal,
    // Olive / khaki earthy tint — replaces the cold blue-grey (0x8899aa) that
    // read as a dark, lifeless slab. Warmer & more saturated so the mainland
    // looks like real vegetated earth around the concrete terminal.
    color: 0x8f8a5e,
    roughness: 1.0,
    metalness: 0.0
  });

  const land = new THREE.Mesh(landGeo, landMat);
  land.rotation.x = -Math.PI / 2;
  land.position.set(0, 0.5, 10000);
  land.receiveShadow = true;
  scene.add(land);
  return land;
}
