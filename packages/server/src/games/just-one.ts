import { pickJustOneWord } from '@party-games/shared';
import type {
  ClientMessage,
  JustOnePrivate,
  JustOneState,
  PlayerId,
} from '@party-games/shared';
import type { Game, GameContext } from './types.ts';
import { compactText, normalizeText, Timer } from './util.ts';

const CLUE_MS = 45_000;
const GUESS_MS = 60_000;
const RESULT_MS = 6_000;

interface JData {
  order: PlayerId[];
  round: number; // 0-based
  totalRounds: number;
  guesserIndex: number;
  word: string;
  phase: JustOneState['phase'];
  clues: Record<PlayerId, string>;
  finalClues: string[];
  duplicates: number;
  lastGuess?: string;
  lastWord?: string;
  lastCorrect?: boolean;
  score: number;
  history: { word: string; guess: string; correct: boolean }[];
  hint: string;
}

/**
 * Just One（一字提示）：每轮一名猜词者，其他人各给一个词的提示，
 * 重复的提示整组作废；猜词者只能看到剩下的提示。
 */
export class JustOneGame implements Game {
  readonly id = 'just-one' as const;
  private s!: JData;
  private timer = new Timer();

  start(ctx: GameContext): void {
    const ids = ctx.players.map((p) => p.id);
    this.s = {
      order: ids,
      round: 0,
      totalRounds: ids.length,
      guesserIndex: 0,
      word: '',
      phase: 'clue',
      clues: {},
      finalClues: [],
      duplicates: 0,
      score: 0,
      history: [],
      hint: '',
    };
    this.beginRound(ctx);
  }

  onMessage(ctx: GameContext, msg: ClientMessage, senderId: PlayerId): void {
    const s = this.s;
    if (s.phase === 'clue' && msg.type === 'submit') {
      this.submitClue(ctx, senderId, msg.value);
      return;
    }
    if (s.phase === 'guess' && msg.type === 'submit') {
      if (senderId !== s.order[s.guesserIndex]) return;
      this.finishGuess(ctx, msg.value);
    }
  }

  getState(): JustOneState {
    const s = this.s;
    const revealed = s.phase === 'guess' || s.phase === 'result' || s.phase === 'gameover';
    return {
      game: 'just-one',
      phase: s.phase,
      round: Math.min(s.round + 1, s.totalRounds),
      totalRounds: s.totalRounds,
      guesser: s.order[s.guesserIndex]!,
      clues: revealed ? [...s.finalClues] : undefined,
      clueCount: s.phase === 'clue' ? Object.keys(s.clues).length : undefined,
      duplicates: revealed ? s.duplicates : undefined,
      lastGuess: s.phase === 'result' || s.phase === 'gameover' ? s.lastGuess : undefined,
      lastWord: s.phase === 'result' || s.phase === 'gameover' ? s.lastWord : undefined,
      lastCorrect: s.phase === 'result' || s.phase === 'gameover' ? s.lastCorrect : undefined,
      score: s.score,
      history: s.history,
      hint: s.hint,
    };
  }

  destroy(): void {
    this.timer.clear();
  }

  private beginRound(ctx: GameContext): void {
    const s = this.s;
    s.word = pickJustOneWord();
    s.clues = {};
    s.finalClues = [];
    s.duplicates = 0;
    s.lastGuess = undefined;
    s.lastWord = undefined;
    s.lastCorrect = undefined;
    s.phase = 'clue';
    const guesser = s.order[s.guesserIndex]!;
    s.hint = `${ctx.name(guesser)} 猜词，其他人各给一个词的提示。`;

    for (const id of s.order) {
      const data: JustOnePrivate =
        id === guesser
          ? { game: 'just-one', role: 'guesser' }
          : { game: 'just-one', role: 'clue', word: s.word };
      ctx.sendTo(id, { type: 'game-private', data });
    }
    this.pushState(ctx);
    this.timer.set(CLUE_MS, () => {
      if (!ctx.hostLeft) this.openGuess(ctx);
    });
  }

  private submitClue(ctx: GameContext, senderId: PlayerId, raw: unknown): void {
    const s = this.s;
    if (senderId === s.order[s.guesserIndex]) return;
    if (s.clues[senderId]) return;
    const clue = normalizeText(raw, 8);
    if (!clue) return;
    if (clue.includes(' ')) {
      ctx.sendTo(senderId, { type: 'system', text: '提示只能是一个词，不能带空格。' });
      return;
    }
    if (compactText(clue).includes(compactText(s.word))) {
      ctx.sendTo(senderId, { type: 'system', text: '提示里不能直接出现答案。' });
      return;
    }
    s.clues[senderId] = clue;
    this.pushState(ctx);
    if (Object.keys(s.clues).length >= s.order.length - 1) this.openGuess(ctx);
  }

  private openGuess(ctx: GameContext): void {
    this.timer.clear();
    const s = this.s;
    const groups = new Map<string, { text: string; count: number }>();
    for (const text of Object.values(s.clues)) {
      const key = compactText(text);
      const hit = groups.get(key);
      if (hit) hit.count += 1;
      else groups.set(key, { text, count: 1 });
    }
    s.finalClues = [...groups.values()].filter((g) => g.count === 1).map((g) => g.text);
    s.duplicates = Object.keys(s.clues).length - s.finalClues.length;
    s.phase = 'guess';
    s.hint =
      s.finalClues.length > 0
        ? `猜词者请根据 ${s.finalClues.length} 条提示猜词。`
        : '所有提示都撞车作废了……猜词者只能硬猜。';
    this.pushState(ctx);
    this.timer.set(GUESS_MS, () => {
      if (!ctx.hostLeft) this.finishGuess(ctx, '（超时未作答）');
    });
  }

  private finishGuess(ctx: GameContext, raw: unknown): void {
    this.timer.clear();
    const s = this.s;
    const guess = normalizeText(raw, 20) || '（未作答）';
    const correct = compactText(guess) === compactText(s.word);
    if (correct) s.score += 1;
    s.lastGuess = guess;
    s.lastWord = s.word;
    s.lastCorrect = correct;
    s.history.push({ word: s.word, guess, correct });
    s.phase = 'result';
    s.hint = correct ? `✅ 猜中了「${s.word}」！全队 +1 分。` : `❌ 答案是「${s.word}」。`;
    this.pushState(ctx);
    ctx.broadcast({ type: 'system', text: s.hint });
    this.timer.set(RESULT_MS, () => {
      if (!ctx.hostLeft) this.nextRound(ctx);
    });
  }

  private nextRound(ctx: GameContext): void {
    const s = this.s;
    s.guesserIndex += 1;
    s.round += 1;
    if (s.round >= s.totalRounds) {
      s.phase = 'gameover';
      s.hint = `🏁 全部结束：全队猜中 ${s.score}/${s.totalRounds} 个词。`;
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
