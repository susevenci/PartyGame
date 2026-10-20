import { pickSpyfallLocation, SPYFALL_LOCATIONS } from '@party-games/shared';
import type { ClientMessage, PlayerId, SpyfallPrivate, SpyfallState } from '@party-games/shared';
import type { Game, GameContext } from './types.ts';
import { Timer } from './util.ts';

const DISCUSS_SECONDS = 480; // 8 分钟讨论
const REVEAL_MS = 8_000;

interface SData {
  order: PlayerId[];
  spyId: PlayerId;
  location: string;
  votes: Record<PlayerId, PlayerId>;
  timeLeft: number;
  phase: SpyfallState['phase'];
  accused?: PlayerId | null;
  winner?: 'spy' | 'agents';
  hint: string;
}

/**
 * 间谍游戏：所有人拿到同一个地点，只有间谍不知道。
 * 讨论阶段互相提问试探，所有人投票后揭晓；超时未指认则间谍获胜。
 */
export class SpyfallGame implements Game {
  readonly id = 'spyfall' as const;
  private s!: SData;
  private timer = new Timer();

  start(ctx: GameContext): void {
    const ids = ctx.players.map((p) => p.id);
    const spyId = ids[Math.floor(Math.random() * ids.length)]!;
    const location = pickSpyfallLocation();
    this.s = {
      order: ids,
      spyId,
      location,
      votes: {},
      timeLeft: DISCUSS_SECONDS,
      phase: 'discuss',
      hint: '轮流提问试探：谁的回答不像知道地点？',
    };

    for (const id of ids) {
      const data: SpyfallPrivate =
        id === spyId
          ? { game: 'spyfall', isSpy: true, locations: SPYFALL_LOCATIONS }
          : { game: 'spyfall', isSpy: false, location, locations: SPYFALL_LOCATIONS };
      ctx.sendTo(id, { type: 'game-private', data });
    }
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: '🕶️ 地点已发放：只有间谍不知道这里是哪。' });
    this.countdown(ctx);
  }

  onMessage(ctx: GameContext, msg: ClientMessage, senderId: PlayerId): void {
    const s = this.s;
    if (s.phase !== 'discuss' || msg.type !== 'vote') return;
    if (!s.order.includes(senderId) || !s.order.includes(msg.target) || senderId === msg.target) return;
    if (s.votes[senderId]) return;
    s.votes[senderId] = msg.target;
    this.pushState(ctx);
    if (Object.keys(s.votes).length >= s.order.length) this.resolve(ctx);
  }

  getState(): SpyfallState {
    const s = this.s;
    const revealed = s.phase === 'reveal' || s.phase === 'gameover';
    return {
      game: 'spyfall',
      phase: s.phase,
      timeLeft: s.timeLeft,
      voteCount: Object.keys(s.votes).length,
      accused: revealed ? s.accused : undefined,
      spyId: revealed ? s.spyId : undefined,
      location: revealed ? s.location : undefined,
      winner: s.winner,
      hint: s.hint,
    };
  }

  destroy(): void {
    this.timer.clear();
  }

  private countdown(ctx: GameContext): void {
    this.timer.set(1000, () => {
      if (ctx.hostLeft) return;
      const s = this.s;
      if (s.phase !== 'discuss') return;
      s.timeLeft = Math.max(0, s.timeLeft - 1);
      if (s.timeLeft === 0) {
        this.finish(ctx, 'spy', '时间到，没有人成功指认间谍，间谍获胜！');
        return;
      }
      if (s.timeLeft % 5 === 0 || s.timeLeft <= 10) this.pushState(ctx);
      this.countdown(ctx);
    });
  }

  private resolve(ctx: GameContext): void {
    const s = this.s;
    const counts = new Map<PlayerId, number>();
    for (const target of Object.values(s.votes)) {
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
    let top: PlayerId | null = null;
    let max = 0;
    let tie = false;
    for (const [id, count] of counts) {
      if (count > max) {
        top = id;
        max = count;
        tie = false;
      } else if (count === max) {
        tie = true;
      }
    }
    s.accused = tie ? null : top;
    if (s.accused === s.spyId) {
      this.finish(ctx, 'agents', `🎯 指认成功：${ctx.name(s.spyId)} 就是间谍！`);
    } else {
      this.finish(
        ctx,
        'spy',
        s.accused ? `被指认的是 ${ctx.name(s.accused)}，真正的间谍是 ${ctx.name(s.spyId)}。` : '平票，没有人被指认，间谍获胜。',
      );
    }
  }

  private finish(ctx: GameContext, winner: 'spy' | 'agents', reason: string): void {
    this.timer.clear();
    const s = this.s;
    if (s.phase === 'gameover') return;
    s.phase = 'reveal';
    s.winner = winner;
    s.hint = `${winner === 'spy' ? '🕶️ 间谍胜利' : '🕵️ 平民胜利'}：${reason}`;
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: `地点是「${s.location}」。${s.hint}` });
    this.timer.set(REVEAL_MS, () => {
      if (ctx.hostLeft) return;
      this.s.phase = 'gameover';
      this.pushState(ctx);
    });
  }

  private pushState(ctx: GameContext): void {
    ctx.broadcast({ type: 'game-state', state: this.getState() });
  }
}
