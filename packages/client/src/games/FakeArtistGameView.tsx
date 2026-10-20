import { useEffect, useState } from 'react';
import type { DrawOp, FakeArtistPrivate, FakeArtistState, PlayerId } from '@party-games/shared';
import { CanvasBoard } from '../components/CanvasBoard';
import { Feed, GameTopBar, PlayerStrip, type GameViewProps } from '../components/common';

interface Props extends GameViewProps {
  state: FakeArtistState;
  privateData: FakeArtistPrivate | null;
  drawOps: DrawOp[];
}

export function FakeArtistGameView(props: Props) {
  const { state, privateData, drawOps, room, myId, send, feed } = props;
  const [voted, setVoted] = useState<PlayerId | null>(null);
  const [guess, setGuess] = useState('');
  const isHost = room.players.find((p) => p.id === myId)?.isHost;
  const isFake = privateData?.isFake === true;
  const myTurn = state.phase === 'draw' && state.current === myId;

  useEffect(() => {
    if (state.phase !== 'vote') setVoted(null);
  }, [state.phase]);

  return (
    <>
      <GameTopBar room={room} onLeave={() => send({ type: 'leave' })} />
      <div className="game-banner">
        <div style={{ fontWeight: 700 }}>{state.hint}</div>
        <div className="hint">
          品类：{state.category} · 已画 {state.strokes}/{state.totalStrokes} 笔
        </div>
      </div>

      {privateData && state.phase !== 'gameover' && (
        <div className="word-card" style={{ fontSize: 22 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 6 }}>
            {isFake ? '🖌️ 你是假画家，只知道品类' : '🎨 你要画的东西'}
          </div>
          {isFake ? (
            <span style={{ color: 'var(--warn)' }}>{privateData.category}</span>
          ) : (
            privateData.word
          )}
        </div>
      )}

      <div className="draw-area">
        <CanvasBoard
          ops={drawOps}
          canDraw={myTurn}
          onStroke={(op) => send({ type: 'draw', op })}
        />
        <div style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'center', marginTop: 6 }}>
          {myTurn ? '轮到你：画一笔就好' : state.phase === 'draw' ? `等 ${room.players.find((p) => p.id === state.current)?.name ?? '…'} 画` : '画布已封笔'}
        </div>
      </div>

      {state.phase === 'vote' && (
        <>
          <PlayerStrip room={room} myId={myId} />
          <div className="vote-grid">
            {room.players
              .filter((p) => p.id !== myId)
              .map((p) => (
                <button
                  key={p.id}
                  className={`vote-btn ${voted === p.id ? 'selected' : ''}`}
                  onClick={() => {
                    setVoted(p.id);
                    send({ type: 'vote', target: p.id });
                  }}
                >
                  {p.name}
                </button>
              ))}
          </div>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>
            已投 {state.voteCount ?? 0}/{room.players.length} 票
          </div>
        </>
      )}

      {state.phase === 'guess' && isFake && (
        <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 520 }}>
          <input
            placeholder="猜猜大家画的是什么…"
            value={guess}
            maxLength={20}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && guess.trim()) send({ type: 'submit', value: guess.trim() });
            }}
          />
          <button className="primary" disabled={!guess.trim()} onClick={() => send({ type: 'submit', value: guess.trim() })}>
            提交
          </button>
        </div>
      )}

      {state.phase === 'gameover' && (
        <div className="result-overlay">
          <div className="result-card">
            <div style={{ fontSize: 54 }}>{state.winner === 'fake' ? '🖌️' : '🎨'}</div>
            <h2 style={{ margin: '10px 0' }}>{state.winner === 'fake' ? '假画家胜利' : '画家阵营胜利'}</h2>
            <p style={{ color: 'var(--dim)', margin: '0 0 18px' }}>{state.hint}</p>
            {isHost ? (
              <button className="primary" style={{ width: '100%', padding: 12 }} onClick={() => send({ type: 'finish-game' })}>
                结束本局
              </button>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--dim)' }}>等待房主结束…</div>
            )}
          </div>
        </div>
      )}

      <Feed lines={feed} input onSend={(t) => send({ type: 'chat', text: t })} />
    </>
  );
}
