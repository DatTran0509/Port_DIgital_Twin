/* ──────────────────────────────────────────────────────────────────────────
 * sim/knowledge.js — Port knowledge base + fuzzy retrieval (Copilot brain)
 *
 * Answers hundreds of customer phrasings about everything in the port —
 * introductions, explanations, objects, flows, acronyms, the underground level,
 * the CHRONOS engine, how to use the app — WITHOUT a backend or LLM. It mines
 * the live feature catalog (window.FEATS) and a curated entity/concept catalog,
 * then matches a free-text question by diacritic-insensitive, synonym-expanded,
 * IDF-weighted keyword overlap. Each entry may carry an ACTION (fly the camera,
 * open a feature flow, descend underground, start a guided tour, fork a
 * scenario) that the copilot executes so the bot answers by ACTING too.
 *
 * Coverage scales with phrasing variety: ~100 answer entries × synonym/diacritic
 * folding comfortably resolves the 500–1000 common questions a visitor asks.
 * ────────────────────────────────────────────────────────────────────────── */

import { FAQ } from './faq.js';

// Normalise: lowercase, strip Vietnamese diacritics, đ→d, keep alnum + spaces.
function norm(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// Synonym groups (canonical → variants), all matched in normalised form so a
// query word and a keyword collapse to the same canonical token.
const SYN = {
  tau: ['thuyen', 'ship', 'vessel', 'containership', 't"u'],
  cau: ['crane', 'gantry', 'cancau'],
  sts: ['quaycrane', 'shiptoshore', 'caubo', 'caubocxep'],
  rtg: ['caubai', 'rubbertyred'],
  rmg: ['transfercrane', 'cauthap', 'jib'],
  xe: ['truck', 'xetai', 'daukeo', 'container truck', 'lorry'],
  cong: ['gate', 'cong cang'],
  bai: ['yard', 'block', 'khobai', 'depot'],
  ben: ['berth', 'quay', 'cauben', 'wharf'],
  drone: ['uav', 'maybaykhongnguoilai', 'flycam'],
  radar: ['rada'],
  phao: ['buoy', 'sensor', 'cambien'],
  gio: ['wind', 'tuabin', 'turbine'],
  mattroi: ['solar', 'pin', 'pv', 'dienmattroi'],
  nangluong: ['energy', 'dien', 'power', 'electricity'],
  moitruong: ['environment', 'esg', 'xanh', 'green', 'carbon', 'phatthai', 'emission'],
  anninh: ['security', 'baove', 'an toan', 'safety'],
  ngam: ['underground', 'basement', 'tanghan', 'tanghaml', 'duoilongdat', 'duoilongdatduoi'],
  chronos: ['timemachine', 'cothemay', 'thoigian', 'time', 'tuanguoc', 'replay'],
  tuonglai: ['future', 'tientri', 'dubao', 'forecast', 'precognition'],
  fork: ['phannhanh', 'whatif', 'kichban', 'scenario', 'mophong'],
  gioithieu: ['intro', 'tongquan', 'overview', 'lagi', 'about'],
  coche: ['mechanism', 'nguyenly', 'hoatdong', 'lamviec', 'how', 'cachthuc', 'vanhanh'],
  buoc: ['step', 'quytrinh', 'luong', 'flow', 'tienthrinh'],
  chiso: ['metric', 'solieu', 'thongke', 'kpi', 'ketqua', 'sostatistic'],
  container: ['cont', 'thung', 'teu', 'hang'],
  huongdan: ['help', 'huong dan', 'dieukhien', 'control', 'sudung', 'thaotac'],
  tour: ['thamquan', 'dandi', 'dao', 'gioi thieu di', 'guidedtour'],
};
const CANON = {};
for (const c in SYN) { CANON[c] = c; for (const v of SYN[c]) CANON[norm(v)] = c; }
const canon = w => CANON[w] || w;

const STOP = new Set('la gi the nao co cua va cho toi ban o di xem cai nhu mot cac nhung khong duoc se da dang thi ra vao ve khi nay do day ma hay con rat duong lien quan khac them nua voi tai sao bao gồm gom hoi muon can them'.split(' '));

// "Filler" intent words (how/what/where/explain…). They carry little signal, so
// they get a tiny weight — the distinctive ENTITY token decides the match.
const WEAK = new Set('hoat dong sao lam viec gioi thieu cach thuc van hanh che nguyen ly dau o mo ta noi dien giai trinh bay hoat-dong ra sao the nao chuc nang y nghia'.split(' '));

function tokens(s) {
  return norm(s).split(' ').map(canon).filter(t => t && !STOP.has(t));
}

/* ── Curated catalog ──────────────────────────────────────────────────────── */
// cat: nhóm để gợi ý chip. kw: từ khoá (sẽ chuẩn hoá). a: câu trả lời. act: hành động.
const CATALOG = [
  // —— Tổng quan / công ty ——
  { cat: 'Giới thiệu', kw: 'gioi thieu tong quan cang ndt15 la gi day la gi noi dung', a: 'Đây là NDT 15 — Bản Sao Số (Digital Twin) của một cảng biển thông minh, mô phỏng 3D toàn bộ hoạt động: tàu cập bến, cẩu bốc dỡ, bãi container, cổng tự động, an ninh drone, năng lượng xanh, tầng hạ tầng ngầm và cỗ máy thời gian CHRONOS. Bấm vào bất kỳ vật thể nào để xem chi tiết, hoặc hỏi tôi về từng hạng mục.', act: { fly: 'overview' } },
  { cat: 'Giới thiệu', kw: 'digital twin ban sao so la gi nghia khai niem', a: 'Digital Twin (bản sao số) là bản sao ảo sống của tài sản vật lý, cập nhật real-time qua cảm biến & dữ liệu. NDT15 không chỉ "phản chiếu" cảng mà còn mô phỏng what-if và tua thời gian (CHRONOS) — đạt cấp Prescriptive (cấp 4/5) cao hơn phần lớn cảng thật.' },
  { cat: 'Giới thiệu', kw: '15 lop layer tang du lieu ndt 15 nghia con so', a: 'NDT15 tượng trưng cho 15 lớp dữ liệu của một cảng số (AIS, TIS, GIS, BIM, EIS, CIM, an ninh SSIS, hạ tầng ngầm là lớp 13...). Mỗi tính năng trong cảnh là hiện thân của một/nhiều lớp đó.' },
  { cat: 'Giới thiệu', kw: 'ban la ai tro ly chatbot ai copilot ho tro', a: 'Tôi là Trợ lý ảo của Cảng NDT15. Tôi có thể giới thiệu, giải thích mọi vật thể & tính năng, dẫn bạn đi tham quan, chạy luồng vận hành, mô phỏng sự cố và tua thời gian. Cứ hỏi tự nhiên!' },

  // —— Hướng dẫn dùng app ——
  { cat: 'Hướng dẫn', kw: 'dieu khien chuot xoay zoom phong to thao tac su dung app', a: 'Điều khiển: GIỮ CHUỘT TRÁI để xoay (orbit), LĂN CHUỘT để phóng to/thu nhỏ, CHUỘT PHẢI để di chuyển. Bấm vào vật thể để xem thông tin; bấm nút tính năng ở thanh dưới để chạy luồng.' },
  { cat: 'Hướng dẫn', kw: 'ngay dem day night sang toi che do anh sang', a: 'Bấm nút "☀ Day Mode / 🌙 Night" trên thanh trên cùng để chuyển ngày↔đêm. Ban đêm hệ thống đèn cao áp và đèn bãi sẽ bật, dễ thấy hoạt động về đêm.' },
  { cat: 'Hướng dẫn', kw: 'an hien giao dien ui hide show', a: 'Nút "👁 Hide UI" ẩn toàn bộ giao diện để xem cảnh 3D sạch; bấm lại để hiện.' },

  // —— Cỗ máy thời gian CHRONOS ——
  { cat: 'CHRONOS', kw: 'chronos co may thoi gian la gi thanh tua tua nguoc', a: 'CHRONOS là cỗ máy thời gian của cảng (thanh điều khiển dưới màn hình). Thực tại luôn chạy theo giờ thực; bạn có thể TUA NGƯỢC (◀◀) xem lại quá khứ, TUA TỚI (▶▶) nhanh ×2/×4/×8, nhảy về ⦿ Thực Tại, hoặc kéo vào vùng TƯƠNG LAI để xem dự báo.' },
  { cat: 'CHRONOS', kw: 'tuonglai tien tri du bao ghost bong ma future', a: 'Kéo con trỏ thời gian sang phải (hoặc bấm ⏭) để vào vùng TƯƠNG LAI: cảng hiện lớp "bóng ma" cyan cho thấy tàu sẽ ở đâu sau N phút — lớp tiên tri (precognition).', act: { future: 90 } },
  { cat: 'CHRONOS', kw: 'fork phan nhanh thuc tai kich ban su co mo phong what if', a: 'Bấm "⚡ Fork Reality" để phân nhánh thực tại: chọn 1 kịch bản sự cố (cẩu hỏng, dồn tàu, bão+ngập, tấn công mạng, mất điện) — cảng mô phỏng hậu quả cascade so với baseline, có biểu đồ + sơ đồ ảnh hưởng + nút AI Hóa Giải.', act: { picker: true } },
  { cat: 'CHRONOS', kw: 'glass box nhan qua giai thich tai sao chuoi', a: 'Glass Box: khi đang mô phỏng sự cố, bấm vào một ô chỉ số hoặc node sơ đồ — hệ thống vẽ chuỗi sợi sáng nối ngược về nguyên nhân gốc (vd "cổng kẹt ← bãi ùn ← cẩu hỏng"), biến hộp đen thành hộp kính.' },

  // —— Tàu & bến ——
  { cat: 'Vật thể', kw: 'tau thuyen ship vessel container la gi gioi thieu', a: 'Các tàu container ra/vào cảng theo dữ liệu AIS. Mỗi tàu có IMO, hô hiệu, hãng khai thác, DWT, sức chở TEU, cảng đi/đến, mớn nước. Bấm vào tàu để xem hồ sơ đầy đủ; nhãn AIS nổi trên mỗi tàu.', act: { fly: 'berth' } },
  { cat: 'Vật thể', kw: 'ben berth cau ben quay cap ben bao nhieu', a: 'Cảng có dải cầu bến dọc mép nước; tàu cập đúng bến theo điều phối JIT. Mỗi bến có bảng LED trạng thái (đang dỡ/bốc, tiến độ %). Cẩu STS đứng trên cầu bến để bốc dỡ.', act: { fly: 'berth' } },
  { cat: 'Vật thể', kw: 'ais dinh vi tau theo doi tin hieu', a: 'AIS (Automatic Identification System) là tín hiệu định vị tàu tự động. Hệ thống quét AIS trong bán kính ~50 hải lý để biết GPS, tốc độ, hướng, ETA — cơ sở cho điều phối Just-in-Time.' },

  // —— Cẩu ——
  { cat: 'Vật thể', kw: 'cau bo sts quay crane boc do tau gantry', a: 'Cẩu STS (Ship-To-Shore) là cẩu giàn lớn trên cầu bến, bốc/dỡ container giữa tàu và bãi. Xe trolley chạy ra biển nhấc container, hạ xuống xe/bãi; chu trình lặp khi có tàu cập.', act: { fly: 'berth' } },
  { cat: 'Vật thể', kw: 'rtg cau bai rubber tyred gantry yard', a: 'Cẩu RTG (Rubber-Tyred Gantry) là cẩu bánh lốp di động trong bãi container, xếp/lấy container theo lệnh tự động và giao/nhận với xe đầu kéo. Mỗi khối bãi có một RTG.', act: { fly: 'yard' } },
  { cat: 'Vật thể', kw: 'cau thap jib transfer luan chuyen doc rmg', a: 'Cẩu tháp quay (jib) ở rìa bãi luân chuyển container theo chiều DỌC giữa hai bãi liền kề, bổ trợ cho RTG (vốn chuyển ngang). Tầm với ~66m, tải ~40 tấn.', act: { fly: 'yard' } },

  // —— Bãi container ——
  { cat: 'Vật thể', kw: 'bai container yard block xep chong khoi luu tru', a: 'Bãi container được số hóa 3D 1:1 (lớp BIM+GIS). AI xếp container theo lịch tàu: đi sớm để trên, đi muộn để dưới — triệt tiêu đảo chuyển vô ích. Mỗi vị trí có địa chỉ Block-Bay-Row-Tier; bảng nhiệt cảnh báo khu quá tải.', act: { feature: 'BÃI' } },
  { cat: 'Vật thể', kw: 'container cont teu thung hang khoi luong loai iso 20 40 45 feet reefer lanh', a: 'Container theo chuẩn ISO (20\'/40\'/45\', loại GP/HC/RF lạnh/OT/FR). Bấm vào xe hoặc container để xem số hiệu, loại hàng, khối lượng, seal. Sức chứa cảng tính theo TEU.' },

  // —— Cổng & xe ——
  { cat: 'Vật thể', kw: 'cong gate tu dong barrier alpr thong quan', a: 'Hệ thống cổng tự động: xe đặt Booking Slot trước, camera ALPR quét biển số (99.4%), AI đối chiếu lệnh điện tử và mở barrier dưới 2 giây — số hóa 100%, hết kẹt xe đầu kéo.', act: { feature: 'CỔNG' } },
  { cat: 'Vật thể', kw: 'xe dau keo truck van chuyen di chuyen', a: 'Xe đầu kéo nhận/giao container giữa cổng – bãi – cẩu, định tuyến tự động trên mạng đường nội bộ (tránh kẹt, nhường nhau ở giao lộ). Bấm vào xe để xem biển số, tài xế, container, bãi đích.', act: { fly: 'gate' } },
  { cat: 'Vật thể', kw: 'barrier rao chan thanh chan cong', a: 'Barrier (rào chắn) tại cổng tự nâng/hạ theo lệnh check-in/check-out. Hợp lệ → mở; sai → giữ và báo lý do. Mọi lượt đều ghi audit log.' },

  // —— An ninh ——
  { cat: 'Vật thể', kw: 'drone uav may bay tuan tra giam sat an ninh', a: 'Drone UAV tuần tra tự động vành đai cảng. Khi radar phát hiện mục tiêu lạ, UAV cất cánh trong ~30s, truyền video nhiệt để AI phân loại mức đe dọa. Bấm vào drone để xem nhiệm vụ, độ cao, pin.', act: { feature: 'AN NINH' } },
  { cat: 'Vật thể', kw: 'radar quet song mat nuoc phat hien', a: 'Radar ven biển quét 360° bán kính ~5km, phát hiện vật thể chuyển động >0.5 knot. AI lọc nhiễu, đối chiếu whitelist AIS để khoanh mục tiêu lạ và điều drone.' },
  { cat: 'Vật thể', kw: 'phao buoy cam bien sensor nuoc bien chat luong', a: 'Phao cảm biến IoT đo chất lượng nước biển real-time (WQI, độ đục, pH, hydrocarbon) phục vụ quan trắc môi trường và kiểm toán ESG.' },

  // —— Năng lượng & môi trường ——
  { cat: 'Vật thể', kw: 'tuabin gio wind turbine dien gio', a: 'Tuabin gió (trên bờ & ngoài khơi) cấp điện tái tạo cho cảng. Mỗi tuabin ~2.5MW. Cùng pin mặt trời tạo microgrid giảm phụ thuộc lưới.', act: { fly: 'energy' } },
  { cat: 'Vật thể', kw: 'pin mat troi solar dien mat troi panel', a: 'Hệ pin mặt trời đặt trên mái kho cấp điện sạch ban ngày, hòa cùng điện gió. Dashboard năng lượng dự báo giá điện và tối ưu hóa đơn (-15% chi phí).', act: { feature: 'NĂNG LƯỢNG' } },
  { cat: 'Vật thể', kw: 'moi truong esg carbon phat thai xanh quan trac', a: 'Hệ sinh thái Cảng Xanh (EIS): sensor IoT đo CO₂/SOx/NOx & chất lượng nước real-time, tổng hợp dashboard ESG, xuất báo cáo chuẩn IMO 1-click. Khi tàu cập dùng điện bờ giảm ~90% CO₂.', act: { feature: 'MÔI TRƯỜNG' } },

  // —— Mở rộng landward ——
  { cat: 'Mở rộng', kw: 'rail terminal duong sat tau hoa lien van', a: 'On-dock Rail Terminal: ga đường sắt cạnh bãi, cẩu RMG chuyển container thẳng giữa tàu hỏa và bãi — liên vận đa phương thức, giảm xe tải đường bộ.' },
  { cat: 'Mở rộng', kw: 'automation tu dong agv asc terminal khong nguoi', a: 'Bến tự động hóa: xe AGV không người lái chạy vòng và cẩu ASC xếp container hoàn toàn tự động — mô hình bến thế hệ mới, vận hành 24/7 ít người.' },
  { cat: 'Mở rộng', kw: 'green hub trung tam nang luong xanh hydro', a: 'Green Energy Hub: trung tâm năng lượng xanh tích hợp điện tái tạo, lưu trữ và (định hướng) hydro — cấp điện sạch cho cảng và tàu.' },
  { cat: 'Mở rộng', kw: 'control tower thap dieu khien trung tam dieu hanh', a: 'Tháp điều khiển (Control Tower) là trung tâm điều hành tổng, tổng hợp dữ liệu 15 lớp để giám sát và ra lệnh toàn cảng.' },

  // —— Tầng ngầm ——
  { cat: 'Tầng ngầm', kw: 'tang ngam underground ha tang duoi long dat lop 13 xuong', a: 'Tầng hạ tầng ngầm (lớp 13) nằm dưới cảng: hầm kỹ thuật gom điện/nước/cáp, trạm bơm chống ngập, trạm biến áp, trung tâm dữ liệu (bộ não twin), tuyến hầm logistics, bãi đỗ & bồn chứa. Bấm "⬇ Tầng Ngầm" hoặc bảo tôi để đi xuống.', act: { descend: true } },
  { cat: 'Tầng ngầm', kw: 'ham ky thuat utility tunnel ong cap dien nuoc', a: 'Trục Hầm Kỹ Thuật (Utility Tunnel) gom toàn bộ đường ống & cáp ngầm (nước, thoát nước, khí, nhiên liệu, điện, cáp quang). Cảm biến rò rỉ/áp suất báo về Control Tower — bảo trì tập trung, không phải đào đường.', act: { descend: true } },
  { cat: 'Tầng ngầm', kw: 'tram bom pump station chong ngap thoat nuoc thuy van', a: 'Trạm Bơm Thoát Nước Ngầm: 3 bơm chìm lớn + cống hộp thu nước mưa/triều cường bơm ra biển, chống ngập cảng. Twin mô phỏng ngập theo kịch bản mưa/bão.', act: { descend: true } },
  { cat: 'Tầng ngầm', kw: 'tram bien ap substation phan phoi dien ngam', a: 'Trạm Biến Áp Ngầm hạ áp & phân phối điện (gồm điện xanh) cho cẩu, chiếu sáng, điện bờ; giám sát nhiệt độ real-time. Khi bão gây ngập, trạm này có thể bị ảnh hưởng (xem kịch bản Bão+nước dâng).', act: { descend: true } },
  { cat: 'Tầng ngầm', kw: 'data center datacenter vault trung tam du lieu server bo nao may chu rack iot', a: 'Trung Tâm Dữ Liệu ngầm là "bộ não" của bản sao số: 20 tủ rack thu IoT, chạy mô phỏng và AI điều phối, đồng bộ 15 lớp dữ liệu. Uptime 99,98%.', act: { descend: true } },
  { cat: 'Tầng ngầm', kw: 'ham logistics tunnel agv bang tai lien cang', a: 'Tuyến Hầm Logistics nối cảng chính với 2 bãi phụ dưới lòng đất bằng băng tải/AGV — vận chuyển container không cản giao thông mặt đất, chạy 24/7.', act: { descend: true } },
  { cat: 'Tầng ngầm', kw: 'thang nang container lift gieng dung shaft', a: 'Thang Nâng Container Đứng (shaft hoist) chuyển container giữa tuyến hầm logistics và bãi mặt đất qua giếng đứng — điểm giao thoa chính giữa tầng ngầm và mặt đất.', act: { descend: true } },
  { cat: 'Tầng ngầm', kw: 'robot tuan tra inspection giam sat ham', a: 'Robot tuần tra hạ tầng ngầm quét rò rỉ ống, nhiệt độ cáp, khí gas dọc hầm kỹ thuật bằng LiDAR + cảm biến nhiệt/khí, đẩy dữ liệu real-time về twin.', act: { descend: true } },
  { cat: 'Tầng ngầm', kw: 'bai do xe ngam parking bon chua reservoir nhien lieu nuoc', a: 'Tầng ngầm còn có bãi đỗ xe nội bộ (~120 chỗ), bồn chứa nước chữa cháy/nước sạch/nhiên liệu, trạm cân tải, kho CFS gom-tách hàng lẻ và nhà nghỉ ca cho kíp trực 24/7.', act: { descend: true } },

  // —— Acronyms ——
  { cat: 'Thuật ngữ', kw: 'jit just in time dieu toc dieu phoi', a: 'JIT (Just-In-Time): điều tốc tàu để đến đúng lúc bến trống, không phải neo chờ — tiết kiệm nhiên liệu & phí neo (vd $30k–$50k/ngày/tàu).' },
  { cat: 'Thuật ngữ', kw: 'alpr nhan dien bien so camera', a: 'ALPR (Automatic License Plate Recognition): camera AI nhận diện biển số xe tải tại cổng, độ chính xác 99.4% trong <1 giây.' },
  { cat: 'Thuật ngữ', kw: 'imo to chuc hang hai quoc te tieu chuan', a: 'IMO (International Maritime Organization): tổ chức hàng hải quốc tế đặt chuẩn an toàn & phát thải (vd IMO 2020 giới hạn lưu huỳnh). Báo cáo ESG của cảng đối chiếu chuẩn IMO.' },
  { cat: 'Thuật ngữ', kw: 'bim gis tis eis cim ssis mmis lop he thong', a: 'Các lớp số: BIM (mô hình công trình 3D), GIS (bản đồ không gian), TIS (thông tin bến/khai thác), EIS (môi trường), CIM (quản lý cảng), SSIS (an ninh giám sát), MMIS (vật tư/thiết bị). Chúng phối hợp tạo nên bản sao số.' },
  { cat: 'Thuật ngữ', kw: 'teu dwt sang chuyen don vi do', a: 'TEU = 1 container 20 feet (đơn vị đo sản lượng); DWT = trọng tải toàn phần của tàu (tấn). Đây là các chỉ số mô tả quy mô tàu & cảng.' },

  // —— Vận hành / câu hỏi số liệu ——
  { cat: 'Vận hành', kw: 'bao nhieu tau dang cap ben hien tai may con', a: 'Hiện có khoảng 4 tàu đang trong khu vực cảng (cập bến/đang vào/neo chờ). Bấm ⦿ Thực Tại rồi nhìn các nhãn AIS, hoặc vào tính năng "TỔNG QUAN" để xem số liệu trực tiếp.', act: { feature: 'TỔNG QUAN' } },
  { cat: 'Vận hành', kw: 'an toan tai nan su co rui ro xu ly', a: 'Cảng dùng CHRONOS để mô phỏng sự cố TRƯỚC khi xảy ra (cẩu hỏng, bão ngập, tấn công mạng, mất điện) và thử phương án hóa giải. Bấm "⚡ Fork Reality" để chạy thử một kịch bản.', act: { picker: true } },
];

/* ── Build full KB (catalog + features mined from window.FEATS) ───────────── */
let KB = null, IDF = null;

function featureEntries() {
  const out = [];
  const F = (typeof window !== 'undefined' && window.FEATS) || [];
  F.forEach((f, i) => {
    const base = `${f.name} ${f.short}`;
    out.push({ cat: 'Tính năng', kw: `${base} ${f.desc} gioi thieu la gi tinh nang`, a: `${f.name}: ${f.desc}`, act: { feature: i } });
    if (f.mechanism) out.push({ cat: 'Tính năng', kw: `${base} co che hoat dong nguyen ly cach thuc van hanh the nao`, a: `⚙ Cơ chế "${f.name}": ${f.mechanism}`, act: { feature: i } });
    if (f.painPoints) out.push({ cat: 'Tính năng', kw: `${base} van de kho khan pain tai sao loi ich giai quyet`, a: `⚠ Vấn đề "${f.name}" giải quyết: ${f.painPoints}`, act: { feature: i } });
    if (f.steps && f.steps.length) out.push({ cat: 'Tính năng', kw: `${base} cac buoc quy trinh luong flow chay mo phong tham quan`, a: `Luồng "${f.name}":\n` + f.steps.map((s, k) => `${k + 1}. ${s.title} — ${s.desc}`).join('\n'), act: { feature: i, autoplay: true } });
    if (f.mets && f.mets.length) out.push({ cat: 'Tính năng', kw: `${base} chi so so lieu thong ke ket qua metric kpi`, a: `Chỉ số "${f.name}": ` + f.mets.map(m => `${m[0]} ${m[1]}`).join(' · '), act: { feature: i } });
  });
  return out;
}

function build() {
  KB = CATALOG.concat(FAQ).concat(featureEntries());
  // Precompute normalised keyword token sets.
  KB.forEach(e => { e._kw = tokens(e.kw); e._set = new Set(e._kw); });
  // IDF over keyword tokens (rare tokens are more discriminative).
  const df = {};
  KB.forEach(e => { for (const t of e._set) df[t] = (df[t] || 0) + 1; });
  const N = KB.length;
  IDF = {};
  for (const t in df) IDF[t] = Math.log(1 + N / df[t]);
}

function score(qt, e) {
  let s = 0, strong = 0;   // strong = # of matched content tokens with length ≥ 3
  for (const t of qt) {
    if (e._set.has(t)) {
      if (WEAK.has(t)) { s += 0.12; } else { s += (IDF[t] || 1); if (t.length >= 3) strong++; }
      continue;
    }
    if (WEAK.has(t)) continue;   // filler word, no partial credit
    // partial match (handles morphological variants) at a discount
    if (t.length >= 4) for (const k of e._kw) {
      if (k.length >= 4 && (k.includes(t) || t.includes(k))) { s += 0.4 * (IDF[k] || 1); strong++; break; }
    }
  }
  return { s, strong };
}

export function answer(query) {
  if (!KB) build();
  const qt = tokens(query);
  if (!qt.length) return { text: help(), suggestions: true };
  let best = null, bestS = 0, bestStrong = 0;
  for (const e of KB) {
    const { s, strong } = score(qt, e);
    if (s > bestS) { bestS = s; bestStrong = strong; best = e; }
  }
  // Need a minimally confident match AND at least one discriminative (≥3-char)
  // token — so a stray 2-char overlap ("vô" ↔ "vỏ") falls back instead of guessing.
  if (!best || bestS < 0.9 || bestStrong < 1) {
    return { text: '🤔 Tôi chưa chắc hiểu ý bạn. Bạn có thể hỏi về: tàu, cẩu (STS/RTG), bãi container, cổng tự động, an ninh & drone, năng lượng/môi trường, tầng ngầm, đường sắt, hoặc CHRONOS (tua thời gian, mô phỏng sự cố). Gõ "menu" để xem gợi ý.', suggestions: true };
  }
  return { text: best.a, action: best.act, cat: best.cat };
}

export function help() {
  return 'Tôi có thể giúp bạn về MỌI thứ trong cảng:\n• Giới thiệu & giải thích (tàu, cẩu, bãi, cổng, an ninh, năng lượng, môi trường…)\n• Tầng hạ tầng ngầm (hầm kỹ thuật, trạm bơm, biến áp, data center…)\n• Chạy luồng vận hành / tham quan có dẫn\n• CHRONOS: tua thời gian, xem tương lai, mô phỏng sự cố\nVí dụ: "cẩu RTG là gì?", "chạy luồng cổng tự động", "dẫn tôi đi tham quan", "xuống tầng ngầm", "nếu bão thì sao?"';
}

// Quick-reply chips grouped for the UI.
export const CHIPS = [
  'Giới thiệu tổng quan cảng',
  'Dẫn tôi đi tham quan',
  'Cẩu RTG là gì?',
  'Bãi container hoạt động thế nào?',
  'Cổng tự động làm việc ra sao?',
  'Xuống tầng ngầm',
  'An ninh & drone',
  'Năng lượng xanh của cảng',
  'CHRONOS là gì?',
  'Cho tôi xem tương lai',
];
