import { useEffect, useState } from 'react';
import { MetaAPI } from './api.js';

// "Hôm nay" và giờ hiện tại phải theo MÚI GIỜ VĂN PHÒNG do server cấu hình (OFFICE_TZ), không theo đồng hồ của trình
// duyệt — nếu không, người dùng ở múi giờ khác sẽ thấy "hôm nay" lệch với ngày server dùng để chấm công.

const FALLBACK_TZ = 'Asia/Ho_Chi_Minh';

let cachedTz = null; // đã tải xong
let inflight = null; // request đang chạy (nhiều component cùng mount chỉ gọi 1 lần)

function loadOfficeTz() {
  if (cachedTz) return Promise.resolve(cachedTz);
  if (!inflight) {
    inflight = MetaAPI.get()
      .then((meta) => meta?.timezone || FALLBACK_TZ)
      .catch(() => FALLBACK_TZ)
      .then((tz) => {
        cachedTz = tz;
        return tz;
      });
  }
  return inflight;
}

// Trả về múi giờ văn phòng (chuỗi IANA), hoặc null trong lúc đang tải
export function useOfficeTz() {
  const [tz, setTz] = useState(cachedTz);

  useEffect(() => {
    if (cachedTz) return undefined;
    let alive = true;
    loadOfficeTz().then((value) => {
      if (alive) setTz(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  return tz;
}

// 'YYYY-MM-DD' của một thời điểm theo múi giờ tz (tz rỗng = múi giờ trình duyệt)
export function dateInTz(tz, date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// 'HH:mm:ss' của một thời điểm theo múi giờ tz (tz rỗng = múi giờ trình duyệt)
export function timeInTz(tz, date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz || undefined,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}
