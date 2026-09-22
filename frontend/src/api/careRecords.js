// 照护记录接口客户端。保存类接口不做本地乐观更新：
// 只有服务器确认成功后才更新列表，失败时现有列表和计数保持不变。

const request = async (path, options = {}) => {
  let response;
  try {
    response = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error('无法连接服务器，请检查网络后重试');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // 服务器返回了非 JSON 内容
  }

  if (!response.ok) {
    throw new Error(payload?.error || '请求失败，请稍后重试');
  }
  return payload;
};

export const fetchCareRecords = () =>
  request('/api/care-records').then((data) => data.records);

export const createCareRecord = (record) =>
  request('/api/care-records', {
    method: 'POST',
    body: JSON.stringify(record),
  }).then((data) => data.record);

export const closeCareRecord = (id) =>
  request(`/api/care-records/${encodeURIComponent(id)}/close`, {
    method: 'PATCH',
  }).then((data) => data.record);

// 每次"新的填写"生成一个提交标识；网络重试/双击/刷新重发复用同一标识，
// 服务器据此保证同一提交只生成一条记录。
export const generateClientToken = () =>
  (globalThis.crypto?.randomUUID?.() ??
    `tok-${Date.now()}-${Math.random().toString(36).slice(2)}`);
