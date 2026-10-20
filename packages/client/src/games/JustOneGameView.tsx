import { useState } from 'react';
import type { JustOnePrivate, JustOneState } from '@party-games/shared';
import { Feed, GameTopBar, type GameViewProps } from '../components/common';

interface Props extends GameViewProps {
  state: JustOneState;
  privateData: JustOnePrivate | null;
}

export function JustOneGameView(props: Props) {
  const { state, privateData, room, myId, send, feed } = props;
  const [text, setText] = useState('');
  const isHost = room.players.find((p) => p.id === myId)?.isHost;
  const isGuesser = state.guesser === myId;
  const word = privateData?.role === 'clue' ? privateData.word : null;
  const guesserName = room.players.find((p) => p.id === state.guesser)?.name ?? '玩家';

  const submit = () => {
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
          第 {state.round}/{state.totalRounds} 轮 · {guesserName} 猜词 · 合作分 {state.score}
        </div>
      </div>

      {(state.phase === 'clue' || state.phase === 'guess') && (
        <div className="word-card" style={{ fontSize: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 6 }}>
            {isGuesser ? '🕵️ 你是猜词者' : '💡 你要提示的词'}
          </div>
          {isGuesser ? '根据提示猜出这个词' : word}
        </div>
      )}

      {state.phase === 'clue' && !isGuesser && (
        <>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 8 }}>
              只写一个词，重复的提示会作废（已提交 {state.clueCount ?? 0}/{room.players.length - 1}）
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="一个词的提示…"
                value={text}
                maxLength={8}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
              <button className="primary" disabled={!text.trim()} onClick={submit}>
                提交
              </button>
            </div>
          </div>
        </>
      )}

      {state.phase === 'guess' && (
        <>
          <div className="clue-row">
            {(state.clues ?? []).map((clue, i) => (
              <span key={`${clue}-${i}`} className="clue-chip">
                {clue}
              </span>
            ))}
            {(state.clues ?? []).length === 0 && (
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>没有有效提示</span>
            )}
          </div>
          {(state.duplicates ?? 0) > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--warn)' }}>
              有 {state.duplicates} 条提示撞车作废
            </div>
          )}
          {isGuesser && (
            <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 520 }}>
              <input
                placeholder="我猜是…"
                value={text}
                maxLength={20}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
              <button className="primary" disabled={!text.trim()} onClick={submit}>
                猜
              </button>
            </div>
          )}
        </>
      )}

      {(state.phase === 'result' || state.phase === 'gameover') && (
        <div className="game-banner">
          <div style={{ fontWeight: 700, color: state.lastCorrect ? 'var(--ok)' : 'var(--danger)' }}>
            {state.lastCorrect ? '✅ 猜对了' : '❌ 没猜中'} · 答案「{state.lastWord}」
          </div>
          <div className="hint">本局合作分：{state.score}</div>
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
