/* ──────────────────────────────────────────────────────────────────────────
 * process-scenes.js — Authored "screenplay" for the Digital-Twin Theater.
 *
 * Each feature id maps to a list of STAGES. A stage drives one beat of the
 * cinematic walkthrough:
 *   title      : short stage heading
 *   loop       : which Digital-Twin loop phase it belongs to
 *                ('physical' | 'sense' | 'twin' | 'ai' | 'decide' | 'act')
 *   viz        : a renderer key from process-viz.js VIZ registry
 *   vp         : params object passed to the renderer
 *   narration  : 1–2 sentences explaining HOW the digital twin works here
 *   insight    : one punchy "before → after / why it matters" line, shown as a
 *                highlighted callout so a first-time viewer instantly gets the
 *                value (the "wow")
 *   inLabel    : data packet flowing INTO this stage (from the previous one)
 *   outLabel   : data packet this stage HANDS to the next one
 *   kpis       : [[k,v,u]] live metrics (numbers count up in the panel)
 *   dur        : optional seconds for this stage (defaults applied by theater)
 *
 * The "loop" phase teaches the *essence* of a digital twin — a continuous
 * cycle: physical world → sensing → digital model (twin) → AI analysis →
 * decision → actuation → (back to the physical world). Stages are ordered to
 * follow that cycle so the audience literally watches the loop turn.
 * ────────────────────────────────────────────────────────────────────────── */

export const LOOP_PHASES = [
  { key: 'physical', label: 'Thế Giới Thực', icon: '🌐' },
  { key: 'sense', label: 'Cảm Biến', icon: '📡' },
  { key: 'twin', label: 'Bản Sao Số', icon: '🧊' },
  { key: 'ai', label: 'Phân Tích AI', icon: '🧠' },
  { key: 'decide', label: 'Quyết Định', icon: '🎯' },
  { key: 'act', label: 'Hành Động', icon: '⚙️' },
];

const SCENES = {
  /* ─── 01 · Điều Phối Bến Thông Minh ─────────────────────────────────── */
  '01': [
    {
      title: 'AIS quét tàu từ xa', loop: 'sense', viz: 'radar',
      vp: { caption: 'AIS · bán kính 50 hải lý · chu kỳ 30s', blips: [{ a: 0.6, r: 0.85 }, { a: 2.0, r: 0.5 }, { a: 3.7, r: 0.7 }, { a: 5.0, r: 0.9 }, { a: 4.3, r: 0.35, alert: true }] },
      inLabel: 'Sóng AIS từ tàu', outLabel: 'GPS · tốc độ · hướng · ETA',
      narration: 'Mỗi 30 giây, cảng thu tín hiệu AIS của mọi tàu trong 50 hải lý — vị trí, tốc độ, hướng, mớn nước. Đây là lớp "giác quan" liên tục nuôi dữ liệu cho bản sao số.',
      insight: 'Một tàu neo chờ ngoài luồng tốn $30.000–$50.000/ngày. AIS theo dõi 12 tàu cùng lúc — điều mắt người không thể.',
      kpis: [['Tàu theo dõi', '12', 'chiếc'], ['Bán kính quét', '50', 'hải lý'], ['Chu kỳ cập nhật', '30', 's']],
    },
    {
      title: 'TIS đối chiếu trạng thái bến', loop: 'sense', viz: 'grid',
      vp: { cols: 7, rows: 1, caption: 'Trạng thái 7 bến · real-time', heat: true },
      inLabel: 'GPS · tốc độ · ETA', outLabel: 'Bến trống · tiến độ %',
      narration: 'Lớp TIS tra cứu real-time từng bến: đang bốc dỡ, tiến độ %, thời gian dự kiến xong. Trạng thái vật lý của cầu cảng được ánh xạ tức thì vào mô hình số.',
      insight: 'Thay vì gọi điện hỏi từng bến, trạng thái cả 7 bến hiện trên một màn hình — ai cũng nhìn chung một sự thật.',
      kpis: [['Bến trống', '4', '/7'], ['Đang khai thác', '3', 'bến'], ['Tiến độ TB', '62', '%']],
    },
    {
      title: 'GIS dựng bản đồ luồng số', loop: 'twin', viz: 'grid',
      vp: { cols: 9, rows: 6, caption: 'Bản đồ GIS · luồng lạch + vùng neo', heat: true },
      inLabel: 'Bến trống · tiến độ %', outLabel: 'Bản sao số luồng cảng',
      narration: 'GIS hợp nhất tàu, luồng lạch và vùng neo thành một bản sao số sống động — tàu được mã màu Xanh (JIT OK), Vàng (cần điều chỉnh), Đỏ (trễ).',
      insight: 'Gộp 6 lớp dữ liệu rời rạc thành 1 bức tranh duy nhất — nhìn là biết tàu nào sắp gây kẹt luồng.',
      kpis: [['Lớp dữ liệu', '6', 'lớp'], ['Tàu JIT OK', '8', 'chiếc'], ['Cần điều chỉnh', '3', 'chiếc']],
    },
    {
      title: 'AI tính lệnh điều tốc JIT', loop: 'ai', viz: 'ai',
      vp: { inputs: ['Vị trí tàu', 'Tiến độ bến', 'Luồng lạch', 'Thủy triều'], outputs: ['Vận tốc tối ưu', 'Cửa sổ cập bến'], caption: 'Thuật toán Just-in-Time' },
      inLabel: 'Bản sao số luồng', outLabel: 'Vận tốc tối ưu (knot)',
      narration: 'Thuật toán JIT mô phỏng hàng nghìn kịch bản trên bản sao số, tính vận tốc để tàu tới đúng lúc bến trống — triệt tiêu thời gian neo chờ tốn kém.',
      insight: 'AI thử 2.400 kịch bản/giây để chọn vận tốc tối ưu; con người tính tay mất hàng giờ và vẫn sai 45–90 phút.',
      kpis: [['Chuẩn JIT', '87', '%'], ['Sai số ETA', '10', 'phút'], ['Kịch bản/giây', '2400', '']],
    },
    {
      title: 'Berth Allocation Grid', loop: 'decide', viz: 'line',
      vp: { data: [0.2, 0.35, 0.3, 0.5, 0.62, 0.78, 0.7, 0.9], caption: 'Tiến độ bốc dỡ & phân bổ bến theo phút' },
      inLabel: 'Vận tốc tối ưu', outLabel: 'Lệnh phân bổ bến',
      narration: 'Hệ thống tự động phân bổ bến ngay khi tàu trước rời đi, hiển thị tiến độ theo từng phút và gửi thông báo xác nhận tới ekip vận hành.',
      insight: 'Tàu tới đúng lúc bến vừa trống → gần 0 phút neo chờ → tiết kiệm tới $42.000 nhiên liệu mỗi ngày.',
      kpis: [['Nhiên liệu tiết kiệm', '42', 'k$/ngày'], ['Phí neo tránh được', '38', 'k$'], ['Bến tự phân bổ', '7', 'bến']],
    },
    {
      title: 'Xác nhận ETA cho hãng tàu', loop: 'act', viz: 'notify',
      vp: { cards: [{ t: 'ETA chính xác gửi hãng tàu', s: '±10 phút · qua API' }, { t: 'Lệnh điều tốc phát qua VHF', s: '14.2 → 11.8 knot' }, { t: 'Bến B3 xác nhận sẵn sàng', s: 'cập bến 14:20' }], caption: 'Lệnh quay lại thế giới thực' },
      inLabel: 'Lệnh phân bổ bến', outLabel: '↺ Tàu điều chỉnh tốc độ thật',
      narration: 'Lệnh điều tốc và ETA chính xác được phát qua VHF/API về tàu thật — vòng lặp digital twin khép kín: thế giới thực thay đổi, cảm biến lại ghi nhận và chu trình lặp lại.',
      insight: 'Đây là điểm "khép vòng": quyết định số quay về điều khiển tàu thật, rồi AIS lại đo — cảng tự điều phối 24/7.',
      kpis: [['Thông báo gửi', '12', ''], ['Độ chính xác ETA', '94', '%'], ['Hãng tàu kết nối', '8', '']],
    },
  ],

  /* ─── 02 · Bãi Container Số 3D ───────────────────────────────────────── */
  /* Flow theo đúng vòng lặp: Cảm biến → BẢN SAO SỐ → Phân tích AI → Quyết định
   * → Giám sát → Hành động. (Bản sao số được dựng TRƯỚC khi AI phân tích.)     */
  '02': [
    {
      title: 'Thu thập dữ liệu container', loop: 'sense', viz: 'stream',
      vp: { src: 'TÀU + TIS', dst: 'NỀN TẢNG BÃI', tokens: ['ID cont', 'Ngày đi', 'POD', 'Trọng lượng'], caption: 'Mỗi cont một "hộ chiếu số"' },
      inLabel: 'Lịch tàu + cảm biến', outLabel: 'Hồ sơ số từng container',
      narration: 'TIS và cảm biến cấp dữ liệu từng container: thuộc tàu nào, ngày xuất, điểm đến (POD), trọng lượng. Mọi thùng hàng vật lý đều có một "hồ sơ số" cập nhật từng giây.',
      insight: 'Mỗi container mang một "hộ chiếu số" — cảng luôn biết chính xác cái gì sẽ tới và rời đi khi nào.',
      kpis: [['Container/ngày', '1840', ''], ['Tàu trong kế hoạch', '6', 'tàu'], ['Điểm đến (POD)', '24', '']],
    },
    {
      title: 'BIM dựng bản sao số bãi 3D 1:1', loop: 'twin', viz: 'stack',
      vp: { cols: 6, tiers: 4, caption: 'Bản sao số 3D · địa chỉ Block-Bay-Row-Tier' },
      inLabel: 'Hồ sơ số container', outLabel: 'Mô hình bãi 3D sống',
      narration: 'BIM dựng mô hình số 1:1 của bãi: mỗi vị trí có địa chỉ Block-Bay-Row-Tier và cập nhật real-time theo từng lần cẩu gắp. Đây chính là "bản sao số" hữu hình của bãi vật lý — nền tảng để AI làm việc.',
      insight: 'Bản sao số 1:1 biết chính xác từng container nằm ở ô nào — không còn cảnh "đi tìm" cont giữa hàng vạn thùng.',
      kpis: [['Ô được địa chỉ hóa', '100', '%'], ['Sức chứa khả dụng', '15', '%↑'], ['Cập nhật', 'real', 'time']],
    },
    {
      title: 'AI phân tích & tối ưu xếp', loop: 'ai', viz: 'ai',
      vp: { inputs: ['Ngày xuất', 'Trọng lượng', 'POD', 'Trạng thái bãi'], outputs: ['Thứ tự xếp tối ưu', 'Bản đồ slot 72h'], caption: 'Tối ưu thứ tự tầng trên bản sao số' },
      inLabel: 'Mô hình bãi 3D', outLabel: 'Chiến lược xếp tối ưu',
      narration: 'Trên nền bản sao số, AI tính toán: container đi trước xếp tầng trên, đi sau xuống dưới. Nhờ "thử" trên mô hình số, cảng triệt tiêu các lần đảo chuyển vô ích trước khi chúng xảy ra ngoài thực địa.',
      insight: 'Đảo chuyển container rỗng vô ích từng ngốn 20% chi phí bãi. AI hạ xuống còn 4,1% — tiết kiệm thấy rõ.',
      kpis: [['Đảo chuyển còn', '4.1', '%'], ['Giảm so với cũ', '20', '%'], ['Tầm tối ưu', '72', 'giờ']],
    },
    {
      title: 'Gán slot tự động cho từng cont', loop: 'decide', viz: 'grid',
      vp: { cols: 10, rows: 6, caption: 'Mỗi cont nhập cảng → một ô tối ưu' },
      inLabel: 'Chiến lược xếp', outLabel: 'Lệnh vị trí từng container',
      narration: 'Mỗi container nhập cảnh được AI gán vị trí ngay lập tức; container xuất sớm luôn ở tầng trên, sẵn sàng cho cẩu lấy nhanh khi tàu tới.',
      insight: 'Gán chỗ trong 0,3 giây/cont, không bao giờ "chôn" nhầm cont cần lấy sớm dưới đáy chồng.',
      kpis: [['AI xếp hôm nay', '1840', 'cont'], ['Năng lượng cẩu', '18', '%↓'], ['Thời gian gán', '0.3', 's']],
    },
    {
      title: 'Yard Heatmap giám sát tải', loop: 'ai', viz: 'grid',
      vp: { cols: 8, rows: 5, heat: true, caption: 'Bản đồ nhiệt công suất từng khu' },
      inLabel: 'Lệnh vị trí', outLabel: 'Cảnh báo khu >90%',
      narration: 'Bản sao số liên tục tự giám sát: bản đồ nhiệt phơi bày tức thì khu nào quá tải (>90%) và đề xuất phân luồng — tầm bao quát mà con người đứng ở bãi không thể có.',
      insight: 'Cảnh báo khu sắp tắc TRƯỚC khi tắc thật — phòng bệnh hơn chữa bệnh, không gián đoạn khai thác.',
      kpis: [['Khu cảnh báo', '2', 'khu'], ['Tải cao nhất', '93', '%'], ['Đề xuất phân luồng', '3', '']],
    },
    {
      title: 'RTG nhận lệnh & thực thi', loop: 'act', viz: 'notify',
      vp: { cards: [{ t: 'Lệnh tới cabin RTG-04', s: 'Block C · Bay 12 · Tier 3' }, { t: 'Tuyến di chuyển tối ưu', s: 'giảm 18% năng lượng' }, { t: 'Xác nhận hoàn tất', s: 'cont MSCU 778-1 đã xếp' }], caption: 'Lệnh số → cẩu thật → cập nhật ngược' },
      inLabel: 'Cảnh báo & lệnh', outLabel: '↺ Cẩu di chuyển, bản sao số cập nhật',
      narration: 'Lệnh di chuyển hiện thẳng trên màn hình cabin RTG, giảm phụ thuộc phán đoán thủ công — và mỗi thao tác thật lại cập nhật ngược vào bản sao số, khép kín vòng lặp.',
      insight: 'Người vận hành chỉ việc làm theo màn hình; bản sao số luôn khớp 100% với bãi thật, không lệch dữ liệu.',
      kpis: [['RTG điều phối', '8', 'cẩu'], ['Lệnh/giờ', '210', ''], ['Sai vị trí', '0', '']],
    },
  ],

  /* ─── 03 · Hệ Thống Cổng Tự Động ────────────────────────────────────── */
  '03': [
    {
      title: 'Đặt Booking Slot trước 24h', loop: 'sense', viz: 'grid',
      vp: { cols: 8, rows: 4, caption: 'Khung giờ vào cảng · dàn đều tải' },
      inLabel: 'Yêu cầu vào cảng', outLabel: 'Slot giờ được cấp',
      narration: 'Xe tải đặt lịch qua app trước 24 giờ; hệ thống dàn đều lưu lượng theo khung giờ để xoá nạn "Gate Chaos" — kẹt xe nhiều km vào giờ cao điểm.',
      insight: 'Dàn đều xe theo giờ giúp giảm 40% tải giờ đỉnh — hàng km xe chờ biến mất ngay từ khâu lập kế hoạch.',
      kpis: [['Slot/ngày', '1230', ''], ['Tải giờ đỉnh', '40', '%↓'], ['Đặt trước', '24', 'giờ']],
    },
    {
      title: 'Phát QR & lệnh điện tử', loop: 'twin', viz: 'stream',
      vp: { src: 'HỆ THỐNG CỔNG', dst: 'TÀI XẾ', tokens: ['Cont ID', 'Slot', 'Cổng', 'Tuyến'], caption: 'Số hóa 100% hồ sơ giấy' },
      inLabel: 'Slot giờ', outLabel: 'Mã QR · tuyến đường số',
      narration: 'Tài xế nhận mã QR chứa container ID, slot, cổng vào và tuyến đi trong cảng — hồ sơ giấy về con số 0, mọi giao dịch tồn tại trong bản sao số.',
      insight: '0 tờ giấy: toàn bộ lệnh giao nhận sống trong bản sao số, tra cứu và đối soát tức thì.',
      kpis: [['Hồ sơ giấy', '0', 'tờ'], ['QR phát/ngày', '1230', ''], ['Trường dữ liệu/QR', '8', '']],
    },
    {
      title: 'Camera ALPR quét biển số', loop: 'sense', viz: 'camera',
      vp: { feed: 'GATE-CAM 03', target: 'ĐỌC BIỂN SỐ', caption: 'Nhận diện trong 0.8 giây' },
      inLabel: 'Xe tới làn', outLabel: 'Biển số nhận diện',
      narration: 'Xe vào làn không cần dừng, camera AI quét biển số với độ chính xác 99,4% chỉ trong 0,8 giây — thay cho nhân viên ghi chép thủ công.',
      insight: 'Đọc biển số trong 0,8 giây, không cần barie chặn xe đứng yên — luồng xe chảy liên tục.',
      kpis: [['Độ chính xác', '99.4', '%'], ['Thời gian đọc', '0.8', 's'], ['Làn hoạt động', '4', 'làn']],
    },
    {
      title: 'AI xác thực lệnh điện tử', loop: 'ai', viz: 'ai',
      vp: { inputs: ['Biển số', 'Slot giờ', 'Trọng tải', 'Container ID'], outputs: ['Kết quả hợp lệ ✓', 'Tuyến trong cảng'], caption: 'Đối chiếu < 2 giây' },
      inLabel: 'Biển số nhận diện', outLabel: 'Phán quyết hợp lệ',
      narration: 'AI đối chiếu biển số với lệnh điện tử, kiểm tra slot và trọng tải trong dưới 2 giây — quyết định thông quan hoàn toàn tự động, không cảm tính.',
      insight: 'Quy trình giấy tờ 30 phút rút còn dưới 2 giây xác thực — và chặn được xe sai phép ngay tại cổng.',
      kpis: [['Thời gian xác thực', '1.9', 's'], ['Tỷ lệ tự động', '98', '%'], ['Chặn sai phép', '12', 'lượt']],
    },
    {
      title: 'Barrier mở tự động', loop: 'act', viz: 'gate',
      vp: { plate: '51C-678.90', okText: '✓ HỢP LỆ · MỞ BARRIER', caption: 'Thông quan 1 phút 48 giây (−90%)' },
      inLabel: 'Phán quyết hợp lệ', outLabel: '↺ Barrier mở · xe vào',
      narration: 'Hợp lệ → barrier mở và hiển thị tuyến đi tới bãi; sai → giữ barrier kèm lý do. Toàn bộ quy trình 30 phút thủ công rút còn dưới 2 phút.',
      insight: 'Thông quan 1 phút 48 giây thay vì 30 phút — giảm 90%, xe lăn bánh ngay vào tuyến đã chỉ định.',
      kpis: [['Thời gian thông quan', '1.8', 'phút'], ['Giảm thời gian', '90', '%'], ['Xe/giờ', '180', '']],
    },
    {
      title: 'Audit Log tự động', loop: 'twin', viz: 'notify',
      vp: { cards: [{ t: 'Ghi nhận giao dịch', s: 'timestamp + ảnh camera' }, { t: 'Đối soát container', s: 'MSCU 778-1 · khớp' }, { t: 'Sẵn sàng kiểm toán', s: 'xuất hồ sơ 1-click' }], caption: 'Mọi sự kiện lưu vết số' },
      inLabel: 'Xe đã vào', outLabel: 'Nhật ký kiểm toán số',
      narration: 'Mỗi lượt qua cổng được ghi timestamp, biển số, container và hình ảnh camera — bản sao số trở thành sổ cái minh bạch, bất biến cho kiểm toán.',
      insight: '2.460 sự kiện/ngày tự lưu kèm ảnh + thời gian → tranh chấp giao nhận về 0, minh bạch tuyệt đối.',
      kpis: [['Sự kiện/ngày', '2460', ''], ['Lưu vết', '100', '%'], ['Tranh chấp', '0', '']],
    },
  ],

  /* ─── 05 · Lá Chắn An Ninh AI ───────────────────────────────────────── */
  '05': [
    {
      title: 'Radar SSIS quét 24/7', loop: 'sense', viz: 'radar',
      vp: { caption: 'Quét 360° · bán kính 5km · liên tục', blips: [{ a: 0.5, r: 0.7 }, { a: 2.4, r: 0.5 }, { a: 4.1, r: 0.85, alert: true }, { a: 5.4, r: 0.4 }] },
      inLabel: 'Sóng radar phản xạ', outLabel: 'Vật thể chuyển động',
      narration: 'Mạng radar ven biển quét 360° bán kính 5km, phát hiện mọi vật thể di chuyển trên 0,5 knot — phủ kín cả điểm mù ban đêm và sương mù.',
      insight: 'Radar canh 360°/5km cả khi đêm tối, sương mù — nơi mắt người và canô tuần tra hoàn toàn bó tay.',
      kpis: [['Độ phủ', '360', '°'], ['Bán kính', '5', 'km'], ['Hoạt động', '24/7', '']],
    },
    {
      title: 'AI lọc mục tiêu lạ', loop: 'ai', viz: 'ai',
      vp: { inputs: ['Contact radar', 'AIS whitelist', 'Quỹ đạo', 'Tốc độ'], outputs: ['Mục tiêu lạ', 'Mức đe dọa'], caption: 'Loại nhiễu · phân biệt bạn/thù' },
      inLabel: 'Vật thể chuyển động', outLabel: 'Toạ độ mục tiêu lạ',
      narration: 'AI loại nhiễu sóng và đối chiếu danh sách AIS hợp lệ — tàu đã đăng ký được bỏ qua, chỉ mục tiêu lạ mới kích hoạt phản ứng.',
      insight: 'Tự lọc tàu hợp lệ khỏi mục tiêu lạ → không "báo động giả" làm tê liệt đội an ninh giữa đêm.',
      kpis: [['Mục tiêu lạ', '1', ''], ['Nhiễu loại bỏ', '99', '%'], ['Độ chính xác', '100', '%']],
    },
    {
      title: 'UAV cất cánh tự động', loop: 'act', viz: 'drone',
      vp: { target: 'MỤC TIÊU 10.52°N', caption: 'Drone airborne trong 30 giây' },
      inLabel: 'Toạ độ mục tiêu', outLabel: 'UAV bay tới hiện trường',
      narration: 'Drone UAV nhận lệnh và cất cánh trong 30 giây, tự bay theo toạ độ GPS của mục tiêu — thay cho canô tuần tra đắt đỏ, không phủ kín 360°.',
      insight: 'Drone airborne trong 30 giây tới đúng toạ độ — cắt 50% chi phí so với canô và nhanh hơn nhiều lần.',
      kpis: [['Thời gian cất cánh', '30', 's'], ['UAV đang bay', '3', 'chiếc'], ['Chi phí tuần tra', '50', '%↓']],
    },
    {
      title: 'Camera nhiệt AI phân loại', loop: 'sense', viz: 'camera',
      vp: { thermal: true, feed: 'UAV-02 THERMAL', target: 'PHÂN LOẠI MỤC TIÊU', caption: 'Video hồng ngoại real-time' },
      inLabel: 'UAV tới nơi', outLabel: 'Video + phân loại đe dọa',
      narration: 'Drone truyền video hồng ngoại về trung tâm, AI phân loại mục tiêu và đánh giá mức độ đe dọa ngay trên luồng video — nhìn xuyên đêm và sương mù.',
      insight: 'Camera nhiệt thấy rõ mục tiêu trong bóng tối; AI phán đoán đe dọa ngay, không chờ người soi từng khung hình.',
      kpis: [['Khoảng cách', '120', 'm'], ['Độ tin cậy', '92', '%'], ['Độ trễ video', '0.4', 's']],
    },
    {
      title: 'Alert tới trung tâm chỉ huy', loop: 'decide', viz: 'notify',
      vp: { cards: [{ t: '02:17 · CẢNH BÁO XÂM NHẬP', s: 'mục tiêu lạ vùng nước đông' }, { t: 'Bằng chứng đính kèm', s: 'ảnh nhiệt + toạ độ 10.52°N' }, { t: 'Đề xuất ứng phó', s: 'điều lực lượng tuần tra' }], caption: 'Cảnh báo tức thì có bằng chứng' },
      inLabel: 'Phân loại đe dọa', outLabel: 'Cảnh báo + bằng chứng',
      narration: 'Cảnh báo tức thì hiện trên màn hình trung tâm kèm ảnh, video và toạ độ — biến dữ liệu cảm biến thành quyết định hành động trong vài giây.',
      insight: 'Từ lúc radar chớp tới khi có cảnh báo kèm bằng chứng: dưới 3 phút — đủ sớm để chặn đứng nguy cơ.',
      kpis: [['Thời gian phản ứng', '3', 'phút'], ['Cảnh báo/ca', '4', ''], ['Báo động giả', '0', '']],
    },
    {
      title: 'Phối hợp ứng phó', loop: 'act', viz: 'stream',
      vp: { src: 'TRUNG TÂM', dst: 'LỰC LƯỢNG', tokens: ['Toạ độ', 'Ảnh', 'Lệnh'], caption: 'Khép kín vòng an ninh' },
      inLabel: 'Cảnh báo', outLabel: '↺ Lực lượng triển khai',
      narration: 'Trung tâm xác minh qua video rồi điều lực lượng ứng phó; toàn bộ sự kiện được ghi lại, nuôi tiếp dữ liệu cho lần phân tích sau — vòng lặp học hỏi liên tục.',
      insight: 'Mỗi sự cố được ghi lại đầy đủ để AI "học" cho lần sau — hệ thống càng dùng càng thông minh.',
      kpis: [['Sự cố xử lý', '100', '%'], ['Ghi nhận sự kiện', 'full', ''], ['Vùng phủ', '5', 'km']],
    },
  ],

  /* ─── 08 · Hệ Sinh Thái Cảng Xanh EIS ───────────────────────────────── */
  '08': [
    {
      title: 'IoT sensor khí thải', loop: 'sense', viz: 'gauges',
      vp: { gauges: [{ l: 'CO₂', v: 0.32, u: 'ppm' }, { l: 'SOx', v: 0.08, u: '%' }, { l: 'NOx', v: 0.41, u: 'ppb' }], caption: 'Đo 1 phút/lần dọc cầu bến' },
      inLabel: 'Khí thải tàu/thiết bị', outLabel: 'Nồng độ CO₂·SOx·NOx',
      narration: 'Trạm IoT đo CO₂, SOx, NOx mỗi phút tại các điểm chiến lược dọc cầu bến — biến phát thải vô hình thành dữ liệu số đo đếm được.',
      insight: 'Phát thải vốn vô hình nay thành con số mỗi phút — sẵn sàng cho thuế carbon IMO ngày càng siết.',
      kpis: [['Trạm đo khí', '12', 'trạm'], ['Tần suất', '60', 's'], ['SOx hiện tại', '0.08', '%']],
    },
    {
      title: 'IoT sensor nước biển', loop: 'sense', viz: 'gauges',
      vp: { gauges: [{ l: 'WQI', v: 0.78, u: '' }, { l: 'pH', v: 0.5, u: '' }, { l: 'Đục', v: 0.22, u: 'NTU' }], caption: '8 trạm quan trắc nước real-time' },
      inLabel: 'Mẫu nước biển', outLabel: 'WQI · pH · hydrocarbon',
      narration: '8 trạm đo chỉ số chất lượng nước (WQI), độ đục, pH và hydrocarbon hòa tan real-time — giám sát sức khỏe môi trường vùng nước cảng.',
      insight: 'Phát hiện rò rỉ dầu hay ô nhiễm bất thường ngay khi mới chớm — trước khi thành sự cố môi trường lớn.',
      kpis: [['Trạm đo nước', '8', 'trạm'], ['WQI', '78', '/100'], ['Hydrocarbon', '0.01', 'mg/L']],
    },
    {
      title: 'EIS tổng hợp dashboard ESG', loop: 'twin', viz: 'ai',
      vp: { inputs: ['Khí thải', 'Nước', 'Năng lượng', 'Tàu cập bến'], outputs: ['Chỉ số ESG', 'Xu hướng'], caption: 'Hợp nhất mọi cảm biến thành ESG' },
      inLabel: 'Dữ liệu cảm biến', outLabel: 'Chỉ số ESG tổng hợp',
      narration: 'Lớp EIS hợp nhất mọi dòng cảm biến, tính chỉ số ESG tổng hợp và dựng dashboard trực quan — bản sao số môi trường của cả cảng theo thời gian thực.',
      insight: 'Gộp 20 nguồn dữ liệu rải rác thành 1 điểm số ESG duy nhất — lãnh đạo và nhà đầu tư nhìn là hiểu.',
      kpis: [['Điểm ESG Q2', '84', '/100'], ['Giảm CO₂ khi cập bến', '90', '%'], ['Nguồn dữ liệu', '20', '']],
    },
    {
      title: 'Đối chiếu chuẩn IMO 2020', loop: 'ai', viz: 'line',
      vp: { data: [0.7, 0.55, 0.6, 0.4, 0.45, 0.3, 0.35, 0.25], caption: 'So ngưỡng IMO · cảnh báo khi vượt' },
      inLabel: 'Chỉ số ESG', outLabel: 'Báo cáo tuân thủ',
      narration: 'Hệ thống tự so từng chỉ tiêu với ngưỡng IMO 2020 và lập báo cáo lỗi ngay khi vượt — chủ động phòng ngừa trước áp lực thuế carbon và rủi ro bị phạt.',
      insight: 'Cảnh báo vượt ngưỡng TRƯỚC khi bị thanh tra — biến tuân thủ từ "bị động đối phó" sang "chủ động kiểm soát".',
      kpis: [['Chỉ tiêu đạt', '11', '/12'], ['Cảnh báo vượt', '1', ''], ['Xu hướng', 'giảm', '']],
    },
    {
      title: 'Xuất báo cáo ESG 1-click', loop: 'decide', viz: 'notify',
      vp: { cards: [{ t: 'Báo cáo PDF chuẩn IMO', s: 'Quý 2 · đã tạo xong' }, { t: 'Bảng Excel kiểm toán', s: 'số liệu thô đính kèm' }, { t: 'Ký số & gửi', s: 'kiểm toán độc lập' }], caption: 'Tự động hóa tuân thủ' },
      inLabel: 'Báo cáo tuân thủ', outLabel: 'Hồ sơ ESG hoàn chỉnh',
      narration: 'Một cú click xuất báo cáo PDF/Excel chuẩn IMO, kèm số liệu thô, sẵn sàng nộp kiểm toán độc lập — việc trước đây tốn hàng tuần tổng hợp thủ công.',
      insight: 'Báo cáo ESG chuẩn IMO xuất trong chưa đầy 1 phút thay vì hàng tuần gom số liệu bằng tay.',
      kpis: [['Thời gian lập', '1', 'phút'], ['Chuẩn', 'IMO', '2020'], ['Độ đầy đủ', '100', '%']],
    },
    {
      title: 'Partner portal real-time', loop: 'act', viz: 'stream',
      vp: { src: 'CẢNG XANH', dst: 'HÃNG TÀU', tokens: ['ESG', 'CO₂', 'WQI'], caption: 'Minh bạch tới đối tác' },
      inLabel: 'Hồ sơ ESG', outLabel: '↺ Hãng tàu ưu tiên cảng',
      narration: 'Hãng tàu truy cập portal xem chỉ số ESG real-time để ra quyết định ưu tiên cảng xanh — danh tiếng môi trường trở thành lợi thế cạnh tranh hữu hình.',
      insight: 'ESG minh bạch real-time giúp cảng được hãng tàu ưu tiên chọn tăng 22% — "xanh" sinh ra lợi nhuận.',
      kpis: [['Đối tác kết nối', '8', ''], ['Truy cập/tháng', '340', ''], ['Ưu tiên cảng xanh', '22', '%↑']],
    },
  ],

  /* ─── 09 · Tài Chính & Năng Lượng ───────────────────────────────────── */
  '09': [
    {
      title: 'IoT đo tiêu thụ điện', loop: 'sense', viz: 'gauges',
      vp: { gauges: [{ l: 'Cẩu STS', v: 0.62, u: 'kW' }, { l: 'Điện bờ', v: 0.4, u: 'kW' }, { l: 'Chiếu sáng', v: 0.28, u: 'kW' }], caption: 'Đồng hồ số toàn cảng · 5s/lần' },
      inLabel: 'Phụ tải thiết bị', outLabel: 'Dữ liệu tiêu thụ kW',
      narration: 'Đồng hồ IoT đo tiêu thụ từng cụm thiết bị real-time — nền tảng để bản sao số hiểu chính xác "tiền điện chảy đi đâu" trong cảng.',
      insight: '46 đồng hồ số bóc tách tiêu thụ tới từng cụm thiết bị — không còn hóa đơn điện "mù mờ" cuối tháng.',
      kpis: [['Điểm đo', '46', ''], ['Tải đỉnh', '4.3', 'MW'], ['Lấy mẫu', '5', 's']],
    },
    {
      title: 'BIM/GIS bản đồ năng lượng', loop: 'twin', viz: 'grid',
      vp: { cols: 8, rows: 5, heat: true, caption: 'Bản đồ nhiệt tiêu thụ theo khu' },
      inLabel: 'Dữ liệu tiêu thụ', outLabel: 'Bản sao số năng lượng',
      narration: 'BIM/GIS ánh xạ tiêu thụ lên bản đồ cảng, phơi bày khu vực "ngốn điện" — bản sao số năng lượng của toàn cảng, cập nhật từng giây.',
      insight: 'Bản đồ nhiệt chỉ đích danh 3 khu tiêu tốn điện nhất — biết chính xác chỗ cần tối ưu trước.',
      kpis: [['Khu giám sát', '40', ''], ['Điểm nóng', '3', 'khu'], ['Cập nhật', 'real', 'time']],
    },
    {
      title: 'Mô phỏng nguồn tái tạo', loop: 'ai', viz: 'sankey',
      vp: { sources: [{ l: 'Mặt trời 3.2MW', v: 0.42, c: '#F8B23C' }, { l: 'Gió 1.1MW', v: 0.25, c: '#34E0F0' }, { l: 'Lưới QG', v: 0.33, c: '#B07CFF' }], loads: [{ l: 'Cẩu STS', v: 0.45 }, { l: 'Điện bờ', v: 0.3 }, { l: 'Khác', v: 0.25 }], caption: 'Mô phỏng phối nguồn theo thời tiết' },
      inLabel: 'Bản sao số năng lượng', outLabel: 'Kịch bản phối nguồn',
      narration: 'Bản sao số mô phỏng sản lượng điện mặt trời và gió theo thời tiết, thử nghiệm hàng loạt kịch bản phối nguồn mà không cần động tới hệ thống điện thật.',
      insight: '"Thử nghiệm" trên bản sao số an toàn 100% — tối ưu phối nguồn mà không rủi ro gián đoạn điện cảng.',
      kpis: [['Điện mặt trời', '3.2', 'MW'], ['Điện gió', '1.1', 'MW'], ['Tỷ lệ tái tạo', '67', '%']],
    },
    {
      title: 'Dự báo giá điện 24h', loop: 'ai', viz: 'line',
      vp: { data: [0.4, 0.5, 0.45, 0.65, 0.8, 0.6, 0.5, 0.42], forecast: [0.42, 0.48, 0.5, 0.62, 0.75, 0.58, 0.52, 0.45], caption: 'Dự báo giá theo khung giờ' },
      inLabel: 'Kịch bản phối nguồn', outLabel: 'Đường cong giá 24h',
      narration: 'AI dự báo giá điện theo khung giờ với độ chính xác 96%, nhận diện giờ cao điểm để né — biến dữ liệu vận hành thành chiến lược tài chính.',
      insight: 'Biết trước giờ nào điện đắt để né, giờ nào rẻ để chạy cẩu — độ chính xác dự báo 96%.',
      kpis: [['Độ chính xác', '96', '%'], ['Giờ đỉnh né', '4', 'khung'], ['Tầm dự báo', '24', 'giờ']],
    },
    {
      title: 'Tối ưu luồng điện', loop: 'decide', viz: 'sankey',
      vp: { sources: [{ l: 'Mặt trời', v: 0.5, c: '#F8B23C' }, { l: 'Gió', v: 0.3, c: '#34E0F0' }, { l: 'Lưới (giờ rẻ)', v: 0.2, c: '#B07CFF' }], loads: [{ l: 'Cẩu STS', v: 0.5 }, { l: 'Điện bờ', v: 0.3 }, { l: 'Pin lưu trữ', v: 0.2 }], caption: 'Dồn tải vào giờ điện rẻ' },
      inLabel: 'Đường cong giá', outLabel: 'Lệnh điều phối tải',
      narration: 'Hệ thống dồn phụ tải linh hoạt vào giờ điện rẻ và ưu tiên nguồn tái tạo, nạp pin lưu trữ khi dư — cắt 15% hóa đơn điện toàn cảng.',
      insight: 'Dịch 28% phụ tải sang giờ điện rẻ + ưu tiên tái tạo → cắt thẳng 15% hóa đơn điện mỗi tháng.',
      kpis: [['Chi phí điện', '15', '%↓'], ['Tải dịch chuyển', '28', '%'], ['Pin lưu trữ', '1.2', 'MWh']],
    },
    {
      title: 'Cost Dashboard real-time', loop: 'act', viz: 'notify',
      vp: { cards: [{ t: 'Tiết kiệm hôm nay', s: '−15% chi phí điện' }, { t: 'Lệnh tối ưu đã áp dụng', s: 'cẩu STS chạy giờ thấp điểm' }, { t: 'Báo cáo tài chính', s: 'cập nhật live theo phút' }], caption: 'Vật lý ↔ dòng tiền khép kín' },
      inLabel: 'Lệnh điều phối', outLabel: '↺ Thiết bị chạy giờ rẻ',
      narration: 'Dashboard liên kết hoạt động vật lý với dòng tiền real-time; lệnh tối ưu áp dụng lên thiết bị thật, rồi đồng hồ IoT lại đo — vòng lặp tài chính - năng lượng khép kín.',
      insight: 'Mỗi thao tác thiết bị quy ra tiền ngay lập tức; hệ thống hoàn vốn chỉ sau ~18 tháng.',
      kpis: [['Tiết kiệm/tháng', '210', 'k$'], ['Độ chính xác dự báo', '96', '%'], ['Hoàn vốn', '18', 'tháng']],
    },
  ],

  /* ─── 10 · Tổng Quan Bến Cảng (đúc kết toàn bộ vòng lặp) ─────────────── */
  '10': [
    {
      title: 'Bản sao số toàn cảng', loop: 'twin', viz: 'grid',
      vp: { cols: 10, rows: 6, heat: true, caption: 'Mọi tài sản · một mô hình sống' },
      inLabel: 'Toàn bộ cảm biến cảng', outLabel: 'Bức tranh vận hành sống',
      narration: 'Tất cả tàu, cẩu, xe, cảm biến hội tụ vào một bản sao số duy nhất — một bản sao kỹ thuật số 1:1 của cả cảng, phản chiếu thực tế từng giây.',
      insight: 'Digital twin = một "bản sao sống" của cảng thật: mọi thứ xảy ra ngoài thực địa đều hiện trên màn hình tức thì.',
      kpis: [['Tàu cập bến', '4', ''], ['Xe đang chạy', '12', ''], ['Cẩu hoạt động', '8', '']],
    },
    {
      title: '6 phân hệ chung một nguồn sự thật', loop: 'sense', viz: 'ai',
      vp: { inputs: ['Bến', 'Bãi', 'Cổng', 'An ninh', 'Môi trường', 'Năng lượng'], outputs: ['Nguồn sự thật chung'], caption: 'Phá vỡ ốc đảo dữ liệu' },
      inLabel: 'Dữ liệu 6 phân hệ', outLabel: 'Nền dữ liệu hợp nhất',
      narration: 'Sáu phân hệ — Bến, Bãi, Cổng, An ninh, Môi trường, Năng lượng — không còn là các "ốc đảo dữ liệu" rời rạc, mà chia sẻ chung một nguồn sự thật duy nhất.',
      insight: 'Hết cảnh mỗi phòng ban một bảng tính riêng — tất cả cùng nhìn một dữ liệu, ra quyết định ăn khớp.',
      kpis: [['Phân hệ đồng bộ', '6', ''], ['Nguồn sự thật', '1', ''], ['Độ trễ dữ liệu', '1', 's']],
    },
    {
      title: 'Vòng lặp Digital Twin tự tối ưu', loop: 'ai', viz: 'ai',
      vp: { inputs: ['Cảm biến', 'Bản sao số', 'Mô phỏng'], outputs: ['Quyết định', 'Hành động'], caption: 'Đo → Mô phỏng → Quyết định → Hành động' },
      inLabel: 'Nền dữ liệu hợp nhất', outLabel: '↺ Tối ưu liên tục',
      narration: 'Digital twin không phải mô hình tĩnh — nó là vòng lặp sống: cảm biến đo → bản sao số mô phỏng → AI ra quyết định → điều khiển thiết bị thật → rồi lặp lại, giúp cảng tự tối ưu mỗi giây.',
      insight: 'Cốt lõi của digital twin: một vòng lặp không ngừng. Cảng càng vận hành càng tự học và tự tối ưu.',
      kpis: [['UAV tuần tra', '3', ''], ['Quyết định/phút', '90', ''], ['Cập nhật', 'real', 'time']],
    },
    {
      title: 'Tác động kinh doanh', loop: 'act', viz: 'notify',
      vp: { cards: [{ t: 'Tàu chờ & phí neo', s: 'giảm mạnh nhờ JIT' }, { t: 'Thông quan cổng', s: 'nhanh hơn 90%' }, { t: 'Chi phí điện & phát thải', s: '−15% điện · −90% CO₂ cập bến' }], caption: 'Kết quả thấy được trên dòng tiền' },
      inLabel: 'Tối ưu liên tục', outLabel: '↺ Cảng vận hành tốt hơn mỗi ngày',
      narration: 'Khi cả vòng lặp vận hành, kết quả hội tụ về điều ai cũng hiểu: ít chờ hơn, ít kẹt hơn, ít phát thải hơn, ít chi phí hơn — và nó tự cải thiện mỗi ngày.',
      insight: 'Tổng hòa: cảng chạy nhanh hơn, rẻ hơn, xanh hơn và an toàn hơn — đó là sức mạnh thật của Digital Twin.',
      kpis: [['Thông quan', '90', '%↑'], ['Chi phí điện', '15', '%↓'], ['CO₂ khi cập bến', '90', '%↓']],
    },
  ],
};

// Normalize a raw stage entry's kpis ([k,v,u] tuples) into objects.
function normKpis(kpis) {
  return (kpis || []).map(x => Array.isArray(x) ? { k: x[0], v: x[1], u: x[2] || '' } : x);
}

export function getScene(featureId) {
  const raw = SCENES[featureId];
  if (!raw) return null;
  return raw.map(s => ({ ...s, kpis: normKpis(s.kpis) }));
}
