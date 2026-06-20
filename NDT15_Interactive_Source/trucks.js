// Barrel module: trucks.js was split into focused modules under trucks/
// (truck-mesh, router, collision, dispatch) as the baseline before the
// task 6 rework. Public exports are preserved for existing callers.
export { truckGroup, buildTruck, setTruckOpacity } from './trucks/truck-mesh.js';
export { trucks, initTrucks, reDispatch, updateTruckInfo } from './trucks/dispatch.js';
export { canProceed } from './trucks/collision.js';
export { updateTrucks } from './trucks/router.js';
