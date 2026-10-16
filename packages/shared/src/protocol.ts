/**
 * 通信协议：前后端所有 WebSocket 消息的类型定义。
 * 这是整个项目的“合同”——服务端与客户端只允许使用这里定义的消息。
 */

// ---------- 基础 ----------

export type PlayerId = string;

export type GameId = 'werewolf' | 'drawing' | 'truth-dare';

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

// ---------- 客户端 → 服务端 ----------

export type ClientMessage =
  | { type: 'join'; name: string; avatar: number; code: string; game?: GameId }
  | { type: 'leave' }
  | { type: 'ready'; ready: boolean }
  | { type: 'start-game' }
  | { type: 'chat'; text: string }
  /** 你画我猜：提交一个猜测（文字） */
  | { type: 'answer'; value: string }
  /** 你画我猜：画家放弃当前题目（换一题） */
  | { type: 'pass' }
  /** 你画我猜：画家提交一笔（坐标已归一化到 0~1） */
  | { type: 'draw'; op: DrawOp }
  /** 谁是卧底：投票目标 */
  | { type: 'vote'; target: PlayerId }
  /** 谁是卧底：猜身份（平民猜谁是卧底，可选，答对加分） */
  | { type: 'guess-role'; target: PlayerId }
  /** 真心话大冒险：选择一张卡 */
  | { type: 'pick-card'; value: string }
  /** 真心话大冒险：完成后自报结果 */
  | { type: 'report-result'; value: string }
  /** 真心话大冒险：主持人结束当前回合 */
  | { type: 'end-turn' }
  /** 主持人：结束整局 / 再来一局 */
  | { type: 'finish-game' }
  | { type: 'rematch' };

// ---------- 服务端 → 客户端 ----------

export type ServerMessage =
  | { type: 'hello'; playerId: PlayerId; room: RoomInfo }
  | { type: 'room-update'; room: RoomInfo }
  | { type: 'game-state'; state: GameState }
  /** 你画我猜：广播一笔画布操作 */
  | { type: 'draw'; op: DrawOp }
  /** 你画我猜：清空画布（换题/新一轮） */
  | { type: 'canvas-clear' }
  /** 私密信息（自己的卧底身份、自己要画的词等），只发给本人 */
  | { type: 'game-private'; data: GamePrivate }
  | { type: 'chat'; from: PlayerId; name: string; text: string; ts: number }
  | { type: 'system'; text: string }
  /** 真心话大冒险：广播当前抽到的卡 */
  | { type: 'card'; kind: 'truth' | 'dare'; text: string }
  | { type: 'error'; message: string };

export type GamePrivate =
  | { game: 'werewolf'; role: WerewolfRole; word: string }
  | { game: 'drawing'; word: string };

/** 画布画笔操作，坐标归一化（0~1）以适应不同屏幕 */
export interface DrawOp {
  tool: 'pen' | 'eraser';
  color: string;
  size: number; // 1~5，相对粗细
  points: [number, number][];
}

// ---------- 游戏状态（公开部分，广播给所有人） ----------

export type WerewolfRole = 'werewolf' | 'villager';

export interface WerewolfState {
  game: 'werewolf';
  phase: 'night' | 'day' | 'vote' | 'reveal' | 'gameover';
  round: number;
  /** 当前存活玩家 */
  alive: PlayerId[];
  /** 夜晚提示文案（不含角色信息），如“狼人请睁眼” */
  hint: string;
  /** 白天：昨晚死亡名单与遗言提示 */
  lastDeaths?: PlayerId[];
  /** 投票阶段：已投票人数 */
  voteCount?: number;
  /** 投票结果（平票/出局者） */
  votedOut?: PlayerId | null;
  winner?: 'werewolf' | 'villager';
  winReason?: string;
}

export interface DrawingState {
  game: 'drawing';
  phase: 'draw' | 'guess' | 'reveal';
  round: number;
  totalRounds: number;
  /** 当前画家 */
  drawer: PlayerId;
  /** 已弃权的人（公开） */
  passed: PlayerId[];
  /** 揭示阶段：正确答案 */
  word?: string;
  /** 本轮得分：playerId -> 正确猜出的次数（谁先猜中得2分，其余猜中1分） */
  scores?: Record<PlayerId, number>;
  totalScores: Record<PlayerId, number>;
}

export interface TruthDareState {
  game: 'truth-dare';
  round: number; // 第几圈（一圈=所有人都轮一遍）
  turn: number; // 圈内第几个人
  /** 当前表演者 */
  current: PlayerId;
  phase: 'picking' | 'acting' | 'reporting' | 'round-result' | 'gameover';
  /** 表演倒计时剩余秒数 */
  timeLeft?: number;
  /** 当前已收集的自报结果 */
  reports: { name: string; text: string }[];
  /** 整局累计记录（供翻牌回顾） */
  history: { name: string; card: string; result: string }[];
}

export type GameState = WerewolfState | DrawingState | TruthDareState;
