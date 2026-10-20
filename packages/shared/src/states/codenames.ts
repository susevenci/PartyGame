export type CodenameTeam = 'red' | 'blue';
export type CodenameColor = CodenameTeam | 'neutral' | 'assassin';

/** 公开卡片：未翻开时不带颜色，防止客户端偷看 */
export interface CodenameCardView {
  id: string;
  word: string;
  revealedTeam?: CodenameColor;
}

export interface CodenamesState {
  game: 'codenames';
  phase: 'clue' | 'guess' | 'gameover';
  turn: CodenameTeam;
  cards: CodenameCardView[];
  remaining: Record<CodenameTeam, number>;
  clue?: { word: string; count: number };
  guessesLeft: number;
  winner?: CodenameTeam;
  winReason?: string;
  hint: string;
}

export interface CodenamesPrivate {
  game: 'codenames';
  team: CodenameTeam;
  spymaster: boolean;
  /** 仅队长可见：与 cards 下标一一对应 */
  key?: CodenameColor[];
}
