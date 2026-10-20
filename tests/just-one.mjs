import { finish, joinGame, send, sleep } from './lib.mjs';

const { clients, code } = await joinGame('just-one', ['Alice', 'Bob', 'Cathy']);
console.log('房号:', code);
if (!clients.every((c) => c.joined)) finish(clients, false, '加入失败');

send(clients[0], { type: 'start-game' });
await sleep(500);

const guesser = clients.find((c) => c.private?.role === 'guesser');
const clueGivers = clients.filter((c) => c.private?.role === 'clue');
const word = clueGivers[0]?.private?.word;
console.log('猜词者:', guesser?.name, '词:', word, '提示者:', clueGivers.length);

// 两人给相同提示，验证「重复作废」
send(clueGivers[0], { type: 'submit', value: '蓝色' });
send(clueGivers[1], { type: 'submit', value: '蓝色' });
await sleep(400);
const guessPhase = clients[0].lastState;
console.log('阶段:', guessPhase?.phase, '有效提示:', guessPhase?.clues, '作废:', guessPhase?.duplicates);

send(guesser, { type: 'submit', value: word });
await sleep(400);
const result = clients[0].lastState;
console.log('结果阶段:', result?.phase, '猜中:', result?.lastCorrect, '合作分:', result?.score);

const ok =
  Boolean(word) &&
  guessPhase?.phase === 'guess' &&
  (guessPhase?.clues?.length ?? 0) === 0 &&
  guessPhase?.duplicates === 2 &&
  result?.phase === 'result' &&
  result?.lastCorrect === true &&
  result?.score === 1;
finish(clients, ok, ok ? '重复提示作废与猜词计分正常' : 'Just One 流程异常');
