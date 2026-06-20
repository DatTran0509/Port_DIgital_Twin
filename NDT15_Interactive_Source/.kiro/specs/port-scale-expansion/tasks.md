# Implementation Plan: Port Scale Expansion

## Overview

This plan expands the NDT15 Smart Port digital twin from 6 blocks into a 20–30 block grid,
refactors the oversized source files into focused modules, rebuilds the road network and
truck traffic system, relocates buildings/energy, and runs a performance pass — all in
JavaScript (ES modules, Three.js r0.160), matching the existing codebase.

The sequencing follows the design's keystone-first strategy: `layout.js` (the single
parameter-driven source of coordinates, road graph, block→berth mapping, and preset source)
is built first because every other module depends on it. The oversized files are then split
per the design's Old→new responsibility map while preserving behavior, after which the scale
expansion, truck routing, relocation, presets, and performance work proceed. Each major step
leaves the simulation runnable so it can be verified visually via Go Live
(http://localhost:5500) after every step.

Per the requirements, **no automated test suite is mandated**; validation is visual. The
design's pure-logic layers (layout derivation, road graph, routing, collision, presets) carry
15 correctness properties suitable for property-based validation with **fast-check (≥100
iterations each)**. Those property tests are included as **optional sub-tasks marked with `*`**
and are non-blocking — implementation and visual verification take priority.

## Tasks

- [x] 1. Create the `layout.js` import hub (keystone)
  - [x] 1.1 Create `layout.js` with `PARAMS` and pure coordinate derivations
    - Define `PARAMS` (COLS=6, ROWS=4, BLOCK_W, BLOCK_D, ROAD_W, LANE_HALF, COL_PITCH, ROW_PITCH, YARD_Z0, QUAY_Z, BERTH_Z, QUAY_LEN, BERTH_SPACING, GATE_GAP, APRON_MARGIN) defaulting to 24 blocks
    - Implement pure accessors returning numbers/plain data only (no THREE.js objects): `blockCenter(col,row)`, `blockId(col,row)`, `vertRoadX()`, `horizRoadZ()`, `laneCenters(roadCenter,axis)`, `berthX()`, `blockToBerth(col,row)`, `gatePosition()`, `gateLaneX()`, `apronBounds()`
    - `berthX()` derives from `QUAY_LEN / BERTH_SPACING`, independent of block count
    - _Requirements: 3.1, 1.1, 1.2, 1.4, 2.1, 2.2, 7.2_

  - [x] 1.2 Implement `validateLayout()` finiteness/completeness check in `layout.js`
    - Return `{ ok, badKey? }`; detect missing, incomplete, or non-numeric parameters/derived values; expose for consumers to treat failure as a no-op
    - _Requirements: 3.4_

  - [x] 1.3 Implement `roadGraph()` builder in `layout.js` returning `{ nodes, edges, adj }`
    - Build crossing/gate/service/berthside nodes from `vertRoadX() × horizRoadZ()`
    - Emit exactly two opposing directed edges per physical corridor; build adjacency list by node id
    - _Requirements: 4.1, 4.4_

  - [ ]* 1.4 Write property test for layout block count (sets up fast-check harness)
    - **Property 1: Layout produces a valid block count**
    - **Validates: Requirements 1.1, 1.4**

  - [ ]* 1.5 Write property test for no geometric overlap and city-ward growth
    - **Property 2: No geometric overlap and city-ward growth**
    - **Validates: Requirements 1.2, 1.6, 7.1**

  - [ ]* 1.6 Write property test for apron containment and clearance
    - **Property 3: Everything fits inside the apron with clearance**
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 1.7 Write property test for invalid layout detection
    - **Property 5: Invalid layout is detected and rejected**
    - **Validates: Requirements 3.4**

  - [ ]* 1.8 Write property test for road graph connectivity and lane structure
    - **Property 6: Road network connectivity and lane structure**
    - **Validates: Requirements 4.1, 4.4**

- [x] 2. Refactor `main.js` into orchestrator + env/boards/interaction modules (behavior-preserving)
  - [x] 2.2 Extract `env/*` modules from `main.js`
    - Create `env/sky.js`, `env/ocean.js`, `env/land.js`, `env/models.js`, `env/buildings.js`, `env/energy.js`, `env/flags.js`, `env/drones.js`, `env/particles.js`, each under ~200 source lines, importing shared helpers/materials from `core.js`
    - Preserve current runtime behavior; do not redefine coordinates locally
    - _Requirements: 10.1, 10.3, 10.4, 10.5_

  - [x] 2.3 Extract `boards/electronic-boards.js` from `main.js`
    - Move gate/port board canvas setup and `updateBoards` logic; keep behavior identical
    - _Requirements: 10.1, 10.3_

  - [x] 2.4 Extract `interaction/raycast-follow.js` from `main.js`
    - Move pointer raycast, click-to-follow, and follow-camera logic; keep behavior identical
    - _Requirements: 10.1, 10.3_

  - [x] 2.1 Create `scene.js` orchestrator hub (init wiring + animation loop)
    - Move init sequence and the `animate()` loop into `scene.js`; import env/boards/interaction and the domain feature modules
    - Designate `scene.js` as an Import_Hub permitted to exceed 200 lines
    - _Requirements: 10.2, 10.3, 10.6_

  - [x] 2.5 Point `index.html` entry at `scene.js` and verify clean load
    - Update the module entry; confirm zero module import/resolution errors in the browser console
    - _Requirements: 10.6_

- [x] 3. Split feature files into domain modules (behavior-preserving)
  - [x] 3.1 Split `yard.js` into `yard/blocks.js`, `yard/rtg.js`, `yard/block-screens.js`
    - Preserve container instancing, RTG state machine (states 0–15), and block screens; import coordinates from `layout.js`
    - _Requirements: 10.1, 10.3, 10.4_

  - [x] 3.2 Split `ships.js` into `ships/berths.js`, `ships/vessels.js`, `ships/sts-cranes.js`, `ships/berth-screens.js`
    - Preserve vessel pose cycle, STS crane animation, and berth screens; import coordinates from `layout.js`
    - _Requirements: 10.1, 10.3, 10.4_

  - [x] 3.3 Split `gate.js` into `gate/gate.js`, `gate/gate-screens.js`
    - Preserve gate structure, barriers, and screen rendering; import gate position/lanes from `layout.js`
    - _Requirements: 10.1, 10.3, 10.4_

  - [x] 3.4 Split `trucks.js` into `trucks/truck-mesh.js`, `trucks/router.js`, `trucks/collision.js`, `trucks/dispatch.js`
    - Move shared truck visual build into `truck-mesh.js`; keep the existing state machine working through this split as the baseline before rework in task 6
    - _Requirements: 10.1, 10.3, 10.4_

  - [x] 3.5 Split `ui.js` into `ui/nav.js`, `ui/feature-presets.js`, `ui/charts.js`, `ui/object-info.js`, `ui/radar-popover.js`, `ui/overlays.js`, `ui/daynight.js`
    - Preserve all panel, overlay, callout, and day/night behavior; keep each module under ~200 lines
    - _Requirements: 10.1, 10.3_

  - [x] 3.6 Reduce `features.js` to descriptive metadata only
    - Remove numeric `cp/fp/ft` presets (moved to `ui/feature-presets.js` in task 8); keep feature descriptions/metadata
    - _Requirements: 10.4, 10.5_

  - [x] 3.7 Checkpoint - verify refactor preserves behavior
    - Ensure all tests pass, ask the user if questions arise. Confirm zero module import errors and that yard, ships, gate, trucks, gate screens, and UI behave as before via Go Live.

- [x] 4. Expand the container yard to a 20–30 block grid
  - [x] 4.1 Rebuild `yard/blocks.js` to span the full grid in 4 `InstancedMesh` buckets
    - Compute all block instance matrices from `blockCenter`/`blockId` using the shared `dummy`; all blocks share the same 4 color buckets (4 container draw calls regardless of block count)
    - _Requirements: 1.1, 1.3, 9.1_

  - [x] 4.2 Rebuild `yard/rtg.js` for one RTG crane per block with batched static parts
    - One RTG per block (Req 1.5); batch static structural members (legs, beams, wheels) into per-part `InstancedMesh` across all cranes; keep the small moving group per-crane; drive targets from `layout.js`
    - _Requirements: 1.5, 9.4_

  - [x] 4.3 Update `yard/block-screens.js` for unique ids/signboards across the grid
    - Assign each block its unique `blockId` and render it on the corresponding signboard
    - _Requirements: 1.4_

  - [ ]* 4.4 Write property test for constant container draw calls across scale
    - **Property 15: Container draw calls are constant across scale**
    - **Validates: Requirements 9.1, 9.4**

  - [x] 4.5 Enlarge the apron and quay surfaces from `apronBounds()`
    - Size the apron from `apronBounds()` with ≥2 m clearance; keep quay/apron waterfront edges coincident; ensure apron/quay receive shadows each frame
    - _Requirements: 2.1, 2.3, 2.4_

- [x] 5. Rebuild the two-lane road network
  - [x] 5.1 Create `roads/road-network.js` building merged road surfaces from the layout
    - Build corridor surfaces from `vertRoadX()`/`horizRoadZ()` providing exactly one two-lane segment between adjacent blocks and continuous paths to gate and berth-side
    - _Requirements: 4.1, 4.4_

  - [x] 5.2 Add lane-divider and directional markings with z-fight-free offset
    - Render center lane dividers and inbound/outbound directional markings at a small `+y` offset above the road; reuse shared geometry via `bx` and `M.mark`
    - _Requirements: 4.2, 4.3, 4.5_

- [x] 6. Truck waypoint-graph router and scalable collision avoidance
  - [x] 6.1 Implement `trucks/router.js` pathfinding and driving state machine
    - BFS/Dijkstra (or precomputed gate↔block paths) over `roadGraph().adj`; inbound route uses only inbound edges to the assigned service node, return route uses only outbound edges to the gate; keep trucks within lane centerlines; hold (never remove) an unroutable truck and retry on later frames
    - _Requirements: 5.1, 5.2, 5.3, 5.7_

  - [ ]* 6.2 Write property test for routing direction and never dropping a truck
    - **Property 7: Routing uses correct lane direction and never drops a truck**
    - **Validates: Requirements 5.1, 5.2, 5.7**

  - [ ]* 6.3 Write property test for trucks staying within their lane
    - **Property 8: Trucks stay within their lane**
    - **Validates: Requirements 5.3**

  - [x] 6.4 Implement `trucks/collision.js` spacing and intersection reservations
    - Per-frame following gap ≥2.0 m on shared directed edges; crossing reservation holds the later-arriving truck (greater distance-to-crossing) until clear; deterministic lowest-id tie-break; use only preallocated scratch buffers (lane buckets, crossing owners, reused vectors) with zero per-frame allocation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7, 9.3_

  - [ ]* 6.5 Write property test for following gap preventing same-lane overlap
    - **Property 9: Following gap prevents same-lane overlap**
    - **Validates: Requirements 6.1, 6.4**

  - [ ]* 6.6 Write property test for mutually exclusive crossings with tie-break
    - **Property 10: Crossings are mutually exclusive with deterministic tie-break**
    - **Validates: Requirements 6.2, 6.3, 6.4**

  - [ ]* 6.7 Write property test for allocation-free frame evaluation
    - **Property 13: Frame evaluation is allocation-free**
    - **Validates: Requirements 6.7, 9.3**

  - [x] 6.8 Implement `trucks/dispatch.js` spawn/re-dispatch and crane handoff
    - Re-dispatch with a newly assigned block and cargo direction; place a truck only at a position keeping ≥2.0 m separation, else defer and retry; hand off to an available serving RTG at the service node, else hold stationary without overlap until one is free
    - _Requirements: 5.4, 5.5, 5.6, 6.5, 6.6_

  - [ ]* 6.9 Write property test for dispatch/re-dispatch minimum separation
    - **Property 11: Dispatch and re-dispatch preserve minimum separation**
    - **Validates: Requirements 5.6, 6.5, 6.6**

  - [ ]* 6.10 Write property test for handoff to a serving crane
    - **Property 12: Handoff to a serving crane**
    - **Validates: Requirements 5.4, 5.5**

  - [x] 6.11 Checkpoint - verify traffic across the expanded network
    - Ensure all tests pass, ask the user if questions arise. Confirm via Go Live that trucks route to assigned blocks, stay in lanes, avoid collisions, and exit/re-dispatch correctly.

- [x] 7. Decouple berths/STS and relocate buildings and energy
  - [x] 7.1 Position `ships/berths.js` and `ships/sts-cranes.js` from `berthX()`
    - Place berths/STS cranes from `berthX()` (independent of block count) and the `blockToBerth` mapping
    - _Requirements: 3.2, 3.3_

  - [x] 7.2 Align vessel berthing references in `ships/vessels.js` from the layout
    - Set each vessel's berthing reference within 0.1 units of its serving quay position on each axis
    - _Requirements: 3.3_

  - [ ]* 7.3 Write property test for single-source derivation consistency
    - **Property 4: Single-source derivation is consistent**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 7.4 Relocate assets in `env/buildings.js` and `env/energy.js` from layout bounds
    - Reposition warehouses+solar (solar atop its warehouse footprint), radar/shore-power on the waterfront between quay and nearest block, and wind turbines off berths/approach/anchorage so nothing overlaps blocks, roads, quay, or berths
    - _Requirements: 7.1, 7.3, 7.4, 7.5_

  - [x] 7.5 Re-bind relocated assets to clickable info panels
    - Keep `userData.isClickable` and existing info-panel data bound on every relocated asset
    - _Requirements: 7.6, 7.7_

  - [x] 7.6 Position the gate at the landward end from `gatePosition()`
    - Place the gate in `+z` beyond the last block row so every inbound truck passes the gate before any block
    - _Requirements: 7.2_

- [x] 8. Update feature camera presets
  - [x] 8.1 Compute presets in `ui/feature-presets.js` from layout bounds
    - Recompute each feature's `cp/fp/ft` so `fp`/`ft` lie within the represented element's bounds; provide an overview preset whose view contains the full yard, roads, quay, and berths; complete transitions within 2 s ending at `cp` oriented toward `ft`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 8.2 Write property test for preset framing and overview coverage
    - **Property 14: Camera presets frame their element; overview contains everything**
    - **Validates: Requirements 8.1, 8.4**

- [x] 9. Performance pass
  - [x] 9.1 Size the directional shadow frustum and cap the shadow map in `core.js`
    - Tighten the shadow frustum to bound the expanded yard; keep `sun.shadow.mapSize` ≤ 4096; preserve texel density ≥ pre-expansion baseline (raise `mapSize` toward the cap if needed)
    - _Requirements: 9.2, 9.7_

  - [x] 9.2 Audit and enforce shared geometry/material reuse
    - Verify exactly one shared geometry and one shared material instance per repeated structure type across blocks, RTG cranes, and trucks; remove any duplicate instances
    - _Requirements: 9.4_

  - [x] 9.3 Eliminate per-frame allocations in the animation loop
    - Replace per-frame `new THREE.Vector3()`/`Box3` and similar allocations in `scene.js` and truck logic with preallocated module-level scratch objects
    - _Requirements: 9.3_

  - [x] 9.4 Add a draw-call invariance assertion for containers
    - Assert the container `InstancedMesh` count equals the number of color buckets (4) regardless of block count
    - _Requirements: 9.1_

  - [x] 9.5 Final checkpoint - verify performance and clean load
    - Ensure all tests pass, ask the user if questions arise. Via Go Live, confirm zero console import errors, smooth interaction, and that the expanded port renders correctly.

## Notes

- Implementation language is JavaScript (ES modules, Three.js r0.160), matching the existing codebase.
- Tasks marked with `*` are optional property-based tests (fast-check, ≥100 iterations each) and are non-blocking per the requirements' "no automated test suite" mandate; visual validation via Go Live (http://localhost:5500) is the primary check.
- `core.js`, `layout.js`, and `scene.js` are Import_Hubs permitted to exceed 200 lines; all other modules target under ~200 source lines.
- Each task references the requirements it implements and, where relevant, the design correctness property it validates.
- Checkpoints (3.7, 6.11, 9.5) leave the simulation runnable so it can be verified after each major step.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4", "1.5", "1.6", "1.7", "1.8", "2.2", "2.3", "2.4", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6"] },
    { "id": 4, "tasks": ["2.1"] },
    { "id": 5, "tasks": ["2.5"] },
    { "id": 6, "tasks": ["4.1", "4.2", "4.3", "5.1", "7.6"] },
    { "id": 7, "tasks": ["4.4", "4.5", "5.2", "6.1", "7.1", "8.1"] },
    { "id": 8, "tasks": ["6.2", "6.3", "6.4", "7.2", "7.4", "8.2"] },
    { "id": 9, "tasks": ["6.5", "6.6", "6.7", "6.8", "7.3", "7.5"] },
    { "id": 10, "tasks": ["6.9", "6.10"] },
    { "id": 11, "tasks": ["9.1"] },
    { "id": 12, "tasks": ["9.2", "9.3", "9.4"] }
  ]
}
```
