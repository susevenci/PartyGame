import type { DrawOp } from '@party-games/shared';

/** 可清理的定时器：统一 save/clear 语义，避免每个游戏重复写 destroy 逻辑 */
export class Timer {
  private handle: ReturnType<typeof setTimeout> | null = null;

  set(ms: number, fn: () => void): void {
    this.clear();
    this.handle = setTimeout(() => {
      this.handle = null;
      fn();
    }, ms);
  }

  clear(): void {
    if (this.handle) clearTimeout(this.handle);
    this.handle = null;
  }
}

/** 归一化用户输入：折叠空白、去首尾、限长 */
export function normalizeText(value: unknown, max = 40): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** 用于答案比对的紧凑形式：去掉空白与常见标点，忽略大小写 */
export function compactText(value: string): string {
  return value.replace(/[\s，。！？、,.!?：:；;'"“”‘’]/g, '').toLowerCase();
}

/** 只保留一格有效笔迹，坐标夹在 0~1，防止恶意超长数组 */
export function sanitizeDrawOp(raw: unknown): DrawOp | null {
  if (!raw || typeof raw !== 'object') return null;
  const op = raw as Partial<DrawOp>;
  if (!Array.isArray(op.points) || op.points.length === 0) return null;

  const points: [number, number][] = [];
  for (const point of op.points.slice(0, 200)) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const x = Number(point[0]);
    const y = Number(point[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push([Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))]);
  }
  if (points.length === 0) return null;

  return {
    tool: op.tool === 'eraser' ? 'eraser' : 'pen',
    color: typeof op.color === 'string' ? op.color.slice(0, 16) : '#111827',
    size: Math.min(5, Math.max(1, Math.round(Number(op.size) || 2))),
    points,
  };
}

/** 洗牌（原地） */
export function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

export function pickOne<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}
