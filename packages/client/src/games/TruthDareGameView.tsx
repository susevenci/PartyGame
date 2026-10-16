import { useEffect, useState } from 'react';
import type {
  ClientMessage,
  PlayerId,
  RoomInfo,
  TruthDareState,
} from '@party-games/shared';
import { Feed, GameTopBar, PlayerStrip, type ChatLine } from '../components/common';

interface Props {
  state: TruthDareState;
  room: RoomInfo;
  myId: PlayerId;
  feed: ChatLine[];
  send: (m: ClientMessage) => void;
}

export function TruthDareGameView(props: Props) {
  const { state, room, myId, feed, send } = props;
  const [report, setReport] = useState('');
  const current = room.players.find((p) => p.id === state.current);
  const isActor = state.current === myId;
  const isHost = room.players.find((p) => p.id === myId)?.isHost;
  const canReport = isActor || isHost;
  const lastCard = [...feed].reverse().find((l) => l.kind === 'card');

  useEffect(() => {
    setReport('');
  }, [state.current, state.round]);

  const submit = () => {
    const t = report.trim();
    if (!t) return;
    send({ type: 'report-result', value: t.slice(0, 50) });
    setReport('');
  };

  const acting = state.phase === 'acting' || state.phase === 'reporting';

  return (
    <>
      <GameTopBar room={room} onLeave={() => send({ type: 'leave' })} />

      <div className="game-banner">
        <div style={{ fontSize: 13, color: 'var(--dim)' }}>第 {state.round} 圈 · 第 {state.turn} 人</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
          🎯 {current?.name ?? '?'} 的回合
        </div>
      </div>

      {/* 当前抽到的卡 */}
      {lastCard && (
        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 8 }}>
            {lastCard.text.startsWith('【真心话】') ? '💬 真心话' : '🔥 大冒险'}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.7 }}>
            {lastCard.text.replace('【真心话】', '').replace('【大冒险】', '')}
          </div>
        </div>
      )}

      {acting && canReport && (
        <div className="card">
          <label style={{ fontSize: 13, color: 'var(--dim)' }}>
            {isActor ? '完成后填写你的结果（让全场围观）：' : `你是房主，可代 ${current?.name} 填写结果：`}
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              placeholder="例如：我唱了半句情歌被笑了…"
              maxLength={50}
              value={report}
              onChange={(e) => setReport(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <button className="primary" disabled={!report.trim()} onClick={submit}>
              提交
            </button>
          </div>
          <button className="ghost" style={{ marginTop: 8, width: '100%' }} onClick={() => send({ type: 'end-turn' })}>
            跳过这一轮
          </button>
        </div>
      )}
      {acting && !canReport && (
        <div className="game-banner" style={{ maxWidth: 420 }}>
          等 {current?.name} 表演中，倒计时 60 秒…
        </div>
      )}

      {state.phase === 'round-result' && state.reports.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 8 }}>📣 本轮结果</div>
          {state.reports.map((r, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
              <b>{r.name}：</b>
              {r.text}
            </div>
          ))}
        </div>
      )}

      <PlayerStrip room={room} myId={myId} active={state.current} />

      {/* 翻牌回顾 */}
      {state.history.length > 0 && (
        <details className="card" style={{ fontSize: 13.5 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--dim)' }}>📜 翻牌回顾（{state.history.length}）</summary>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {[...state.history].reverse().map((h, i) => (
              <div key={i} style={{ lineHeight: 1.6 }}>
                <b>{h.name}</b> — {h.card}
                <div style={{ color: 'var(--dim)' }}>↳ {h.result}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      <Feed lines={feed} input onSend={(t) => send({ type: 'chat', text: t })} />

      {isHost && (
        <button className="ghost" style={{ maxWidth: 520, width: '100%' }} onClick={() => send({ type: 'finish-game' })}>
          ⏹️ 结束本局
        </button>
      )}
    </>
  );
}
