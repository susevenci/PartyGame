import { useEffect, useState } from 'react';
import type { WavelengthPrivate, WavelengthState } from '@party-games/shared';
import { Feed, GameTopBar, type GameViewProps } from '../components/common';

interface Props extends GameViewProps {
  state: WavelengthState;
  privateData: WavelengthPrivate | null;
}

export function WavelengthGameView(props: Props) {
  const { state, privateData, room, myId, send, feed } = props;
  const [clue, setClue] = useState('');
  const [value, setValue] = useState(50);
  const isHost = room.players.find((p) => p.id === myId)?.isHost;
  const isPsychic = state.psychic === myId;
  const target = privateData?.role === 'psychic' ? privateData.target : null;
  const psychicName = room.players.find((p) => p.id === state.psychic)?.name ?? '主持人';

  useEffect(() => {
    setClue('');
    setValue(50);
  }, [state.round]);

  return (
    <>
      <GameTopBar room={room} onLeave={() => send({ type: 'leave' })} />
      <div className="game-banner">
        <div style={{ fontWeight: 700 }}>{state.hint}</div>
        <div className="hint">
          第 {state.round}/{state.totalRounds} 轮 · 主持人是 {psychicName}
        </div>
      </div>

      <div className="spectrum">
        <div className="spectrum-labels">
          <span>{state.spectrum.left}</span>
          <span>{state.spectrum.right}</span>
        </div>
        <div className="spectrum-bar" />
        {target !== null && state.phase === 'clue' && (
          <div className="spectrum-target">🎯 目标：{target}</div>
        )}
        {state.clue && <div className="spectrum-clue">线索：「{state.clue}」</div>}
      </div>

      {state.phase === 'clue' && isPsychic && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 8 }}>
            写一句线索，让大家猜到这个位置（目标 {target}）
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="一句话线索…"
              value={clue}
              maxLength={20}
              onChange={(e) => setClue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && clue.trim()) send({ type: 'submit', value: clue.trim() });
              }}
            />
            <button className="primary" disabled={!clue.trim()} onClick={() => send({ type: 'submit', value: clue.trim() })}>
              给出
            </button>
          </div>
        </div>
      )}

      {state.phase === 'guess' && !isPsychic && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 8 }}>
            拖动滑杆选择位置（已提交 {state.guessCount ?? 0}/{room.players.length - 1}）
          </div>
          <input
            className="slider"
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{value}</span>
            <span className="spacer" />
            <button className="primary" onClick={() => send({ type: 'submit', value: String(value) })}>
              锁定 {value}
            </button>
          </div>
        </div>
      )}

      {(state.phase === 'reveal' || state.phase === 'gameover') && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            🎯 目标是 {state.target}
          </div>
          {(state.results ?? []).map((r, i) => (
            <div key={`${r.name}-${i}`} className="result-row">
              <span>{r.name}</span>
              <span style={{ color: 'var(--dim)' }}>落点 {r.value} · 差 {r.distance}</span>
              <span style={{ color: r.score > 0 ? 'var(--ok)' : 'var(--dim)' }}>+{r.score}</span>
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
