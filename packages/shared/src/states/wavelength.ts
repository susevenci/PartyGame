import type { PlayerId } from '../base.ts';

/** 波长：主持人看到光谱上的隐藏目标，用一句话给线索，其他人猜位置。 */
export interface WavelengthState {
  game: 'wavelength';
  phase: 'clue' | 'guess' | 'reveal' | 'gameover';
  round: number;
  totalRounds: number;
  psychic: PlayerId;
  /** 光谱两端的词，如 难吃 ↔ 好吃 */
  spectrum: { left: string; right: string };
  clue?: string;
  /** 猜测阶段：已提交人数 */
  guessCount?: number;
  /** 揭示阶段：每个人的落点与得分 */
  results?: { name: string; value: number; distance: number; score: number }[];
  /** 揭示阶段才公开目标值 */
  target?: number;
  scores: Record<PlayerId, number>;
  hint: string;
}

export type WavelengthPrivate =
  | { game: 'wavelength'; role: 'psychic'; target: number }
  | { game: 'wavelength'; role: 'guesser' };
