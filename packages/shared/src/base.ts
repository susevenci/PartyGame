/**
 * 协议基础类型：被 protocol 与各游戏状态模块共用，避免循环依赖。
 * 这里只放跨游戏的结构，具体游戏状态见 ./states/。
 */

export type PlayerId = string;

/** 全部内置游戏 id；新增游戏时同步 meta.ts 与 server/src/games/index.ts */
export type GameId =
  | 'werewolf'
  | 'drawing'
  | 'truth-dare'
  | 'fake-artist'
  | 'just-one'
  | 'wavelength'
  | 'fibbage'
  | 'spyfall'
  | 'bombparty'
  | 'codenames'
  | 'telephone'
  | 'avalon';

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface PlayerInfo {
  id: PlayerId;
  name: string;
  avatar: number; // 表情头像在 AVATARS 列表中的下标
  isHost: boolean;
  ready: boolean;
  connected: boolean;
}

export interface RoomInfo {
  code: string;
  name: string;
  game: GameId;
  status: RoomStatus;
  players: PlayerInfo[];
  minPlayers: number;
  maxPlayers: number;
}

/** 游戏元信息：大厅展示与开局校验共用 */
export interface GameMeta {
  id: GameId;
  name: string;
  icon: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  howToPlay: string[];
}

/** 画布画笔操作，坐标归一化（0~1）以适应不同屏幕 */
export interface DrawOp {
  tool: 'pen' | 'eraser';
  color: string;
  size: number; // 1~5，相对粗细
  points: [number, number][];
}
