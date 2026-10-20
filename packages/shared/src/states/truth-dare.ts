import type { PlayerId } from '../base.ts';

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
