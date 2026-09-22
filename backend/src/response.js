const logger = require('./logger');

const sendJson = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
};

// 保存失败等服务器错误：返回 500 且不回传任何已变更数据，前端保持现有列表不变
const sendError = (res, error) => {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  if (status >= 500) {
    logger.error('request failed', error?.stack || error);
  }
  sendJson(res, status, {
    error: status >= 500 ? '保存失败，请稍后重试' : error?.message || '请求失败',
  });
};

module.exports = {
  sendJson,
  sendError,
};
