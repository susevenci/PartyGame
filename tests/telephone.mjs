import { drawOp, finish, joinGame, send, sleep } from './lib.mjs';

const { clients, code } = await joinGame('telephone', ['Alice', 'Bob', 'Cathy']);
console.log('房号:', code);
if (!clients.every((c) => c.joined)) finish(clients, false, '加入失败');

send(clients[0], { type: 'start-game' });
await sleep(600);

for (const c of clients) send(c, { type: 'submit', value: `${c.name} 的一句话` });
await sleep(700);
const drawPhase = clients[0].lastState;
const drawPrivates = clients.map((c) => c.private);
console.log('写话后:', drawPhase?.phase, '私密:', drawPrivates.map((p) => p?.kind).join('/'));

for (const c of clients) send(c, { type: 'submit-drawing', ops: [drawOp()] });
await sleep(700);
const guessPhase = clients[0].lastState;
const guessPrivates = clients.map((c) => c.private);
console.log('画完:', guessPhase?.phase, '私密:', guessPrivates.map((p) => p?.kind).join('/'));

for (const c of clients) send(c, { type: 'submit', value: `${c.name} 的猜测` });
await sleep(700);
const reveal = clients[0].lastState;
console.log('揭示:', reveal?.phase, '链路数:', reveal?.chains?.length);

const ok =
  drawPhase?.phase === 'draw' &&
  drawPrivates.every((p) => p?.kind === 'draw' && typeof p?.prompt === 'string') &&
  guessPhase?.phase === 'guess' &&
  guessPrivates.every((p) => p?.kind === 'guess' && Array.isArray(p?.ops)) &&
  reveal?.phase === 'reveal' &&
  reveal?.chains?.length === 3 &&
  reveal?.chains?.every((chain) => chain.steps.length === 3);
finish(clients, ok, ok ? '写画猜接力与链路回放正常' : '传话画图流程异常');
