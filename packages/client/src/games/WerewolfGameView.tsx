import { useEffect, useState } from 'react';
import type {
  ClientMessage,
  PlayerId,
  RoomInfo,
  WerewolfRole,
  WerewolfState,
} from '@party-games/shared';
import { AvatarChip, Feed, GameTopBar, PlayerStrip, type ChatLine } from '../components/common';

interface Props {
  state: WerewolfState;
  privateRole: { role: WerewolfRole; word: string } | null;
  room: RoomInfo;
  myId: PlayerId;
  feed: ChatLine[];
  send: (m: ClientMessage) => void;
}

export function WerewolfGameView(props: Props) {
  const { state, privateRole, room, myId, feed, send } = props;
  const [showWord, setShowWord] = useState(true);
  const [voted, setVoted] = useState<PlayerId | null>(null);

  useEffect(() => {
    if (state.phase === 'vote') setVoted(null);
  }, [state.phase]);

  // 系统消息由 App 层的 system 事件驱动更合适，这里只展示状态提示
  const isVoting = state.phase === 'vote';
  const aliveIds = state.alive;
  const dead = room.players.map((p) => p.id).filter((id) => !aliveIds.includes(id));
  const iAmAlive = aliveIds.includes(myId);
  const isHost = room.players.find((p) => p.id === myId)?.isHost;

  return (
    <>
      <GameTopBar room={room} onLeave={() => send({ type: 'leave' })} />
      <div className="game-banner">
        <div style={{ fontWeight: 700 }}>{state.hint}</div>
        <div className="hint">第 {state.round} 轮 · 存活 {aliveIds.length} 人</div>
        {state.lastDeaths && (
          <div style={{ marginTop: 6 }}>
            {state.lastDeaths.map((d) => (
              <span key={d}>
                <AvatarChip avatar={room.players.find((p) => p.id === d)?.avatar ?? 0} name={room.players.find((p) => p.id === d)?.name ?? '?'} dead />
              </span>
            ))}
          </div>
        )}
      </div>

      {privateRole && state.phase !== 'gameover' && (
        <div
          className="word-card"
          style={{ cursor: showWord ? 'pointer' : 'pointer' }}
          onClick={() => setShowWord((v) => !v)}
        >
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 6 }}>
            {privateRole.role === 'werewolf' ? '🕵️ 你是卧底 · 你的词与别人不同' : '🛡️ 你是平民 · 大家拿同一个词'}
            <span style={{ marginLeft: 8 }}>点击{showWord ? '隐藏' : '查看'}</span>
          </div>
          {showWord ? privateRole.word : '？？？'}
        </div>
      )}

      <PlayerStrip room={room} myId={myId} dead={dead} active={state.votedOut ?? undefined} />

      {isVoting && iAmAlive && (
        <div className="vote-grid">
          {aliveIds
            .filter((id) => id !== myId)
            .map((id) => {
              const p = room.players.find((x) => x.id === id)!;
              return (
                <button
                  key={id}
                  className={`vote-btn ${voted === id ? 'selected' : ''}`}
                  onClick={() => {
                    setVoted(id);
                    send({ type: 'vote', target: id });
                  }}
                >
                  {['🐰', '🐱', '🐶', '🦊'][p.avatar % 4]} {p.name}
                </button>
              );
            })}
        </div>
      )}
      {isVoting && iAmAlive && (
        <div style={{ fontSize: 13, color: 'var(--dim)' }}>
          已投 {state.voteCount ?? 0}/{aliveIds.length} 票 · 点击玩家即投票（可改投）
        </div>
      )}
      {isVoting && !iAmAlive && <div className="game-banner" style={{ maxWidth: 420 }}>你已出局，观战模式 🍿</div>}

      {state.phase === 'gameover' && (
        <div className="result-overlay">
          <div className="result-card">
            <div style={{ fontSize: 56 }}>{state.winner === 'werewolf' ? '🕵️' : '🎉'}</div>
            <h2 style={{ margin: '10px 0' }}>{state.winner === 'werewolf' ? '卧底胜利' : '平民胜利'}</h2>
            <p style={{ color: 'var(--dim)', margin: '0 0 18px' }}>{state.winReason}</p>
            {isHost ? (
              <button className="primary" style={{ width: '100%', padding: 12 }} onClick={() => send({ type: 'rematch' })}>
                再来一局
              </button>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--dim)' }}>等待房主发起新一局…</div>
            )}
          </div>
        </div>
      )}

      <Feed lines={feed} input onSend={(t) => send({ type: 'chat', text: t })} />
    </>
  );
}
