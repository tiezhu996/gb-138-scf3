const crypto = require('node:crypto');
const { symptomOptions } = require('./constants');
const { badRequest, notFound, HttpError } = require('./errors');
const store = require('./store');

const MAX_NOTES_LENGTH = 1000;
const MAX_TOKEN_LENGTH = 100;

const symptomMap = new Map(symptomOptions.map((item) => [item.id, item]));

// 幂等：同一 clientToken 的重复提交（网络重试、双击、刷新重发）
// 只生成一条记录。正在处理中的相同 token 复用同一个 Promise，
// 已完成的通过记录上的 clientToken 去重（重启后依然有效）。
const inFlight = new Map();

const toIso = (value) => new Date(value).toISOString();

const sortRecords = (records) =>
  [...records].sort((a, b) => {
    const byOccurred = b.occurredAt.localeCompare(a.occurredAt);
    if (byOccurred !== 0) return byOccurred;
    return b.createdAt.localeCompare(a.createdAt);
  });

const validatePayload = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('请求体格式不正确');
  }

  const symptom = symptomMap.get(body.symptomId);
  if (!symptom) {
    throw badRequest('请选择有效的症状');
  }

  const severity = Number(body.severity);
  if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
    throw badRequest('严重度必须是 1-5 的整数');
  }

  const occurredAt = new Date(body.occurredAt);
  if (!body.occurredAt || Number.isNaN(occurredAt.getTime())) {
    throw badRequest('请填写有效的发生时间');
  }

  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (!notes) {
    throw badRequest('请填写观察说明');
  }
  if (notes.length > MAX_NOTES_LENGTH) {
    throw badRequest(`观察说明不能超过 ${MAX_NOTES_LENGTH} 字`);
  }

  const clientToken = typeof body.clientToken === 'string' ? body.clientToken.trim() : '';
  if (!clientToken || clientToken.length > MAX_TOKEN_LENGTH) {
    throw badRequest('缺少有效的提交标识');
  }

  return { symptom, severity, occurredAt, notes, clientToken };
};

const buildRecord = ({ symptom, severity, occurredAt, notes, clientToken }) => ({
  id: crypto.randomUUID(),
  symptomId: symptom.id,
  symptomTitle: symptom.title,
  symptomIcon: symptom.icon,
  severity,
  occurredAt: toIso(occurredAt),
  notes,
  status: 'open',
  clientToken,
  createdAt: new Date().toISOString(),
  closedAt: null,
});

const listRecords = async () => {
  const state = await store.runExclusive((current) => current);
  return sortRecords(state.records);
};

const createRecord = async (body) => {
  const input = validatePayload(body);

  const existing = inFlight.get(input.clientToken);
  if (existing) {
    return existing;
  }

  const task = store.runExclusive(async (state) => {
    // 同一提交重复到达：返回首次创建的记录，不再新增
    const duplicated = state.records.find((record) => record.clientToken === input.clientToken);
    if (duplicated) {
      return duplicated;
    }

    const record = buildRecord(input);
    const nextRecords = [...state.records, record];
    // 先持久化成功再提交到内存，保存失败不影响现有列表和计数
    await store.writeFileAtomic(nextRecords);
    state.records = nextRecords;
    return record;
  });

  inFlight.set(input.clientToken, task);
  try {
    return await task;
  } finally {
    inFlight.delete(input.clientToken);
  }
};

const closeRecord = async (id) => {
  return store.runExclusive(async (state) => {
    const record = state.records.find((item) => item.id === id);
    if (!record) {
      throw notFound('照护记录不存在');
    }
    if (record.status === 'closed') {
      return record;
    }
    // 未填写说明的记录不得结案（创建时已强制要求，这里兜底防御）
    if (!record.notes || !record.notes.trim()) {
      throw new HttpError(409, '未填写观察说明的记录不能结案');
    }

    const closed = { ...record, status: 'closed', closedAt: new Date().toISOString() };
    const nextRecords = state.records.map((item) => (item.id === id ? closed : item));
    // 先持久化成功再提交到内存；结案只更新状态，原始记录内容保留不变
    await store.writeFileAtomic(nextRecords);
    state.records = nextRecords;
    return closed;
  });
};

module.exports = {
  listRecords,
  createRecord,
  closeRecord,
};
