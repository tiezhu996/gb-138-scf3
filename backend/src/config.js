const path = require('node:path');

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  port: toNumber(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  // 照护记录以 JSON 文件持久化，重启服务后仍在；容器中由命名卷挂载
  dataDir: process.env.DATA_DIR || path.resolve(__dirname, '..', 'data'),
  database: {
    host: process.env.DB_HOST || 'db',
    name: process.env.DB_NAME || 'hospice_guide',
  },
};
