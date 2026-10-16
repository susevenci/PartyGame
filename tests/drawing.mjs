import WebSocket from 'ws';
const URL = process.env.PG_URL || 'ws://localhost:3000/ws';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(name, code = '') {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    const c = { name, ws, room: null, private: null, lastState: null, draws: [], sys: [], joined: false };
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', name, avatar: 0, code, game: 'drawing' })));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.type === 'hello') { c.room = m.room; c.joined = true; resolve(c); }
      else if (m.type === 'room-update') c.room = m.room;
      else if (m.type === 'game-private') c.private = m.data;
      else if (m.type === 'game-state') c.lastState = m.state;
      else if (m.type === 'draw') c.draws.push(m.op);
      else if (m.type === 'system') c.sys.push(m.text);
      else if (m.type === 'error') c.error = m.message;
    });
    setTimeout(() => resolve(c), 3000);
  });
}

const a = await client('P1');
const code = a.room.code;
const b = await client('P2', code);
console.log('2人加入:', a.joined && b.joined);

a.ws.send(JSON.stringify({ type: 'start-game' }));
await sleep(800);

// P1 是画家（顺序第一个）
const drawerWord = a.private?.word;
console.log('画家词:', drawerWord, ' 猜词人拿到词(应为undefined):', b.private?.word);

// 画家画一笔
a.ws.send(JSON.stringify({ type: 'draw', op: { tool: 'pen', color: '#000000', size: 2, points: [[0.1, 0.2], [0.5, 0.6]] } }));
await sleep(500);
console.log('猜词人收到笔迹:', b.draws.length === 1, JSON.stringify(b.draws[0]?.points));

// 猜中
b.ws.send(JSON.stringify({ type: 'answer', value: drawerWord }));
await sleep(500);
console.log('猜中后得分:', JSON.stringify(a.lastState?.scores), '系统提示:', a.sys[a.sys.length - 1]);

// 全部猜中 → 进入 reveal
await sleep(1000);
console.log('阶段:', a.lastState?.phase, '揭示答案:', a.lastState?.word);
console.log('总分:', JSON.stringify(a.lastState?.totalScores));

const ok =
  b.draws.length === 1 &&
  a.lastState?.phase === 'reveal' &&
  a.lastState?.scores?.[b.room.players.find(p => p.name === 'P2').id] === 2;
console.log(ok ? '\n✅ 你画我猜 冒烟测试通过' : '\n❌ 失败');
process.exit(ok ? 0 : 1);
