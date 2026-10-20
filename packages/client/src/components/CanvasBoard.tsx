import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrawOp } from '@party-games/shared';

const COLORS = ['#111827', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

function paint(ctx: CanvasRenderingContext2D, width: number, height: number, ops: DrawOp[]): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  for (const op of ops) {
    if (op.points.length === 0) continue;
    ctx.strokeStyle = op.tool === 'eraser' ? '#ffffff' : op.color;
    ctx.lineWidth = op.size * (op.tool === 'eraser' ? 3 : 1) * (width / 300);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const [sx, sy] = op.points[0]!;
    ctx.moveTo(sx * width, sy * height);
    for (let i = 1; i < op.points.length; i++) {
      const [x, y] = op.points[i]!;
      ctx.lineTo(x * width, y * height);
    }
    ctx.stroke();
  }
}

/** 可交互画布：画家本地绘制并上送归一化坐标，所有人实时渲染远端笔迹 */
export function CanvasBoard(props: {
  ops: DrawOp[];
  canDraw: boolean;
  onStroke: (op: DrawOp) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]!);
  const [size, setSize] = useState(2);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const drawingRef = useRef(false);
  const currentRef = useRef<DrawOp | null>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const all = currentRef.current ? [...props.ops, currentRef.current] : props.ops;
    paint(ctx, canvas.width, canvas.height, all);
  }, [props.ops]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const resize = () => {
      const w = parent.clientWidth;
      canvas.width = Math.round(w);
      canvas.height = Math.round(w * 0.75);
      render();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [render]);

  useEffect(() => {
    render();
  }, [render, color, size, tool]);

  const toNorm = (e: React.PointerEvent): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    ];
  };

  const onDown = (e: React.PointerEvent) => {
    if (!props.canDraw) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentRef.current = { tool, color, size, points: [toNorm(e)] };
    render();
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drawingRef.current || !currentRef.current) return;
    currentRef.current.points.push(toNorm(e));
    render();
  };

  const onUp = () => {
    if (!drawingRef.current || !currentRef.current) return;
    drawingRef.current = false;
    if (currentRef.current.points.length > 1) props.onStroke(currentRef.current);
    currentRef.current = null;
  };

  return (
    <>
      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          style={{ touchAction: 'none', cursor: props.canDraw ? 'crosshair' : 'default' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
      </div>
      {props.canDraw && (
        <div className="toolbar">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${color === c && tool === 'pen' ? 'active' : ''}`}
              style={{ background: c }}
              aria-label={c}
              onClick={() => {
                setColor(c);
                setTool('pen');
              }}
            />
          ))}
          <button
            className="ghost"
            style={{ fontSize: 13, padding: '6px 10px' }}
            onClick={() => setTool('eraser')}
          >
            🧹 {tool === 'eraser' ? '橡皮' : '画笔'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>[粗细 {size}]</span>
          {[1, 2, 3, 5].map((s) => (
            <button
              key={s}
              className={`swatch ${size === s ? 'active' : ''}`}
              style={{
                background: 'transparent',
                border: '2px solid var(--line)',
                display: 'grid',
                placeItems: 'center',
                width: 26,
                height: 26,
              }}
              onClick={() => setSize(s)}
            >
              <span
                style={{
                  width: 4 + s * 2,
                  height: 4 + s * 2,
                  borderRadius: '50%',
                  background: '#fff',
                  display: 'block',
                }}
              />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** 只读画布：用于展示别人画好的图（猜词阶段、传话画图回顾） */
export function StaticCanvas(props: { ops: DrawOp[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    paint(ctx, canvas.width, canvas.height, props.ops);
  }, [props.ops]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const resize = () => {
      const w = parent.clientWidth;
      canvas.width = Math.round(w);
      canvas.height = Math.round(w * 0.75);
      render();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [render]);

  useEffect(() => {
    render();
  }, [render]);

  return (
    <div className="canvas-wrap canvas-viewer">
      <canvas ref={canvasRef} />
    </div>
  );
}
