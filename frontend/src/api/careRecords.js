const API_BASE = '/api';

const request = async (path, options = {}) => {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch {
    // 网络层失败（含服务不可用）：统一抛出，调用方不得更新现有列表
    throw new Error('无法连接服务器，请稍后重试');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `请求失败（${response.status}）`);
  }
  return payload;
};

export const fetchCareRecords = () =>
  request('/care-records').then((data) => data.records);

export const createCareRecord = (record, idempotencyKey) =>
  request('/care-records', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(record),
  });

export const closeCareRecord = (id, closeNote) =>
  request(`/care-records/${encodeURIComponent(id)}/close`, {
    method: 'POST',
    body: JSON.stringify({ closeNote }),
  });
