import { useEffect, useState } from 'react';
import type { DrawOp, TelephonePrivate, TelephoneState } from '@party-games/shared';
import { CanvasBoard, StaticCanvas } from '../components/CanvasBoard';
import { Feed, GameTopBar, type GameViewProps } from '../components/common';

interface Props extends GameViewProps {
  state: TelephoneState;
  privateData: TelephonePrivate | null;
}

export function TelephoneGameView(props: Props) {
  const { state, privateData, room, myId, send, feed } = props;
  const [text, setText] = useState('');
  const [ops, setOps] = useState<DrawOp[]>([]);
  const isHost = room.players.find((p) => p.id === myId)?.isHost;

  useEffect(() => {
    setText('');
    setOps([]);
  }, [state.step]);

  const submitText = () => {
    const value = text.trim();
    if (!value) return;
    send({ type: 'submit', value });
    setText('');
  };

  const submitDrawing = () => {
    if (ops.length === 0) return;
    send({ type: 'submit-drawing', ops });
    setOps([]);
  };

  return (
    <>
      <GameTopBar room={room} onLeave={() => send({ type: 'leave' })} />
      <div className="game-banner">
        <div style={{ fontWeight: 700 }}>{state.hint}</div>
        <div className="hint">
          第 {state.step}/{state.totalSteps} 步 · 剩余 {state.timeLeft}s · 已提交 {state.submitted}/{room.players.length}
        </div>
      </div>

      {state.phase === 'write' && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 8 }}>写一句容易被画出来的话</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="比如：一只在吃火锅的猫"
              value={text}
              maxLength={40}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitText()}
            />
            <button className="primary" disabled={!text.trim()} onClick={submitText}>
              提交
            </button>
          </div>
        </div>
      )}

      {state.phase === 'draw' && (
        <div className="draw-area">
          <div className="game-banner" style={{ padding: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>你要画的是</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{privateData?.prompt ?? '（等待同步…）'}</div>
          </div>
          <CanvasBoard ops={ops} canDraw onStroke={(op) => setOps((prev) => [...prev, op])} />
          <button className="primary" style={{ marginTop: 8, width: '100%' }} disabled={ops.length === 0} onClick={submitDrawing}>
            画好了（{ops.length} 笔）
          </button>
        </div>
      )}

      {state.phase === 'guess' && (
        <>
          <div className="draw-area">
            <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 6 }}>猜猜这幅画画的是什么</div>
            {privateData?.ops ? <StaticCanvas ops={privateData.ops} /> : <div className="card">（等待同步…）</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 520 }}>
            <input
              placeholder="我猜这句话是…"
              value={text}
              maxLength={40}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitText()}
            />
            <button className="primary" disabled={!text.trim()} onClick={submitText}>
              提交
            </button>
          </div>
        </>
      )}

      {state.phase === 'reveal' && (
        <div className="chain-list">
          {(state.chains ?? []).map((chain, ci) => (
            <div key={`${chain.author}-${ci}`} className="chain-card">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>链路 {ci + 1}</div>
              {chain.steps.map((step, si) =>
                step.kind === 'text' ? (
                  <div key={si} className="chain-text">
                    {step.value}
                  </div>
                ) : (
                  <div key={si} className="chain-canvas">
                    <StaticCanvas ops={step.ops} />
                  </div>
                ),
              )}
            </div>
          ))}
        </div>
      )}

      {state.phase === 'reveal' && isHost && (
        <button className="primary" style={{ maxWidth: 520, width: '100%' }} onClick={() => send({ type: 'finish-game' })}>
          结束本局
        </button>
      )}

      <Feed lines={feed} input onSend={(t) => send({ type: 'chat', text: t })} />
    </>
  );
}
