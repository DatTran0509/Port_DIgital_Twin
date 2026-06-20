// env/flags.js — NDT logo flags (canvas texture + pole) + per-frame cloth wave
// (the flag portion of main.js createFlagsAndEnergy + the flag animation in animate()).
import * as THREE from 'three';
import { scene, mat, cy } from '../core.js';

let globalFlagGeo = null; // Stored for per-frame cloth animation

// Builds the three NDT logo flags and their poles. Returns the shared flag
// geometry handle used for animation. Behavior preserved exactly from main.js.
export function initFlags() {
  // Flags - Canvas Texture for White Fabric + Centered Logo
  const cvsFront = document.createElement('canvas');
  cvsFront.width = 1024; cvsFront.height = 682;
  const ctxF = cvsFront.getContext('2d');
  ctxF.fillStyle = '#ffffff'; ctxF.fillRect(0, 0, cvsFront.width, cvsFront.height);

  const cvsBack = document.createElement('canvas');
  cvsBack.width = 1024; cvsBack.height = 682;
  const ctxB = cvsBack.getContext('2d');
  ctxB.fillStyle = '#ffffff'; ctxB.fillRect(0, 0, cvsBack.width, cvsBack.height);

  const texF = new THREE.CanvasTexture(cvsFront); texF.colorSpace = THREE.SRGBColorSpace; texF.anisotropy = 16;
  const texB = new THREE.CanvasTexture(cvsBack); texB.colorSpace = THREE.SRGBColorSpace; texB.anisotropy = 16;

  const img = new Image();
  img.src = 'assets/logo_ndt.png';
  img.onload = () => {
    const lw = cvsFront.width * 0.65;
    const lh = (img.height / img.width) * lw;
    // Front
    ctxF.drawImage(img, (cvsFront.width - lw) / 2, (cvsFront.height - lh) / 2, lw, lh);
    texF.needsUpdate = true;

    // Back (flipped horizontally)
    ctxB.translate(cvsBack.width, 0);
    ctxB.scale(-1, 1);
    ctxB.drawImage(img, (cvsBack.width - lw) / 2, (cvsBack.height - lh) / 2, lw, lh);
    texB.needsUpdate = true;
  };

  globalFlagGeo = new THREE.PlaneGeometry(6, 4, 25, 12);
  globalFlagGeo.translate(3, 0, 0); // Move origin to left edge
  const fpos = globalFlagGeo.attributes.position;
  globalFlagGeo.userData = { initZ: new Float32Array(fpos.count) };
  for (let i = 0; i < fpos.count; i++) globalFlagGeo.userData.initZ[i] = fpos.getZ(i);

  const matF = new THREE.MeshStandardMaterial({ map: texF, side: THREE.FrontSide, roughness: 0.9, metalness: 0.0 });
  const matB = new THREE.MeshStandardMaterial({ map: texB, side: THREE.BackSide, roughness: 0.9, metalness: 0.0 });

  // 3 vị trí: 2 đầu cảng và 1 trước cổng (hướng ra ngoài)
  // [x, z, rotationY]
  const flagPlacements = [
    [-280, -5, 0],             // Đầu càng trái
    [280, -5, Math.PI],        // Đầu càng phải
    [55, 140, 0]               // Cạnh phải đường vào, bay về bên phải
  ];

  flagPlacements.forEach(([fx, fz, ry]) => {
    cy(scene, 0.2, 20, mat(0x8899aa, 0.5, 0.9), fx, 0, fz); // Metal pole
    const fmFront = new THREE.Mesh(globalFlagGeo, matF);
    const fmBack = new THREE.Mesh(globalFlagGeo, matB);
    fmFront.castShadow = true; fmFront.receiveShadow = true;
    fmBack.castShadow = true; fmBack.receiveShadow = true;

    const fGroup = new THREE.Group();
    fGroup.add(fmFront); fGroup.add(fmBack);
    fGroup.position.set(fx, 18, fz);
    fGroup.rotation.y = ry;
    scene.add(fGroup);
  });

  return { globalFlagGeo };
}

// Per-frame flag cloth wave animation (from animate()).
export function updateFlags(el) {
  if (!globalFlagGeo) return;
  const pos = globalFlagGeo.attributes.position;
  const initZ = globalFlagGeo.userData.initZ;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    // The wave amplitude increases as x goes further right from the pole (x=0)
    const wave = Math.sin(el * 6 - x * 1.5) * (x / 6) * 0.7;
    const noise = Math.sin(el * 15 + x * 4) * (x / 6) * 0.15; // fast flutter
    pos.setZ(i, initZ[i] + wave + noise);
  }
  pos.needsUpdate = true;
  globalFlagGeo.computeVertexNormals();
}
