import type { PlayerId } from '../base.ts';

/** 间谍游戏：所有人知道地点，只有间谍不知道。提问结束后投票指认。 */
export interface SpyfallState {
  game: 'spyfall';
  phase: 'discuss' | 'vote' | 'reveal' | 'gameover';
  /** 讨论阶段剩余秒数 */
  timeLeft: number;
  /** 已投票人数（投票内容在揭示前不公开） */
  voteCount: number;
  /** 揭示阶段：被指认者 */
  accused?: PlayerId | null;
  /** 揭示阶段：间谍与地点 */
  spyId?: PlayerId;
  location?: string;
  winner?: 'spy' | 'agents';
  hint: string;
}

export type SpyfallPrivate =
  | { game: 'spyfall'; isSpy: true; locations: string[] }
  | { game: 'spyfall'; isSpy: false; location: string; locations: string[] };
