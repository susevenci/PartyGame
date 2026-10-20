import type { PlayerId } from '../base.ts';

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

export interface DrawingPrivate {
  game: 'drawing';
  word: string;
}
