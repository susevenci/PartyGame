import type { DrawOp } from '../base.ts';

/** 传话画图中的一步：文字或一幅画 */
export type TelephoneStep =
  | { kind: 'text'; value: string }
  | { kind: 'draw'; ops: DrawOp[] };

export interface TelephoneState {
  game: 'telephone';
  phase: 'write' | 'draw' | 'guess' | 'reveal';
  step: number;
  totalSteps: number;
  timeLeft: number;
  /** 本步已提交人数 */
  submitted: number;
  /** 揭示阶段：每条原始链路的完整过程 */
  chains?: { author: string; steps: TelephoneStep[] }[];
  hint: string;
}

/** 只发给当前操作者：他需要看到的上一步内容 */
export interface TelephonePrivate {
  game: 'telephone';
  step: number;
  kind: 'write' | 'draw' | 'guess';
  prompt?: string;
  ops?: DrawOp[];
}
