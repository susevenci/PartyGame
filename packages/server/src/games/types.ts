/**
 * 游戏插件接口：每个小游戏实现这个接口即可被房间系统驱动。
 *
 * 新增游戏的步骤：
 * 1. shared/protocol.ts 增加该游戏的状态类型与消息类型；
 * 2. 本目录新建文件实现 Game 并在 index.ts 注册；
 * 3. 前端 src/games/ 添加对应组件。
 */
import type { ClientMessage, GameId, GameState, PlayerId, ServerMessage, PlayerInfo } from '@party-games/shared';

export interface GameContext {
  /** 房间内有序玩家列表（含在线状态） */
  players: PlayerInfo[];
  /** 房主 id（发起开始、可结束整局） */
  hostId: PlayerId;
  /** 房主是否已离线（游戏应暂停推进） */
  readonly hostLeft: boolean;
  /** 广播给房间内所有人 */
  broadcast(msg: ServerMessage): void;
  /** 只发给某个玩家（私密信息） */
  sendTo(playerId: PlayerId, msg: ServerMessage): void;
  /** 玩家显示名 */
  name(playerId: PlayerId): string;
  /** 玩家是否在线 */
  online(playerId: PlayerId): boolean;
}

export interface Game {
  readonly id: GameId;
  /** 开局：发送初始公开/私密状态 */
  start(ctx: GameContext): void;
  /** 处理一条客户端消息，senderId 为发送者（服务端可信） */
  onMessage(ctx: GameContext, msg: ClientMessage, senderId: PlayerId): void;
  /** 房间循环心跳（1 秒一次），游戏可用于倒计时等 */
  tick?(ctx: GameContext): void;
  /** 结束：清理内部定时器与状态 */
  destroy(): void;
  /** 当前公开状态（中途加入者补发，可选实现） */
  getState?(): GameState;
}
