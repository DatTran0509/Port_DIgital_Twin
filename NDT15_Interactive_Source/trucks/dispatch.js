/* ──────────────────────────────────────────────────────────────────────────
 * trucks/dispatch.js — Truck spawn / re-dispatch with separation guarantees
 *
 * Owns the shared `trucks` simulation array and spawns trucks with the
 * graph-driven model consumed by trucks/router.js:
 *   { id, g, cargo, hl, plate, state, path, pathIdx, edgeId, s,
 *     assignedBlock, isImport, servingRtg, hold, barIdx, x, z, spd, wait,
 *     yardLane, pending }
 *
 * Every truck is seated landward of the gate on the inbound gate lane, in
 * state 0 (approach gate). `assignedBlock` is a block INDEX in [0, BLOCK_COUNT)
 * that the router maps to both the matching service node and the RTG crane that
 * serves it (rtgCranes[assignedBlock] ↔ SERVICE[assignedBlock], same row-major
 * order). `isImport` sets the cargo direction (whether the truck arrives loaded)
 * and is read by the RTG crane.
 *
 * MINIMUM-SEPARATION SPAWN (Req 6.5 / Property 11): a truck is only placed at a
 * candidate slot whose CENTER distance to every other truck is ≥ SEP
 * (TRUCK_LEN + MIN_SEP = 13), i.e. a ≥ 2.0 m bumper-to-bumper gap. SEP matches
 * collision.js FOLLOW_THRESH so a freshly seated truck never instantly overlaps
 * a queued one.
 *
 * DEFER-AND-RETRY (Req 6.6 / Req 5.6): when the inbound lane is backed up and no
 * candidate slot is clear, the truck is NOT placed overlapping — it is parked
 * invisibly far landward, flagged `pending`, and re-tried every frame via
 * tryPlacePending() (called once per frame from router.updateTrucks) until a
 * non-overlapping slot frees. A truck is NEVER removed from trucks[].
 *
 * CRANE HANDOFF (Req 5.4, 5.5): the handoff itself lives in router state 3
 * (`rc.tTrk = tk` when rtgCranes[assignedBlock] is idle/free). This module only
 * guarantees the supporting model — `assignedBlock` → crane mapping and
 * `servingRtg`. When no crane is free the router holds the truck stationary at
 * its service-node arrival point; collision.js's following-gap keeps trucks
 * queued behind it from overlapping (same shared-edge spacing check).
 *
 * The spawn scan is a bounded loop over fixed candidate slots and allocates
 * nothing in steady state (Req 6.7 / 9.3 friendly).
 *
 * Requirements: 5.4, 5.5, 5.6, 6.5, 6.6, 10.1, 10.4
 * ────────────────────────────────────────────────────────────────────────── */

import { cMats } from '../core.js';
import { buildTruck, setTruckOpacity } from './truck-mesh.js';
import { PARAMS, gatePosition } from '../layout.js';
import { blocks, blockData } from '../yard/blocks.js';

export const trucks = [];

const BLOCK_COUNT = PARAMS.COLS * PARAMS.ROWS;
const GP = gatePosition();

/* ── Gate lane x-values (mirror gate/gate.js barriers) ────────────────────────
 * gate.js builds 4 barriers at x = [-30,-10,10,30] and treats x<0 as INBOUND,
 * x>0 as OUTBOUND. Trucks are spread over BOTH inbound lanes on entry and BOTH
 * outbound lanes on exit (round-robin by id), so all four barriers are used
 * instead of only the two middle (±10) ones. */
const IN_LANES  = [-10, -30];            // inbound (entry) gate lanes
const OUT_LANES = [10, 30];              // outbound (exit) gate lanes

/* ── Separation tunables (mirror collision.js so spawn ↔ follow agree) ────── */
const TRUCK_LEN = 11.0;                  // truck body length (center clearance)
const MIN_SEP   = 3.0;                   // required bumper-to-bumper gap (3 m, Req)
const SEP       = TRUCK_LEN + MIN_SEP;   // min CENTER spacing = 14 (= FOLLOW_THRESH)

/* ── Bounded candidate spawn slots along the inbound lane, landward of gate ── */
const SPAWN_SLOTS = 12;                  // bounded scan — never allocates per frame
const SPAWN_STEP  = SEP;                 // slots one separation apart
// Nearest slot sits BEYOND the router's fade band (GP.z + FADE_LEN, FADE_LEN=40),
// so the inbound spawn position and the exit→respawn lane teleport both happen
// while the router renders the truck fully transparent (alpha 0 for z ≥ GP.z+40).
const SPAWN_Z0    = GP.z + 80;           // nearest slot, well landward of the fade band
// Holding spot for deferred trucks: beyond every slot, where the fade math
// (router) renders them fully transparent until a real slot frees.
const PARK_Z      = SPAWN_Z0 + (SPAWN_SLOTS + 2) * SPAWN_STEP;

/* ── Staggered random entry (Problem 2) ───────────────────────────────────────
 * Each freshly (re)dispatched truck waits enterWait seconds — parked invisibly
 * off-lane — before it first attempts to seat on its inbound lane. This makes
 * the fleet trickle in at random times instead of all 8 spawning together and
 * stacking at the gate. enterWait = random[0,ENTER_BASE) + id*ENTER_STAGGER so
 * the initial batch is also spread out by id. */
const ENTER_BASE    = 12;                // max random entry delay (seconds)
const ENTER_STAGGER = 0.8;               // per-id offset so the first batch trickles in

let _nextId = 0;

// True when (x,z) keeps ≥ SEP center distance from every truck except `skip`.
// Deferred (parked) trucks are ignored — they hold off-lane and never block a slot.
function slotClear(x, z, skip) {
  for (let i = 0; i < trucks.length; i++) {
    const o = trucks[i];
    if (o === skip || o.pending) continue;
    const dx = o.x - x, dz = o.z - z;
    if (dx * dx + dz * dz < SEP * SEP) return false;   // would violate ≥ 2.0 m
  }
  return true;
}

// Seat `tk` at the first clear candidate slot on ITS inbound lane (tk.inLaneX).
// Returns true and writes tk.x/tk.z, or false when every slot is occupied.
// Trucks on different inbound lanes are 20 apart (> SEP=13) so the Euclidean
// slotClear check never conflates them — we only need to seat x = tk.inLaneX.
function placeOnInboundLane(tk) {
  for (let k = 0; k < SPAWN_SLOTS; k++) {
    const z = SPAWN_Z0 + k * SPAWN_STEP;
    if (slotClear(tk.inLaneX, z, tk)) { tk.x = tk.inLaneX; tk.z = z; return true; }
  }
  return false;
}

// Commit a seated truck to the active driving state (approach the gate).
function activate(tk) {
  tk.pending = false;
  tk.state = 0; tk.hold = false; tk.barIdx = -1; tk.servingRtg = null;
  tk.s = 0; tk.pathIdx = 0; tk.path = null; tk.edgeId = -1;
  tk.reroute = false; tk.stuck = 0; tk.frozen = 0; tk.rerouted = false;   // clear re-route/deadlock state
  tk.lat = 0; tk.latTarget = 0; tk.overtaking = false; tk.blockT = 0;     // clear overtake state
}

// Park a truck that could not be seated (or is still waiting out enterWait):
// held off-lane on its inbound lane, invisible, retried later.
function defer(tk) {
  tk.pending = true; tk.edgeId = -1;
  tk.x = tk.inLaneX; tk.z = PARK_Z;
  tk.g.position.set(tk.x, 5.0, tk.z);
  setTruckOpacity(tk, 0);                 // hidden until a non-overlapping slot frees
}

// Assign a stable inbound/outbound lane PAIR by id (round-robin over the two
// inbound and two outbound lanes), so both lanes on each side fill evenly.
function assignLanes(tk) {
  const k = tk.id % 2;
  tk.inLaneX  = IN_LANES[k];
  tk.outLaneX = OUT_LANES[k];
}

// Begin the staggered-entry waiting phase: pick a random entry delay and park
// the truck invisibly until tryPlacePending() counts it down and a slot frees.
function startPending(tk) {
  tk.enterWait = Math.random() * ENTER_BASE + tk.id * ENTER_STAGGER;
  defer(tk);                              // sets tk.pending = true, parks off-lane
}

// Assign a fresh block + cargo direction; reset routing/handoff state.
function reassign(tk) {
  tk.assignedBlock = Math.floor(Math.random() * BLOCK_COUNT);  // Req 5.6
  tk.isImport = Math.random() > 0.5;                            // cargo direction
  tk.cargo.visible = tk.isImport;
  assignCargo(tk);                                             // fresh container/goods
  updateTruckInfo(tk);                                         // refresh click-info snapshot
}

/* ── Rich truck cargo / haulage info ──────────────────────────────────────── */
const CONT_TYPES = ["20'GP (hàng khô)", "40'GP (hàng khô)", "40'HC (cao 9'6\")", "20'RF (lạnh)", "40'RF (lạnh)", "20'OT (mui trần)", "40'FR (sàn phẳng)"];
const GOODS = ['Điện tử & linh kiện', 'Hàng dệt may', 'Nông sản', 'Máy móc thiết bị', 'Hóa chất công nghiệp', 'Đồ gỗ nội thất', 'Thủy sản đông lạnh', 'Linh kiện ô tô', 'Cà phê & hạt điều', 'Gạo xuất khẩu'];
const OWNERS = ['MSCU', 'MAEU', 'CMAU', 'COSU', 'OOLU', 'HLXU', 'TGHU', 'EGHU'];
const pickRand = arr => arr[Math.floor(Math.random() * arr.length)];

// Stable, per-haul cargo identity (a random ISO-6346-style container number,
// type, commodity and gross weight). Re-rolled on each (re)dispatch.
function assignCargo(tk) {
  const owner = pickRand(OWNERS);
  tk.contNo = owner + ' ' + Math.floor(100000 + Math.random() * 899999) + '-' + Math.floor(Math.random() * 10);
  tk.contType = pickRand(CONT_TYPES);
  tk.goods = pickRand(GOODS);
  tk.contWeight = (8 + Math.random() * 22).toFixed(1);         // gross tonnes
  tk.sealNo = 'VN' + Math.floor(100000 + Math.random() * 899999);
}

// Live driving-status text derived from the truck's state machine state.
function truckStatusText(tk) {
  if (tk.pending) return '🕓 Chờ điều phối vào cảng';
  const s = tk.state;
  if (s === 0) return '🚦 Đang tiến vào cổng';
  if (s === 1 || s === 1.7) return '🪪 Kiểm tra cổng (check-in)';
  if (s === 2) return '➡️ Đang vào bãi đích';
  if (s === 3 || s === 3.5) return tk.isImport ? '⬇️ Cẩu đang dỡ hàng xuống bãi' : '⬆️ Cẩu đang bốc hàng lên xe';
  if (s === 3.6 || s === 6) return '↩️ Rời bãi, tìm đường ra cổng';
  if (s === 6.2 || s === 6.5) return '🪪 Kiểm tra cổng (check-out)';
  if (s === 7) return '✅ Hoàn tất, rời cảng';
  return '🚚 Đang lưu thông trong cảng';
}

// Refresh the truck's clickable info object (mutated in place so any open panel
// stays bound). Combines the static driver/plate fields (kept from build) with
// the live haul: cargo, operation (load/unload), destination block, status.
export function updateTruckInfo(tk) {
  const d = tk.g.userData && tk.g.userData.data;
  if (!d) return;
  if (!tk._driver) {                       // capture the one-off identity from build
    tk._driver = d.details['Tài xế'];
    tk._company = d.details['Đơn vị vận tải'];
    tk._fuel = d.details['Mức nhiên liệu'];
  }
  const bd = blockData[tk.assignedBlock];
  const code = bd ? bd.details['Mã bãi'] : ('#' + (tk.assignedBlock + 1));
  const blkId = (blocks[tk.assignedBlock] && blocks[tk.assignedBlock].id) || (tk.assignedBlock + 1);

  d.icon = '🚛';
  d.name = 'Xe Đầu Kéo ' + tk.plate;
  d.subtitle = tk.isImport ? 'XE CHỞ HÀNG NHẬP (IMPORT)' : 'XE CHỞ HÀNG XUẤT (EXPORT)';
  d.details = {
    'Biển số': tk.plate,
    'Tài xế': tk._driver,
    'Đơn vị vận tải': tk._company,
    'Tác nghiệp': tk.isImport ? 'Dỡ container nhập về bãi' : 'Bốc container xuất lên tàu',
    'Bãi đích': 'BÃI ' + code + ' (Khối số ' + blkId + ')',
    'Số container': tk.contNo,
    'Loại container': tk.contType,
    'Loại hàng hóa': tk.goods,
    'Khối lượng (gross)': tk.contWeight + ' tấn',
    'Số seal niêm phong': tk.sealNo,
    'Tình trạng': truckStatusText(tk),
    'Mức nhiên liệu': tk._fuel,
  };
}

export function initTrucks() {
  for (let i = 0; i < 10; i++) {
    const isImport = Math.random() > 0.5;
    const v = buildTruck(cMats[i % cMats.length]);
    const tk = {
      id: _nextId++, g: v.g, cargo: v.cargo, hl: v.hl, plate: v.plate,
      state: 0, path: null, pathIdx: 0, edgeId: -1, s: 0,
      assignedBlock: Math.floor(Math.random() * BLOCK_COUNT),
      isImport, servingRtg: null, hold: false, barIdx: -1,
      x: 0, z: SPAWN_Z0, spd: 20, wait: 0, yardLane: 0, pending: true,
      inLaneX: IN_LANES[0], outLaneX: OUT_LANES[0], enterWait: 0,
      lat: 0, latTarget: 0, overtaking: false, blockT: 0,
    };
    tk.cargo.visible = isImport;
    assignLanes(tk);                       // stable lane pair by id (spreads load)
    assignCargo(tk);                       // container/goods identity for this haul
    updateTruckInfo(tk);                   // build the rich clickable info snapshot
    trucks.push(tk);
    // Staggered entry: every truck starts pending with a random delay, parked
    // invisibly. tryPlacePending() seats it (with full separation) once its
    // delay elapses AND a slot is clear — so trucks trickle in, never stack.
    startPending(tk);
  }
}

// Re-dispatch a truck that has exited at the gate (Req 5.6): new block + cargo
// direction, refresh its lane pair, then begin a fresh staggered-entry wait and
// re-seat with ≥ 2.0 m separation when ready (Req 6.5/6.6).
export function reDispatch(tk) {
  reassign(tk);
  assignLanes(tk);
  startPending(tk);
}

// Called ONCE per frame by router.updateTrucks (with the frame dt): count down
// each pending truck's entry delay, then try to seat it now that earlier trucks
// may have cleared the spawn slots. Trucks placed here are sequenced in-loop, so
// two pending trucks never claim the same slot.
export function tryPlacePending(dt) {
  for (let i = 0; i < trucks.length; i++) {
    const tk = trucks[i];
    if (!tk.pending) continue;
    if (tk.enterWait > 0) { tk.enterWait -= dt; continue; }   // staggered delay
    if (placeOnInboundLane(tk)) activate(tk);                 // else stay parked, retry
  }
}
