import { useState } from 'react';
import type { FibbageState } from '@party-games/shared';
import { Feed, GameTopBar, type GameViewProps } from '../components/common';

interface Props extends GameViewProps {
  state: FibbageState;
}

export function FibbageGameView(props: Props) {
  const { state, room, myId, send, feed } = props;
  const [text, setText] = useState('');
  const isHost = room.players.find((p) => p.id === myId)?.isHost;

  const submitFake = () => {
    const value = text.trim();
    if (!value) return;
    send({ type: 'submit', value });
    setText('');
  };

  return (
    <>
      <GameTopBar room={room} onLeave={() => send({ type: 'leave' })} />
      <div className="game-banner">
        <div style={{ fontWeight: 700 }}>{state.hint}</div>
        <div className="hint">
          第 {state.round}/{state.totalRounds} 题
        </div>
      </div>

      <div className="question-card">{state.question}</div>

      {state.phase === 'write' && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 8 }}>
            编一个假答案（已提交 {state.submitted}/{room.players.length}）
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="越像真的越好…"
              value={text}
              maxLength={20}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitFake()}
            />
            <button className="primary" disabled={!text.trim()} onClick={submitFake}>
              提交
            </button>
          </div>
        </div>
      )}

      {state.phase === 'vote' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>
            选出真正的答案（已投 {state.submitted}/{room.players.length}）
          </div>
          <div className="choice-list">
            {(state.choices ?? []).map((c) => (
              <button key={c.id} className="choice-btn" onClick={() => send({ type: 'choose', value: c.id })}>
                {c.text}
              </button>
            ))}
          </div>
        </>
      )}

      {(state.phase === 'reveal' || state.phase === 'gameover') && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            真答案：<span style={{ color: 'var(--ok)' }}>{state.truth}</span>
          </div>
          {(state.result ?? []).map((r, i) => (
            <div key={`${r.text}-${i}`} className="result-row">
              <span style={{ color: r.correct ? 'var(--ok)' : undefined }}>
                {r.correct ? '✅ ' : ''}
                {r.text}
              </span>
              <span style={{ color: 'var(--dim)' }}>{r.author ? `by ${r.author}` : '标准答案'}</span>
              <span>{r.count} 票</span>
            </div>
          ))}
        </div>
      )}

      <div className="score-row">
        {Object.entries(state.scores)
          .sort((a, b) => b[1] - a[1])
          .map(([id, score]) => (
            <span key={id} className="badge">
              {room.players.find((p) => p.id === id)?.name ?? '?'} {score}
            </span>
          ))}
      </div>

      {state.phase === 'gameover' && isHost && (
        <button className="primary" style={{ maxWidth: 520, width: '100%' }} onClick={() => send({ type: 'finish-game' })}>
          结束本局
        </button>
      )}

      <Feed lines={feed} input onSend={(t) => send({ type: 'chat', text: t })} />
    </>
  );
}
