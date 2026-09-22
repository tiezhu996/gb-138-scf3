const http = require('node:http');
const config = require('./config');
const { messages } = require('./constants');
const { handleRequest } = require('./routes');
const careStore = require('./careStore');
const logger = require('./logger');

const server = http.createServer(handleRequest);

const start = async () => {
  try {
    await careStore.ensureStorageReady();
  } catch (error) {
    // 持久化目录不可用时仍然启动，但健康检查会反映异常，便于排查
    logger.error('care records storage unavailable', error);
  }

  server.listen(config.port, config.host, () => {
    logger.info(`${messages.serverStarted} on ${config.port}`);
  });
};

start();
