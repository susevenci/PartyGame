import { pickWavelengthPrompt } from '@party-games/shared';
import type {
  ClientMessage,
  PlayerId,
  WavelengthPrivate,
  WavelengthState,
} from '@party-games/shared';
import type { Game, GameContext } from './types.ts';
import { normalizeText, Timer } from './util.ts';

const CLUE_MS = 45_000;
const GUESS_MS = 60_000;
const REVEAL_MS = 8_000;

interface WData {
  order: PlayerId[];
  round: number; // 0-based
  totalRounds: number;
  spectrum: { left: string; right: string };
  target: number;
  clue?: string;
  guesses: Record<PlayerId, number>;
  results?: { name: string; value: number; distance: number; score: number }[];
  phase: WavelengthState['phase'];
  scores: Record<PlayerId, number>;
  hint: string;
}

/**
 * 波长：每轮一名主持人看到 0~100 的隐藏目标，用一句话给线索，
 * 其他人在光谱上猜位置；越接近得分越高。
 */
export class WavelengthGame implements Game {
  readonly id = 'wavelength' as const;
  private s!: WData;
  private timer = new Timer();

  start(ctx: GameContext): void {
    const ids = ctx.players.map((p) => p.id);
    this.s = {
      order: ids,
      round: 0,
      totalRounds: ids.length,
      spectrum: { left: '', right: '' },
      target: 50,
      guesses: {},
      phase: 'clue',
      scores: Object.fromEntries(ids.map((id) => [id, 0])),
      hint: '',
    };
    this.beginRound(ctx);
  }

  onMessage(ctx: GameContext, msg: ClientMessage, senderId: PlayerId): void {
    const s = this.s;
    if (s.phase === 'clue' && msg.type === 'submit' && senderId === this.psychic) {
      const clue = normalizeText(msg.value, 20);
      if (!clue) return;
      s.clue = clue;
      this.openGuess(ctx);
      return;
    }
    if (s.phase === 'guess' && msg.type === 'submit' && senderId !== this.psychic) {
      const value = Number.parseInt(normalizeText(msg.value, 4), 10);
      if (!Number.isFinite(value)) return;
      if (this.psychic === senderId || s.guesses[senderId] !== undefined) return;
      s.guesses[senderId] = Math.min(100, Math.max(0, value));
      this.pushState(ctx);
      if (Object.keys(s.guesses).length >= s.order.length - 1) this.reveal(ctx);
    }
  }

  getState(): WavelengthState {
    const s = this.s;
    const revealed = s.phase === 'reveal' || s.phase === 'gameover';
    return {
      game: 'wavelength',
      phase: s.phase,
      round: Math.min(s.round + 1, s.totalRounds),
      totalRounds: s.totalRounds,
      psychic: this.psychic,
      spectrum: s.spectrum,
      clue: s.clue,
      guessCount: s.phase === 'guess' ? Object.keys(s.guesses).length : undefined,
      results: revealed ? s.results : undefined,
      target: revealed ? s.target : undefined,
      scores: s.scores,
      hint: s.hint,
    };
  }

  destroy(): void {
    this.timer.clear();
  }

  private get psychic(): PlayerId {
    return this.s.order[this.s.round % this.s.order.length]!;
  }

  private beginRound(ctx: GameContext): void {
    const s = this.s;
    s.spectrum = pickWavelengthPrompt();
    s.target = 5 + Math.floor(Math.random() * 91); // 5~95，避免贴边
    s.clue = undefined;
    s.guesses = {};
    s.results = undefined;
    s.phase = 'clue';
    s.hint = `${ctx.name(this.psychic)} 是主持人，看到目标后给一句话线索。`;

    for (const id of s.order) {
      const data: WavelengthPrivate =
        id === this.psychic
          ? { game: 'wavelength', role: 'psychic', target: s.target }
          : { game: 'wavelength', role: 'guesser' };
      ctx.sendTo(id, { type: 'game-private', data });
    }
    this.pushState(ctx);
    this.timer.set(CLUE_MS, () => {
      if (ctx.hostLeft) return;
      if (!this.s.clue) {
        this.s.clue = '（主持人没有给线索）';
        this.openGuess(ctx);
      }
    });
  }

  private openGuess(ctx: GameContext): void {
    this.timer.clear();
    const s = this.s;
    s.phase = 'guess';
    s.hint = `线索：「${s.clue}」——你觉得在光谱的哪个位置？`;
    this.pushState(ctx);
    this.timer.set(GUESS_MS, () => {
      if (!ctx.hostLeft) this.reveal(ctx);
    });
  }

  private reveal(ctx: GameContext): void {
    this.timer.clear();
    const s = this.s;
    if (s.phase === 'reveal') return;
    s.phase = 'reveal';
    s.results = [];
    let best = Number.POSITIVE_INFINITY;

    for (const id of s.order) {
      if (id === this.psychic) continue;
      const value = s.guesses[id];
      if (value === undefined) continue; // 未提交不计分，也不参与「最接近」
      const distance = Math.abs(value - s.target);
      best = Math.min(best, distance);
      const score = distance <= 5 ? 3 : distance <= 15 ? 2 : distance <= 25 ? 1 : 0;
      s.scores[id] = (s.scores[id] ?? 0) + score;
      s.results.push({ name: ctx.name(id), value, distance, score });
    }
    if (best <= 10) s.scores[this.psychic] = (s.scores[this.psychic] ?? 0) + 2;
    s.results.sort((a, b) => a.distance - b.distance);
    const closest = s.results[0];
    s.hint = closest
      ? `🎯 目标位置是 ${s.target}，最接近的是 ${closest.name}（差 ${best}）。`
      : `🎯 目标位置是 ${s.target}，没有人提交猜测。`;
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: s.hint });
    this.timer.set(REVEAL_MS, () => {
      if (!ctx.hostLeft) this.nextRound(ctx);
    });
  }

  private nextRound(ctx: GameContext): void {
    const s = this.s;
    s.round += 1;
    if (s.round >= s.totalRounds) {
      const top = Object.entries(s.scores).sort((a, b) => b[1] - a[1])[0];
      s.phase = 'gameover';
      s.hint = `🏆 全部结束！最高分：${top ? `${ctx.name(top[0])}（${top[1]} 分）` : '无'}`;
      this.pushState(ctx);
      ctx.broadcast({ type: 'system', text: s.hint });
      return;
    }
    this.beginRound(ctx);
  }

  private pushState(ctx: GameContext): void {
    ctx.broadcast({ type: 'game-state', state: this.getState() });
  }
}
