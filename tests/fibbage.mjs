import { finish, joinGame, send, sleep } from './lib.mjs';

const { clients, code } = await joinGame('fibbage', ['Alice', 'Bob']);
console.log('房号:', code);
if (!clients.every((c) => c.joined)) finish(clients, false, '加入失败');

send(clients[0], { type: 'start-game' });
await sleep(500);
console.log('题目:', clients[0].lastState?.question);

send(clients[0], { type: 'submit', value: '蓝色' });
send(clients[1], { type: 'submit', value: '月亮' });
await sleep(400);
const votePhase = clients[0].lastState;
console.log('投票阶段:', votePhase?.phase, '候选:', JSON.stringify(votePhase?.choices));

const choices = votePhase?.choices ?? [];
const ids = choices.map((c) => c.id);
const opaqueIds = ids.length === 3 && ids.every((id) => /^o\d+$/.test(id));
const leakedIds = ids.some((id) => clients.some((c) => id.includes(c.playerId)));
const noAuthorField = choices.every((c) => !('author' in c));
console.log('不透明 id:', opaqueIds, '泄漏 id:', leakedIds, '不含作者字段:', noAuthorField);

const target = choices[0];
const choiceById = Object.fromEntries(choices.map((c) => [c.id, c]));

/** 依次尝试候选，直到服务端接受（submitted 增加）；返回实际投中的 id */
async function castVote(client, ids, expectedSubmitted) {
  for (const id of ids) {
    send(client, { type: 'choose', value: id });
    await sleep(180);
    const st = clients[0].lastState;
    if (st?.phase === 'reveal') return id;
    if ((st?.submitted ?? 0) >= expectedSubmitted) return id;
  }
  return null;
}

const vote0 = await castVote(clients[0], ids, 1);
const vote1 = await castVote(clients[1], ids, 2);
console.log('实际投票:', vote0, vote1, '目标样例:', target?.id);
const reveal = clients[0].lastState;

function scoreFor(voterName, ownVoteId, otherVoteId) {
  let score = 0;
  const own = reveal?.result?.find((r) => r.text === choiceById[ownVoteId]?.text);
  if (own?.correct) score += 1000;
  const other = reveal?.result?.find((r) => r.text === choiceById[otherVoteId]?.text);
  if (other && !other.correct && other.author === voterName) score += 500;
  return score;
}

const expected0 = scoreFor(clients[0].name, vote0, vote1);
const expected1 = scoreFor(clients[1].name, vote1, vote0);
console.log('揭示:', reveal?.phase, '真答案:', reveal?.truth, '分数:', JSON.stringify(reveal?.scores));
console.log('期望分:', expected0, expected1);

const ok =
  votePhase?.phase === 'vote' &&
  opaqueIds &&
  !leakedIds &&
  noAuthorField &&
  Boolean(vote0) &&
  Boolean(vote1) &&
  reveal?.phase === 'reveal' &&
  typeof reveal?.truth === 'string' &&
  reveal?.result?.filter((r) => r.correct).length === 1 &&
  reveal?.scores?.[clients[0].playerId] === expected0 &&
  reveal?.scores?.[clients[1].playerId] === expected1;
finish(clients, ok, ok ? '假答案混入、隐私 id 与计分正常' : '编瞎话流程异常');
