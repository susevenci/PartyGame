import { pickCodenamesWords } from '@party-games/shared';
import type {
  ClientMessage,
  CodenameColor,
  CodenameTeam,
  CodenamesPrivate,
  CodenamesState,
  PlayerId,
} from '@party-games/shared';
import type { Game, GameContext } from './types.ts';
import { normalizeText, shuffle, Timer } from './util.ts';

const CLUE_MS = 120_000;
const GUESS_MS = 120_000;

interface CData {
  order: PlayerId[];
  teams: Record<PlayerId, CodenameTeam>;
  spymasters: Record<CodenameTeam, PlayerId>;
  cards: { id: string; word: string; team: CodenameColor; revealed: boolean }[];
  turn: CodenameTeam;
  phase: CodenamesState['phase'];
  clue?: { word: string; count: number };
  guessesLeft: number;
  remaining: Record<CodenameTeam, number>;
  winner?: CodenameTeam;
  winReason?: string;
  hint: string;
}

/**
 * 行动代号：红蓝两队各有一名队长能看到词卡颜色，
 * 队长用「一个词 + 数字」暗示己方词卡，队员依次猜。
 */
export class CodenamesGame implements Game {
  readonly id = 'codenames' as const;
  private s!: CData;
  private timer = new Timer();

  start(ctx: GameContext): void {
    const ids = ctx.players.map((p) => p.id);
    const teams: Record<PlayerId, CodenameTeam> = {};
    ids.forEach((id, index) => {
      teams[id] = index % 2 === 0 ? 'red' : 'blue';
    });
    const reds = ids.filter((id) => teams[id] === 'red');
    const blues = ids.filter((id) => teams[id] === 'blue');
    const spymasters: Record<CodenameTeam, PlayerId> = { red: reds[0]!, blue: blues[0]! };

    const words = pickCodenamesWords(25);
    const colors: CodenameColor[] = [
      ...Array<CodenameColor>(9).fill('red'),
      ...Array<CodenameColor>(8).fill('blue'),
      ...Array<CodenameColor>(7).fill('neutral'),
      'assassin',
    ];
    shuffle(colors);

    this.s = {
      order: ids,
      teams,
      spymasters,
      cards: words.map((word, i) => ({ id: `c${i}`, word, team: colors[i]!, revealed: false })),
      turn: 'red',
      phase: 'clue',
      guessesLeft: 0,
      remaining: { red: 9, blue: 8 },
      hint: '红队队长给线索',
    };

    const key = this.s.cards.map((c) => c.team);
    for (const id of ids) {
      const team = teams[id]!;
      const spymaster = spymasters[team] === id;
      const data: CodenamesPrivate = spymaster
        ? { game: 'codenames', team, spymaster: true, key }
        : { game: 'codenames', team, spymaster: false };
      ctx.sendTo(id, { type: 'game-private', data });
    }
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: '🧩 词阵已布置：红队先手，队长请给线索。' });
    this.armClue(ctx);
  }

  onMessage(ctx: GameContext, msg: ClientMessage, senderId: PlayerId): void {
    const s = this.s;
    if (s.phase === 'clue' && msg.type === 'codename-clue') {
      if (senderId !== s.spymasters[s.turn]) return;
      const word = normalizeText(msg.word, 12);
      const count = Math.floor(Number(msg.count));
      if (!word || !Number.isFinite(count) || count < 1 || count > 5) return;
      s.clue = { word, count };
      s.phase = 'guess';
      s.guessesLeft = count + 1;
      s.hint = `${this.teamName(s.turn)}猜词：线索「${word}」${count} 张`;
      this.pushState(ctx);
      this.armGuess(ctx);
      return;
    }
    if (s.phase === 'guess' && msg.type === 'choose') {
      this.guessCard(ctx, senderId, msg.value);
      return;
    }
    if (s.phase === 'guess' && msg.type === 'end-turn') {
      if (senderId !== s.spymasters[s.turn]) return;
      this.switchTurn(ctx, '队长结束了本轮猜词');
    }
  }

  getState(): CodenamesState {
    const s = this.s;
    return {
      game: 'codenames',
      phase: s.phase,
      turn: s.turn,
      cards: s.cards.map((c) => ({
        id: c.id,
        word: c.word,
        revealedTeam: c.revealed ? c.team : undefined,
      })),
      remaining: s.remaining,
      clue: s.clue,
      guessesLeft: s.guessesLeft,
      winner: s.winner,
      winReason: s.winReason,
      hint: s.hint,
    };
  }

  destroy(): void {
    this.timer.clear();
  }

  private guessCard(ctx: GameContext, senderId: PlayerId, cardId: string): void {
    const s = this.s;
    if (s.teams[senderId] !== s.turn || s.spymasters[s.turn] === senderId) return;
    const card = s.cards.find((c) => c.id === cardId);
    if (!card || card.revealed) return;
    card.revealed = true;

    if (card.team === 'assassin') {
      const other: CodenameTeam = s.turn === 'red' ? 'blue' : 'red';
      this.finish(ctx, other, `💀 ${ctx.name(senderId)} 翻到了刺客，${this.teamName(other)}获胜！`);
      return;
    }
    if (card.team === s.turn) {
      s.remaining[s.turn] -= 1;
      if (s.remaining[s.turn] === 0) {
        this.finish(ctx, s.turn, `${this.teamName(s.turn)}翻完了自己的全部词卡！`);
        return;
      }
      s.guessesLeft -= 1;
      if (s.guessesLeft <= 0) {
        this.switchTurn(ctx, '猜测次数用完');
        return;
      }
      this.pushState(ctx);
      return;
    }
    if (card.team === 'neutral') {
      this.switchTurn(ctx, '翻到了中立词');
      return;
    }
    const opponent = card.team;
    s.remaining[opponent] -= 1;
    if (s.remaining[opponent] === 0) {
      this.finish(ctx, opponent, `${this.teamName(opponent)}的词卡被全部翻开！`);
      return;
    }
    this.switchTurn(ctx, `翻到了${this.teamName(opponent)}的词`);
  }

  private switchTurn(ctx: GameContext, reason: string): void {
    this.timer.clear();
    const s = this.s;
    if (s.phase === 'gameover') return;
    s.turn = s.turn === 'red' ? 'blue' : 'red';
    s.phase = 'clue';
    s.clue = undefined;
    s.guessesLeft = 0;
    s.hint = `${this.teamName(s.turn)}队长给线索（${reason}）`;
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: `🔁 换边：${this.teamName(s.turn)}回合。` });
    this.armClue(ctx);
  }

  private armClue(ctx: GameContext): void {
    this.timer.set(CLUE_MS, () => {
      if (ctx.hostLeft || this.s.phase !== 'clue') return;
      this.switchTurn(ctx, '队长超时');
    });
  }

  private armGuess(ctx: GameContext): void {
    this.timer.set(GUESS_MS, () => {
      if (ctx.hostLeft || this.s.phase !== 'guess') return;
      this.switchTurn(ctx, '猜词超时');
    });
  }

  private finish(ctx: GameContext, winner: CodenameTeam, reason: string): void {
    this.timer.clear();
    const s = this.s;
    s.phase = 'gameover';
    s.winner = winner;
    s.winReason = reason;
    s.hint = `🏆 ${this.teamName(winner)}胜利：${reason}`;
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: s.hint });
  }

  private teamName(team: CodenameTeam): string {
    return team === 'red' ? '🔴 红队' : '🔵 蓝队';
  }

  private pushState(ctx: GameContext): void {
    ctx.broadcast({ type: 'game-state', state: this.getState() });
  }
}
