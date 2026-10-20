import { finish, joinGame, send, sleep } from './lib.mjs';

const { clients, code } = await joinGame('avalon', ['Alice', 'Bob', 'Cathy', 'Dan', 'Eve']);
console.log('房号:', code);
if (!clients.every((c) => c.joined)) finish(clients, false, '加入失败');

send(clients[0], { type: 'start-game' });
await sleep(600);

const roles = clients.map((c) => c.private?.role);
const merlin = clients.find((c) => c.private?.role === 'merlin');
const loyal = clients.find((c) => c.private?.role === 'loyal');
const state = clients[0].lastState;
console.log('身份:', roles.join('/'), '梅林看到坏人:', merlin?.private?.evilIds?.length);
console.log('初始阶段:', state?.phase, '队长:', state?.leader, '需要人数:', state?.teamSize);

send(clients[0], { type: 'toggle', value: clients[0].playerId });
send(clients[0], { type: 'toggle', value: clients[1].playerId });
await sleep(250);
send(clients[0], { type: 'submit-team' });
await sleep(300);
console.log('组队后阶段:', clients[0].lastState?.phase, '队伍:', clients[0].lastState?.proposedTeam?.length);

for (const c of clients) send(c, { type: 'vote-team', approve: true });
await sleep(400);
console.log('投票后阶段:', clients[0].lastState?.phase);

send(clients[0], { type: 'quest-vote', success: true });
send(clients[1], { type: 'quest-vote', success: true });
await sleep(500);
const after = clients[0].lastState;
console.log('任务后阶段:', after?.phase, '结果:', JSON.stringify(after?.questResults), '轮次:', after?.round);

const ok =
  roles.filter((r) => r === 'merlin').length === 1 &&
  roles.filter((r) => r === 'assassin').length === 1 &&
  roles.filter((r) => r === 'minion').length === 1 &&
  roles.filter((r) => r === 'loyal').length === 2 &&
  merlin?.private?.evilIds?.length === 2 &&
  loyal?.private?.evilIds === undefined &&
  after?.questResults?.[0] === 'success' &&
  after?.round === 2 &&
  after?.phase === 'propose';
finish(clients, ok, ok ? '身份分配、组队与任务结算正常' : '阿瓦隆流程异常');
