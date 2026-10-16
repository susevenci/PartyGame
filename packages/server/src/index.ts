import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, WebSocket } from 'ws';
import { GAME_META } from '@party-games/shared';
import type { ClientMessage, GameId, ServerMessage } from '@party-games/shared';
import { Room } from './room.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const STATIC_DIR = process.env.STATIC_DIR || join(ROOT, '../../client/dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

/** 本机局域网 IPv4 地址列表 */
export function lanAddresses(): string[] {
  const addrs: string[] = [];
  const nets = networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const n of list ?? []) {
      if (n.family === 'IPv4' && !n.internal) addrs.push(n.address);
    }
  }
  return addrs;
}

interface Session {
  playerId: string;
  room: Room;
}

export function startServer() {
  const sessions = new Map<WebSocket, Session>();
  const rooms = new Map<string, Room>();

  const httpServer = createServer((req, res) => {
    if (req.url === '/api/lan') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ port: PORT, addresses: lanAddresses() }));
      return;
    }
    serveStatic(req, res);
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw)) as ClientMessage;
      } catch {
        return;
      }
      handleClientMessage(ws, msg);
    });
  });

  function send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  const serverHandle = {
    broadcast(room: Room, msg: ServerMessage) {
      for (const [ws, s] of sessions) {
        if (s.room === room) send(ws, msg);
      }
    },
    sendTo(playerId: string, msg: ServerMessage) {
      for (const [ws, s] of sessions) {
        if (s.playerId === playerId) send(ws, msg);
      }
    },
    system(playerId: string, text: string) {
      serverHandle.sendTo(playerId, { type: 'system', text });
    },
    error(playerId: string, message: string) {
      serverHandle.sendTo(playerId, { type: 'error', message });
    },
    forget(room: Room) {
      rooms.delete(room.code);
    },
  };

  function findRoom(code: string): Room | undefined {
    return rooms.get(code.trim().toUpperCase());
  }

  function handleClientMessage(ws: WebSocket, msg: ClientMessage): void {
    if (msg.type === 'join') {
      handleJoin(ws, msg);
      return;
    }
    const session = sessions.get(ws);
    if (!session) return;
    if (msg.type === 'leave') {
      session.room.handleClientMessage(session.playerId, msg);
      session.room.destroy();
      sessions.delete(ws);
      return;
    }
    session.room.handleClientMessage(session.playerId, msg);
  }

  function handleJoin(ws: WebSocket, msg: Extract<ClientMessage, { type: 'join' }>) {
    const code = msg.code.trim().toUpperCase();
    let room = code ? findRoom(code) : undefined;

    if (code && !room) {
      send(ws, { type: 'error', message: '房间不存在，请检查房间号（6 位大写字母/数字）' });
      return;
    }

    // 无房间号 → 创建新房（游戏由 URL ?game= 指定，默认 werewolf）
    if (!room) {
      const game: GameId = GAME_META[msg.game as GameId] ? (msg.game as GameId) : 'werewolf';
      let created: Room | undefined;
      for (let i = 0; i < 5 && !created; i++) {
        const c = randomCode();
        if (!rooms.has(c)) {
          created = new Room(serverHandle, c, game);
          rooms.set(c, created);
        }
      }
      if (!created) {
        send(ws, { type: 'error', message: '创建房间失败，请重试' });
        return;
      }
      room = created;
    }

    try {
      const playerId = room.join(String(msg.name || '玩家'), Number(msg.avatar) || 0, ws);
      sessions.set(ws, { playerId, room });
      send(ws, { type: 'hello', playerId, room: room.info() });
      room.syncTo(playerId);
    } catch (e) {
      send(ws, { type: 'error', message: e instanceof Error ? e.message : '加入失败' });
    }
  }

  function randomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  }

  // 定期清理空房间
  const cleaner = setInterval(() => {
    for (const room of rooms.values()) {
      if (room.size === 0) room.destroy();
    }
  }, 60_000);

  httpServer.listen(PORT, '0.0.0.0', () => {
    cleaner.unref();
    const lan = lanAddresses();
    console.log('────────────────────────────────────────────');
    console.log(`🎉 聚会游戏服务器已启动`);
    console.log(`   本机访问:   http://localhost:${PORT}`);
    for (const ip of lan) {
      console.log(`   局域网访问: http://${ip}:${PORT}`);
    }
    if (lan.length === 0) console.log('   ⚠️ 未检测到局域网 IP，请手动确认');
    console.log(`   远程访问:   将服务器部署到公网，或用自己的内网穿透`);
    console.log('────────────────────────────────────────────');
  });

  return { httpServer, wss };
}

async function serveStatic(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (p === '' || p.endsWith('/')) p = join(p, 'index.html');
    const filePath = join(STATIC_DIR, p);
    if (!filePath.startsWith(STATIC_DIR)) {
      res.statusCode = 403;
      res.end('forbidden');
      return;
    }
    const s = await stat(filePath).catch(() => null);
    const target = s?.isDirectory() ? join(filePath, 'index.html') : filePath;
    const body = await readFile(target).catch(() => null);
    if (!body) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('404 Not Found');
      return;
    }
    res.setHeader('Content-Type', MIME[extname(target)] || 'application/octet-stream');
    if (extname(target) === '.html') {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    res.end(body);
  } catch {
    res.statusCode = 500;
    res.end('internal error');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
