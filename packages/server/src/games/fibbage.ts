import { pickFibbageQuestion } from '@party-games/shared';
import type { ClientMessage, FibbageState, PlayerId } from '@party-games/shared';
import type { Game, GameContext } from './types.ts';
import { compactText, normalizeText, shuffle, Timer } from './util.ts';

const WRITE_MS = 60_000;
const VOTE_MS = 45_000;
const REVEAL_MS = 8_000;
const TOTAL_ROUNDS = 3;

interface BData {
  order: PlayerId[];
  round: number;
  totalRounds: number;
  question: string;
  answer: string;
  fakes: Record<PlayerId, string>;
  choices: { id: string; text: string; author?: PlayerId; correct: boolean }[];
  votes: Record<PlayerId, string>;
  result?: { text: string; author?: string; count: number; correct: boolean }[];
  phase: FibbageState['phase'];
  scores: Record<PlayerId, number>;
  hint: string;
}

/**
 * 编瞎话（Fibbage 类）：题目留空，每人编一个假答案，
 * 与正确答案混在一起投票；骗到人、选中真题都得分。
 */
export class FibbageGame implements Game {
  readonly id = 'fibbage' as const;
  private s!: BData;
  private timer = new Timer();

  start(ctx: GameContext): void {
    const ids = ctx.players.map((p) => p.id);
    this.s = {
      order: ids,
      round: 0,
      totalRounds: TOTAL_ROUNDS,
      question: '',
      answer: '',
      fakes: {},
      choices: [],
      votes: {},
      phase: 'write',
      scores: Object.fromEntries(ids.map((id) => [id, 0])),
      hint: '',
    };
    this.beginRound(ctx);
  }

  onMessage(ctx: GameContext, msg: ClientMessage, senderId: PlayerId): void {
    const s = this.s;
    if (s.phase === 'write' && msg.type === 'submit') {
      this.submitFake(ctx, senderId, msg.value);
      return;
    }
    if (s.phase === 'vote' && msg.type === 'choose') {
      this.castVote(ctx, senderId, msg.value);
    }
  }

  getState(): FibbageState {
    const s = this.s;
    const revealed = s.phase === 'reveal' || s.phase === 'gameover';
    return {
      game: 'fibbage',
      phase: s.phase,
      round: Math.min(s.round + 1, s.totalRounds),
      totalRounds: s.totalRounds,
      question: s.question,
      choices: s.phase === 'vote' ? s.choices.map((c) => ({ id: c.id, text: c.text })) : undefined,
      submitted:
        s.phase === 'write' ? Object.keys(s.fakes).length : s.phase === 'vote' ? Object.keys(s.votes).length : 0,
      truth: revealed ? s.answer : undefined,
      result: revealed ? s.result : undefined,
      scores: s.scores,
      hint: s.hint,
    };
  }

  destroy(): void {
    this.timer.clear();
  }

  private beginRound(ctx: GameContext): void {
    const s = this.s;
    const q = pickFibbageQuestion();
    s.question = q.question;
    s.answer = q.answer;
    s.fakes = {};
    s.votes = {};
    s.choices = [];
    s.result = undefined;
    s.phase = 'write';
    s.hint = '题目留空：编一个以假乱真的答案，别写真正的答案。';
    this.pushState(ctx);
    this.timer.set(WRITE_MS, () => {
      if (!ctx.hostLeft) this.closeWrite(ctx);
    });
  }

  private submitFake(ctx: GameContext, senderId: PlayerId, raw: unknown): void {
    const s = this.s;
    if (s.fakes[senderId]) return;
    const text = normalizeText(raw, 20);
    if (!text) return;
    if (compactText(text) === compactText(s.answer)) {
      ctx.sendTo(senderId, { type: 'system', text: '这就是正确答案，换一个假答案吧。' });
      return;
    }
    s.fakes[senderId] = text;
    this.pushState(ctx);
    if (Object.keys(s.fakes).length >= s.order.length) this.closeWrite(ctx);
  }

  private closeWrite(ctx: GameContext): void {
    this.timer.clear();
    const s = this.s;
    // 候选 id 使用不透明序号，避免把「真答案」或作者编码进 id 后泄漏给客户端
    const candidates: { text: string; author?: PlayerId; correct: boolean }[] = [
      { text: s.answer, correct: true },
      ...Object.entries(s.fakes).map(([author, text]) => ({ text, author, correct: false })),
    ];
    shuffle(candidates);
    s.choices = candidates.map((c, i) => ({ ...c, id: `o${i}` }));
    s.phase = 'vote';
    s.hint = '哪个才是真的？选出你认为的正确答案，不能投自己编的。';
    this.pushState(ctx);
    this.timer.set(VOTE_MS, () => {
      if (!ctx.hostLeft) this.reveal(ctx);
    });
  }

  private castVote(ctx: GameContext, senderId: PlayerId, choiceId: string): void {
    const s = this.s;
    if (s.votes[senderId]) return;
    const choice = s.choices.find((c) => c.id === choiceId);
    if (!choice) return;
    if (choice.author === senderId) {
      ctx.sendTo(senderId, { type: 'system', text: '不能投自己编的答案。' });
      return;
    }
    s.votes[senderId] = choiceId;
    this.pushState(ctx);
    if (Object.keys(s.votes).length >= s.order.length) this.reveal(ctx);
  }

  private reveal(ctx: GameContext): void {
    this.timer.clear();
    const s = this.s;
    if (s.phase === 'reveal') return;
    s.phase = 'reveal';

    const counts = new Map<string, number>();
    for (const id of Object.values(s.votes)) counts.set(id, (counts.get(id) ?? 0) + 1);

    for (const [voter, choiceId] of Object.entries(s.votes)) {
      const choice = s.choices.find((c) => c.id === choiceId);
      if (!choice) continue;
      if (choice.correct) {
        s.scores[voter] = (s.scores[voter] ?? 0) + 1000;
      } else if (choice.author) {
        s.scores[choice.author] = (s.scores[choice.author] ?? 0) + 500;
      }
    }

    s.result = s.choices.map((c) => ({
      text: c.text,
      author: c.author ? ctx.name(c.author) : undefined,
      count: counts.get(c.id) ?? 0,
      correct: c.correct,
    }));
    const top = [...s.result].sort((a, b) => b.count - a.count)[0];
    s.hint = `答案是「${s.answer}」。${top && top.count > 0 ? `被选中最多的是「${top.text}」（${top.count} 票）。` : ''}`;
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
