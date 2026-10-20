/**
 * 通信协议：前后端所有 WebSocket 消息的类型定义。
 * 这是整个项目的“合同”——服务端与客户端只允许使用这里定义的消息。
 * 跨游戏的基础结构在 ./base.ts，各游戏状态在 ./states/，此处统一 re-export。
 */

export * from './base.ts';
export * from './states/index.ts';

import type { DrawOp, GameId, PlayerId, RoomInfo } from './base.ts';
import type {
  AvalonPrivate,
  AvalonState,
  BombPartyState,
  CodenamesPrivate,
  CodenamesState,
  DrawingPrivate,
  DrawingState,
  FakeArtistPrivate,
  FakeArtistState,
  FibbageState,
  JustOnePrivate,
  JustOneState,
  SpyfallPrivate,
  SpyfallState,
  TelephonePrivate,
  TelephoneState,
  TruthDareState,
  WavelengthPrivate,
  WavelengthState,
  WerewolfPrivate,
  WerewolfState,
} from './states/index.ts';

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
  /** 画布：提交一笔（坐标已归一化到 0~1）；你画我猜与假画家共用 */
  | { type: 'draw'; op: DrawOp }
  /** 谁是卧底 / 假画家 / 间谍：投票目标 */
  | { type: 'vote'; target: PlayerId }
  /** 谁是卧底：猜身份（平民猜谁是卧底，可选，答对加分） */
  | { type: 'guess-role'; target: PlayerId }
  /** 真心话大冒险：选择一张卡 */
  | { type: 'pick-card'; value: string }
  /** 真心话大冒险：完成后自报结果 */
  | { type: 'report-result'; value: string }
  /** 真心话大冒险：结束当前回合；行动代号：队长结束本轮猜词 */
  | { type: 'end-turn' }
  /** 主持人：结束整局 / 再来一局 */
  | { type: 'finish-game' }
  | { type: 'rematch' }
  /** 通用文本提交：Just One 提示/猜词、编瞎话假答案、波长线索/数字、BombParty 词语、假画家猜词 */
  | { type: 'submit'; value: string }
  /** 通用选项选择：编瞎话选答案 id、行动代号选词卡 id */
  | { type: 'choose'; value: string }
  /** 传话画图：提交整幅画 */
  | { type: 'submit-drawing'; ops: DrawOp[] }
  /** 阿瓦隆：勾选/取消队员（仅队长） */
  | { type: 'toggle'; value: PlayerId }
  /** 阿瓦隆：提交队伍 */
  | { type: 'submit-team' }
  /** 阿瓦隆：队伍投票 */
  | { type: 'vote-team'; approve: boolean }
  /** 阿瓦隆：任务投票 */
  | { type: 'quest-vote'; success: boolean }
  /** 阿瓦隆：刺客刺杀梅林 */
  | { type: 'assassinate'; target: PlayerId }
  /** 行动代号：队长给出线索词与数量 */
  | { type: 'codename-clue'; word: string; count: number };

// ---------- 服务端 → 客户端 ----------

export type ServerMessage =
  | { type: 'hello'; playerId: PlayerId; room: RoomInfo }
  | { type: 'room-update'; room: RoomInfo }
  | { type: 'game-state'; state: GameState }
  /** 你画我猜 / 假画家：广播一笔画布操作 */
  | { type: 'draw'; op: DrawOp }
  /** 你画我猜 / 假画家：清空画布（换题/新一轮） */
  | { type: 'canvas-clear' }
  /** 私密信息（自己的身份、词卡、要画的词等），只发给本人 */
  | { type: 'game-private'; data: GamePrivate }
  | { type: 'chat'; from: PlayerId; name: string; text: string; ts: number }
  | { type: 'system'; text: string }
  /** 真心话大冒险：广播当前抽到的卡 */
  | { type: 'card'; kind: 'truth' | 'dare'; text: string }
  | { type: 'error'; message: string };

// ---------- 游戏状态与私密信息 ----------

export type GameState =
  | WerewolfState
  | DrawingState
  | TruthDareState
  | FakeArtistState
  | JustOneState
  | WavelengthState
  | FibbageState
  | SpyfallState
  | BombPartyState
  | CodenamesState
  | TelephoneState
  | AvalonState;

export type GamePrivate =
  | WerewolfPrivate
  | DrawingPrivate
  | FakeArtistPrivate
  | JustOnePrivate
  | WavelengthPrivate
  | TelephonePrivate
  | CodenamesPrivate
  | SpyfallPrivate
  | AvalonPrivate;
