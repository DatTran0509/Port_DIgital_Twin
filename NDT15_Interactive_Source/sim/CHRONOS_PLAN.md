# NDT CHRONOS — Kế hoạch triển khai chi tiết

> Động cơ thời gian của cảng. Biến digital twin từ "tấm gương phản chiếu hiện tại"
> thành "nhà tiên tri có thể tua thời gian, phân nhánh thực tại, và tự giải thích".
>
> Stack: Three.js r160 vanilla + ES modules + Chart.js (không thêm dependency nặng).

---

## 0. Tóm tắt 1 phút

CHRONOS là **một lõi thời gian** (`simClock`) mà mọi tính năng signature cắm vào:

```
            ┌──────────────────────────────────────────────┐
            │  CHRONOS KERNEL  (sim/timeline.js)             │
            │  simClock: time · rate(−2x…+8x) · setTime()    │
            │  snapshot ring-buffer (tua ngược)              │
            └───────────────┬──────────────────────────────┘
   ┌────────────┬───────────┼────────────┬─────────────────┐
   ▼            ▼           ▼            ▼                 ▼
 PAST        ORACLE     RESILIENCE   GLASS BOX          COPILOT
 replay   (future+fork) (env forks)  (giải thích)      (lái = NL)
 P0          P1+P2         P3          P2.5              P4
```

Một biến `simClock.time` thay cho `clock.getElapsedTime()`. Khi ta điều khiển được
biến đó (tua, dừng, fork) thì **tất cả** thực thể đang chạy theo thời gian (tàu, cẩu,
xe, drone) tự động phục tùng. Không build 4 tính năng rời — build **1 lõi + 4 lớp mỏng**.

---

## 1. KẾT QUẢ CUỐI CÙNG — làm xong trông như thế nào?

### 1.1 Giao diện sau khi hoàn tất

```
┌─────────────────────────────────────────────────────────────────────┐
│ NDT 15 · Smart Port            [☀ Day] [👁 UI]   ◀ topbar hiện có     │
│                                                                       │
│                      «  CẢNH 3D CẢNG (như hiện tại)  »               │
│                       + ghost layer tương lai (cyan trong mờ)         │
│                       + sợi nhân quả Glass Box (khi click)            │
│                                                                       │
│   ┌─ panel trái: Chart.js phân kỳ ─┐      ┌─ panel phải: Copilot ─┐   │
│   │  baseline ──────                │      │  💬 "nếu cẩu B3 hỏng?" │   │
│   │  forked   ╱╱╱╱╱ (phân kỳ đỏ)   │      └───────────────────────┘   │
│   └────────────────────────────────┘                                  │
│                                                                       │
│ ┌─ CHRONOS BAR (mới) ─────────────────────────────────────────────┐  │
│ │ ◀◀ ◀ ❚❚ ▶ ▶▶   ⏱ 14:32  [−2x ─●──── +8x]                       │  │
│ │ [◀──── PAST ────●NOW──── FUTURE (ghost) ────▶]                  │  │
│ │                  │                                               │  │
│ │           [ ⚡ FORK REALITY ]   [ 🌊 RESILIENCE ]               │  │
│ └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Ba trục năng lực mà khi xong sẽ có (mà không cảng web nào có đủ cả ba)

| Trục | Khả năng | Tính năng |
|---|---|---|
| **Thời gian** | tua lại / dừng / chạy nhanh / nhìn tương lai / phân nhánh | Chronos + Oracle |
| **Không gian** | (mở rộng sau) lặn xuống nước / xuống tầng ngầm | Resilience (flood) + Blue Twin* |
| **Nhân quả** | click hậu quả → thấy chuỗi nguyên nhân | Glass Box |

\* Blue Twin là module có thể cắm sau, không nằm trong 5 phase lõi này.

### 1.3 Cấp độ digital twin đạt được

Đi từ **Cấp 1 (Descriptive)** hiện tại → **Cấp 4 (Prescriptive)**: không chỉ
hiển thị, mà mô phỏng what-if và **đề xuất hành động hóa giải**. Đây chính là
"cú hit" — nhảy 3 cấp so với phần lớn cảng thật đang ở cấp 1–3.

---

## 2. KIẾN TRÚC — các tính năng kết hợp với nhau như thế nào

### 2.1 Sơ đồ luồng dữ liệu

```
 wall clock (THREE.Clock)
        │ dtWall
        ▼
 ┌──────────────────┐   time, dt   ┌─────────────────────────────┐
 │   simClock       │ ───────────▶ │  animate() trong scene.js   │
 │  (timeline.js)   │              │  gọi mọi update*(time, dt)  │
 └────────┬─────────┘              └──────────────┬──────────────┘
          │ mỗi 0.5s                              │ mỗi frame
          ▼                                       ▼
 ┌──────────────────┐                  ┌──────────────────────────┐
 │ snapshot buffer  │◀── ghi ──────────│ trạng thái thực thể      │
 │  (snapshot.js)   │── đọc khi tua ──▶│ (tàu/cẩu/xe/cổng)        │
 └──────────────────┘   ngược về PAST  └──────────────────────────┘

 Khi FORK:
 ┌──────────────┐  events   ┌──────────────┐  metrics  ┌──────────────┐
 │ scenario.js  │ ────────▶ │  impact.js   │ ────────▶ │ Chart.js +   │
 │ (kịch bản)   │           │ (cascade)    │           │ ghost.js     │
 └──────────────┘           └──────┬───────┘           └──────────────┘
                                   │ "vì sao?"
                                   ▼
                            ┌──────────────┐
                            │ glassbox.js  │ vẽ sợi nhân quả 3D
                            └──────────────┘
```

### 2.2 Quy tắc phụ thuộc (giữ đồ thị import không vòng — Req 10.6 của repo)

- `sim/*` chỉ import từ `core.js` (giống mọi module khác).
- `scene.js` là **orchestrator duy nhất** import `sim/*` và nối vào loop.
- Mỗi tính năng (Oracle/Resilience/GlassBox/Copilot) là **một lớp đọc** trạng thái
  Chronos + scenario, **không** tự giữ vòng đời thời gian riêng.

### 2.3 Cách 4 tính năng "bắt tay" trong một phiên demo

1. **Chronos** cho bạn dừng ở 14:00.
2. **Oracle** kéo tới 16:00 (tương lai) → ghost layer hiện tàu/xe sẽ ở đâu.
3. Nhấn **Fork Reality** → `scenario` tiêm "cẩu B3 hỏng" → `impact` chạy cascade →
   ghost-overlay vũ trụ phản thực + Chart.js phân kỳ.
4. **Glass Box**: click vào "cổng kẹt 14 xe" → sợi sáng truy ngược về "cẩu B3 hỏng".
5. **Copilot**: thay vì bấm nút, bạn gõ *"điều gì xảy ra nếu cẩu B3 hỏng lúc 14h?"* →
   nó tự gọi `simClock.setTime(14:00)` + `scenario.inject('CRANE_FAIL')` + bay camera.

→ Mỗi lớp đều chỉ gọi **cùng một API** của Chronos. Đó là lý do build lõi trước.

---

## 3. KẾ HOẠCH THEO PHASE (deliverable + tiêu chí nghiệm thu)

### PHASE 0 — Temporal Core (xương sống) ⚠️ quan trọng nhất

**Mục tiêu:** chiếm quyền kiểm soát thời gian; tua/dừng/chạy nhanh; tua ngược qua snapshot.

**File tạo:** `sim/timeline.js`, `sim/snapshot.js`
**File sửa:** `scene.js` (loop), `index.html` + `styles.css` (Chronos bar)

**API `simClock` (sim/timeline.js):**
```js
export const simClock = {
  time: 0,            // giây mô phỏng (đồng bộ ban đầu với clock)
  rate: 1,            // -2..0..+8 (0 = pause, âm = tua ngược)
  mode: 'live',       // 'live' | 'scrub' | 'fork'
  now: 0,             // mốc "hiện tại" (mép phải vùng thực)
  horizonPast: 1800,  // tua lại tối đa 30' (giới hạn buffer)
  horizonFuture: 7200,// nhìn trước tối đa 2h
  dt: 0,              // delta đã nhân rate, dùng cho updater
  tick(dtWall) {...}, // gọi mỗi frame: cập nhật time theo rate, kẹp biên
  setTime(t) {...},   // nhảy tuyệt đối (scrubber kéo / copilot)
  setRate(r) {...},
  isPast()   { return this.time < this.now - 0.1 },
  isFuture() { return this.time > this.now + 0.1 },
};
```

**Cơ chế tua ngược (rủi ro #1):**
- Tàu = `vesselPose(v, time)` thuần hàm theo thời gian → tua ngược tự nhiên, OK.
- Cẩu/xe = bộ tích phân (`lc.lifts`, `lc.scp`, vị trí xe cộng dồn theo dt) → **không** chạy ngược được.
- **Giải pháp — ring-buffer snapshot:**
  - Mỗi 0.5s (khi `mode==='live'`) ghi một frame nhẹ: `{t, cranes:[{sz,sh,vis}], trucks:[{x,z,vis}], gateQueue, ...}`.
  - Buffer vòng ~ `horizonPast/0.5 = 60` frame → rất nhẹ.
  - Khi `isPast()`: KHÔNG gọi update tích phân; thay vào đó `snapshot.sample(time)` nội suy
    tuyến tính 2 frame gần nhất và **set thẳng** pose cho cẩu/xe. Tàu vẫn tính bằng `vesselPose`.

**Sửa scene.js (điểm chính):**
```js
// đầu animate():
const dtWall = Math.min(clock.getDelta(), .05);
simClock.tick(dtWall);
const el = simClock.time, dt = simClock.dt;   // ◀ mọi update* dùng 2 biến này

if (simClock.isPast()) {
  snapshot.apply(el);          // set pose cẩu/xe/cổng từ buffer
  // vẫn chạy: vessels (hàm thời gian), ocean, render
} else {
  // nhánh live/future như cũ: updateRtgCranes(dt), updateTrucks(dt,...), ...
  if (simClock.mode==='live') snapshot.record(el);
}
renderer.render(scene, camera);
```

**Chronos bar (index.html):** một `<div id="chronos">` cố định đáy màn hình:
nút ◀◀ ◀ ❚❚ ▶ ▶▶, ô giờ, slider rate, và **track scrubber** (input range hoặc
thanh kéo tự vẽ). Style tái dùng tông `#topbar`/`.top-btn` sẵn có trong `styles.css`.

**✅ Nghiệm thu Phase 0:** kéo scrubber về trái → cẩu/tàu/xe tua lại mượt; thả ở giữa
→ dừng; kéo phải trong vùng thực → chạy nhanh 8x; không vỡ animation, không rò bộ nhớ.

---

### PHASE 1 — Precognition (bóng ma tương lai)

**Mục tiêu:** kéo qua `now` → nhìn thấy tương lai dạng ghost.

**File tạo:** `sim/ghost.js`   **File sửa:** `scene.js`

**Cơ chế:**
- Tàu: `vesselPose(v, futureTime)` cho ngay vị trí tương lai (miễn phí).
- Cẩu/xe: chạy một **predictive run** rẻ — tiến mô hình `impact` (mục 4) từ `now → time`
  trên bản sao trạng thái nhẹ, lấy vị trí dự kiến.
- Render ghost: `InstancedMesh` dùng lại geometry container/tàu, material `transparent`,
  `opacity 0.32`, `emissive` cyan `#34E0F0`, `depthWrite:false`. Một group `ghostLayer`
  bật khi `isFuture()`, tắt khi về thực.

**✅ Nghiệm thu:** kéo tới +90' → thấy tàu mới đang vào, container ghost xuất hiện ở bãi
đúng chỗ mô hình dự báo; kéo về thực → ghost biến mất.

---

### PHASE 2 — Fork & Cascade (CÚ HIT — Oracle)

**Mục tiêu:** phân nhánh thực tại; chạy cascade hậu quả; so sánh song song.

**File tạo:** `sim/scenario.js`, `sim/impact.js`   **File sửa:** `scene.js`, `features.js` (thẻ "Chronos")

**Luồng:**
1. Đang ở tương lai (hoặc tại NOW), nhấn **Fork Reality** → `simClock.mode='fork'`.
2. Chọn kịch bản (mục 5) → `scenario.inject(id, atTime)`.
3. Mỗi frame: chạy **2 mô hình `impact` song song** — `baseline` (không sự kiện) và
   `forked` (có sự kiện) — từ `now` đến `time`.
4. Hiển thị:
   - **Ghost-overlay** vũ trụ forked (đỏ-cam) chồng lên baseline.
   - **Chart.js**: 2 đường (kẹt cổng / chi phí / phát thải) phân kỳ theo thời gian.
   - Bảng KPI delta: `Δ chờ tàu +3.2h · Δ chi phí +$38k · Δ CO₂ +12%`.
5. **Mitigation:** nút "AI hóa giải" tiêm sự kiện đối ứng (vd điều cẩu B2 sang) →
   đường forked uốn lại gần baseline → chứng minh giá trị quyết định.

**✅ Nghiệm thu:** fork "cẩu B3 hỏng" → trong 10s thấy rõ hai vũ trụ phân kỳ trên 3D +
chart; bấm hóa giải → phân kỳ thu hẹp có thể đo bằng số.

---

### PHASE 2.5 — Glass Box (giải thích nhân quả) — *rẻ, làm xen Phase 2*

**Mục tiêu:** click một hậu quả → thấy chuỗi nguyên nhân bằng sợi sáng 3D.

**File tạo:** `sim/glassbox.js`   (tận dụng helper `cable()` trong core.js)

**Cơ chế:** `impact` ghi lại **cây nhân quả** (mỗi metric biến động gắn `cause: eventId/nodeId`).
Click vào KPI/đối tượng → `glassbox.trace(node)` dựng đường gấp khúc nối các thực thể
3D theo chuỗi cause, animate dòng sáng chạy dọc (giống flow particle), kèm nhãn text.

**✅ Nghiệm thu:** click "cổng kẹt 14 xe" → sợi sáng nối Cổng → Bãi C → Cẩu B3 → nhãn
"cẩu B3 hỏng 14:00" hiện tuần tự.

---

### PHASE 3 — Resilience Sandbox (Hướng B)

**Mục tiêu:** thêm họ kịch bản môi trường/khủng hoảng, tái dùng nguyên engine fork.

**File sửa:** `sim/scenario.js` (+ loại event), `env/underground.js` (flood hook), `sim/impact.js`

**Mới:**
- `sea_level {value:m}` → nâng mặt nước (THREE.Water y), `flood-detect` theo AABB hạ tầng;
  trạm điện ngầm trong `underground.js` bị ngập → đổi material đỏ + cắt điện → cascade.
- `storm {windKts, wave}` → tăng biên độ sóng, drone hạ cánh, cẩu ngừng (gió > ngưỡng).
- `fire {zone}` / `cyber {target:'gate'}` → đóng vùng / cổng về thủ công (kẹt tăng vọt).

**✅ Nghiệm thu:** kéo mực nước +2.4m → nước phủ cầu cảng, 2 trạm ngầm đỏ, chart tải điện
tụt, lộ trình phục hồi hiện thời gian dự kiến.

---

### PHASE 4 — Copilot (Hướng C)

**Mục tiêu:** điều khiển toàn bộ bằng ngôn ngữ tự nhiên.

**File tạo:** `sim/copilot.js`   (parser intent → gọi API Chronos/scenario/camera)

**Cơ chế:** vì API đã có (`setTime`, `inject`, `flyTo`), Copilot chỉ ánh xạ câu →
chuỗi lệnh. Bản đầu có thể dùng rule/regex intent ("nếu … hỏng lúc …" → CRANE_FAIL@time);
bản sau cắm LLM. Bay camera = tween `camera.position` + `orbit.target`.

**✅ Nghiệm thu:** gõ "nếu cẩu B3 hỏng lúc 14h thì sao" → tự tua tới 14h, fork, bay camera
tới B3, mở chart. Không cần chạm nút.

---

## 4. MÔ HÌNH MÔ PHỎNG (impact.js) — cascade chạy như thế nào

Không mô phỏng vật lý chính xác — mục tiêu là **phân kỳ hợp lý & nhìn thấy được**.
Mô hình mạng-dòng (flow-network) rời rạc, bước 1 phút mô phỏng:

### 4.1 Nút trạng thái
```js
state = {
  berths: [{id, occupied, vessel, craneOk, progress, dwellMin}],  // theo v.bx
  yard:   {importFill, exportFill, blocks:[{id,fill}]},
  gate:   {queue, throughputPerMin, mode:'auto'|'manual'},
  power:  {loadMW, supplyMW, undergroundOk},
  kpi:    {vesselWaitH, costUSD, co2Pct, esg},
}
```

### 4.2 Quy tắc lan truyền (mỗi bước)
```
cẩu hỏng  → berth.progress dừng → dwell tăng → tàu kế phải chờ (vesselWait↑)
dwell↑    → bãi import giải phóng chậm → block.fill↑
bãi đầy   → RTG chậm → xe trong cảng chờ → gate.queue↑
gate.queue↑ → xe id ling → co2↑, cost(demurrage)↑
power mất → gate về manual + cẩu ngừng → throughput↓ (đa hậu quả)
```
Mỗi biến động ghi `cause` (eventId hoặc node nguồn) → cấp dữ liệu cho Glass Box.

### 4.3 KPI xuất ra chart
`vesselWaitH`, `costUSD`, `co2Pct`, `gate.queue`, `esg` — 2 series baseline/forked.

---

## 5. HỆ THỐNG TỰ TIÊM TÁC ĐỘNG (scenario.js) + CÁC KỊCH BẢN

### 5.1 Schema một sự kiện
```js
// một scenario = mảng event, mỗi event mutate state tại thời điểm t (offset từ fork)
{ id:'CRANE_FAIL', label:'Cẩu B3 hỏng', icon:'🛠', category:'ops',
  events:[ { t:0,  type:'crane_fail', target:'berth3' },
           { t:0,  type:'cam_focus',  target:'berth3' } ],
  mitigation:[ { t:0, type:'crane_reassign', from:'berth2', to:'berth3' } ] }
```

### 5.2 Loại event hỗ trợ (engine đọc & mutate state)
| type | tham số | tác động vào state |
|---|---|---|
| `crane_fail` | target berth | `berth.craneOk=false`, progress dừng |
| `vessel_delay` | target, hours | dời ETA → bến trống/chờ |
| `vessel_surge` | count | thêm tàu vào hàng chờ |
| `gate_slowdown` / `gate_cyber` | — | `gate.mode='manual'`, throughput ÷3 |
| `power_outage` | zone | `power.supplyMW↓`, kéo theo cẩu+cổng |
| `sea_level` | value(m) | nâng nước, flood AABB → `undergroundOk=false` |
| `storm` | windKts, wave | sóng↑, drone hạ, cẩu ngừng nếu gió>ngưỡng |
| `fire` | zone | đóng block, sơ tán |
| `crane_reassign` (mitigation) | from→to | khôi phục một phần throughput |

### 5.3 Năm kịch bản mẫu (timeline + kết quả kỳ vọng)

#### KB-1 · "CRANE_FAIL" — Cẩu B3 hỏng (Oracle, ops)
```
t+0'   cẩu B3 ngừng (tàu MAERSK đang dỡ 60% → đứng hình)
t+15'  dwell B3 +25'; tàu EVER kế tiếp phải neo chờ ngoài luồng
t+30'  bãi import block C giải phóng chậm; xe export bắt đầu dồn
t+45'  gate.queue = 14 xe; cost +$38k (demurrage); co2 +12%
─ Mitigation (điều cẩu B2 sang) ─
t+50'  throughput hồi 60%; queue rút còn 6; Δcost giảm còn +$15k
```
**Kỳ vọng demo:** hai vũ trụ phân kỳ rõ; Glass Box nối Cổng→Bãi C→Cẩu B3.

#### KB-2 · "VESSEL_SURGE" — Dồn 3 tàu cùng cửa sổ thủy triều (Oracle, planning)
```
t+0'   3 tàu cùng xin cập trong 1h (chỉ 2 bến trống)
t+20'  1 tàu vào vùng neo chờ; JIT cảnh báo vàng
t+40'  nếu không điều tốc → phí neo +$30k/tàu; co2 hành trình↑
─ Mitigation (JIT điều tốc tàu #3 chậm lại) ─
       tàu #3 tới đúng lúc bến trống → 0 phí chờ
```
**Kỳ vọng:** chứng minh giá trị JIT bằng số tiền tiết kiệm.

#### KB-3 · "STORM_SURGE" — Bão + nước dâng (Resilience, climate) ⭐
```
t+0'   storm windKts=55, wave=3.2m → drone hạ cánh, cẩu STS ngừng (gió>45)
t+10'  sea_level +1.8m → nước tràn mép cầu bến
t+20'  +2.4m → 2 trạm điện NGẦM ngập (underground.js đỏ) → power.supply −30%
t+30'  cổng về manual (mất điện) → queue tăng vọt; throughput cảng ≈ 25%
─ Recovery ─
t+90'  nước rút, khôi phục điện; lộ trình phục hồi hiện "6h12m về bình thường"
```
**Kỳ vọng:** đây là cảnh "ăn ảnh" nhất cho lãnh đạo/chính phủ — nước phủ 3D thật,
hạ tầng ngầm đỏ, cả cảng tê liệt rồi hồi phục.

#### KB-4 · "GATE_CYBER" — Tấn công mạng hệ thống cổng (Resilience, security)
```
t+0'   ALPR/booking bị khóa → gate.mode=manual, throughput ÷3
t+15'  queue 30+ xe kéo dài ra đường vành đai; cost logistics↑
t+25'  An ninh AI cô lập phân hệ; mở làn manual dự phòng
─ Recovery ─  khôi phục auto sau 40' → queue tiêu tan
```
**Kỳ vọng:** liên kết với tính năng An ninh AI sẵn có (feature 05).

#### KB-5 · "POWER_OUTAGE" — Mất điện lưới, chạy nguồn tái tạo (Resilience, energy)
```
t+0'   lưới mất → power.supply tụt; cẩu + cổng ưu tiên tải
t+5'   pin/điện mặt trời+gió (feature 09) gánh tải tới hạn
t+20'  nếu tải>nguồn → cắt luân phiên khu không ưu tiên (yard lights tắt)
─ Mitigation (tối ưu luồng điện) ─  duy trì 100% tác nghiệp cốt lõi
```
**Kỳ vọng:** nối với tính năng Năng lượng (feature 09) + microgrid.

### 5.4 Cách một kịch bản "chạy" trong engine
```
fork() → clone state thành {baseline, forked}
loop mỗi bước 1' mô phỏng từ now→time:
   baseline.step()                      // không sự kiện
   forked.step(); scenario.applyAt(t)   // tiêm event đúng mốc t
   ghi KPI 2 series; ghi cause-tree
render: ghost-overlay(forked) + chart(baseline vs forked) + KPI delta
click KPI → glassbox.trace(cause-tree)
```

---

## 6. STORYBOARD DEMO "CÚ HIT" (90 giây thuyết phục nhà đầu tư)

```
0:00  Cảng chạy bình thường (như hiện tại).
0:10  Kéo Chronos scrubber lùi → cả cảng TUA LẠI. "Đây là cỗ máy thời gian."
0:25  Kéo vượt NOW → ghost cyan của tương lai hiện ra. "Và nó thấy trước."
0:40  Nhấn FORK REALITY → chọn STORM_SURGE. Bão nổi, nước dâng phủ cầu cảng.
0:55  2 trạm ngầm đỏ, cả cảng tê liệt; Chart phân kỳ dốc đứng. "Nếu bão tới…"
1:05  Click "cổng kẹt" → Glass Box vẽ chuỗi nhân quả về tận trạm điện ngầm ngập.
1:15  Gõ Copilot: "làm sao giảm thiệt hại?" → AI tiêm mitigation, đường đỏ uốn lại.
1:30  "Không cảng nào trên thế giới cho bạn TUA, HỎI, và THẤY TRƯỚC như thế này."
```

---

## 7. THỨ TỰ THỰC HIỆN ĐỀ XUẤT & RỦI RO

| Ưu tiên | Phase | Vì sao |
|---|---|---|
| 1 | **P0 Temporal Core** | nền móng; nếu chắc → 4 lớp sau lắp nhanh |
| 2 | **P2 + P2.5** Oracle + Glass Box | đây là "cú hit"; làm sớm để có demo |
| 3 | **P1 Precognition** | đẹp nhưng phụ thuộc mô hình predictive của P2 |
| 4 | **P3 Resilience** | tái dùng engine fork; cảnh ăn ảnh nhất |
| 5 | **P4 Copilot** | lớp mỏng trên API đã có |

**Rủi ro & cách chặn:**
- *Tua ngược cẩu/xe* → snapshot ring-buffer (đã thiết kế ở P0).
- *Hiệu năng ghost/2 vũ trụ* → mô hình impact rời rạc 1'/bước (rẻ), ghost bằng InstancedMesh.
- *Đồ thị import vòng* → `sim/*` chỉ import `core.js`; chỉ `scene.js` import `sim/*`.
- *Phình scene.js* → giữ logic trong `sim/*`, scene.js chỉ orchestrate (đúng vai trò hiện tại).

---

*Tài liệu này là bản thiết kế để review trước khi code. Bước kế: scaffold Phase 0
(`sim/timeline.js` + `sim/snapshot.js` + Chronos bar + wire vào `scene.js`).*
