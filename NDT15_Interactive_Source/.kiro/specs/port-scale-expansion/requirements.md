# Requirements Document

## Introduction

This feature expands the existing NDT15 Smart Port Three.js digital twin from its current small footprint (6 container yard blocks) into a large-scale, realistic port simulation inspired by real-world digital twin ports such as 51WORLD's Shanghai-scale terminal with dozens of container blocks.

The expansion increases the number of container yard blocks to between 20 and 30, widens the yard and apron surfaces to fit a proper inter-block road network, rebuilds the road system into clearly marked two-lane truck roads, upgrades truck routing and collision avoidance to operate reliably across the larger network, and relocates energy and port buildings (warehouses, solar arrays, wind turbines, radar station, gate, flags) into a layout that remains logically coherent at the larger scale.

Two cross-cutting concerns govern the entire effort. First, rendering performance must remain smooth: the simulation must continue to rely on `InstancedMesh` for containers, manage draw calls and the shadow map budget for 8 GB VRAM machines, and avoid per-frame memory allocations. Second, the source code must be refactored so that each feature module stays under approximately 200 lines, while designated central import-hub files may remain larger.

This document captures WHAT the expanded system must achieve. Implementation specifics (exact coordinates, module boundaries, algorithm choices) are deferred to the design phase. No automated test suite is required for this feature; validation is performed visually through the running static server.

## Glossary

- **Simulation**: The complete NDT15 Smart Port Three.js digital twin application rendered in the browser.
- **Renderer**: The Three.js WebGL renderer instance defined in `core.js` that draws the scene each frame.
- **Yard**: The collective set of container storage blocks and their supporting surfaces, defined in `yard.js`.
- **Yard_Block**: A single rectangular group of stacked containers served by one RTG crane.
- **Apron**: The flat ground surface beneath and around the yard blocks and roads.
- **Quay**: The waterfront edge surface adjacent to the berths.
- **Road_Network**: The collection of drivable surfaces, lane dividers, and markings connecting the gate, yard blocks, and berths.
- **Truck_Lane**: A single directional lane within a two-lane road segment.
- **Truck_Router**: The truck movement and pathfinding logic in `trucks.js` that drives trucks through the Road_Network via a state machine.
- **Truck**: A single container truck instance controlled by the Truck_Router.
- **Collision_Avoidance**: The subsystem within the Truck_Router that prevents trucks from overlapping or intersecting.
- **RTG_Crane**: A rubber-tyred gantry crane that services a single Yard_Block, defined in `yard.js`.
- **Berth**: A docking position for a vessel along the quay, defined in `ships.js`.
- **Gate**: The automated multi-lane port entry/exit structure defined in `gate.js`.
- **Energy_Asset**: A renewable-energy or utility object, specifically wind turbines, solar panel arrays, and shore-power units.
- **Port_Building**: A non-energy structure, specifically warehouses, the radar station, and flag poles.
- **Feature_Camera_Preset**: A named camera configuration (`cp` start position, `fp` focus position, `ft` look-at target) defined per feature in `features.js`.
- **Layout_Coordinates**: The shared set of position values (block X positions, lane centers, berth X positions, road crossing Z positions, gate Z position, city Z position) that define where scene elements are placed.
- **Code_Module**: A single JavaScript source file in the project.
- **Import_Hub**: A Code_Module designated as a central aggregation/orchestration file that is permitted to exceed the per-module line limit.
- **Developer**: The person extending, maintaining, or reviewing the Simulation source code.
- **Operator**: The person interacting with the running Simulation in the browser.
- **Frame_Budget**: The per-frame time target required to sustain smooth interactive rendering (60 frames per second equals approximately 16.7 milliseconds per frame).

## Requirements

### Requirement 1: Expanded Container Yard

**User Story:** As an Operator, I want the container yard to contain many more blocks extending toward the city side, so that the port looks like a realistic large-scale terminal rather than a small demo.

#### Acceptance Criteria

1. THE Yard SHALL render a count of Yard_Blocks that is greater than or equal to 20 and less than or equal to 30.
2. THE Yard SHALL position every additional Yard_Block (beyond the original demo set) so that its footprint lies on the city-facing side of the original Yard_Block footprint along the city-ward axis of the Layout_Coordinates, such that no additional Yard_Block extends back toward the Quay or Berth side beyond the original footprint boundary.
3. THE Yard SHALL render the containers of all Yard_Blocks using `InstancedMesh`.
4. THE Yard SHALL assign each Yard_Block an identifying number that is unique across all rendered Yard_Blocks and SHALL display that number on the corresponding block signboard.
5. WHERE a Yard_Block is rendered, THE Yard SHALL serve that Yard_Block with exactly one dedicated RTG_Crane.
6. THE Yard SHALL position every Yard_Block so that its geometry does not overlap the Road_Network, the Quay, the Berth surfaces, any other Yard_Block, or any RTG_Crane within the Layout_Coordinates.

### Requirement 2: Enlarged Yard and Apron Surfaces

**User Story:** As an Operator, I want the yard and apron surfaces to be substantially larger and wider, so that there is room for proper roads between the container blocks.

#### Acceptance Criteria

1. THE Apron SHALL extend in width and depth so that every Yard_Block and every Road_Network segment lies entirely within the Apron boundary, with a clearance margin of at least 2 meters between the outermost Yard_Block or road segment edge and the nearest Apron edge.
2. WHERE two Yard_Blocks are adjacent, THE Apron SHALL provide a continuous drivable gap between them whose width is at least the full width of one two-lane road segment including its lane markings plus a clearance margin of at least 0.5 meters on each side of that road segment.
3. THE Renderer SHALL render the Apron and Quay surfaces as receivers of shadows on every rendered frame.
4. WHERE the Apron is enlarged, THE Simulation SHALL position the Quay so that its waterfront edge is coincident with the waterfront edge of the Apron, with no gap and no overlap between the Quay surface and the Apron surface.

### Requirement 3: Layout Coordinate Consistency

**User Story:** As a Developer, I want all scene elements to reference a single consistent set of layout coordinates, so that expanding the port does not leave elements misaligned.

#### Acceptance Criteria

1. THE Simulation SHALL derive Yard_Block positions, Truck_Lane centers, Berth positions, Gate position, and road crossing positions exclusively from a single shared set of Layout_Coordinates, with no element position defined by an independent or hardcoded source.
2. WHEN the Layout_Coordinates change, THE Simulation SHALL reposition the Berths, the RTG_Cranes, the Gate, and the Road_Network so that each element's resulting position matches the value derived from the updated Layout_Coordinates within a tolerance of 0.1 scene units.
3. WHEN the Layout_Coordinates change, THE Simulation SHALL position every Berth and its STS crane so that the docked vessel's berthing reference point is offset from its serving quay position by no more than 0.1 scene units along each axis.
4. IF the Layout_Coordinates are missing, incomplete, or contain a non-numeric value when scene elements are positioned, THEN THE Simulation SHALL retain the last valid element positions and produce an error indication identifying the invalid Layout_Coordinates.

### Requirement 4: Rebuilt Two-Lane Road Network

**User Story:** As an Operator, I want clearly marked two-lane roads between the container blocks, so that trucks have realistic driving paths through the port.

#### Acceptance Criteria

1. THE Road_Network SHALL provide exactly one two-lane road segment between each pair of adjacent Yard_Blocks, each segment containing exactly two Truck_Lanes, one per opposing travel direction.
2. WHEN the Road_Network is rendered, THE Road_Network SHALL render lane-dividing markings along the center of each two-lane road segment.
3. WHEN the Road_Network is rendered, THE Road_Network SHALL render directional lane markings that distinguish the inbound Truck_Lane from the outbound Truck_Lane.
4. THE Road_Network SHALL provide a continuous drivable path from every Yard_Block road segment to both the Gate and the berth-side area through shared crossing roads.
5. WHEN the Renderer renders road markings, THE Renderer SHALL position each marking at a positive vertical offset above the road surface so that no road marking causes z-fighting against the road surface.

### Requirement 5: Truck Routing Across the Expanded Network

**User Story:** As an Operator, I want trucks to navigate the larger road network to reach their assigned blocks and exit again, so that port traffic behaves realistically.

#### Acceptance Criteria

1. WHEN a Truck is dispatched to a Yard_Block, THE Truck_Router SHALL route that Truck from the Gate through the inbound Truck_Lanes of the Road_Network to the assigned Yard_Block's Truck_Lane.
2. WHEN a Truck has completed its yard service, THE Truck_Router SHALL route that Truck from its Yard_Block back through the outbound Truck_Lanes of the Road_Network to the Gate exit.
3. WHILE a Truck is traveling along a road segment, THE Truck_Router SHALL keep that Truck within the bounds of its current Truck_Lane so that no Truck geometry crosses a lane-dividing marking into an adjacent lane.
4. WHEN a Truck reaches its assigned Yard_Block's Truck_Lane, THE Truck_Router SHALL hand that Truck off to an available RTG_Crane serving that Yard_Block.
5. IF no RTG_Crane serving the assigned Yard_Block is available, THEN THE Truck_Router SHALL hold the Truck stationary at the Yard_Block's Truck_Lane, without overlapping any other Truck, until a serving RTG_Crane becomes available.
6. WHEN a Truck exits the Road_Network at the Gate, THE Truck_Router SHALL re-dispatch that Truck with a newly assigned Yard_Block and cargo direction, the cargo direction governing whether the Truck uses inbound or outbound Truck_Lanes.
7. IF the Truck_Router cannot determine a route to a Truck's assigned Yard_Block, THEN THE Truck_Router SHALL hold the Truck at the Gate and re-attempt routing on subsequent frames without removing the Truck from the Simulation.

### Requirement 6: Truck Collision Avoidance at Scale

**User Story:** As an Operator, I want trucks to avoid colliding or overlapping with each other across the whole road network, so that traffic looks orderly even with many trucks and intersections.

#### Acceptance Criteria

1. WHILE two or more Trucks travel in the same direction within the same Truck_Lane, THE Collision_Avoidance SHALL maintain a minimum following gap of at least 2.0 meters between the rear geometry of the leading Truck and the front geometry of the trailing Truck, such that no Truck geometry overlaps another Truck's geometry at any frame.
2. WHEN a Truck arrives within 5.0 meters of a road crossing whose crossing area currently contains any part of another Truck's geometry on an intersecting path, THE Collision_Avoidance SHALL hold the later-arriving Truck (the Truck with the greater distance-to-crossing) at a stop position before the crossing until no other Truck's geometry remains within the crossing area.
3. IF two or more Trucks arrive at the same crossing within the same evaluation frame with equal distance-to-crossing, THEN THE Collision_Avoidance SHALL select exactly one Truck to proceed using a deterministic tie-break of lowest Truck identifier and hold all other contending Trucks until the crossing area is clear.
4. THE Collision_Avoidance SHALL enforce criteria 1 through 3 across all Truck_Lanes and all crossings of the expanded Road_Network for all concurrent Trucks in the Simulation.
5. WHEN a Truck is re-dispatched to a spawn position, THE Truck_Router SHALL place that Truck only at a position whose Truck geometry maintains a minimum separation of at least 2.0 meters from every other Truck's geometry.
6. IF no spawn position satisfying the 2.0 meter minimum separation is available at re-dispatch time, THEN THE Truck_Router SHALL delay placement of that Truck and retry on subsequent frames until a non-overlapping position becomes available.
7. THE Collision_Avoidance SHALL evaluate Truck spacing once per rendered frame and SHALL complete each evaluation without allocating new objects during that evaluation.

### Requirement 7: Logical Relocation of Energy Assets and Port Buildings

**User Story:** As an Operator, I want the warehouses, solar arrays, wind turbines, radar station, gate, and flags repositioned for the larger port, so that the overall layout stays logically organized.

#### Acceptance Criteria

1. WHEN the Yard is expanded, THE Simulation SHALL reposition every Energy_Asset and Port_Building so that its geometry does not overlap any Yard_Block, the Road_Network, the Quay, or the Berth surfaces.
2. THE Simulation SHALL position the Gate at the city-side end of the Road_Network so that every inbound Truck passes the Gate before reaching any Yard_Block along its route.
3. THE Simulation SHALL position the warehouses and their associated solar arrays together so that each solar array footprint lies within or atop its associated warehouse footprint.
4. THE Simulation SHALL position the radar station and the shore-power units on the waterfront side of the Layout_Coordinates, between the Quay edge and the nearest Yard_Block, without crossing to the city side of the nearest Yard_Block.
5. WHERE wind turbines are placed on the water side of the Quay, THE Simulation SHALL position them so that their geometry does not overlap the Berth surfaces, the vessel approach path, or the vessel anchorage areas.
6. WHEN an Operator clicks a relocated Energy_Asset or Port_Building, THE Simulation SHALL open the information panel for that object.
7. THE Simulation SHALL bind every relocated Energy_Asset and Port_Building to its existing information panel data.

### Requirement 8: Updated Feature Camera Presets

**User Story:** As an Operator, I want the guided feature views to frame the correct areas after the layout changes, so that selecting a feature still shows the relevant part of the expanded port.

#### Acceptance Criteria

1. WHEN the Layout_Coordinates change, THE Simulation SHALL update each Feature_Camera_Preset so that its focus position (`fp`) and look-at target (`ft`) lie within the horizontal and depth bounds of the port element that the preset represents.
2. WHEN an Operator selects a feature, THE Simulation SHALL move the camera to that feature's updated Feature_Camera_Preset within 2 seconds.
3. WHEN a Feature_Camera_Preset transition completes, THE Simulation SHALL leave the camera positioned at the preset's start position (`cp`) and oriented toward the preset's look-at target (`ft`).
4. THE Simulation SHALL provide an overview Feature_Camera_Preset whose camera view contains the full horizontal and depth extent of the Yard, the Road_Network, the Quay, and the Berths, with no part of those elements falling outside the camera view.

### Requirement 9: Rendering Performance

**User Story:** As an Operator, I want the expanded port to render smoothly, so that interaction and animation remain fluid despite the larger scale.

#### Acceptance Criteria

1. THE Simulation SHALL render all container instances of the Yard using `InstancedMesh` so that the number of draw calls for containers is at most one per distinct container mesh type regardless of the Yard_Block count between 20 and 30.
2. THE Simulation SHALL keep the directional shadow map resolution at no more than 4096 by 4096 texels to remain within the budget suitable for 8 GB VRAM machines.
3. WHILE the animation loop is running, THE Simulation SHALL perform zero per-frame allocations of geometry, material, or vector objects.
4. THE Renderer SHALL use exactly one shared geometry instance and one shared material instance per repeated structure type across Yard_Blocks, RTG_Cranes, and Trucks, with no duplicate geometry or material instances for those repeated structures.
5. WHILE the Operator interacts with the camera on a machine with 8 GB VRAM, THE Simulation SHALL sustain an average frame time of no more than 16.7 milliseconds over any continuous 5-second window.
6. WHILE the Operator interacts with the camera on a machine with 8 GB VRAM, THE Simulation SHALL keep every individual frame time at no more than 33.3 milliseconds.
7. WHERE the directional light shadow camera covers the scene, THE Simulation SHALL size its shadow frustum to include the expanded Yard while keeping shadow texel density no lower than the pre-expansion density.

### Requirement 10: Modular Source Code

**User Story:** As a Developer, I want the large source files split into focused modules, so that the codebase stays maintainable as features grow.

#### Acceptance Criteria

1. THE Simulation SHALL organize feature-specific logic into Code_Modules that each contain no more than 200 source lines, excluding blank lines and comment-only lines.
2. WHERE a Code_Module serves as an Import_Hub that aggregates or orchestrates other modules, THE Simulation SHALL permit that Import_Hub to exceed the 200 source line limit defined in criterion 1.
3. WHEN source files are split into modules, THE Simulation SHALL preserve the runtime behavior of the yard, ships, gate, trucks, gate screens, and user-interface features so that, for the same inputs and Operator interactions, the refactored Simulation produces output equivalent to the pre-refactor baseline.
4. THE Simulation SHALL expose shared Layout_Coordinates, geometry helpers, and materials through Import_Hub modules, and feature Code_Modules SHALL import these shared definitions from the Import_Hub modules.
5. IF a feature Code_Module redefines a shared Layout_Coordinate, geometry helper, or material locally instead of importing it from an Import_Hub, THEN THE refactoring SHALL be treated as non-compliant with criterion 4.
6. WHEN the refactored Simulation is loaded in the browser, THE Simulation SHALL initialize with zero module import or resolution errors reported in the browser console.
