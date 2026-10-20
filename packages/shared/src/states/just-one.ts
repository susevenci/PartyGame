import type { PlayerId } from '../base.ts';

/**
 * Just One：合作猜词。除猜词者外每人给一个词的提示，
 * 重复的提示会被作废，猜词者只能看到剩下唯一的提示。
 */
export interface JustOneState {
  game: 'just-one';
  phase: 'clue' | 'guess' | 'result' | 'gameover';
  round: number;
  totalRounds: number;
  /** 本轮猜词者 */
  guesser: PlayerId;
  /** 去重后公开的提示（猜词阶段才下发） */
  clues?: string[];
  /** 已提交提示的人数 */
  clueCount?: number;
  /** 被作废的重复提示数量 */
  duplicates?: number;
  /** 本轮猜词结果 */
  lastGuess?: string;
  lastWord?: string;
  lastCorrect?: boolean;
  /** 合作总分（全队共享） */
  score: number;
  history: { word: string; guess: string; correct: boolean }[];
  hint: string;
}

export type JustOnePrivate =
  | { game: 'just-one'; role: 'guesser' }
  | { game: 'just-one'; role: 'clue'; word: string };
