window.PC = ['', '#15D8A4', '#F8B23C', '#B07CFF'];
window.FEATS = [
  {
    id: '01', name: 'Điều Phối Bến Thông Minh', short: 'BẾN', color: '#34E0F0', phase: 1, core: true,
    cp: [-60, 15, -15], fp: [-150, 45, -150], ft: [-60, 10, 60],
    desc: 'Điều phối tàu tức thì & tối ưu cập bến dựa trên dữ liệu AIS real-time.',
    painPoints: 'Tắc nghẽn tại luồng lạch phao số 0 diễn ra thường xuyên do thiếu đồng bộ dữ liệu. Các hãng tàu chịu phí phạt neo chờ từ $30,000–$50,000/ngày/tàu. Điều phối thủ công gây sai số ETA trung bình 45–90 phút, tạo chuỗi trễ dây chuyền.',
    mechanism: 'Hệ thống tự động quét dữ liệu định vị AIS từ xa, đối chiếu trạng thái khai thác bến real-time qua bản đồ GIS, tự động phát lệnh điều tốc tàu (Just-in-Time). AI tính toán để tàu không phải neo chờ.',
    mets: [['Chuẩn JIT', '87%'], ['Bến Trống', '4 / 7'], ['Tàu Theo Dõi', '12'], ['Nhiên Liệu Tiết Kiệm', '$42k/ngày']],
    steps: [
      { title: 'AIS quét tàu', desc: 'Hệ thống nhận tín hiệu AIS định kỳ 30 giây từ tàu trong bán kính 50 hải lý. Ghi nhận GPS, tốc độ, hướng đi, IMO, DWT, ETA.' },
      { title: 'TIS đối chiếu bến', desc: 'Lớp TIS tra cứu trạng thái bến real-time: đang bốc dỡ, tiến độ %, thời gian dự kiến xong, sức chứa.' },
      { title: 'GIS bản đồ số', desc: 'Tích hợp bản đồ hiển thị luồng lạch, vùng neo chờ, mã hóa màu tàu (Xanh=JIT OK, Vàng=Cần điều chỉnh, Đỏ=Trễ).' },
      { title: 'AI phát lệnh điều tốc', desc: 'Thuật toán JIT tính toán vận tốc tối ưu và phát lệnh điều tốc qua VHF. Ghi nhận timestamp, vận tốc mới, lý do.' },
      { title: 'Berth Allocation Grid', desc: 'Hiển thị tiến độ bốc dỡ theo phút, tự động phân bổ bến khi tàu trước rời đi, gửi thông báo xác nhận.' },
      { title: 'Xác nhận ETA', desc: 'Hãng tàu nhận thông báo ETA chính xác (±10 phút) qua API/portal, cập nhật tự động khi có thay đổi.' }
    ],
    co: []
  },
  {
    id: '02', name: 'Bãi Container Số 3D', short: 'BÃI', color: '#27C281', phase: 1, core: true,
    cp: [60, 25, 50], fp: [90, 60, 110], ft: [0, 5, 20],
    desc: 'Số hóa bãi container & tối ưu xếp chồng.',
    painPoints: 'Tỷ lệ đảo chuyển container rỗng vô ích chiếm tới 20% chi phí bãi do quy hoạch thủ công. Không có tầm nhìn tổng thể dẫn đến container bị chôn vùi không lấy được đúng lúc.',
    mechanism: 'Lớp BIM phối hợp GIS & MMIS dựng mô hình số bãi 1:1. AI quét lịch trình tàu để tự xếp container: đi trước lên trên, đi sau xuống dưới. Triệt tiêu hoàn toàn đảo chuyển vô ích.',
    mets: [['Đảo Chuyển', '4.1% (-20%)'], ['Sức Chứa Khả Dụng', '+15%'], ['Năng Lượng Cẩu', '-18%'], ['AI Xếp Hôm Nay', '1,840']],
    steps: [
      { title: 'Nhập lịch tàu', desc: 'TIS cung cấp danh sách container theo tàu, ngày xuất, điểm đến làm đầu vào cho AI.' },
      { title: 'AI phân tích ưu tiên', desc: 'Thuật toán sắp xếp container theo ngày xuất, trọng lượng, điểm đến để tạo bản đồ xếp chồng tối ưu cho 72 giờ tới.' },
      { title: 'BIM 3D dựng model', desc: 'Mô hình số 3D cập nhật real-time. Mỗi vị trí được đánh địa chỉ Block-Bay-Row-Tier.' },
      { title: 'AI phân slot tự động', desc: 'Mỗi container nhập cảnh được AI gán vị trí xếp tự động, container xuất sớm luôn ở tầng trên.' },
      { title: 'Yard Heatmap', desc: 'Bản đồ nhiệt hiển thị công suất từng khu vực, cảnh báo khu quá tải (>90%) và đề xuất phân luồng.' },
      { title: 'RTG nhận lệnh', desc: 'Cẩu bãi RTG nhận lệnh di chuyển tự động qua màn hình cabin, giảm phụ thuộc phán đoán thủ công.' }
    ],
    co: []
  },
  {
    id: '03', name: 'Hệ Thống Cổng Tự Động', short: 'CỔNG', color: '#4D8DF6', phase: 1, core: true,
    cp: [25, 25, 85], fp: [25, 40, 200], ft: [10, 5, 120],
    desc: 'Tự động hóa cổng cảng & điều tiết giao thông.',
    painPoints: 'Gate Chaos – kẹt xe đầu kéo nhiều km tại cổng cảng vào giờ cao điểm. Quy trình thông quan thủ công tốn 30 phút, gây thiệt hại dây chuyền cho logistics.',
    mechanism: 'Lớp TIS kết hợp CIM thiết lập hệ thống đặt chỗ (Truck Booking Slot). Camera AI quét biển số (ALPR) đối chiếu lệnh điện tử và mở barrier dưới 2 giây. Số hóa 100%.',
    mets: [['Thông Quan', '1p 48s (-90%)'], ['Nhận Diện Biển Số', '99.4%'], ['Xe Tải Hôm Nay', '1,230'], ['Hồ Sơ Giấy', '0']],
    steps: [
      { title: 'Đặt Booking Slot', desc: 'Công ty xe tải đặt lịch vào cảng qua app trước 24 giờ. Hệ thống phân bổ slot giờ tránh đỉnh cao.' },
      { title: 'Nhận QR/lệnh điện tử', desc: 'Tài xế nhận mã QR chứa container ID, slot giờ, cổng vào, tuyến đường trong cảng.' },
      { title: 'Camera ALPR quét', desc: 'Xe vào làn tự động, camera AI quét nhận diện biển số độ chính xác 99.4% trong 0.8 giây.' },
      { title: 'AI xác thực lệnh', desc: 'Đối chiếu biển số với lệnh điện tử, kiểm tra hợp lệ slot, trọng tải trong trung tâm < 2 giây.' },
      { title: 'Barrier mở tự động', desc: 'Hợp lệ → barrier mở, hiển thị tuyến đường. Sai → barrier giữ, thông báo lý do.' },
      { title: 'Audit Log tự động', desc: 'Ghi nhận timestamp, biển số, container, hình ảnh camera phục vụ kiểm toán.' }
    ],
    co: []
  },
  {
    id: '05', name: 'Lá Chắn An Ninh AI', short: 'AN NINH', color: '#FF5468', phase: 2,
    cp: [120, 35, -40], fp: [140, 80, -90], ft: [0, 10, -40],
    desc: 'Vành đai an ninh & Drone tuần tra tự động.',
    painPoints: 'Điểm mù an ninh vùng nước cảng rộng lớn trong đêm/sương mù. Chi phí canô tuần tra thủ công đắt, không phủ sóng 360°. Nguy cơ xâm nhập trái phép.',
    mechanism: 'Radar quét sóng mặt nước liên tục phát hiện mục tiêu lạ. Tự động điều Drone UAV cất cánh trong 30s. AI phân tích video camera nhiệt xác định mức độ đe dọa.',
    mets: [['Độ Phủ Radar', '360° / 5km'], ['Chi Phí Tuần Tra', '-50%'], ['Drone Đang Bay', '3 chiếc'], ['Độ Chính Xác', '100%']],
    steps: [
      { title: 'Radar SSIS quét 24/7', desc: 'Mạng lưới radar ven biển quét 360° bán kính 5km, phát hiện vật thể chuyển động >0.5 knot liên tục.' },
      { title: 'AI lọc mục tiêu lạ', desc: 'Thuật toán loại bỏ nhiễu, phân biệt tàu thuyền đã đăng ký (AIS whitelist) với mục tiêu lạ.' },
      { title: 'UAV cất cánh tự động', desc: 'Drone nhận lệnh cất cánh trong 30 giây, bay theo tọa độ GPS mục tiêu.' },
      { title: 'Camera nhiệt AI', desc: 'Drone truyền video hồng ngoại real-time, AI phân loại mục tiêu và mức độ đe dọa.' },
      { title: 'Alert trung tâm', desc: 'Cảnh báo tức thì gửi đến màn hình trung tâm kèm ảnh/video và tọa độ.' },
      { title: 'Phối hợp ứng phó', desc: 'Trung tâm xác minh qua video và điều lực lượng ứng phó, ghi nhận toàn bộ sự kiện.' }
    ],
    co: []
  },
  {
    id: '08', name: 'Hệ Sinh Thái Cảng Xanh EIS', short: 'MÔI TRƯỜNG', color: '#2ADA9A', phase: 2, core: false,
    cp: [-140, 5, -80], fp: [-160, 50, -100], ft: [-40, 0, -60],
    desc: 'Quan trắc môi trường & Kiểm toán ESG tự động.',
    painPoints: 'Áp lực thuế carbon IMO nghiêm khắc. Nguy cơ bị hãng tàu tẩy chay nếu không đạt ESG. Cảng thiếu dữ liệu phát thải chính xác và hệ thống báo cáo ESG tự động.',
    mechanism: 'Lớp EIS tích hợp sensor IoT đo real-time CO₂, SOx, NOx từ tàu/thiết bị, đo chất lượng nước biển. Tổng hợp dashboard ESG và xuất báo cáo kiểm toán 1 click.',
    mets: [['Giảm CO₂', '90% (Khi cập bến)'], ['SOₓ', '0.08% ✓'], ['Trạm Điện Bờ', '3 Kích hoạt'], ['Điểm ESG Q2', '84/100']],
    steps: [
      { title: 'IoT sensor khí thải', desc: 'Trạm đo CO₂, SOx, NOx lắp tại điểm chiến lược dọc cầu bến, đo 1 phút/lần.' },
      { title: 'IoT sensor nước biển', desc: '8 trạm quan trắc đo WQI, turbidity, pH, hydrocarbon hòa tan real-time.' },
      { title: 'EIS tổng hợp', desc: 'Thu nhận dữ liệu, tính chỉ số ESG tổng hợp, hiển thị dashboard trực quan.' },
      { title: 'Đối chiếu compliance', desc: 'Tự động so sánh từng chỉ tiêu với ngưỡng IMO 2020, tạo báo cáo lỗi khi vượt.' },
      { title: 'Xuất báo cáo ESG', desc: 'Một click xuất PDF/Excel chuẩn IMO, sẵn sàng nộp cho kiểm toán độc lập.' },
      { title: 'Partner portal', desc: 'Hãng tàu truy cập portal xem chỉ số ESG real-time để ra quyết định ưu tiên cảng.' }
    ],
    co: []
  },
  {
    id: '09', name: 'Tài Chính & Năng Lượng', short: 'NĂNG LƯỢNG', color: '#FF5468', phase: 1, core: true,
    cp: [-100, 25, 148], fp: [-180, 70, 200], ft: [-120, 10, 140],
    desc: 'Liên kết hoạt động vật lý với dòng tiền, mô phỏng năng lượng tái tạo.',
    painPoints: 'Chi phí năng lượng cao và khó dự báo.',
    mechanism: 'Mô phỏng sản lượng năng lượng tái tạo và tối ưu hóa hóa đơn tiền điện cho cảng.',
    mets: [['Chi Phí Điện', '-15%'], ['Điện Mặt Trời', '3.2MW'], ['Điện Gió', '1.1MW'], ['Độ Chính Xác Dự Báo', '96%']],
    steps: [
      { title: 'IoT Sens.', desc: 'Thu thập dữ liệu tiêu thụ.' },
      { title: 'BIM/GIS Map', desc: 'Hiển thị bản đồ tiêu thụ năng lượng.' },
      { title: 'Power Sim', desc: 'Mô phỏng nguồn điện tái tạo.' },
      { title: 'Price Forecast', desc: 'Dự báo giá điện.' },
      { title: 'Optimize Flow', desc: 'Tối ưu luồng điện.' },
      { title: 'Cost Dashboard', desc: 'Hiển thị chi phí theo thời gian thực.' }
    ],
    co: []
  },
  {
    id: '10', name: 'Tổng Quan Bến Cảng', short: 'TỔNG QUAN', color: '#B07CFF', phase: 3,
    cp: [0, 34, 20], fp: [220, 140, -180], ft: [0, 0, 0],
    desc: 'Quay về góc nhìn bao quát toàn cảnh bến cảng thông minh.',
    painPoints: '',
    mechanism: '',
    mets: [['Tàu Đang Cập Bến', '4'], ['Xe Tải Đang Chạy', '12'], ['Cần Cẩu Đang Hoạt Động', '8'], ['UAV Tuần Tra', '3']],
    steps: [
      { title: 'Góc Nhìn Rộng', desc: 'Quan sát toàn bộ quy mô bến cảng.' },
      { title: 'Theo Dõi Luồng', desc: 'Xem sự phối hợp giữa tàu, xe và cẩu.' }
    ],
    co: []
  }
];