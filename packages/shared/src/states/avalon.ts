import type { PlayerId } from '../base.ts';

export type AvalonRole = 'merlin' | 'assassin' | 'minion' | 'loyal';
export type AvalonQuestResult = 'success' | 'fail' | 'pending';

/**
 * 阿瓦隆（简化版）：保留 梅林 / 刺客 / 爪牙 / 忠臣 四种角色，
 * 五轮任务 + 组队投票 + 连续否决 + 终局刺杀。
 */
export interface AvalonState {
  game: 'avalon';
  phase: 'propose' | 'vote' | 'quest' | 'assassinate' | 'gameover';
  /** 0-based 任务轮次 */
  round: number;
  leader: PlayerId;
  teamSize: number;
  proposedTeam: PlayerId[];
  /** 已投票人数；否决前不公开具体票型 */
  voteCount: number;
  approveCount?: number;
  rejectCount?: number;
  rejectStreak: number;
  questResults: AvalonQuestResult[];
  /** 本轮任务需要几张失败票才算失败（第 4 轮 7 人以上为 2） */
  failNeeded: number;
  assassinated?: PlayerId | null;
  winner?: 'good' | 'evil';
  winReason?: string;
  /** gameover 时公开全部身份，供复盘 */
  revealedRoles?: Record<PlayerId, AvalonRole>;
  hint: string;
}

export type AvalonPrivate =
  | { game: 'avalon'; role: 'merlin'; evilIds: PlayerId[] }
  | { game: 'avalon'; role: 'assassin'; evilIds: PlayerId[] }
  | { game: 'avalon'; role: 'minion'; evilIds: PlayerId[] }
  | { game: 'avalon'; role: 'loyal' };
