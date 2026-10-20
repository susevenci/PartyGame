import { pickCard } from '@party-games/shared';
import type { PlayerId, TruthDareState } from '@party-games/shared';
import type { Game, GameContext } from './types.ts';
import { Timer } from './util.ts';

const ACT_MS = 60000;  // 表演/回答时间
const RESULT_MS = 8000; // 结果展示时间

interface TData {
  order: PlayerId[];
  round: number; // 已完成圈数
  turn: number; // 圈内下标 0-based
  current: PlayerId;
  phase: TruthDareState['phase'];
  reports: { name: string; text: string }[];
  history: { name: string; card: string; result: string }[];
  cardText: string;
  cardKind: 'truth' | 'dare';
}

/**
 * 真心话大冒险：
 * 按顺序轮流，抽到一张随机卡（真心话/大冒险各半概率），
 * 完成后自报结果，全场围观。一圈轮完自动开始下一圈，
 * 房主可随时结束整局（由 Room 处理 finish-game）。
 */
export class TruthDareGame implements Game {
  readonly id = 'truth-dare' as const;
  private s!: TData;
  private timer = new Timer();

  start(ctx: GameContext): void {
    const ids = ctx.players.map((p) => p.id);
    this.s = {
      order: [...ids],
      round: 0,
      turn: 0,
      current: ids[0]!,
      phase: 'picking',
      reports: [],
      history: [],
      cardText: '',
      cardKind: 'truth',
    };
    this.dealCard(ctx);
    this.pushState(ctx);
  }

  onMessage(ctx: GameContext, msg: import('@party-games/shared').ClientMessage, senderId: PlayerId): void {
    const s = this.s;
    if (msg.type === 'report-result') {
      // 允许当前玩家自报，或房主代填
      const isActor = senderId === s.current;
      const isHost = senderId === ctx.hostId;
      if (!isActor && !isHost) return;
      const text = String(msg.value).trim();
      if (!text || text.length > 50) return;
      if (s.phase === 'acting' || s.phase === 'reporting') {
        s.reports.push({ name: isActor ? ctx.name(senderId) : `${ctx.name(senderId)} 代 ${ctx.name(s.current)}`, text });
        s.history.push({ name: ctx.name(s.current), card: s.cardText, result: text });
        s.phase = 'round-result';
        this.pushState(ctx);
        this.later(ctx, RESULT_MS, () => this.nextTurn(ctx));
      }
    }
    if (msg.type === 'end-turn' && (senderId === s.current || senderId === ctx.hostId)) {
      if (s.phase === 'acting') {
        // 没自报结果就先记为“待补充”
        s.reports.push({ name: ctx.name(s.current), text: '（未填写结果）' });
        s.history.push({ name: ctx.name(s.current), card: s.cardText, result: '（未填写结果）' });
        s.phase = 'round-result';
        this.pushState(ctx);
        this.later(ctx, RESULT_MS, () => this.nextTurn(ctx));
      }
    }
  }

  getState(): TruthDareState {
    const s = this.s;
    return {
      game: 'truth-dare',
      round: s.round + 1,
      turn: s.turn + 1,
      current: s.current,
      phase: s.phase,
      reports: s.reports,
      history: s.history,
    };
  }

  private dealCard(ctx: GameContext): void {
    const s = this.s;
    const card = pickCard(Math.random() < 0.5 ? 'truth' : 'dare');
    s.cardKind = card.kind;
    s.cardText = card.text;
    const prefix = card.kind === 'truth' ? '【真心话】' : '【大冒险】';
    ctx.broadcast({
      type: 'card',
      kind: card.kind,
      text: `${prefix}${card.text}`,
    });
    s.phase = 'acting';
    ctx.broadcast({
      type: 'system',
      text: `🎲 轮到 ${ctx.name(s.current)}！抽到了一张${card.kind === 'truth' ? '真心话' : '大冒险'}卡。`,
    });
    this.later(ctx, ACT_MS, () => {
      if (this.s.phase === 'acting') {
        this.s.reports.push({ name: ctx.name(this.s.current), text: '（超时，未填写结果）' });
        this.s.history.push({ name: ctx.name(this.s.current), card: this.s.cardText, result: '（超时，未填写结果）' });
        this.s.phase = 'round-result';
        this.pushState(ctx);
        this.later(ctx, RESULT_MS, () => this.nextTurn(ctx));
      }
    });
  }

  private nextTurn(ctx: GameContext): void {
    const s = this.s;
    s.reports = [];
    s.turn += 1;
    if (s.turn >= s.order.length) {
      s.turn = 0;
      s.round += 1;
      ctx.broadcast({ type: 'system', text: `🔄 第 ${s.round + 1} 圈开始！` });
    }
    s.current = s.order[s.turn]!;
    s.phase = 'picking';
    this.pushState(ctx);
    this.later(ctx, 2000, () => this.dealCard(ctx));
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
