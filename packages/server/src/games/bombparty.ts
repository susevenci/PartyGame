import { pickBombPartyPrompt } from '@party-games/shared';
import type { BombPartyState, ClientMessage, PlayerId } from '@party-games/shared';
import type { Game, GameContext } from './types.ts';
import { normalizeText, Timer } from './util.ts';

const TURN_SECONDS = 12;
const LIVES = 3;
const WORD_RE = /^[\u4e00-\u9fa5]+$/;

interface BData {
  order: PlayerId[];
  currentIndex: number;
  lives: Record<PlayerId, number>;
  used: string[];
  prompt: string;
  promptUsed: string[];
  timeLeft: number;
  phase: BombPartyState['phase'];
  lastPlayer?: PlayerId;
  lastWord?: string;
  winner?: PlayerId;
  hint: string;
}

/**
 * 词语炸弹（中文版 BombParty）：轮到你时，必须在倒计时结束前
 * 说出一个包含指定汉字的词语；超时扣命，命耗尽淘汰。
 */
export class BombPartyGame implements Game {
  readonly id = 'bombparty' as const;
  private s!: BData;
  private timer = new Timer();

  start(ctx: GameContext): void {
    const ids = ctx.players.map((p) => p.id);
    this.s = {
      order: ids,
      currentIndex: 0,
      lives: Object.fromEntries(ids.map((id) => [id, LIVES])),
      used: [],
      prompt: '',
      promptUsed: [],
      timeLeft: TURN_SECONDS,
      phase: 'playing',
      hint: '',
    };
    ctx.broadcast({ type: 'system', text: `💣 每人 ${LIVES} 条命，说出含指定字的词语！` });
    this.nextTurn(ctx);
  }

  onMessage(ctx: GameContext, msg: ClientMessage, senderId: PlayerId): void {
    if (this.s.phase !== 'playing' || msg.type !== 'submit') return;
    if (senderId !== this.current) return;
    this.tryWord(ctx, senderId, msg.value);
  }

  getState(): BombPartyState {
    const s = this.s;
    return {
      game: 'bombparty',
      phase: s.phase,
      prompt: s.prompt,
      current: this.current,
      timeLeft: s.timeLeft,
      lives: s.lives,
      used: s.used,
      lastPlayer: s.lastPlayer,
      lastWord: s.lastWord,
      winner: s.winner,
      hint: s.hint,
    };
  }

  destroy(): void {
    this.timer.clear();
  }

  private get current(): PlayerId {
    return this.s.order[this.s.currentIndex]!;
  }

  private nextTurn(ctx: GameContext): void {
    this.timer.clear();
    const s = this.s;
    s.prompt = pickBombPartyPrompt(s.promptUsed);
    s.promptUsed.push(s.prompt);
    s.timeLeft = TURN_SECONDS;
    s.hint = `轮到 ${ctx.name(this.current)}：说出一个含「${s.prompt}」的词`;
    this.pushState(ctx);
    this.countdown(ctx);
  }

  private countdown(ctx: GameContext): void {
    this.timer.set(1000, () => {
      if (ctx.hostLeft) return;
      const s = this.s;
      if (s.phase !== 'playing') return;
      s.timeLeft = Math.max(0, s.timeLeft - 1);
      if (s.timeLeft === 0) {
        this.penalty(ctx, '⏰ 超时');
        return;
      }
      this.pushState(ctx);
      this.countdown(ctx);
    });
  }

  private tryWord(ctx: GameContext, senderId: PlayerId, raw: unknown): void {
    const s = this.s;
    const word = normalizeText(raw, 8);
    if (word.length < 2) {
      ctx.sendTo(senderId, { type: 'system', text: '至少要说两个字。' });
      return;
    }
    if (!WORD_RE.test(word)) {
      ctx.sendTo(senderId, { type: 'system', text: '只能说纯中文词语。' });
      return;
    }
    if (!word.includes(s.prompt)) {
      ctx.sendTo(senderId, { type: 'system', text: `这个词里没有「${s.prompt}」。` });
      return;
    }
    if (s.used.includes(word)) {
      ctx.sendTo(senderId, { type: 'system', text: '这个词已经用过了。' });
      return;
    }
    s.used.push(word);
    s.lastPlayer = senderId;
    s.lastWord = word;
    this.advance(ctx);
  }

  private penalty(ctx: GameContext, reason: string): void {
    const s = this.s;
    const player = this.current;
    s.lives[player] = Math.max(0, (s.lives[player] ?? 0) - 1);
    ctx.broadcast({
      type: 'system',
      text: `${reason}，${ctx.name(player)} 扣一条命（剩 ${s.lives[player]}）。`,
    });
    this.advance(ctx);
  }

  private advance(ctx: GameContext): void {
    const s = this.s;
    if (s.lives[this.current] === 0) {
      ctx.broadcast({ type: 'system', text: `💥 ${ctx.name(this.current)} 被淘汰！` });
    }
    const alive = s.order.filter((id) => (s.lives[id] ?? 0) > 0);
    if (alive.length <= 1) {
      this.finish(ctx, alive[0]);
      return;
    }
    let next = (s.currentIndex + 1) % s.order.length;
    while ((s.lives[s.order[next]!] ?? 0) === 0) {
      next = (next + 1) % s.order.length;
    }
    s.currentIndex = next;
    this.nextTurn(ctx);
  }

  private finish(ctx: GameContext, winner?: PlayerId): void {
    this.timer.clear();
    const s = this.s;
    s.phase = 'gameover';
    s.winner = winner;
    s.hint = `🏆 最后幸存者：${winner ? ctx.name(winner) : '无人'}`;
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: s.hint });
  }

  private pushState(ctx: GameContext): void {
    ctx.broadcast({ type: 'game-state', state: this.getState() });
  }
}
