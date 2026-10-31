// Tiện ích thời gian theo múi giờ văn phòng (Việt Nam), KHÔNG phụ thuộc múi giờ của máy chủ.
// Trước đây ngày lấy theo UTC còn giờ lấy theo giờ máy nên chấm công trước 07:00 sáng
// bị ghi sang ngày hôm trước (và giờ bị lệch 7 tiếng khi chạy trong Docker).

export const OFFICE_TZ = process.env.OFFICE_TZ || 'Asia/Ho_Chi_Minh';

// Trả về 'YYYY-MM-DD' của hôm nay theo múi giờ văn phòng
export function todayStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OFFICE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Trả về 'HH:MM:SS' của thời điểm hiện tại theo múi giờ văn phòng
export function timeStr() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: OFFICE_TZ,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
}

// --- Quy tắc "Đi trễ" -------------------------------------------------------
// Giờ bắt đầu làm việc và số phút châm chước cấu hình bằng biến môi trường:
//   WORK_START_TIME     mặc định 08:00 (định dạng HH:MM)
//   LATE_GRACE_MINUTES  mặc định 0 (số phút được trễ mà vẫn tính là đúng giờ)
// So sánh theo PHÚT (giống giao diện chỉ hiện HH:MM): với giờ bắt đầu 08:00 và châm chước 0,
// vào lúc 08:00:45 vẫn đúng giờ, từ 08:01:00 trở đi là đi trễ.
function parseWorkStartMinutes(raw) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(raw ?? '').trim());
  if (match && Number(match[1]) <= 23 && Number(match[2]) <= 59) {
    return Number(match[1]) * 60 + Number(match[2]);
  }
  if (raw) console.warn(`[WARNING] WORK_START_TIME="${raw}" không hợp lệ (cần dạng HH:MM), dùng mặc định 08:00.`);
  return 8 * 60;
}

function parseGraceMinutes(raw) {
  const n = Number(raw);
  if (raw !== undefined && raw !== '' && (!Number.isInteger(n) || n < 0 || n > 240)) {
    console.warn(`[WARNING] LATE_GRACE_MINUTES="${raw}" không hợp lệ (cần số nguyên 0-240), dùng mặc định 0.`);
    return 0;
  }
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

const LATE_AFTER_MINUTES =
  parseWorkStartMinutes(process.env.WORK_START_TIME || '08:00') + parseGraceMinutes(process.env.LATE_GRACE_MINUTES);

// checkInTime: chuỗi 'HH:MM' hoặc 'HH:MM:SS' (giờ văn phòng)
export function isLate(checkInTime) {
  const [h, m] = String(checkInTime).split(':').map(Number);
  return h * 60 + (m || 0) > LATE_AFTER_MINUTES;
}
