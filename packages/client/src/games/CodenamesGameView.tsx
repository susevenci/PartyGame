import { useState } from 'react';
import type { CodenameColor, CodenamesPrivate, CodenamesState } from '@party-games/shared';
import { Feed, GameTopBar, type GameViewProps } from '../components/common';

interface Props extends GameViewProps {
  state: CodenamesState;
  privateData: CodenamesPrivate | null;
}

const COLOR_BG: Record<CodenameColor, string> = {
  red: '#b91c1c',
  blue: '#1d4ed8',
  neutral: '#6b7280',
  assassin: '#111827',
};

const KEY_BORDER: Record<CodenameColor, string> = {
  red: '#f87171',
  blue: '#60a5fa',
  neutral: '#9ca3af',
  assassin: '#fbbf24',
};

export function CodenamesGameView(props: Props) {
  const { state, privateData, room, myId, send, feed } = props;
  const [word, setWord] = useState('');
  const [count, setCount] = useState(1);
  const isHost = room.players.find((p) => p.id === myId)?.isHost;
  const myTeam = privateData?.team;
  const isSpymaster = privateData?.spymaster === true;
  const isMyTurn = myTeam === state.turn;
  const canClue = isMyTurn && isSpymaster && state.phase === 'clue';
  const canGuess = isMyTurn && !isSpymaster && state.phase === 'guess';
  const key = privateData?.key;

  const submitClue = () => {
    const value = word.trim();
    if (!value) return;
    send({ type: 'codename-clue', word: value, count });
    setWord('');
  };

  return (
    <>
      <GameTopBar room={room} onLeave={() => send({ type: 'leave' })} />
      <div className="game-banner">
        <div style={{ fontWeight: 700 }}>{state.hint}</div>
        <div className="hint">
          {state.turn === 'red' ? '🔴 红队回合' : '🔵 蓝队回合'} · 剩余 🔴{state.remaining.red} / 🔵{state.remaining.blue}
          {state.clue ? ` · 线索「${state.clue.word}」${state.clue.count}` : ''}
        </div>
      </div>

      {privateData && (
        <div className="role-card">
          <span>
            你是 {myTeam === 'red' ? '🔴 红队' : '🔵 蓝队'} 的{isSpymaster ? '队长（能看到颜色）' : '队员'}
          </span>
          {isSpymaster && <span className="badge">还剩 {state.guessesLeft} 次猜测</span>}
        </div>
      )}

      <div className="codename-grid">
        {state.cards.map((card, i) => {
          const revealed = card.revealedTeam;
          const keyColor = key?.[i];
          const clickable = canGuess && !revealed;
          return (
            <button
              key={card.id}
              className={`codename-card ${revealed ? 'revealed' : ''}`}
              style={{
                background: revealed ? COLOR_BG[revealed] : 'rgba(255,255,255,.09)',
                borderColor: !revealed && keyColor ? KEY_BORDER[keyColor] : 'transparent',
                opacity: revealed === 'neutral' ? 0.55 : 1,
                cursor: clickable ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (clickable) send({ type: 'choose', value: card.id });
              }}
            >
              {card.word}
            </button>
          );
        })}
      </div>

      {canClue && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 8 }}>
            给一个线索词 + 数量（队员最多猜「数量 + 1」次）
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="线索词…"
              value={word}
              maxLength={12}
              onChange={(e) => setWord(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitClue()}
            />
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              style={{ width: 80, borderRadius: 12, background: 'rgba(0,0,0,.25)', color: 'var(--text)', border: '1px solid var(--line)' }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button className="primary" disabled={!word.trim()} onClick={submitClue}>
              给出
            </button>
          </div>
        </div>
      )}

      {isMyTurn && isSpymaster && state.phase === 'guess' && (
        <button className="ghost" style={{ maxWidth: 520, width: '100%' }} onClick={() => send({ type: 'end-turn' })}>
          结束本轮猜词
        </button>
      )}

      {isMyTurn && !isSpymaster && state.phase === 'guess' && (
        <div style={{ fontSize: 13, color: 'var(--dim)' }}>点击词卡猜词（还能猜 {state.guessesLeft} 次）</div>
      )}

      {state.phase === 'gameover' && (
        <div className="result-overlay">
          <div className="result-card">
            <div style={{ fontSize: 54 }}>{state.winner === 'red' ? '🔴' : '🔵'}</div>
            <h2 style={{ margin: '10px 0' }}>{state.winner === 'red' ? '红队胜利' : '蓝队胜利'}</h2>
            <p style={{ color: 'var(--dim)', margin: '0 0 18px' }}>{state.winReason}</p>
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
