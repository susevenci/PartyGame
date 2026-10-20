import type { PlayerId } from '../base.ts';

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

export interface WerewolfPrivate {
  game: 'werewolf';
  role: WerewolfRole;
  word: string;
}
