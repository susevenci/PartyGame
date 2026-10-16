/**
 * 冒烟测试运行器：自动拉起服务器 → 依次跑三个游戏的多人协议测试 → 关闭服务器。
 * 用法：node tests/run-all.mjs   （需先 npm run build）
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = 3100; // 与生产端口错开，避免冲突
const URL = `ws://localhost:${PORT}/ws`;

function waitForServer(ms = 8000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      fetch(`http://localhost:${PORT}/api/lan`)
        .then((r) => r.json())
        .then(() => resolve())
        .catch(() => {
          if (Date.now() - t0 > ms) reject(new Error('server did not start'));
          else setTimeout(tryOnce, 250);
        });
    };
    tryOnce();
  });
}

async function runTest(name) {
  const child = spawn(process.execPath, [join(__dirname, `${name}.mjs`)], {
    env: { ...process.env, PG_URL: URL },
    stdio: 'inherit',
  });
  const code = await new Promise((r) => child.on('exit', r));
  return code === 0;
}

const server = spawn(process.execPath, [join(ROOT, 'packages/server/dist/index.js')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});

let exitCode = 0;
try {
  await waitForServer();
  const results = [];
  for (const name of ['werewolf', 'drawing', 'truth-dare']) {
    console.log(`\n===== ${name} =====`);
    const ok = await runTest(name);
    results.push(`${name}: ${ok ? 'PASS' : 'FAIL'}`);
    if (!ok) exitCode = 1;
  }
  console.log('\n' + results.join(' | '));
} finally {
  server.kill();
}
process.exit(exitCode);
