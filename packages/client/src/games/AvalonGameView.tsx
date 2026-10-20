import type { AvalonPrivate, AvalonRole, AvalonState } from '@party-games/shared';
import { Feed, GameTopBar, type GameViewProps } from '../components/common';

interface Props extends GameViewProps {
  state: AvalonState;
  privateData: AvalonPrivate | null;
}

const ROLE_NAME: Record<AvalonRole, string> = {
  merlin: '梅林',
  assassin: '刺客',
  minion: '爪牙',
  loyal: '忠臣',
};

export function AvalonGameView(props: Props) {
  const { state, privateData, room, myId, send, feed } = props;
  const isHost = room.players.find((p) => p.id === myId)?.isHost;
  const role = privateData?.role;
  const isLeader = state.leader === myId;
  const inTeam = state.proposedTeam.includes(myId);
  const evilIds = privateData && 'evilIds' in privateData ? privateData.evilIds : [];

  return (
    <>
      <GameTopBar room={room} onLeave={() => send({ type: 'leave' })} />
      <div className="game-banner">
        <div style={{ fontWeight: 700 }}>{state.hint}</div>
        <div className="hint">
          第 {state.round}/5 轮 · 需要 {state.teamSize} 人 · 连续否决 {state.rejectStreak}/5
        </div>
      </div>

      {privateData && (
        <div className="role-card">
          <span>
            你的身份：<b>{role ? ROLE_NAME[role] : '?'}</b>
          </span>
          {evilIds.length > 0 && (
            <span style={{ color: 'var(--warn)', fontSize: 13 }}>
              坏人：{evilIds.map((id) => room.players.find((p) => p.id === id)?.name ?? '?').join('、')}
            </span>
          )}
        </div>
      )}

      <div className="quest-track">
        {Array.from({ length: 5 }).map((_, i) => {
          const result = state.questResults[i];
          return (
            <span key={i} className={`quest-slot ${result ?? 'pending'}`}>
              {result === 'success' ? '✅' : result === 'fail' ? '💥' : `${i + 1}`}
            </span>
          );
        })}
      </div>

      {state.proposedTeam.length > 0 && state.phase !== 'gameover' && (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>当前队伍（队长 {room.players.find((p) => p.id === state.leader)?.name}）</div>
          <div className="clue-row" style={{ marginTop: 8 }}>
            {state.proposedTeam.map((id) => (
              <span key={id} className="clue-chip">
                {room.players.find((p) => p.id === id)?.name ?? '?'}
              </span>
            ))}
          </div>
        </div>
      )}

      {state.phase === 'propose' && isLeader && (
        <>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>
            点选 {state.teamSize} 人组队（已选 {state.proposedTeam.length}）
          </div>
          <div className="vote-grid">
            {room.players.map((p) => (
              <button
                key={p.id}
                className={`vote-btn ${state.proposedTeam.includes(p.id) ? 'selected' : ''}`}
                onClick={() => send({ type: 'toggle', value: p.id })}
              >
                {p.name}
              </button>
            ))}
          </div>
          <button
            className="primary"
            style={{ maxWidth: 520, width: '100%' }}
            disabled={state.proposedTeam.length !== state.teamSize}
            onClick={() => send({ type: 'submit-team' })}
          >
            提交队伍
          </button>
        </>
      )}

      {state.phase === 'propose' && !isLeader && (
        <div style={{ fontSize: 13, color: 'var(--dim)' }}>等待队长组队…</div>
      )}

      {state.phase === 'vote' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>
            投票是否同意（已投 {state.voteCount}/{room.players.length}）
          </div>
          <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 520 }}>
            <button className="primary" style={{ flex: 1, padding: 14 }} onClick={() => send({ type: 'vote-team', approve: true })}>
              👍 同意
            </button>
            <button className="ghost" style={{ flex: 1, padding: 14 }} onClick={() => send({ type: 'vote-team', approve: false })}>
              👎 否决
            </button>
          </div>
        </>
      )}

      {state.phase === 'quest' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>
            本轮需要 {state.failNeeded} 张失败票 · 任务成员秘密投票
          </div>
          {inTeam ? (
            <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 520 }}>
              <button className="primary" style={{ flex: 1, padding: 14 }} onClick={() => send({ type: 'quest-vote', success: true })}>
                ✅ 成功
              </button>
              <button className="ghost" style={{ flex: 1, padding: 14 }} onClick={() => send({ type: 'quest-vote', success: false })}>
                💥 破坏
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>你不在任务队伍中，等待结果…</div>
          )}
        </>
      )}

      {state.phase === 'assassinate' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>
            {role === 'assassin' ? '你是刺客：选出梅林' : '等待刺客行动…'}
          </div>
          {role === 'assassin' && (
            <div className="vote-grid">
              {room.players
                .filter((p) => p.id !== myId)
                .map((p) => (
                  <button key={p.id} className="vote-btn" onClick={() => send({ type: 'assassinate', target: p.id })}>
                    {p.name}
                  </button>
                ))}
            </div>
          )}
        </>
      )}

      {state.phase === 'gameover' && (
        <div className="result-overlay">
          <div className="result-card">
            <div style={{ fontSize: 54 }}>{state.winner === 'evil' ? '⚔️' : '🛡️'}</div>
            <h2 style={{ margin: '10px 0' }}>{state.winner === 'evil' ? '坏人胜利' : '好人胜利'}</h2>
            <p style={{ color: 'var(--dim)', margin: '0 0 12px' }}>{state.winReason}</p>
            {state.revealedRoles && (
              <div className="clue-row" style={{ marginBottom: 14 }}>
                {room.players.map((p) => {
                  const revealed = state.revealedRoles?.[p.id];
                  return (
                    <span key={p.id} className="clue-chip">
                      {p.name}：{revealed ? ROLE_NAME[revealed] : '?'}
                    </span>
                  );
                })}
              </div>
            )}
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
