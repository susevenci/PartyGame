import WebSocket from 'ws';

const URL = process.env.PG_URL || 'ws://localhost:3000/ws';
const N = 4;

function client(name, code = '') {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    const c = { name, ws, room: null, private: null, states: [], sys: [], joined: false };
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', name, avatar: 0, code, game: 'werewolf' })));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.type === 'hello') { c.room = m.room; c.joined = true; resolve(c); }
      else if (m.type === 'room-update') c.room = m.room;
      else if (m.type === 'game-private') c.private = m.data;
      else if (m.type === 'game-state') { c.states.push(m.state); c.lastState = m.state; }
      else if (m.type === 'system') c.sys.push(m.text);
      else if (m.type === 'error') c.error = m.message;
    });
    ws.on('error', (e) => { c.wsError = String(e.message ?? e); });
    setTimeout(() => resolve(c), 3000);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const players = [];
// 第一个建房
players.push(await client('Alice'));
const code = players[0].room?.code;
console.log('房号:', code);
// 其余加入
for (const n of ['Bob', 'Cathy', 'Dan']) {
  players.push(await client(n, code));
}

const joinedOk = players.every((p) => p.joined);
console.log('4人加入:', joinedOk, players.map(p => p.room?.players?.length).join('/'));
if (!joinedOk) { console.log('ERRORS', players.map(p => p.error || p.wsError)); process.exit(1); }

// 房主开始游戏
players[0].ws.send(JSON.stringify({ type: 'start-game' }));
await sleep(1500);

const allGotPrivate = players.every((p) => p.private?.game === 'werewolf' && p.private.word && p.private.role);
const spyCount = players.filter((p) => p.private?.role === 'werewolf').length;
const commonWord = players.find((p) => p.private?.role === 'villager')?.private?.word;
console.log('收到词牌:', allGotPrivate, '卧底人数:', spyCount, '平民词:', commonWord);

// 走到投票阶段（夜晚8s + 白天30s 太长，只验证状态推进到 night→day）
await sleep(9000);
const phase = players[0].lastState?.phase;
console.log('9秒后阶段:', phase, '存活:', players[0].lastState?.alive?.length, '昨晚死亡:', players[0].lastState?.lastDeaths?.length);
const sysSample = players[0].sys.slice(0, 3);
console.log('系统消息样例:', JSON.stringify(sysSample));

const ok = allGotPrivate && spyCount === 1 && phase === 'day' && players[0].lastState.alive.length === 3;
console.log(ok ? '\n✅ 冒烟测试通过' : '\n❌ 冒烟测试失败');
process.exit(ok ? 0 : 1);
