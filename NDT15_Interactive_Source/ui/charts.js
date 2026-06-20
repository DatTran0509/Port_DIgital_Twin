let pChart = null, pChart2 = null, pChart3 = null;

// Renders the per-feature chart set into the left sidebar. Behavior-preserving
// extraction of the chart block that previously lived inside selectFeat in ui.js.
export function renderFeatureCharts(f) {
  const leftSidebar = document.getElementById('left-sidebar');

  if (pChart) pChart.destroy();
  if (pChart2) pChart2.destroy();
  if (pChart3) pChart3.destroy();
  const c1w = document.getElementById('pchart-wrapper');
  const c2w = document.getElementById('pchart2-wrapper');
  const c3w = document.getElementById('pchart3-wrapper');
  if (c1w) c1w.style.display = 'none';
  if (c2w) c2w.style.display = 'none';
  if (c3w) c3w.style.display = 'none';

  Chart.defaults.color = '#aabccf';
  Chart.defaults.borderColor = '#2a3b50';
  Chart.defaults.font.family = 'Inter, Arial, sans-serif';

  // Custom plugin to add a subtle glow
  const glowPlugin = {
    id: 'glow',
    beforeDraw: (chart) => {
      const ctx = chart.ctx;
      ctx.save();
      const glow = chart.config.options?.plugins?.glow;
      if (glow) {
        ctx.shadowColor = glow.color || 'rgba(0,0,0,0)';
        ctx.shadowBlur = glow.blur || 0;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
      }
      ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    },
    afterDraw: (chart) => { chart.ctx.restore(); }
  };
  Chart.register(glowPlugin);

  const commonOpt = (title) => ({
    responsive: true,
    plugins: {
      title: { display: true, text: title, color: '#fff', font: { size: 14, weight: 'bold' }, padding: { bottom: 15 } },
      legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true, color: '#ccc' } }
    }
  });

  // Every feature that renders charts opens the sidebar and shows both wrappers.
  const CHART_FEATURES = ['01', '02', '03', '05', '08', '09', '10'];
  if (CHART_FEATURES.includes(f.id)) {
    leftSidebar.classList.add('open');
    if (c1w) c1w.style.display = 'block';
    if (c2w) c2w.style.display = 'block';
  }

  if (f.id === '01') {
    pChart = new Chart(document.getElementById('pchart'), {
      type: 'line',
      data: {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
        datasets: [
          { label: 'Lưu lượng thực tế', data: [8, 4, 2, 6, 12, 7, 5], borderColor: f.color, backgroundColor: f.color + '40', tension: 0.4, fill: true },
          { label: 'Dự báo AI (JIT)', data: [7, 5, 3, 5, 10, 6, 6], borderColor: '#B07CFF', borderDash: [5, 5], tension: 0.4 }
        ]
      },
      options: { ...commonOpt('Mật độ Tàu Chờ Phao Số 0'), scales: { y: { beginAtZero: true } } }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'bar',
      data: {
        labels: ['Bến 1', 'Bến 2', 'Bến 3', 'Bến 4', 'Bến 5', 'Bến 6'],
        datasets: [{ label: 'Công suất bốc dỡ (TEU/h)', data: [120, 145, 90, 180, 150, 110], backgroundColor: '#F8B23C', borderRadius: 4 }]
      },
      options: { ...commonOpt('Hiệu Suất Cẩu STS Theo Bến'), scales: { y: { beginAtZero: true } } }
    });
  } else if (f.id === '02') {
    pChart = new Chart(document.getElementById('pchart'), {
      type: 'doughnut',
      data: {
        labels: ['Trống', 'Hàng Khô', 'Hàng Lạnh (Reefer)', 'Nguy Hiểm (IMDG)'],
        datasets: [{ data: [15, 60, 20, 5], backgroundColor: ['#2a3b50', f.color, '#34E0F0', '#FF5468'], borderWidth: 0 }]
      },
      options: { ...commonOpt('Cơ Cấu Sức Chứa Bãi (Theo Loại)'), cutout: '70%' }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'line',
      data: {
        labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
        datasets: [
          { label: 'Nhập (Import)', data: [4500, 5200, 4800, 6100, 5900, 4200, 3100], borderColor: '#15D8A4', tension: 0.3 },
          { label: 'Xuất (Export)', data: [3800, 4100, 5500, 4900, 6500, 5100, 2800], borderColor: '#B07CFF', tension: 0.3 }
        ]
      },
      options: { ...commonOpt('Lưu Lượng TEU Ra/Vào Bãi'), scales: { y: { beginAtZero: true } } }
    });
  } else if (f.id === '03') {
    pChart = new Chart(document.getElementById('pchart'), {
      type: 'bar',
      data: {
        labels: ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
        datasets: [
          { label: 'Xe có Booking', data: [120, 350, 280, 410, 220, 90], backgroundColor: f.color },
          { label: 'Xe Vãng Lai', data: [40, 80, 110, 95, 60, 20], backgroundColor: '#FF5468' }
        ]
      },
      options: { ...commonOpt('Tần Suất Xe Tải Qua Cổng'), scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'line',
      data: {
        labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
        datasets: [{ label: 'Thời gian chờ trung bình (Phút)', data: [12, 10, 8, 5, 2.5, 1.8], borderColor: '#F8B23C', backgroundColor: 'rgba(248,178,60,0.2)', fill: true, tension: 0.4 }]
      },
      options: { ...commonOpt('Hiệu Quả AI - Giảm Thời Gian Chờ') }
    });
  } else if (f.id === '05') {
    pChart = new Chart(document.getElementById('pchart'), {
      type: 'polarArea',
      data: {
        labels: ['Vùng Bắc', 'Vùng Nam', 'Luồng Lạch', 'Khu Bến'],
        datasets: [{ data: [12, 5, 28, 8], backgroundColor: ['#34E0F070', '#15D8A470', '#FF546870', '#F8B23C70'], borderWidth: 1, borderColor: '#fff' }]
      },
      options: { ...commonOpt('Phát Hiện Xâm Nhập (30 Ngày)'), scales: { r: { ticks: { display: false }, grid: { color: '#334' } } } }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'bar',
      data: {
        labels: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'],
        datasets: [
          { label: 'Tuần Tra Tự Động (UAV)', data: [45, 50, 48, 55], backgroundColor: '#B07CFF', borderRadius: 2 },
          { label: 'Canô Thủ Công', data: [20, 15, 12, 8], backgroundColor: '#FF5468', borderRadius: 2 }
        ]
      },
      options: { ...commonOpt('Chuyển Đổi Phương Thức Tuần Tra') }
    });
  } else if (f.id === '08') {
    pChart = new Chart(document.getElementById('pchart'), {
      type: 'doughnut',
      data: {
        labels: ['CO2 (Carbon)', 'SOx (Lưu Huỳnh)', 'NOx (Nitơ)', 'PM2.5 (Bụi Mịn)'],
        datasets: [{ data: [65, 12, 18, 5], backgroundColor: ['#FF5468', '#F8B23C', '#34E0F0', '#B07CFF'], borderWidth: 0 }]
      },
      options: { ...commonOpt('Phân Bổ Khí Thải (Real-time)'), cutout: '65%' }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'line',
      data: {
        labels: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6'],
        datasets: [
          { label: 'Chỉ số WQI (Nước Biển)', data: [75, 78, 82, 80, 85, 88], borderColor: '#15D8A4', tension: 0.4 },
          { label: 'Mục Tiêu ESG', data: [80, 80, 80, 80, 80, 80], borderColor: '#FF5468', borderDash: [5, 5], pointRadius: 0 }
        ]
      },
      options: { ...commonOpt('Cải Thiện Chất Lượng Nước Biển (WQI)') }
    });
  } else if (f.id === '09') {
    pChart = new Chart(document.getElementById('pchart'), {
      type: 'line',
      data: {
        labels: ['06:00', '09:00', '12:00', '15:00', '18:00'],
        datasets: [
          { label: 'Điện Mặt Trời (MW)', data: [0.5, 2.2, 3.5, 2.8, 0.4], borderColor: '#F8B23C', backgroundColor: 'rgba(248,178,60,0.1)', fill: true, tension: 0.3 },
          { label: 'Tiêu Thụ (MW)', data: [1.2, 2.5, 2.8, 3.0, 2.2], borderColor: '#FF5468', borderDash: [5, 2], tension: 0.3 }
        ]
      },
      options: { ...commonOpt('Cung - Cầu Năng Lượng Tái Tạo (Day)') }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'bar',
      data: {
        labels: ['Cẩu STS', 'Cẩu Bãi eRTG', 'Chiếu Sáng', 'Tòa Nhà', 'Điện Bờ (AMP)'],
        datasets: [{ label: 'Tỷ lệ tiêu thụ (%)', data: [35, 25, 10, 5, 25], backgroundColor: ['#34E0F0', '#15D8A4', '#B07CFF', '#F8B23C', '#FF5468'] }]
      },
      options: { ...commonOpt('Phân Bổ Tiêu Thụ Điện Năng'), indexAxis: 'y' }
    });
  } else if (f.id === '10') {
    pChart = new Chart(document.getElementById('pchart'), {
      type: 'bar',
      data: {
        labels: ['2023', '2024', '2025', '2026 (Dự Kiến)'],
        datasets: [
          { label: 'Sản Lượng Cảng (Triệu TEU)', data: [5.2, 6.8, 8.5, 11.2], backgroundColor: '#15D8A4' }
        ]
      },
      options: { ...commonOpt('Tăng Trưởng Sản Lượng Logistics') }
    });

    pChart2 = new Chart(document.getElementById('pchart2'), {
      type: 'doughnut',
      data: {
        labels: ['Nội Địa', 'Châu Á', 'Châu Âu', 'Châu Mỹ'],
        datasets: [{ data: [20, 45, 20, 15], backgroundColor: ['#F8B23C', '#34E0F0', '#B07CFF', '#FF5468'], borderWidth: 0 }]
      },
      options: { ...commonOpt('Tỷ Trọng Tuyến Dịch Vụ'), cutout: '50%' }
    });
  }
}
