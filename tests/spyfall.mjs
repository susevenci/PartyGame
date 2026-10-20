import { finish, joinGame, send, sleep } from './lib.mjs';

const { clients, code } = await joinGame('spyfall', ['Alice', 'Bob', 'Cathy']);
console.log('房号:', code);
if (!clients.every((c) => c.joined)) finish(clients, false, '加入失败');

send(clients[0], { type: 'start-game' });
await sleep(500);

const spy = clients.find((c) => c.private?.isSpy === true);
const agents = clients.filter((c) => c.private?.isSpy === false);
const location = agents[0]?.private?.location;
console.log('间谍:', spy?.name, '地点:', location, '平民:', agents.length);
console.log('初始阶段:', clients[0].lastState?.phase, '倒计时:', clients[0].lastState?.timeLeft);

for (const agent of agents) send(agent, { type: 'vote', target: spy.playerId });
send(spy, { type: 'vote', target: agents[0].playerId });
await sleep(500);

const state = clients[0].lastState;
console.log('揭示:', state?.phase, '赢家:', state?.winner, '间谍:', state?.spyId, '地点:', state?.location);

const ok =
  Boolean(spy) &&
  agents.length === 2 &&
  Boolean(location) &&
  clients[0].states.some((s) => s.phase === 'discuss' && s.spyId === undefined && s.location === undefined) &&
  state?.phase === 'reveal' &&
  state?.winner === 'agents' &&
  state?.spyId === spy.playerId &&
  state?.location === location;
finish(clients, ok, ok ? '间谍私密信息与指认结算正常' : '间谍流程异常');
