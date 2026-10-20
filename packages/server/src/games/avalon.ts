import type {
  AvalonPrivate,
  AvalonQuestResult,
  AvalonRole,
  AvalonState,
  ClientMessage,
  PlayerId,
} from '@party-games/shared';
import type { Game, GameContext } from './types.ts';
import { shuffle, Timer } from './util.ts';

const PROPOSE_MS = 90_000;
const VOTE_MS = 60_000;
const QUEST_MS = 60_000;
const ASSASSIN_MS = 60_000;

const SETUPS: Record<number, { minions: number; loyal: number; quests: number[] }> = {
  5: { minions: 1, loyal: 2, quests: [2, 3, 2, 3, 3] },
  6: { minions: 1, loyal: 3, quests: [2, 3, 4, 3, 4] },
  7: { minions: 2, loyal: 3, quests: [2, 3, 3, 4, 4] },
  8: { minions: 2, loyal: 4, quests: [3, 4, 4, 5, 5] },
  9: { minions: 2, loyal: 5, quests: [3, 4, 4, 5, 5] },
  10: { minions: 3, loyal: 5, quests: [3, 4, 4, 5, 5] },
};

interface AData {
  order: PlayerId[];
  roles: Record<PlayerId, AvalonRole>;
  quests: number[];
  leaderIndex: number;
  round: number;
  teamSize: number;
  proposed: PlayerId[];
  votes: Record<PlayerId, boolean>;
  questVotes: Record<PlayerId, boolean>;
  rejectStreak: number;
  questResults: AvalonQuestResult[];
  phase: AvalonState['phase'];
  approveCount?: number;
  rejectCount?: number;
  assassinated?: PlayerId | null;
  winner?: 'good' | 'evil';
  winReason?: string;
  revealedRoles?: Record<PlayerId, AvalonRole>;
  hint: string;
}

/**
 * 阿瓦隆（简化版）：梅林 / 刺客 / 爪牙 / 忠臣。
 * 组队投票 → 任务投票 → 三次成功进入刺杀，三次失败坏人获胜。
 */
export class AvalonGame implements Game {
  readonly id = 'avalon' as const;
  private s!: AData;
  private timer = new Timer();

  start(ctx: GameContext): void {
    const ids = ctx.players.map((p) => p.id);
    const setup = SETUPS[ids.length] ?? SETUPS[5]!;
    const pool: AvalonRole[] = [
      'merlin',
      'assassin',
      ...Array<AvalonRole>(setup.minions).fill('minion'),
      ...Array<AvalonRole>(setup.loyal).fill('loyal'),
    ];
    shuffle(pool);
    const roles: Record<PlayerId, AvalonRole> = {};
    ids.forEach((id, index) => {
      roles[id] = pool[index]!;
    });
    const evilIds = ids.filter((id) => roles[id] !== 'merlin' && roles[id] !== 'loyal');

    this.s = {
      order: ids,
      roles,
      quests: setup.quests,
      leaderIndex: 0,
      round: 0,
      teamSize: setup.quests[0]!,
      proposed: [],
      votes: {},
      questVotes: {},
      rejectStreak: 0,
      questResults: [],
      phase: 'propose',
      hint: '',
    };

    for (const id of ids) {
      const role = roles[id]!;
      const data: AvalonPrivate = role === 'loyal' ? { game: 'avalon', role: 'loyal' } : { game: 'avalon', role, evilIds };
      ctx.sendTo(id, { type: 'game-private', data });
    }
    this.beginPropose(ctx, `第 1 轮任务：${ctx.name(ids[0]!)} 是队长`);
  }

  onMessage(ctx: GameContext, msg: ClientMessage, senderId: PlayerId): void {
    const s = this.s;
    if (s.phase === 'propose') {
      if (msg.type === 'toggle') this.toggleMember(ctx, senderId, msg.value);
      else if (msg.type === 'submit-team') this.submitTeam(ctx, senderId);
      return;
    }
    if (s.phase === 'vote' && msg.type === 'vote-team') {
      if (typeof msg.approve !== 'boolean') return;
      if (s.votes[senderId] !== undefined) return;
      s.votes[senderId] = Boolean(msg.approve);
      this.pushState(ctx);
      if (Object.keys(s.votes).length >= s.order.length) this.resolveVote(ctx);
      return;
    }
    if (s.phase === 'quest' && msg.type === 'quest-vote') {
      if (typeof msg.success !== 'boolean') return;
      if (!s.proposed.includes(senderId) || s.questVotes[senderId] !== undefined) return;
      s.questVotes[senderId] = Boolean(msg.success);
      this.pushState(ctx);
      if (Object.keys(s.questVotes).length >= s.proposed.length) this.resolveQuest(ctx);
      return;
    }
    if (s.phase === 'assassinate' && msg.type === 'assassinate') {
      this.assassinate(ctx, senderId, msg.target);
    }
  }

  getState(): AvalonState {
    const s = this.s;
    return {
      game: 'avalon',
      phase: s.phase,
      round: s.round + 1,
      leader: s.order[s.leaderIndex]!,
      teamSize: s.teamSize,
      proposedTeam: [...s.proposed],
      voteCount: s.phase === 'vote' ? Object.keys(s.votes).length : 0,
      approveCount: s.approveCount,
      rejectCount: s.rejectCount,
      rejectStreak: s.rejectStreak,
      questResults: s.questResults,
      failNeeded: s.round === 3 && s.order.length >= 7 ? 2 : 1,
      assassinated: s.assassinated,
      winner: s.winner,
      winReason: s.winReason,
      revealedRoles: s.phase === 'gameover' ? s.revealedRoles : undefined,
      hint: s.hint,
    };
  }

  destroy(): void {
    this.timer.clear();
  }

  private beginPropose(ctx: GameContext, reason: string): void {
    this.timer.clear();
    const s = this.s;
    s.phase = 'propose';
    s.proposed = [];
    s.votes = {};
    s.questVotes = {};
    s.approveCount = undefined;
    s.rejectCount = undefined;
    s.hint = `${reason}，请选出 ${s.teamSize} 人执行任务。`;
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: `⚔️ ${s.hint}` });
    this.timer.set(PROPOSE_MS, () => {
      if (ctx.hostLeft || this.s.phase !== 'propose') return;
      this.autoPropose(ctx);
    });
  }

  private autoPropose(ctx: GameContext): void {
    const s = this.s;
    s.proposed = shuffle([...s.order]).slice(0, s.teamSize);
    ctx.broadcast({ type: 'system', text: '⏰ 队长超时，系统随机组队。' });
    this.startVote(ctx);
  }

  private toggleMember(ctx: GameContext, senderId: PlayerId, target: PlayerId): void {
    const s = this.s;
    if (senderId !== s.order[s.leaderIndex]) return;
    if (!s.order.includes(target)) return;
    const index = s.proposed.indexOf(target);
    if (index >= 0) s.proposed.splice(index, 1);
    else if (s.proposed.length < s.teamSize) s.proposed.push(target);
    this.pushState(ctx);
  }

  private submitTeam(ctx: GameContext, senderId: PlayerId): void {
    const s = this.s;
    if (senderId !== s.order[s.leaderIndex]) return;
    if (s.proposed.length !== s.teamSize) {
      ctx.sendTo(senderId, { type: 'system', text: `需要正好 ${s.teamSize} 人。` });
      return;
    }
    this.startVote(ctx);
  }

  private startVote(ctx: GameContext): void {
    this.timer.clear();
    const s = this.s;
    s.phase = 'vote';
    s.votes = {};
    s.hint = '全员投票：同意这套阵容吗？';
    this.pushState(ctx);
    this.timer.set(VOTE_MS, () => {
      if (!ctx.hostLeft) this.resolveVote(ctx);
    });
  }

  private resolveVote(ctx: GameContext): void {
    this.timer.clear();
    const s = this.s;
    if (s.phase !== 'vote') return;
    // 分母用在线玩家：掉线/未在场的人不应把同意票门槛抬高
    const eligible = s.order.filter((id) => ctx.online(id));
    if (eligible.length === 0) {
      this.finish(ctx, 'evil', '没有玩家在线，任务无法继续。');
      return;
    }
    const approve = eligible.filter((id) => s.votes[id] === true).length;
    const reject = eligible.length - approve;
    s.approveCount = approve;
    s.rejectCount = reject;

    if (approve > reject) {
      s.rejectStreak = 0;
      this.startQuest(ctx);
      return;
    }
    s.rejectStreak += 1;
    if (s.rejectStreak >= 5) {
      this.finish(ctx, 'evil', '连续 5 次否决，坏人拖垮了好人阵营。');
      return;
    }
    s.leaderIndex = (s.leaderIndex + 1) % s.order.length;
    this.beginPropose(ctx, `第 ${s.round + 1} 轮任务：${ctx.name(s.order[s.leaderIndex]!)} 接任队长`);
  }

  private startQuest(ctx: GameContext): void {
    this.timer.clear();
    const s = this.s;
    s.phase = 'quest';
    s.questVotes = {};
    s.hint = `任务成员请秘密投票：成功还是破坏？（本轮需要 ${this.failNeeded} 张失败票）`;
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: `🗡️ ${s.proposed.map((id) => ctx.name(id)).join('、')} 出任务。` });
    this.timer.set(QUEST_MS, () => {
      if (!ctx.hostLeft) this.resolveQuest(ctx);
    });
  }

  private resolveQuest(ctx: GameContext): void {
    this.timer.clear();
    const s = this.s;
    if (s.phase !== 'quest') return;
    const fails = Object.values(s.questVotes).filter((v) => !v).length;
    const failed = fails >= this.failNeeded;
    s.questResults.push(failed ? 'fail' : 'success');
    const failTotal = s.questResults.filter((r) => r === 'fail').length;
    const successTotal = s.questResults.filter((r) => r === 'success').length;
    this.pushState(ctx);
    ctx.broadcast({
      type: 'system',
      text: `${failed ? '💥 任务失败' : '✅ 任务成功'}：第 ${s.round + 1} 轮出现 ${fails} 张失败票。`,
    });

    if (failTotal >= 3) {
      this.finish(ctx, 'evil', '三次任务被破坏，坏人阵营获胜。');
      return;
    }
    if (successTotal >= 3) {
      this.startAssassinate(ctx);
      return;
    }
    s.round += 1;
    s.leaderIndex = (s.leaderIndex + 1) % s.order.length;
    s.teamSize = s.quests[s.round] ?? s.teamSize;
    this.beginPropose(ctx, `第 ${s.round + 1} 轮任务：${ctx.name(s.order[s.leaderIndex]!)} 是队长`);
  }

  private startAssassinate(ctx: GameContext): void {
    this.timer.clear();
    const s = this.s;
    s.phase = 'assassinate';
    s.hint = '🗡️ 好人完成了 3 次任务！刺客请选择要刺杀的人。';
    this.pushState(ctx);
    this.timer.set(ASSASSIN_MS, () => {
      if (!ctx.hostLeft) this.finish(ctx, 'good', '刺客没有动手，好人阵营获胜。');
    });
  }

  private assassinate(ctx: GameContext, senderId: PlayerId, target: PlayerId): void {
    const s = this.s;
    if (s.roles[senderId] !== 'assassin' || !s.order.includes(target)) return;
    s.assassinated = target;
    if (s.roles[target] === 'merlin') {
      this.finish(ctx, 'evil', `刺客刺中了梅林（${ctx.name(target)}），坏人翻盘！`);
    } else {
      this.finish(ctx, 'good', `刺客刺错了人（${ctx.name(target)}），好人阵营获胜！`);
    }
  }

  private get failNeeded(): number {
    return this.s.round === 3 && this.s.order.length >= 7 ? 2 : 1;
  }

  private finish(ctx: GameContext, winner: 'good' | 'evil', reason: string): void {
    this.timer.clear();
    const s = this.s;
    if (s.phase === 'gameover') return;
    s.phase = 'gameover';
    s.winner = winner;
    s.winReason = reason;
    s.revealedRoles = { ...s.roles };
    s.hint = `${winner === 'evil' ? '⚔️ 坏人胜利' : '🛡️ 好人胜利'}：${reason}`;
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: s.hint });
  }

  private pushState(ctx: GameContext): void {
    ctx.broadcast({ type: 'game-state', state: this.getState() });
  }
}
