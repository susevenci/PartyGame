import { pickDrawingWord } from '@party-games/shared';
import type {
  DrawOp,
  DrawingState,
  PlayerId,
} from '@party-games/shared';
import type { Game, GameContext } from './types.ts';
import { Timer } from './util.ts';

const GUESS_MS = 45000; // 每轮作画 + 猜测时间
const REVEAL_MS = 6000; // 揭示答案时间

interface DData {
  order: PlayerId[]; // 作画顺序
  round: number; // 0-based
  totalRounds: number;
  drawer: PlayerId;
  word: string;
  passed: PlayerId[];
  scores: Record<PlayerId, number>;
  totalScores: Record<PlayerId, number>;
  correct: PlayerId[]; // 本轮已猜中（有序，第一个 2 分其余 1 分）
  phase: DrawingState['phase'];
  finished: boolean;
}

/**
 * 你画我猜：
 * 按顺序每人画一轮，画家看得到自己的词，其他人输入文字猜测。
 * 第一个猜中得 2 分，其后每多一个猜中得 1 分。
 */
export class DrawingGame implements Game {
  readonly id = 'drawing' as const;
  private s!: DData;
  private timer = new Timer();

  start(ctx: GameContext): void {
    const ids = ctx.players.map((p) => p.id);
    this.s = {
      order: [...ids],
      round: 0,
      totalRounds: ids.length,
      drawer: ids[0]!,
      word: '',
      passed: [],
      scores: {},
      totalScores: Object.fromEntries(ids.map((i) => [i, 0])),
      correct: [],
      phase: 'draw',
      finished: false,
    };
    this.newRound(ctx);
  }

  onMessage(ctx: GameContext, msg: import('@party-games/shared').ClientMessage, senderId: PlayerId): void {
    const s = this.s;
    if (s.phase === 'reveal') return;

    if (senderId === s.drawer) {
      // 画家：作画 / 换题
      if (msg.type === 'draw') {
        ctx.broadcast({ type: 'draw', op: msg.op as DrawOp });
        return;
      }
      if (msg.type === 'pass') {
        s.passed.push(senderId);
        this.newRoundWord(ctx);
        ctx.broadcast({ type: 'canvas-clear' });
        ctx.broadcast({ type: 'system', text: '画家换了一个新词，请重新猜！' });
        return;
      }
      return;
    }

    // 猜词者
    if (msg.type === 'answer') {
      this.handleGuess(ctx, senderId, String(msg.value).trim());
    }
  }

  private handleGuess(ctx: GameContext, pid: PlayerId, raw: string): void {
    const s = this.s;
    const guess = raw;
    if (!guess) return;
    if (s.correct.includes(pid)) return;
    // 宽松匹配：去掉空格、大小写，包含关系即可
    const norm = (x: string) => x.replace(/\s+/g, '').toLowerCase();
    const g = norm(guess);
    const w = norm(s.word);
    const hit = g.length > 0 && (g === w || w.includes(g) || g.includes(w));
    if (!hit) return;
    s.correct.push(pid);
    const score = s.correct.length === 1 ? 2 : 1;
    s.scores[pid] = score;
    ctx.broadcast({ type: 'system', text: `✅ ${ctx.name(pid)} 猜中了！` });
    this.pushState(ctx);
    if (s.correct.length >= s.order.length - 1) {
      this.reveal(ctx);
    }
  }

  private newRound(ctx: GameContext): void {
    const s = this.s;
    if (s.round >= s.totalRounds) {
      return this.endGame(ctx);
    }
    s.drawer = s.order[s.round]!;
    s.passed = [];
    s.scores = {};
    s.correct = [];
    s.phase = 'draw';
    this.newRoundWord(ctx);
    this.pushState(ctx);
    ctx.broadcast({ type: 'canvas-clear' });
    ctx.broadcast({ type: 'system', text: `🎨 轮到 ${ctx.name(s.drawer)} 作画，其他人请猜词！` });
    this.later(ctx, GUESS_MS, () => this.reveal(ctx));
  }

  private newRoundWord(ctx: GameContext): void {
    const s = this.s;
    s.word = pickDrawingWord();
    ctx.sendTo(s.drawer, { type: 'game-private', data: { game: 'drawing', word: s.word } });
  }

  private reveal(ctx: GameContext): void {
    const s = this.s;
    if (s.phase === 'reveal') return;
    this.timer.clear();
    s.phase = 'reveal';
    // 结算
    for (const [pid, sc] of Object.entries(s.scores)) {
      s.totalScores[pid] = (s.totalScores[pid] ?? 0) + (sc ?? 0);
    }
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: `⏰ 时间到！答案是「${s.word}」。` });
    this.later(ctx, REVEAL_MS, () => {
      s.round += 1;
      this.newRound(ctx);
    });
  }

  private endGame(ctx: GameContext): void {
    const s = this.s;
    if (s.finished) return;
    s.finished = true;
    s.phase = 'reveal';
    const ranked = Object.entries(s.totalScores).sort((a, b) => b[1] - a[1]);
    const top = ranked[0]![0];
    this.pushState(ctx);
    ctx.broadcast({
      type: 'system',
      text: `🏆 本局结束！最高分：${ctx.name(top)}（${s.totalScores[top] ?? 0} 分）。`,
    });
  }

  getState(): DrawingState {
    const s = this.s;
    return {
      game: 'drawing',
      phase: s.phase,
      round: s.round + 1,
      totalRounds: s.totalRounds,
      drawer: s.drawer,
      passed: [...s.passed],
      word: s.phase === 'reveal' ? s.word : undefined,
      scores: s.scores,
      totalScores: s.totalScores,
    };
  }

  private pushState(ctx: GameContext): void {
    ctx.broadcast({ type: 'game-state', state: this.getState() });
  }

  private later(ctx: GameContext, ms: number, fn: () => void): void {
    this.timer.set(ms, () => {
      if (ctx.hostLeft) return;
      fn();
    });
  }

  destroy(): void {
    this.timer.clear();
  }
}
