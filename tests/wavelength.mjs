import { finish, joinGame, send, sleep } from './lib.mjs';

const { clients, code } = await joinGame('wavelength', ['Alice', 'Bob']);
console.log('房号:', code);
if (!clients.every((c) => c.joined)) finish(clients, false, '加入失败');

send(clients[0], { type: 'start-game' });
await sleep(500);

const psychic = clients.find((c) => c.private?.role === 'psychic');
const guesser = clients.find((c) => c.private?.role === 'guesser');
const target = psychic?.private?.target;
const spectrum = clients[0].lastState?.spectrum;
console.log('主持人:', psychic?.name, '目标:', target, '光谱:', spectrum);

send(psychic, { type: 'submit', value: '接近目标' });
await sleep(300);
console.log('线索阶段:', clients[0].lastState?.phase, '线索:', clients[0].lastState?.clue);

send(guesser, { type: 'submit', value: String(target) });
await sleep(400);
const state = clients[0].lastState;
console.log('揭示阶段:', state?.phase, '目标:', state?.target, '结果:', JSON.stringify(state?.results));

const ok =
  typeof target === 'number' &&
  state?.phase === 'reveal' &&
  state?.target === target &&
  state?.results?.[0]?.distance === 0 &&
  state?.scores?.[guesser.playerId] === 3;
finish(clients, ok, ok ? '波长线索与命中计分正常' : '波长流程异常');
