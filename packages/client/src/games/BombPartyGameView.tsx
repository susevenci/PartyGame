import { useState } from 'react';
import type { BombPartyState } from '@party-games/shared';
import { Feed, GameTopBar, type GameViewProps } from '../components/common';

interface Props extends GameViewProps {
  state: BombPartyState;
}

export function BombPartyGameView(props: Props) {
  const { state, room, myId, send, feed } = props;
  const [word, setWord] = useState('');
  const isHost = room.players.find((p) => p.id === myId)?.isHost;
  const myTurn = state.phase === 'playing' && state.current === myId;
  const currentName = room.players.find((p) => p.id === state.current)?.name ?? '玩家';

  const submit = () => {
    const value = word.trim();
    if (!value) return;
    send({ type: 'submit', value });
    setWord('');
  };

  return (
    <>
      <GameTopBar room={room} onLeave={() => send({ type: 'leave' })} />
      <div className="game-banner">
        <div style={{ fontWeight: 700 }}>{state.hint}</div>
        <div className="hint">
          {state.phase === 'playing' ? `轮到 ${currentName}` : '本局结束'} · 已用 {state.used.length} 个词
        </div>
      </div>

      <div className="bomb-card">
        <div className={`bomb-timer ${state.timeLeft <= 4 ? 'danger' : ''}`}>{state.timeLeft}</div>
        <div className="bomb-char">{state.prompt}</div>
        <div style={{ fontSize: 13, color: 'var(--dim)' }}>说出一个包含这个字的词语</div>
      </div>

      <div className="lives-row">
        {room.players.map((p) => {
          const lives = state.lives[p.id] ?? 0;
          return (
            <span key={p.id} className={`life-chip ${state.current === p.id ? 'active' : ''} ${lives === 0 ? 'dead' : ''}`}>
              {p.name} {'❤️'.repeat(lives) || '💀'}
            </span>
          );
        })}
      </div>

      {myTurn && (
        <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 520 }}>
          <input
            placeholder={`含「${state.prompt}」的词语…`}
            value={word}
            maxLength={8}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button className="primary" disabled={!word.trim()} onClick={submit}>
            说！
          </button>
        </div>
      )}

      {state.lastWord && (
        <div className="game-banner" style={{ padding: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>
            上一个词：{state.lastWord}（{room.players.find((p) => p.id === state.lastPlayer)?.name ?? '?'}）
          </span>
        </div>
      )}

      {state.used.length > 0 && (
        <div className="clue-row">
          {state.used.slice(-12).map((w) => (
            <span key={w} className="clue-chip">
              {w}
            </span>
          ))}
        </div>
      )}

      {state.phase === 'gameover' && (
        <div className="result-overlay">
          <div className="result-card">
            <div style={{ fontSize: 54 }}>💣</div>
            <h2 style={{ margin: '10px 0' }}>最后幸存者</h2>
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
