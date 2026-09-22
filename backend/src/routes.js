const config = require('./config');
const { project, messages } = require('./constants');
const { sendJson } = require('./response');
const { HttpError } = require('./errors');
const careRecords = require('./careRecords');
const logger = require('./logger');

const MAX_BODY_BYTES = 1024 * 1024;

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, '请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, '请求体不是有效的 JSON'));
      }
    });
    req.on('error', reject);
  });

const handleRequest = async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  try {
    if (url.pathname === '/api/health') {
      sendJson(res, 200, {
        status: 'ok',
        service: project.id,
        message: messages.health,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (url.pathname === '/api/info') {
      sendJson(res, 200, {
        ...project,
        database: config.database,
      });
      return;
    }

    if (url.pathname === '/api/care-records' && req.method === 'GET') {
      const records = await careRecords.listRecords();
      sendJson(res, 200, { records, total: records.length });
      return;
    }

    if (url.pathname === '/api/care-records' && req.method === 'POST') {
      const body = await readBody(req);
      const record = await careRecords.createRecord(body);
      sendJson(res, 201, { record });
      return;
    }

    const closeMatch = url.pathname.match(/^\/api\/care-records\/([^/]+)\/close$/);
    if (closeMatch && req.method === 'PATCH') {
      const record = await careRecords.closeRecord(decodeURIComponent(closeMatch[1]));
      sendJson(res, 200, { record });
      return;
    }

    sendJson(res, 404, { error: messages.notFound, path: url.pathname });
  } catch (error) {
    if (error instanceof HttpError) {
      const payload = { error: error.message };
      if (error.details !== undefined) {
        payload.details = error.details;
      }
      sendJson(res, error.status, payload);
      return;
    }
    logger.error('请求处理失败', error);
    sendJson(res, 500, { error: '服务器内部错误，请稍后重试' });
  }
};

module.exports = {
  handleRequest,
};
