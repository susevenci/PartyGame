import type { PlayerId } from '../base.ts';

/**
 * 编瞎话（Fibbage 类）：题目留空，所有人编一个假答案，
 * 混入正确答案后一起投票；骗到别人、选中真题都得分。
 */
export interface FibbageState {
  game: 'fibbage';
  phase: 'write' | 'vote' | 'reveal' | 'gameover';
  round: number;
  totalRounds: number;
  question: string;
  /** 投票阶段：打乱后的候选答案（不含作者信息） */
  choices?: { id: string; text: string }[];
  /** 已提交/已投票人数 */
  submitted: number;
  /** 揭示阶段：正确答案与每条答案的作者、票数 */
  truth?: string;
  result?: { text: string; author?: string; count: number; correct: boolean }[];
  scores: Record<PlayerId, number>;
  hint: string;
}
