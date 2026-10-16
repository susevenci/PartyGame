import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ClientMessage,
  DrawOp,
  DrawingState,
  PlayerId,
  RoomInfo,
} from '@party-games/shared';
import { Feed, GameTopBar, type ChatLine } from '../components/common';

interface Props {
  state: DrawingState;
  privateWord: string | null;
  drawOps: DrawOp[];
  room: RoomInfo;
  myId: PlayerId;
  feed: ChatLine[];
  send: (m: ClientMessage) => void;
}

const COLORS = ['#111827', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

export function DrawingGameView(props: Props) {
  const { state, privateWord, drawOps, room, myId, feed, send } = props;
  const isDrawer = state.drawer === myId;
  const drawerName = room.players.find((p) => p.id === state.drawer)?.name ?? '画家';
  const isHost = room.players.find((p) => p.id === myId)?.isHost;

  return (
    <>
      <GameTopBar room={room} onLeave={() => send({ type: 'leave' })} />
      <div className="game-banner">
        <div style={{ fontWeight: 700 }}>
          第 {state.round}/{state.totalRounds} 轮 · 🎨 {drawerName} 在画
        </div>
        <div className="hint">
          {isDrawer
            ? privateWord
              ? '根据下面的词语作画，画完点「换词」可换一题'
              : '正在发词…'
            : '输入文字猜词，第一个猜中 2 分！'}
        </div>
      </div>

      {isDrawer && privateWord && (
        <div className="word-card">
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 4 }}>你要画的词</div>
          {privateWord}
        </div>
      )}

      <div className="draw-area">
        <CanvasBoard
          ops={drawOps}
          canDraw={isDrawer && state.phase !== 'reveal'}
          onStroke={(op) => send({ type: 'draw', op })}
        />
        {isDrawer && state.phase !== 'reveal' && (
          <button className="ghost" style={{ marginTop: 8, width: '100%' }} onClick={() => send({ type: 'pass' })}>
            🔀 我画不出来，换个词
          </button>
        )}
      </div>

      {!isDrawer && state.phase !== 'reveal' && (
        <GuessBar onGuess={(v) => send({ type: 'answer', value: v })} />
      )}

      {state.phase === 'reveal' && (
        <div className="game-banner">
          <div style={{ fontWeight: 700 }}>
            答案是 <span style={{ color: 'var(--accent)', fontSize: 20 }}>{state.word}</span>
          </div>
          {state.scores &&
            Object.entries(state.scores).map(([pid, sc]) => (
              <div key={pid} style={{ fontSize: 13, color: 'var(--dim)' }}>
                {room.players.find((p) => p.id === pid)?.name} +{sc}
              </div>
            ))}
        </div>
      )}

      <div className="game-banner" style={{ background: 'rgba(255,255,255,.05)' }}>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 6 }}>总分</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {Object.entries(state.totalScores)
            .sort((a, b) => b[1] - a[1])
            .map(([pid, sc]) => (
              <span key={pid} className="badge">
                {room.players.find((p) => p.id === pid)?.name} {sc}
              </span>
            ))}
        </div>
      </div>

      <Feed lines={feed} input={!isDrawer} onSend={(t) => send({ type: 'chat', text: t })} disabled={state.phase === 'reveal'} />

      {/* 终局：所有人画完后服务端发 system 提示，房主可结束 */}
      {isHost && state.round > state.totalRounds && (
        <button className="primary" style={{ maxWidth: 520, width: '100%' }} onClick={() => send({ type: 'finish-game' })}>
          结束本局
        </button>
      )}
    </>
  );
}

function GuessBar(props: { onGuess: (v: string) => void }) {
  const [text, setText] = useState('');
  const submit = () => {
    if (text.trim()) {
      props.onGuess(text.trim());
      setText('');
    }
  };
  return (
    <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 520 }}>
      <input
        placeholder="我猜是…"
        value={text}
        maxLength={12}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <button className="primary" onClick={submit} disabled={!text.trim()}>
        猜
      </button>
    </div>
  );
}

/** 画布：画家本地绘制并上送归一化坐标，所有人实时渲染远端笔迹 */
function CanvasBoard(props: { ops: DrawOp[]; canDraw: boolean; onStroke: (op: DrawOp) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]!);
  const [size, setSize] = useState(2);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const drawingRef = useRef(false);
  const currentRef = useRef<DrawOp | null>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    const all: DrawOp[] = [...props.ops];
    if (currentRef.current) all.push(currentRef.current);
    for (const op of all) {
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
  }, [props.ops]);

  // 尺寸自适应：跟随容器宽度
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
    if (currentRef.current.points.length > 1) {
      props.onStroke(currentRef.current);
    }
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
              <span style={{ width: 4 + s * 2, height: 4 + s * 2, borderRadius: '50%', background: '#fff', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
