import WebSocket from 'ws';

export const URL = process.env.PG_URL || 'ws://localhost:3000/ws';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 连接并加入（code 为空则创建房间） */
export function connect(name, code = '', game) {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    const c = {
      name,
      ws,
      room: null,
      playerId: null,
      private: null,
      lastState: null,
      states: [],
      system: [],
      joined: false,
      error: null,
      closed: null,
    };
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', name, avatar: 0, code, game })));
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      if (m.type === 'hello') {
        c.room = m.room;
        c.playerId = m.playerId;
        c.joined = true;
        resolve(c);
      } else if (m.type === 'room-update') c.room = m.room;
      else if (m.type === 'game-private') c.private = m.data;
      else if (m.type === 'game-state') {
        c.states.push(m.state);
        c.lastState = m.state;
      } else if (m.type === 'system') c.system.push(m.text);
      else if (m.type === 'error') c.error = m.message;
    });
    ws.on('error', (e) => {
      c.error = String(e.message ?? e);
    });
    ws.on('close', (code, reason) => {
      c.closed = { code, reason: String(reason) };
    });
    setTimeout(() => resolve(c), 2500);
  });
}

export function send(c, msg) {
  c.ws.send(JSON.stringify(msg));
}

/** 建房 + 依次加入，返回 clients（clients[0] 是房主） */
export async function joinGame(game, names) {
  const clients = [await connect(names[0], '', game)];
  const code = clients[0].room?.code;
  if (!code) throw new Error(`创建房间失败: ${clients[0].error ?? 'no room'}`);
  for (const name of names.slice(1)) {
    clients.push(await connect(name, code, game));
  }
  return { clients, code };
}

export function closeAll(clients) {
  for (const c of clients) {
    try {
      c.ws.close();
    } catch {
      /* ignore */
    }
  }
}

/** 统一收尾：打印结论并退出 */
export function finish(clients, ok, detail) {
  console.log(detail);
  console.log(ok ? '\n✅ 冒烟测试通过' : '\n❌ 冒烟测试失败');
  closeAll(clients);
  process.exit(ok ? 0 : 1);
}

/** 轮询直到条件成立，避免用固定 sleep 等待服务端状态 */
export async function waitFor(predicate, timeout = 3000, interval = 50) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (predicate()) return true;
    await sleep(interval);
  }
  return false;
}

export function drawOp(x = 0.2, y = 0.2) {
  return {
    tool: 'pen',
    color: '#111827',
    size: 2,
    points: [
      [x, y],
      [x + 0.1, y + 0.1],
    ],
  };
}
