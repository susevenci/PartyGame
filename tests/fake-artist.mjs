import { drawOp, finish, joinGame, send, sleep } from './lib.mjs';

const { clients, code } = await joinGame('fake-artist', ['Alice', 'Bob', 'Cathy', 'Dan', 'Eve']);
console.log('房号:', code, '人数:', clients.length);
if (!clients.every((c) => c.joined)) finish(clients, false, '加入失败');

send(clients[0], { type: 'start-game' });
await sleep(600);

const privates = clients.map((c) => c.private);
const fakes = privates.filter((p) => p?.game === 'fake-artist' && p.isFake === true);
const artists = privates.filter((p) => p?.game === 'fake-artist' && p.isFake === false);
const state = clients[0].lastState;
console.log('私密信息:', privates.map((p) => (p?.isFake ? 'fake' : p?.word)).join('/'));
console.log('阶段:', state?.phase, '总笔数:', state?.totalStrokes);

const first = clients.find((c) => c.playerId === state?.current);
send(first, { type: 'draw', op: drawOp() });
await sleep(400);
const after = clients[0].lastState;
console.log('落笔后已画:', after?.strokes, '下一人:', after?.current);

const ok =
  fakes.length === 1 &&
  artists.length === 4 &&
  state?.phase === 'draw' &&
  state?.totalStrokes === 10 &&
  after?.strokes === 1 &&
  after?.current !== state?.current;
finish(clients, ok, ok ? '假画家发牌与轮转笔迹正常' : '假画家流程异常');
