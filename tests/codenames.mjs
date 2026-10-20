import { finish, joinGame, send, sleep } from './lib.mjs';

const { clients, code } = await joinGame('codenames', ['Alice', 'Bob', 'Cathy', 'Dan']);
console.log('房号:', code);
if (!clients.every((c) => c.joined)) finish(clients, false, '加入失败');

send(clients[0], { type: 'start-game' });
await sleep(600);

const redSpy = clients.find((c) => c.private?.team === 'red' && c.private?.spymaster);
const redOperative = clients.find((c) => c.private?.team === 'red' && !c.private?.spymaster);
const key = redSpy?.private?.key;
const redIndex = key?.findIndex((color) => color === 'red') ?? -1;
const state = clients[0].lastState;
console.log('红队队长:', redSpy?.name, '红队队员:', redOperative?.name, '红卡下标:', redIndex);
console.log('初始:', state?.phase, '回合:', state?.turn, '剩余:', JSON.stringify(state?.remaining));

send(redSpy, { type: 'codename-clue', word: '测试', count: 1 });
await sleep(400);
console.log('线索后阶段:', clients[0].lastState?.phase, '线索:', JSON.stringify(clients[0].lastState?.clue));

send(redOperative, { type: 'choose', value: `c${redIndex}` });
await sleep(400);
const after = clients[0].lastState;
console.log('翻牌后剩余:', JSON.stringify(after?.remaining), '卡面:', after?.cards?.[redIndex]?.revealedTeam);

const ok =
  redIndex >= 0 &&
  redOperative?.private?.key === undefined &&
  state?.turn === 'red' &&
  state?.remaining?.red === 9 &&
  after?.remaining?.red === 8 &&
  after?.cards?.[redIndex]?.revealedTeam === 'red' &&
  after?.phase === 'guess';
finish(clients, ok, ok ? '队长私密颜色与翻牌扣减正常' : '行动代号流程异常');
