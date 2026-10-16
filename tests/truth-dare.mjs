import WebSocket from 'ws';
const URL = process.env.PG_URL || 'ws://localhost:3000/ws';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(name, code = '') {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    const c = { name, ws, room: null, lastState: null, cards: [], reports: [], sys: [], joined: false };
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', name, avatar: 0, code, game: 'truth-dare' })));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.type === 'hello') { c.room = m.room; c.joined = true; resolve(c); }
      else if (m.type === 'room-update') c.room = m.room;
      else if (m.type === 'game-state') { c.lastState = m.state; if (m.state.reports?.length) c.reports = m.state.reports; }
      else if (m.type === 'card') c.cards.push(m);
      else if (m.type === 'system') c.sys.push(m.text);
      else if (m.type === 'error') c.error = m.message;
    });
    setTimeout(() => resolve(c), 3000);
  });
}

const a = await client('Host');
const code = a.room.code;
const b = await client('Guest', code);
console.log('2人加入:', a.joined && b.joined);

a.ws.send(JSON.stringify({ type: 'start-game' }));
await sleep(800);
console.log('第一轮卡片:', a.cards[0]?.text?.slice(0, 12), '…', ' 阶段:', a.lastState?.phase, ' 当前:', a.lastState?.current);

// 当前玩家自报结果
a.ws.send(JSON.stringify({ type: 'report-result', value: '我唱了半句情歌' }));
await sleep(500);
const reportOk = a.lastState?.reports?.[0]?.text === '我唱了半句情歌';
console.log('自报后阶段:', a.lastState?.phase, ' 结果记录:', JSON.stringify(a.lastState?.reports));

// 8 秒结果展示 + 2 秒后轮到下一位
await sleep(12000);
console.log('下一位:', a.lastState?.current === b.room.players.find(p => p.name === 'Guest').id ? 'Guest(正确)' : '???');
console.log('第二张卡:', a.cards[1]?.text?.slice(0, 12));
console.log('历史记录条数:', a.lastState?.history?.length);

const ok = reportOk && a.cards.length >= 2;
console.log(ok ? '\n✅ 真心话大冒险 冒烟测试通过' : '\n❌ 失败');
process.exit(ok ? 0 : 1);
