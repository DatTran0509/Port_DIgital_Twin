// Barrel module: ui.js was split into focused modules under ./ui/ to keep each
// concern small (Req 10.1, 10.3). Behavior is unchanged; this file simply
// re-exports the public surface the rest of the app imports.
export { initUI } from './ui/nav.js';
export { hsEls, coEls, setCallouts, projAt, updateOverlays, isScanActive } from './ui/overlays.js';
export { showObjectInfo, hideObjectInfo, updateActivePanels, activeObjType, activeObjData } from './ui/object-info.js';
