import type { PlayerId } from '../base.ts';

/**
 * 词语炸弹（中文版 BombParty）：轮到你时，抢在炸弹爆炸前说出一个
 * 含指定汉字的词语；超时或说重复词扣一条命，命耗尽淘汰。
 */
export interface BombPartyState {
  game: 'bombparty';
  phase: 'playing' | 'gameover';
  /** 本轮必须包含的汉字 */
  prompt: string;
  current: PlayerId;
  timeLeft: number;
  lives: Record<PlayerId, number>;
  /** 已经用过的词（避免重复） */
  used: string[];
  lastPlayer?: PlayerId;
  lastWord?: string;
  winner?: PlayerId;
  hint: string;
}
