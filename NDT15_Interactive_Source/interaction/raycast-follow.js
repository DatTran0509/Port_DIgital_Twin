// interaction/raycast-follow.js — pointer raycast, click-to-follow, and
// follow-camera logic (extracted from main.js). Behavior preserved exactly.
import * as THREE from 'three';
import { camera, scene, orbit } from '../core.js';
import { showObjectInfo, hideObjectInfo } from '../ui.js';
import { highlight, clearHighlight } from '../sim/highlight.js';

// Internal module-level state (mirrors the former main.js module vars).
let activeFollowTarget = null;
let followCamOffset = new THREE.Vector3();
let isFollowing = false;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Preallocated scratch reused by the per-frame updateFollow() so the animation
// loop allocates no Vector3 per frame (Req 9.3). _zeroOffset is an immutable
// (never mutated) fallback for window.followTargetOffset.
const _objPos = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _desiredCam = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _zeroOffset = new THREE.Vector3();

// Registers the pointerdown / orbit 'start' / 'clear-follow-target' listeners.
// Click-to-follow: raycast the scene, walk up to the nearest clickable group,
// compute a bounding-box-aware camera offset by object type, and open its info
// panel. An empty click clears the target and hides the panel.
export function initRaycastFollow() {
  orbit.addEventListener('start', () => { isFollowing = false; });

  window.addEventListener('clear-follow-target', () => {
    activeFollowTarget = null;
    isFollowing = false;
    clearHighlight();
    hideObjectInfo();
  });

  window.addEventListener('pointerdown', (event) => {
    // Only process if it's a direct click on canvas or we're not clicking on UI elements
    if (event.button !== 0 || event.target.tagName !== 'CANVAS') return;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
      let curr = intersects[0].object;
      let clickedData = null;
      let clickedGroup = null;
      while (curr) {
        if (curr.userData && curr.userData.isClickable) {
          clickedData = curr.userData;
          clickedGroup = curr;
          break;
        }
        curr = curr.parent;
      }
      if (clickedData) {
        // Action objects (e.g. the underground gate / elevators) just show their
        // info and fire their action — they must NOT engage the follow-camera,
        // otherwise it fights the descent fly and re-focuses the clicked object.
        if (clickedData.uaction) {
          activeFollowTarget = null;
          isFollowing = false;
          showObjectInfo(clickedData.data, clickedData.objType);
          window.dispatchEvent(new Event(clickedData.uaction));
          return;
        }
        focusGroup(clickedGroup, clickedData);
      } else {
        activeFollowTarget = null;
        clearHighlight();
        hideObjectInfo();
      }
    } else {
      activeFollowTarget = null;
      clearHighlight();
      hideObjectInfo();
    }
  });
}

// Engage the follow-camera on a clickable group, open its info panel and put a
// glowing highlight on it. Shared by pointer clicks AND the Copilot locator.
export function focusGroup(clickedGroup, clickedData) {
  activeFollowTarget = clickedGroup;
  isFollowing = true;

  const dir = new THREE.Vector3().subVectors(camera.position, orbit.target).normalize();
  if (dir.lengthSq() < 0.1) dir.set(0, 0.5, 1).normalize();
  if (dir.y < 0.35) { dir.y = 0.5; dir.normalize(); }

  const box = new THREE.Box3().setFromObject(clickedGroup);
  const size = new THREE.Vector3(); box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);

  let dist = maxDim * 5;
  if (clickedData.objType === 'ship') dist = maxDim * 2.2;
  else if (clickedData.objType === 'uav') dist = maxDim * 8.0;
  else if (clickedData.objType === 'energy') dist = maxDim * 3.0;
  else if (clickedData.objType === 'truck') dist = maxDim * 8.0;
  else if (clickedData.objType === 'transfercrane') dist = maxDim * 2.0;
  if (dist < 25) dist = 25;
  followCamOffset.copy(dir.multiplyScalar(dist));

  const objOrigin = new THREE.Vector3();
  clickedGroup.getWorldPosition(objOrigin);
  const center = new THREE.Vector3(); box.getCenter(center);
  window.followTargetOffset = center.clone().sub(objOrigin);

  highlight(clickedGroup, { label: clickedData.data && clickedData.data.name, color: 0x34E0F0 });
  showObjectInfo(clickedData.data, clickedData.objType);
}

// Public locator used by the Copilot: focus an object group by reference.
export function focusObject(group, type, data) {
  focusGroup(group, { objType: type, data: data || (group.userData && group.userData.data) });
}

// Per-frame follow-camera lerp block (formerly inline in animate()). Lerps the
// orbit target and camera position toward the followed object each frame.
export function updateFollow() {
  if (activeFollowTarget) {
    activeFollowTarget.getWorldPosition(_objPos);
    // Cộng thêm offset để điểm focus luôn nằm giữa tâm vật thể
    _targetPos.copy(_objPos).add(window.followTargetOffset || _zeroOffset);

    if (isFollowing) {
      orbit.target.lerp(_targetPos, 0.08);
      _desiredCam.copy(_targetPos).add(followCamOffset);
      camera.position.lerp(_desiredCam, 0.08);

      if (orbit.target.distanceTo(_targetPos) < 1.0) {
        isFollowing = false;
      }
    } else {
      _delta.copy(_targetPos).sub(orbit.target);
      orbit.target.copy(_targetPos);
      camera.position.add(_delta);
    }
  }
}
