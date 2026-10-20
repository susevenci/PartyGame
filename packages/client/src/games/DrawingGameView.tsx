import { useState } from 'react';
import type {
  ClientMessage,
  DrawOp,
  DrawingState,
  PlayerId,
  RoomInfo,
} from '@party-games/shared';
import { CanvasBoard } from '../components/CanvasBoard';
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
