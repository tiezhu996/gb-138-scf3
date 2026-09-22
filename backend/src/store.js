const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const config = require('./config');
const logger = require('./logger');

// 基于 JSON 文件的持久化存储：
// - stateChain 串行化所有"读-改-写"事务，fileChain 串行化磁盘写入，两者独立，
//   事务内部可以安全等待写盘完成
// - 先写临时文件再 rename，保证文件不会写到一半损坏
// - 写盘失败时事务抛错且不提交新状态，内存中的现有列表和计数保持不变

const recordsFile = path.join(config.dataDir, 'care-records.json');

let state = { records: [] };
let fileChain = Promise.resolve();
let stateChain = Promise.resolve();

const load = () => {
  try {
    const raw = fs.readFileSync(recordsFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.records)) {
      state = { records: parsed.records };
      logger.info(`已加载 ${state.records.length} 条照护记录`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('未发现照护记录文件，将创建新文件');
    } else {
      logger.error('照护记录文件读取失败，以空数据启动', error);
    }
  }
};

const writeFileAtomic = (records) => {
  const snapshot = JSON.stringify({ records }, null, 2);
  const run = fileChain.then(async () => {
    await fsp.mkdir(path.dirname(recordsFile), { recursive: true });
    await fsp.writeFile(`${recordsFile}.tmp`, snapshot, 'utf8');
    await fsp.rename(`${recordsFile}.tmp`, recordsFile);
  });
  // 一次写盘失败不应阻塞后续写入
  fileChain = run.catch(() => {});
  return run;
};

// 所有对 state 的读改写都在同一个串行队列中进行
const runExclusive = (task) => {
  const run = stateChain.then(() => task(state));
  stateChain = run.catch(() => {});
  return run;
};

load();

module.exports = {
  recordsFile,
  writeFileAtomic,
  runExclusive,
};
