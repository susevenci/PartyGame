import { useState } from 'react';
import type { PlayerId, SpyfallPrivate, SpyfallState } from '@party-games/shared';
import { Feed, GameTopBar, type GameViewProps } from '../components/common';

interface Props extends GameViewProps {
  state: SpyfallState;
  privateData: SpyfallPrivate | null;
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function SpyfallGameView(props: Props) {
  const { state, privateData, room, myId, send, feed } = props;
  const [voted, setVoted] = useState<PlayerId | null>(null);
  const isHost = room.players.find((p) => p.id === myId)?.isHost;
  const isSpy = privateData?.isSpy === true;
  const revealed = state.phase === 'reveal' || state.phase === 'gameover';

  return (
    <>
      <GameTopBar room={room} onLeave={() => send({ type: 'leave' })} />
      <div className="game-banner">
        <div style={{ fontWeight: 700 }}>{state.hint}</div>
        <div className="hint">
          {state.phase === 'discuss' ? `讨论剩余 ${mmss(state.timeLeft)}` : '本轮已结束'}
        </div>
      </div>

      {privateData && (
        <div className="word-card" style={{ fontSize: 26 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 6 }}>
            {isSpy ? '🕶️ 你是间谍' : '📍 你是平民，地点是'}
          </div>
          {isSpy ? (
            <span style={{ color: 'var(--warn)' }}>你不知道地点，装作知道</span>
          ) : (
            privateData.location
          )}
        </div>
      )}

      <details className="card" style={{ padding: 14 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--dim)' }}>
          地点列表（间谍也会看到这份表）
        </summary>
        <div className="clue-row" style={{ marginTop: 10 }}>
          {(privateData?.locations ?? []).map((loc) => (
            <span key={loc} className="clue-chip">
              {loc}
            </span>
          ))}
        </div>
      </details>

      {state.phase === 'discuss' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>
            投票指认间谍（已投 {state.voteCount}/{room.players.length}，全员投完立即揭晓）
          </div>
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
        </>
      )}

      {revealed && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {state.winner === 'spy' ? '🕶️ 间谍胜利' : '🕵️ 平民胜利'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.9 }}>
            <div>地点：{state.location}</div>
            <div>间谍：{room.players.find((p) => p.id === state.spyId)?.name ?? '?'}</div>
            <div>被指认：{state.accused ? room.players.find((p) => p.id === state.accused)?.name : '无人'}</div>
          </div>
        </div>
      )}

      {state.phase === 'gameover' && isHost && (
        <button className="primary" style={{ maxWidth: 520, width: '100%' }} onClick={() => send({ type: 'finish-game' })}>
          结束本局
        </button>
      )}

      <Feed lines={feed} input onSend={(t) => send({ type: 'chat', text: t })} />
    </>
  );
}
