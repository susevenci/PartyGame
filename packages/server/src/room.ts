import { randomBytes } from 'node:crypto';
import { GAME_META } from '@party-games/shared';
import type {
  ClientMessage,
  GameId,
  PlayerId,
  PlayerInfo,
  RoomInfo,
  ServerMessage,
} from '@party-games/shared';
import { createGame } from './games/index.ts';
import type { Game } from './games/index.ts';

interface Seat {
  info: PlayerInfo;
  ws: import('ws').WebSocket;
}

function makeId(): string {
  return randomBytes(4).toString('base64url').slice(0, 8);
}

/**
 * 房间：玩家座位 + 游戏生命周期。
 * 一个房间同一时间只运行一个游戏实例。
 */
export class Room {
  readonly code: string;
  readonly name: string;
  game: GameId;
  status: RoomInfo['status'] = 'waiting';
  private seats = new Map<PlayerId, Seat>();
  private gameInstance: Game | null = null;
  private destroyed = false;

  constructor(readonly server: ServerHandle, code: string, game: GameId, name?: string) {
    this.code = code;
    this.game = game;
    this.name = name || `房间 ${code}`;
  }

  get players(): PlayerInfo[] {
    return [...this.seats.values()].map((s) => ({ ...s.info, connected: s.ws.readyState === 1 }));
  }

  get hostId(): PlayerId {
    const host = this.players.find((p) => p.isHost && p.connected);
    if (host) return host.id;
    return this.players.find((p) => p.connected)?.id ?? '';
  }

  get size(): number {
    return this.seats.size;
  }

  get meta() {
    return GAME_META[this.game];
  }

  join(name: string, avatar: number, ws: import('ws').WebSocket): PlayerId {
    const trimmed = name.trim().slice(0, 12);
    if (!trimmed) throw new Error('昵称不能为空');
    if (this.status === 'playing') throw new Error('游戏进行中，无法加入');
    if (this.size >= this.meta.maxPlayers) throw new Error('房间已满员');
    if (this.players.some((p) => p.name === trimmed)) throw new Error('昵称已被占用');

    const id = makeId();
    const info: PlayerInfo = {
      id,
      name: trimmed,
      avatar,
      isHost: this.size === 0,
      ready: false,
      connected: true,
    };
    this.seats.set(id, { info, ws });
    ws.on('close', () => this.handleDisconnect(id));
    this.roomUpdate();
    return id;
  }

  private handleDisconnect(id: PlayerId): void {
    this.removePlayer(id);
  }

  /** 移除座位：空房销毁；房主离开则转让给下一位在线玩家 */
  removePlayer(id: PlayerId): void {
    if (this.destroyed) return;
    const seat = this.seats.get(id);
    if (!seat) return;
    const wasHost = seat.info.isHost;
    this.seats.delete(id);

    if (this.seats.size === 0) {
      this.destroy();
      return;
    }
    if (wasHost) {
      const next = [...this.seats.values()].find((s) => s.ws.readyState === 1);
      if (next) {
        next.info.isHost = true;
        this.server.broadcast(this, {
          type: 'system',
          text: `${seat.info.name} 离开，房主已转让给 ${next.info.name}`,
        });
      }
    }
    this.roomUpdate();
  }

  setReady(id: PlayerId, ready: boolean): void {
    const seat = this.seats.get(id);
    if (!seat || this.status !== 'waiting') return;
    seat.info.ready = ready;
    this.roomUpdate();
  }

  tryStart(id: PlayerId): void {
    if (id !== this.hostId) {
      this.server.error(id, '只有房主可以开始游戏');
      return;
    }
    if (this.status === 'playing') return;
    if (this.status === 'finished') {
      this.status = 'waiting';
    }
    const meta = this.meta;
    if (this.size < meta.minPlayers) {
      this.server.error(id, `至少需要 ${meta.minPlayers} 人才能开始`);
      return;
    }
    if (this.size > meta.maxPlayers) {
      this.server.error(id, `最多 ${meta.maxPlayers} 人`);
      return;
    }
    this.start();
  }

  start(): void {
    const game = createGame(this.game);
    this.gameInstance = game;
    this.status = 'playing';
    this.server.broadcast(this, { type: 'system', text: `🎮 游戏「${gameIdName(this.game)}」开始！` });
    this.roomUpdate();
    const ctx = this.buildCtx();
    game.start(ctx);
  }

  handleClientMessage(id: PlayerId, msg: ClientMessage): void {
    if (msg.type === 'leave') {
      this.removePlayer(id);
      return;
    }
    if (msg.type === 'ready') {
      this.setReady(id, msg.ready);
      return;
    }
    if (msg.type === 'start-game') {
      this.tryStart(id);
      return;
    }
    if (msg.type === 'chat') {
      const seat = this.seats.get(id);
      const text = String(msg.text ?? '').trim().slice(0, 200);
      if (text && seat) {
        this.server.broadcast(this, {
          type: 'chat',
          from: id,
          name: seat.info.name,
          text,
          ts: Date.now(),
        });
      }
      return;
    }
    if (msg.type === 'finish-game') {
      if (id !== this.hostId) {
        this.server.error(id, '只有房主可以结束整局');
        return;
      }
      this.stopGame();
      return;
    }
    if (msg.type === 'rematch') {
      if (id !== this.hostId) {
        this.server.error(id, '只有房主可以再来一局');
        return;
      }
      if (this.status === 'playing' && this.gameInstance) this.stopGame();
      if (this.status === 'finished') this.start();
      return;
    }
    if (this.status === 'playing' && this.gameInstance) {
      this.gameInstance.onMessage(this.buildCtx(), msg, id);
    }
  }

  stopGame(): void {
    this.gameInstance?.destroy();
    this.gameInstance = null;
    this.status = 'finished';
    for (const seat of this.seats.values()) seat.info.ready = false;
    this.roomUpdate();
  }

  get ctx(): { hostLeft: boolean } {
    const host = this.seats.get(this.hostId);
    return { hostLeft: !host || host.ws.readyState !== 1 };
  }

  private buildCtx() {
    const self = this;
    return {
      players: this.players,
      hostId: this.hostId,
      get hostLeft() {
        return self.ctx.hostLeft;
      },
      broadcast: (msg: ServerMessage) => self.server.broadcast(this, msg),
      sendTo: (pid: PlayerId, msg: ServerMessage) => self.server.sendTo(pid, msg),
      name: (pid: PlayerId) => self.seats.get(pid)?.info.name ?? '未知玩家',
      online: (pid: PlayerId) => self.seats.get(pid)?.ws.readyState === 1,
    };
  }

  /** 中途加入/重连的玩家补发当前游戏状态 */
  syncTo(id: PlayerId): void {
    const state = this.gameInstance?.getState?.();
    if (state) this.server.sendTo(id, { type: 'game-state', state });
  }

  roomUpdate(): void {
    this.server.broadcast(this, { type: 'room-update', room: this.info() });
  }

  info(): RoomInfo {
    return {
      code: this.code,
      name: this.name,
      game: this.game,
      status: this.status,
      players: this.players,
      minPlayers: this.meta.minPlayers,
      maxPlayers: this.meta.maxPlayers,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.gameInstance?.destroy();
    for (const seat of this.seats.values()) {
      try {
        seat.ws.close(1000, 'room closed');
      } catch {
        /* ignore */
      }
    }
    this.seats.clear();
    this.server.forget(this);
  }
}

function gameIdName(id: GameId): string {
  return GAME_META[id].name;
}

/** 房间对 Server 的反向依赖（窄接口，便于测试） */
export interface ServerHandle {
  broadcast(room: Room, msg: ServerMessage): void;
  sendTo(playerId: PlayerId, msg: ServerMessage): void;
  system(playerId: PlayerId, text: string): void;
  error(playerId: PlayerId, message: string): void;
  forget(room: Room): void;
}
