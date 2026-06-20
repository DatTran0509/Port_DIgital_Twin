// env/models.js — GLB model loading: city skyline + wind turbine preload (from main.js loadModels)
import * as THREE from 'three';
import { scene } from '../core.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Loads the city skyline GLB and preloads the shared wind turbine mesh.
// The turbine uses the window.sharedTurbineMesh / window.pendingTurbines /
// window.turbineAnimations pattern so env/energy.js can clone it once loaded.
// Behavior preserved exactly from main.js.
export function loadModels() {
  new GLTFLoader().load('assets/low_poly_night_city_building_skyline.glb', (gltf) => {
    const city = gltf.scene;

    city.rotation.y = Math.PI;
    city.scale.setScalar(4);
    city.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(city);
    const center = new THREE.Vector3();
    box.getCenter(center);

    city.position.x -= center.x;
    city.position.z -= center.z;
    city.position.z += 1000;
    city.position.y -= box.min.y;
    city.position.y += 0.5;

    city.traverse(c => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    scene.add(city);
  });

  // Preload Wind Turbine
  new GLTFLoader().load('assets/wind_turbine.glb', (gltf) => {
    const mesh = gltf.scene;
    // Normalize size
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3(); box.getSize(size);
    const scale = 50 / size.y; // Target height ~50
    mesh.scale.setScalar(scale);

    mesh.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3(); box2.getCenter(center);
    mesh.position.x -= center.x;
    mesh.position.z -= center.z;
    mesh.position.y -= box2.min.y;

    mesh.traverse(c => {
      if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
    });

    window.sharedTurbineMesh = mesh;
    window.turbineAnimations = gltf.animations;
    if (window.pendingTurbines) {
      window.pendingTurbines.forEach(t => t());
      window.pendingTurbines = [];
    }
  });
}
