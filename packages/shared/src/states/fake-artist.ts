import type { PlayerId } from '../base.ts';

/**
 * 假画家：所有人拿到同一个词轮流各画一笔，只有假画家只知道品类。
 * 画完投票，抓到假画家后他还有一次猜词机会。
 */
export interface FakeArtistState {
  game: 'fake-artist';
  phase: 'draw' | 'vote' | 'guess' | 'gameover';
  category: string;
  /** 当前该画的人 */
  current: PlayerId;
  /** 已完成笔数 / 总共需要几笔（人数 × 每人笔数） */
  strokes: number;
  totalStrokes: number;
  /** 投票阶段：已投票人数 */
  voteCount?: number;
  votedOut?: PlayerId | null;
  /** 抓到假画家后，假画家的猜词 */
  finalGuess?: string;
  winner?: 'fake' | 'artists';
  hint: string;
}

export type FakeArtistPrivate =
  | { game: 'fake-artist'; isFake: true; category: string }
  | { game: 'fake-artist'; isFake: false; category: string; word: string };
