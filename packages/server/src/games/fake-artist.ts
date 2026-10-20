import { pickFakeArtistWord } from '@party-games/shared';
import type {
  ClientMessage,
  DrawOp,
  FakeArtistPrivate,
  FakeArtistState,
  PlayerId,
} from '@party-games/shared';
import type { Game, GameContext } from './types.ts';
import { compactText, normalizeText, sanitizeDrawOp, Timer } from './util.ts';

const STROKE_MS = 40_000;
const VOTE_MS = 30_000;
const GUESS_MS = 30_000;
const STROKES_PER_PLAYER = 2;

interface FData {
  category: string;
  word: string;
  fakeId: PlayerId;
  order: PlayerId[];
  currentIndex: number;
  /** 已完成笔数 */
  strokes: number;
  totalStrokes: number;
  phase: FakeArtistState['phase'];
  votes: Record<PlayerId, PlayerId>;
  votedOut?: PlayerId | null;
  finalGuess?: string;
  winner?: 'fake' | 'artists';
  hint: string;
}

/**
 * 假画家：所有人拿同一个词，只有假画家只知道品类。
 * 轮流各画一笔（每人两笔），然后投票；抓到假画家后他还能猜一次词。
 */
export class FakeArtistGame implements Game {
  readonly id = 'fake-artist' as const;
  private s!: FData;
  private timer = new Timer();

  start(ctx: GameContext): void {
    const ids = ctx.players.map((p) => p.id);
    const { category, word } = pickFakeArtistWord();
    const fakeId = ids[Math.floor(Math.random() * ids.length)]!;
    this.s = {
      category,
      word,
      fakeId,
      order: ids,
      currentIndex: 0,
      strokes: 0,
      totalStrokes: ids.length * STROKES_PER_PLAYER,
      phase: 'draw',
      votes: {},
      hint: `第 1 笔：${ctx.name(ids[0]!)} 先画`,
    };

    for (const id of ids) {
      const data: FakeArtistPrivate =
        id === fakeId
          ? { game: 'fake-artist', isFake: true, category }
          : { game: 'fake-artist', isFake: false, category, word };
      ctx.sendTo(id, { type: 'game-private', data });
    }
    ctx.broadcast({ type: 'system', text: '题目已发放：只有假画家不知道具体是什么。' });
    ctx.broadcast({ type: 'canvas-clear' });
    this.pushState(ctx);
    this.armStroke(ctx);
  }

  onMessage(ctx: GameContext, msg: ClientMessage, senderId: PlayerId): void {
    const s = this.s;
    if (s.phase === 'draw' && msg.type === 'draw') {
      this.takeStroke(ctx, senderId, msg.op);
      return;
    }
    if (s.phase === 'vote' && msg.type === 'vote') {
      this.castVote(ctx, senderId, msg.target);
      return;
    }
    if (s.phase === 'guess' && msg.type === 'submit' && senderId === s.fakeId) {
      const guess = normalizeText(msg.value, 20);
      if (!guess) return;
      s.finalGuess = guess;
      const hit = compactText(guess) === compactText(s.word);
      this.finish(
        ctx,
        hit ? 'fake' : 'artists',
        hit ? `假画家猜中了「${s.word}」，假画家反杀！` : `假画家猜成了「${guess}」，画家阵营获胜！`,
      );
    }
  }

  getState(): FakeArtistState {
    const s = this.s;
    return {
      game: 'fake-artist',
      phase: s.phase,
      category: s.category,
      current: s.order[s.currentIndex]!,
      strokes: s.strokes,
      totalStrokes: s.totalStrokes,
      voteCount: s.phase === 'vote' ? Object.keys(s.votes).length : undefined,
      votedOut: s.votedOut,
      finalGuess: s.finalGuess,
      winner: s.winner,
      hint: s.hint,
    };
  }

  destroy(): void {
    this.timer.clear();
  }

  private takeStroke(ctx: GameContext, senderId: PlayerId, raw: unknown): void {
    const s = this.s;
    if (senderId !== s.order[s.currentIndex]) return;
    const op: DrawOp | null = sanitizeDrawOp(raw);
    if (!op) return;
    ctx.broadcast({ type: 'draw', op });
    s.strokes += 1;
    if (s.strokes >= s.totalStrokes) {
      this.openVote(ctx);
      return;
    }
    s.currentIndex = (s.currentIndex + 1) % s.order.length;
    s.hint = `第 ${s.strokes + 1} 笔：${ctx.name(s.order[s.currentIndex]!)} 来画`;
    this.pushState(ctx);
    this.armStroke(ctx);
  }

  private armStroke(ctx: GameContext): void {
    this.timer.set(STROKE_MS, () => {
      if (ctx.hostLeft) return;
      ctx.broadcast({ type: 'system', text: `⏰ ${ctx.name(this.s.order[this.s.currentIndex]!)} 超时，跳过这一笔。` });
      this.s.strokes += 1;
      if (this.s.strokes >= this.s.totalStrokes) {
        this.openVote(ctx);
        return;
      }
      this.s.currentIndex = (this.s.currentIndex + 1) % this.s.order.length;
      this.s.hint = `第 ${this.s.strokes + 1} 笔：${ctx.name(this.s.order[this.s.currentIndex]!)} 来画`;
      this.pushState(ctx);
      this.armStroke(ctx);
    });
  }

  private openVote(ctx: GameContext): void {
    this.timer.clear();
    this.s.phase = 'vote';
    this.s.votes = {};
    this.s.hint = '画完了！投票选出你认为是假画家的人。';
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: '🗳️ 开始投票：谁是没有拿到词的那个人？' });
    this.timer.set(VOTE_MS, () => {
      if (!ctx.hostLeft) this.resolveVote(ctx);
    });
  }

  private castVote(ctx: GameContext, senderId: PlayerId, target: PlayerId): void {
    const s = this.s;
    if (!s.order.includes(senderId) || !s.order.includes(target) || senderId === target) return;
    if (s.votes[senderId]) return;
    s.votes[senderId] = target;
    this.pushState(ctx);
    if (Object.keys(s.votes).length >= s.order.length) this.resolveVote(ctx);
  }

  private resolveVote(ctx: GameContext): void {
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
    s.votedOut = tie ? null : top;

    if (s.votedOut === s.fakeId) {
      s.phase = 'guess';
      s.hint = '🎯 抓到假画家了！他还有一次猜词机会。';
      this.pushState(ctx);
      this.timer.set(GUESS_MS, () => {
        if (!ctx.hostLeft) this.finish(ctx, 'artists', '假画家没有猜出词语，画家阵营获胜！');
      });
      return;
    }
    this.finish(
      ctx,
      'fake',
      s.votedOut ? `被投出去的是 ${ctx.name(s.votedOut)}，假画家混过去了！` : '平票，假画家混过去了！',
    );
  }

  private finish(ctx: GameContext, winner: 'fake' | 'artists', reason: string): void {
    if (this.s.phase === 'gameover') return;
    this.timer.clear();
    this.s.phase = 'gameover';
    this.s.winner = winner;
    this.s.hint = `${winner === 'fake' ? '🖌️ 假画家胜利' : '🎨 画家阵营胜利'}：${reason}`;
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: this.s.hint });
  }

  private pushState(ctx: GameContext): void {
    ctx.broadcast({ type: 'game-state', state: this.getState() });
  }
}
