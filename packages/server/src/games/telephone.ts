import type {
  ClientMessage,
  DrawOp,
  PlayerId,
  TelephonePrivate,
  TelephoneState,
  TelephoneStep,
} from '@party-games/shared';
import type { Game, GameContext } from './types.ts';
import { normalizeText, sanitizeDrawOp, Timer } from './util.ts';

const MAX_OPS = 40;
const MAX_POINTS = 1500;
const SECONDS: Record<'write' | 'draw' | 'guess', number> = { write: 60, draw: 75, guess: 45 };

interface Chain {
  author: PlayerId;
  steps: TelephoneStep[];
}

interface TData {
  order: PlayerId[];
  chains: Chain[];
  step: number;
  totalSteps: number;
  phase: TelephoneState['phase'];
  timeLeft: number;
  submitted: Set<PlayerId>;
  hint: string;
}

/**
 * 传话画图：写 → 画 → 猜 → 画……每条链路依次传递，
 * 全部传完后公开展示，看原句被传成了什么。
 */
export class TelephoneGame implements Game {
  readonly id = 'telephone' as const;
  private s!: TData;
  private timer = new Timer();

  start(ctx: GameContext): void {
    const ids = ctx.players.map((p) => p.id);
    this.s = {
      order: ids,
      chains: ids.map((author) => ({ author, steps: [] })),
      step: 0,
      totalSteps: ids.length,
      phase: 'write',
      timeLeft: SECONDS.write,
      submitted: new Set(),
      hint: '',
    };
    ctx.broadcast({ type: 'system', text: '📞 传话开始：先写一句话，之后交给别人画。' });
    this.startStep(ctx);
  }

  onMessage(ctx: GameContext, msg: ClientMessage, senderId: PlayerId): void {
    const s = this.s;
    if (s.phase === 'reveal') return;
    const kind = this.kindOf(s.step);
    if (kind === 'draw') {
      if (msg.type === 'submit-drawing') this.submitDrawing(ctx, senderId, msg.ops);
      return;
    }
    if (msg.type === 'submit') this.submitText(ctx, senderId, msg.value);
  }

  getState(): TelephoneState {
    const s = this.s;
    return {
      game: 'telephone',
      phase: s.phase,
      step: Math.min(s.step + 1, s.totalSteps),
      totalSteps: s.totalSteps,
      timeLeft: s.timeLeft,
      submitted: s.submitted.size,
      chains:
        s.phase === 'reveal'
          ? s.chains.map((chain) => ({ author: chain.author, steps: chain.steps }))
          : undefined,
      hint: s.hint,
    };
  }

  destroy(): void {
    this.timer.clear();
  }

  private kindOf(step: number): 'write' | 'draw' | 'guess' {
    if (step === 0) return 'write';
    return step % 2 === 1 ? 'draw' : 'guess';
  }

  private chainIndex(playerIndex: number): number {
    const n = this.s.order.length;
    return (playerIndex - this.s.step + n) % n;
  }

  private startStep(ctx: GameContext): void {
    this.timer.clear();
    const s = this.s;
    const kind = this.kindOf(s.step);
    s.phase = kind;
    s.submitted = new Set();
    s.timeLeft = SECONDS[kind];
    s.hint =
      kind === 'write'
        ? '写一句容易画的话（10~30 字）。'
        : kind === 'draw'
          ? '把上一句话画出来，尽量好认。'
          : '猜猜上一幅画画的是什么。';

    for (let i = 0; i < s.order.length; i++) {
      const chain = s.chains[this.chainIndex(i)]!;
      const prev = chain.steps[chain.steps.length - 1];
      const data: TelephonePrivate = { game: 'telephone', step: s.step, kind };
      if (kind === 'draw' && prev?.kind === 'text') data.prompt = prev.value;
      if (kind === 'guess' && prev?.kind === 'draw') data.ops = prev.ops;
      ctx.sendTo(s.order[i]!, { type: 'game-private', data });
    }
    this.pushState(ctx);
    this.countdown(ctx);
  }

  private countdown(ctx: GameContext): void {
    this.timer.set(1000, () => {
      if (ctx.hostLeft) return;
      const s = this.s;
      if (s.phase === 'reveal') return;
      s.timeLeft = Math.max(0, s.timeLeft - 1);
      if (s.timeLeft === 0) {
        this.finishStep(ctx);
        return;
      }
      if (s.timeLeft % 5 === 0 || s.timeLeft <= 10) this.pushState(ctx);
      this.countdown(ctx);
    });
  }

  private submitText(ctx: GameContext, senderId: PlayerId, raw: unknown): void {
    const s = this.s;
    if (s.submitted.has(senderId)) return;
    const known = this.knownChain(senderId);
    if (!known) return;
    const value = normalizeText(raw, s.phase === 'write' ? 40 : 20);
    if (!value) return;
    known.steps.push({ kind: 'text', value });
    s.submitted.add(senderId);
    this.pushState(ctx);
    if (s.submitted.size >= s.order.length) this.finishStep(ctx);
  }

  private submitDrawing(ctx: GameContext, senderId: PlayerId, raw: unknown): void {
    const s = this.s;
    if (s.submitted.has(senderId)) return;
    const known = this.knownChain(senderId);
    if (!known) return;
    if (!Array.isArray(raw)) return;
    const ops: DrawOp[] = [];
    let points = 0;
    for (const item of raw.slice(0, MAX_OPS)) {
      const op = sanitizeDrawOp(item);
      if (!op) continue;
      points += op.points.length;
      if (points > MAX_POINTS) break;
      ops.push(op);
    }
    if (ops.length === 0) return;
    known.steps.push({ kind: 'draw', ops });
    s.submitted.add(senderId);
    this.pushState(ctx);
    if (s.submitted.size >= s.order.length) this.finishStep(ctx);
  }

  private knownChain(senderId: PlayerId): Chain | null {
    const index = this.s.order.indexOf(senderId);
    if (index < 0) return null;
    return this.s.chains[this.chainIndex(index)] ?? null;
  }

  private finishStep(ctx: GameContext): void {
    this.timer.clear();
    const s = this.s;
    const kind = this.kindOf(s.step);

    for (let i = 0; i < s.order.length; i++) {
      const player = s.order[i]!;
      if (s.submitted.has(player)) continue;
      const chain = s.chains[this.chainIndex(i)]!;
      if (kind === 'draw') chain.steps.push({ kind: 'draw', ops: [] });
      else chain.steps.push({ kind: 'text', value: '（超时）' });
    }

    s.step += 1;
    if (s.step >= s.totalSteps) {
      s.phase = 'reveal';
      s.hint = '📞 全部传完！看看每条链路被传成了什么。';
      this.pushState(ctx);
      ctx.broadcast({ type: 'system', text: s.hint });
      return;
    }
    this.startStep(ctx);
  }

  private pushState(ctx: GameContext): void {
    ctx.broadcast({ type: 'game-state', state: this.getState() });
  }
}
