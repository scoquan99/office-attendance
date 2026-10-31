import { useEffect, useMemo, useState } from 'react';
import { OrgAPI } from './api.js';

// Danh sách phòng ban → chức vụ lấy từ backend (GET /api/org), tải một lần rồi dùng chung
// cho mọi component. Không còn bản sao tĩnh trong frontend nên không thể lệch với backend.

let cache = null; // dữ liệu đã tải xong
let inflight = null; // request đang chạy (nhiều component cùng mount chỉ gọi 1 lần)

function loadOrg() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = OrgAPI.get()
      .then((data) => {
        cache = data;
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

const EMPTY = { departments: [] };

export function useOrg() {
  const [org, setOrg] = useState(cache || EMPTY);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cache) return undefined;
    let alive = true;
    loadOrg()
      .then((data) => {
        if (!alive) return;
        setOrg(data);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError('Không tải được danh sách phòng ban / chức vụ từ máy chủ.');
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return useMemo(
    () => ({
      loading,
      error,
      departmentNames: org.departments.map((d) => d.department),
      positionsForDepartment: (department) =>
        org.departments.find((d) => d.department === department)?.positions || [],
    }),
    [org, loading, error]
  );
}
