import { finish, joinGame, send, sleep } from './lib.mjs';

const { clients, code } = await joinGame('bombparty', ['Alice', 'Bob']);
console.log('房号:', code);
if (!clients.every((c) => c.joined)) finish(clients, false, '加入失败');

send(clients[0], { type: 'start-game' });
await sleep(500);

const start = clients[0].lastState;
const prompt = start?.prompt;
const current = clients.find((c) => c.playerId === start?.current);
console.log('题面:', prompt, '当前玩家:', current?.name, '倒计时:', start?.timeLeft);

const word = `${prompt}${prompt}`;
send(current, { type: 'submit', value: word });
await sleep(400);

const after = clients[0].lastState;
console.log('已用词:', after?.used, '下一位:', after?.current, '命数:', JSON.stringify(after?.lives));

const ok =
  typeof prompt === 'string' &&
  prompt.length === 1 &&
  after?.used?.includes(word) &&
  after?.current !== start?.current &&
  after?.lives?.[current.playerId] === 3;
finish(clients, ok, ok ? '含字校验与轮转正常' : '词语炸弹流程异常');
