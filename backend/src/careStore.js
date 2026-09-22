const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'care-records.json');

const EMPTY_DATA = { records: [], idempotencyKeys: {} };

let storeTask = Promise.resolve();

let readPromise = null;
const readData = () => {
  if (!readPromise) {
    readPromise = fs.readFile(DATA_FILE, 'utf8')
      .then((raw) => {
        const parsed = JSON.parse(raw);
        return {
          records: Array.isArray(parsed.records) ? parsed.records : [],
          idempotencyKeys: parsed.idempotencyKeys && typeof parsed.idempotencyKeys === 'object'
            ? parsed.idempotencyKeys
            : {},
        };
      })
      .catch((error) => {
        if (error.code === 'ENOENT') return { ...EMPTY_DATA };
        throw error;
      });
  }
  return readPromise;
};

// 原子写入：先写临时文件再 rename，避免写一半损坏既有数据
const writeData = async (data) => {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tmpFile = `${DATA_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(tmpFile, payload, 'utf8');
  await fs.rename(tmpFile, DATA_FILE);
};

// 所有写操作串行化，保证并发提交不会互相覆盖
const enqueue = (task) => {
  const run = storeTask.then(task, task);
  storeTask = run.catch(() => {});
  return run;
};

const listRecords = async () => {
  const data = await readData();
  return data.records.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
};

// 返回 { record, duplicated }；幂等键相同的重复提交只生成一条记录
const createRecord = (input, idempotencyKey) => enqueue(async () => {
  const data = await readData();

  if (idempotencyKey) {
    const existingId = data.idempotencyKeys[idempotencyKey];
    if (existingId) {
      const existing = data.records.find((record) => record.id === existingId);
      if (existing) return { record: existing, duplicated: true };
    }
  }

  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    symptomId: input.symptomId,
    symptomTitle: input.symptomTitle,
    severity: input.severity,
    occurredAt: input.occurredAt,
    note: input.note,
    status: 'open',
    closeNote: null,
    createdAt: now,
    closedAt: null,
  };

  const nextData = {
    records: [...data.records, record],
    idempotencyKeys: idempotencyKey
      ? { ...data.idempotencyKeys, [idempotencyKey]: record.id }
      : data.idempotencyKeys,
  };
  await commit(nextData);
  return { record, duplicated: false };
});

const commit = async (nextData) => {
  await writeData(nextData);
  // 只有落盘成功才更新内存缓存；失败时保留旧状态，重试可安全再次提交
  readPromise = Promise.resolve(nextData);
};

// 结案只追加结案信息，原始记录内容保持不变
const closeRecord = (id, closeNote) => enqueue(async () => {
  const data = await readData();
  const record = data.records.find((item) => item.id === id);
  if (!record) return { record: null, alreadyClosed: false };
  if (record.status === 'closed') return { record, alreadyClosed: true };

  const closedRecord = { ...record, status: 'closed', closeNote, closedAt: new Date().toISOString() };
  const nextData = {
    ...data,
    records: data.records.map((item) => (item.id === id ? closedRecord : item)),
  };
  await commit(nextData);
  return { record: closedRecord, alreadyClosed: false };
});

const ensureStorageReady = async () => {
  // 首次读取：文件不存在时初始化为空；其他错误（如 JSON 损坏）向上抛出
  const data = await readData();
  if (data.records.length === 0 && Object.keys(data.idempotencyKeys).length === 0) {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.access(DATA_FILE).catch(() => writeData(EMPTY_DATA));
  }
};

module.exports = {
  ensureStorageReady,
  listRecords,
  createRecord,
  closeRecord,
};
