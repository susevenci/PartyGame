import { pickWordPair } from '@party-games/shared';
import type { PlayerId, WerewolfRole, WerewolfState } from '@party-games/shared';
import type { Game, GameContext } from './types.ts';

const NIGHT_MS = 8000;
const DAY_MS = 30000; // 描述阶段（口头进行，屏幕提示）
const VOTE_MS = 25000;
const REVEAL_MS = 5000;

interface WData {
  roles: Record<PlayerId, WerewolfRole>;
  words: Record<PlayerId, string>;
  spyId: PlayerId;
  alive: PlayerId[];
  phase: WerewolfState['phase'];
  round: number;
  hint: string;
  lastDeaths?: PlayerId[];
  votes: Record<PlayerId, PlayerId>;
  votedOut?: PlayerId | null;
  winner?: WerewolfState['winner'];
  winReason?: string;
  lastWord: string;
  timer: NodeJS.Timeout | null;
}

/**
 * 谁是卧底（2 阵营简化版）：
 * 1 名卧底拿到相近词，其余平民拿大众词。
 * 每轮：夜晚狼人随机击杀一名平民 → 白天全员描述词 → 投票放逐。
 * 投出卧底 = 平民胜；卧底存活到平民 ≤ 2 人 = 卧底胜。
 */
export class WerewolfGame implements Game {
  readonly id = 'werewolf' as const;
  private s!: WData;

  start(ctx: GameContext): void {
    const ids = ctx.players.map((p) => p.id);
    const spyId = ids[Math.floor(Math.random() * ids.length)]!;
    const pair = pickWordPair();
    const roles: Record<PlayerId, WerewolfRole> = {};
    const words: Record<PlayerId, string> = {};
    for (const id of ids) {
      roles[id] = id === spyId ? 'werewolf' : 'villager';
      words[id] = id === spyId ? pair.spy : pair.common;
    }
    this.s = {
      roles, words, spyId,
      alive: [...ids],
      phase: 'night', round: 1,
      hint: '天黑了，狼人请睁眼……',
      votes: {}, lastWord: pair.common, timer: null,
    };
    this.pushState(ctx);
    for (const id of ids) {
      ctx.sendTo(id, {
        type: 'game-private',
        data: { game: 'werewolf', role: roles[id]!, word: words[id]! },
      });
    }
    ctx.broadcast({ type: 'system', text: '词卡已发放，请查看自己头上的词牌。' });
    this.later(ctx, NIGHT_MS, () => this.nightKill(ctx));
  }

  onMessage(ctx: GameContext, msg: import('@party-games/shared').ClientMessage, senderId: PlayerId): void {
    if (this.s.phase !== 'vote' || msg.type !== 'vote') return;
    if (!this.s.alive.includes(senderId)) return;
    const target = msg.target;
    if (!this.s.alive.includes(target) || target === senderId) return;
    if (this.s.votes[senderId]) return;
    this.s.votes[senderId] = target;
    this.pushState(ctx);
    if (Object.keys(this.s.votes).length >= this.s.alive.length) {
      this.resolveVote(ctx);
    }
  }

  getState(): WerewolfState {
    return this.stateOf(this.s);
  }

  private nightKill(ctx: GameContext): void {
    const victims = this.s.alive.filter((a) => this.s.roles[a] === 'villager');
    if (victims.length === 0) return this.end(ctx, 'werewolf', '卧底独活到最后一夜！');
    const victim = victims[Math.floor(Math.random() * victims.length)]!;
    this.s.alive = this.s.alive.filter((a) => a !== victim);
    this.s.lastDeaths = [victim];
    this.toDay(ctx);
    ctx.broadcast({ type: 'system', text: `☀️ 天亮了。昨晚 ${ctx.name(victim)} 被狼人击杀。` });
  }

  private toDay(ctx: GameContext): void {
    this.s.phase = 'day';
    this.s.hint = `第 ${this.s.round} 天：请依次用一句话描述自己的词（不能说词本身）。`;
    this.pushState(ctx);
    this.later(ctx, DAY_MS, () => this.openVote(ctx));
  }

  private openVote(ctx: GameContext): void {
    if (this.s.phase !== 'day') return;
    this.s.phase = 'vote';
    this.s.votes = {};
    this.s.hint = '🗳️ 描述结束，开始投票：你认为谁是卧底？';
    this.pushState(ctx);
    this.later(ctx, VOTE_MS, () => {
      if (this.s.phase === 'vote') this.resolveVote(ctx);
    });
  }

  private resolveVote(ctx: GameContext): void {
    const counts: Record<string, number> = {};
    for (const t of Object.values(this.s.votes)) counts[t] = (counts[t] ?? 0) + 1;
    let top: PlayerId | null = null;
    let max = 0;
    let tie = false;
    for (const [pid, n] of Object.entries(counts)) {
      if (n > max) { top = pid; max = n; tie = false; }
      else if (n === max) tie = true;
    }
    const out = tie ? null : top;
    this.s.votedOut = out;
    this.s.phase = 'reveal';
    this.s.hint = out ? `🗳️ ${ctx.name(out)} 被放逐……` : '🗳️ 平票，无人出局。';
    this.pushState(ctx);
    this.later(ctx, REVEAL_MS, () => {
      if (out) {
        if (this.s.roles[out] === 'werewolf') {
          return this.end(ctx, 'villager', `${ctx.name(out)} 是卧底，被成功放逐！`);
        }
        ctx.broadcast({ type: 'system', text: `${ctx.name(out)} 是平民……卧底还藏在中间！` });
        this.s.alive = this.s.alive.filter((a) => a !== out);
        if (this.s.alive.filter((a) => this.s.roles[a] === 'villager').length <= 2) {
          return this.end(ctx, 'werewolf', '平民被逐一放逐，卧底活到了最后！');
        }
      } else {
        ctx.broadcast({ type: 'system', text: '平票之夜重新降临。' });
      }
      this.s.round += 1;
      this.s.phase = 'night';
      this.s.lastDeaths = undefined;
      this.s.hint = '天黑了，狼人请睁眼……';
      this.pushState(ctx);
      this.later(ctx, NIGHT_MS, () => this.nightKill(ctx));
    });
  }

  private end(ctx: GameContext, winner: 'werewolf' | 'villager', reason: string): void {
    if (this.s.phase === 'gameover') return;
    this.s.phase = 'gameover';
    this.s.winner = winner;
    this.s.winReason = reason;
    this.s.hint = `${winner === 'werewolf' ? '🕵️ 卧底胜利' : '🎉 平民胜利'}：${reason}`;
    this.pushState(ctx);
  }

  private stateOf(s: WData): WerewolfState {
    return {
      game: 'werewolf',
      phase: s.phase,
      round: s.round,
      alive: [...s.alive],
      hint: s.hint,
      lastDeaths: s.lastDeaths,
      voteCount: s.phase === 'vote' ? Object.keys(s.votes).length : undefined,
      votedOut: s.votedOut,
      winner: s.winner,
      winReason: s.winReason,
    };
  }

  private pushState(ctx: GameContext): void {
    ctx.broadcast({ type: 'game-state', state: this.stateOf(this.s) });
  }

  private later(ctx: GameContext, ms: number, fn: () => void): void {
    this.clearTimer();
    this.s.timer = setTimeout(() => {
      this.s.timer = null;
      if (ctx.hostLeft) return;
      fn();
    }, ms);
  }

  private clearTimer(): void {
    if (this.s?.timer) {
      clearTimeout(this.s.timer);
      this.s.timer = null;
    }
  }

  destroy(): void {
    this.clearTimer();
  }
}
