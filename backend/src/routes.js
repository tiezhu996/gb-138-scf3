const config = require('./config');
const { project, messages } = require('./constants');
const { sendJson, sendError } = require('./response');
const { symptomMap, URGENT_SYMPTOM_ID, URGENT_SEVERITY } = require('./symptoms');
const careStore = require('./careStore');

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > 64 * 1024) {
      reject(Object.assign(new Error('请求体过大'), { statusCode: 413 }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (chunks.length === 0) {
      resolve({});
      return;
    }
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch {
      reject(Object.assign(new Error('请求体不是合法 JSON'), { statusCode: 400 }));
    }
  });
  req.on('error', reject);
});

const validateRecordInput = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return '提交内容格式不正确';
  }

  const symptom = symptomMap.get(body.symptomId);
  if (!symptom) {
    return '请从已有症状中选择一项';
  }

  const severity = Number(body.severity);
  if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
    return '严重度须为 1 到 5 的整数';
  }

  if (typeof body.occurredAt !== 'string' || !body.occurredAt.trim()) {
    return '请选择发生时间';
  }
  const occurredMs = Date.parse(body.occurredAt);
  if (!Number.isFinite(occurredMs) || occurredMs > Date.now() + 60 * 1000) {
    return '发生时间不合法';
  }

  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!note) {
    return '请填写观察说明';
  }
  if (note.length > 1000) {
    return '观察说明不能超过 1000 字';
  }

  // 统一存储 ISO 格式，服务端标题以症状目录为准
  return null;
};

const normalizeRecord = (record) => ({
  ...record,
  urgent: record.severity >= URGENT_SEVERITY || record.symptomId === URGENT_SYMPTOM_ID,
});

const routes = {
  'GET /api/health': (req, res) => {
    sendJson(res, 200, {
      status: 'ok',
      service: project.id,
      message: messages.health,
      timestamp: new Date().toISOString(),
    });
  },

  'GET /api/info': (req, res) => {
    sendJson(res, 200, {
      ...project,
      database: config.database,
    });
  },

  // 照护记录列表，按发生时间倒序
  'GET /api/care-records': async (req, res) => {
    try {
      const records = await careStore.listRecords();
      sendJson(res, 200, { records: records.map(normalizeRecord) });
    } catch (error) {
      sendError(res, error);
    }
  },

  // 新建照护记录；同一 Idempotency-Key 的重复提交只生成一条记录
  'POST /api/care-records': async (req, res) => {
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      sendError(res, error);
      return;
    }

    const validationError = validateRecordInput(body);
    if (validationError) {
      sendJson(res, 400, { error: validationError });
      return;
    }

    const idempotencyKey = (req.headers['idempotency-key'] || '').toString().trim().slice(0, 100) || null;

    try {
      const { record, duplicated } = await careStore.createRecord(
        {
          symptomId: body.symptomId,
          symptomTitle: symptomMap.get(body.symptomId).title,
          severity: Number(body.severity),
          occurredAt: new Date(body.occurredAt).toISOString(),
          note: body.note.trim(),
        },
        idempotencyKey,
      );
      sendJson(res, duplicated ? 200 : 201, { record: normalizeRecord(record), duplicated });
    } catch (error) {
      sendError(res, error);
    }
  },

  // 结案：结案说明必填，原始记录保留不改动
  'POST /api/care-records/:id/close': async (req, res, params) => {
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      sendError(res, error);
      return;
    }

    const closeNote = typeof body?.closeNote === 'string' ? body.closeNote.trim() : '';
    if (!closeNote) {
      sendJson(res, 400, { error: '请填写结案说明，未填写说明不得结案' });
      return;
    }
    if (closeNote.length > 1000) {
      sendJson(res, 400, { error: '结案说明不能超过 1000 字' });
      return;
    }

    try {
      const { record, alreadyClosed } = await careStore.closeRecord(params.id, closeNote);
      if (!record) {
        sendJson(res, 404, { error: '照护记录不存在' });
        return;
      }
      sendJson(res, 200, { record: normalizeRecord(record), alreadyClosed });
    } catch (error) {
      sendError(res, error);
    }
  },
};

const handleRequest = (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const method = req.method.toUpperCase();

  const exact = routes[`${method} ${url.pathname}`];
  if (exact) {
    exact(req, res, {});
    return;
  }

  // /api/care-records/:id/close
  const closeMatch = url.pathname.match(/^\/api\/care-records\/([^/]+)\/close$/);
  if (closeMatch && method === 'POST') {
    routes['POST /api/care-records/:id/close'](req, res, { id: decodeURIComponent(closeMatch[1]) });
    return;
  }

  sendJson(res, 404, { error: messages.notFound, path: url.pathname });
};

module.exports = {
  handleRequest,
};
