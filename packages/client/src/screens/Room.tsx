import { useEffect, useState } from 'react';
import { GAME_META } from '@party-games/shared';
import type { PlayerId, RoomInfo } from '@party-games/shared';

export function RoomScreen(props: {
  room: RoomInfo;
  myId: PlayerId;
  avatars: readonly string[];
  ready: () => void;
  onStart: () => void;
  onLeave: () => void;
  onToast: (t: string) => void;
}) {
  const { room, myId, avatars, ready, onStart, onLeave, onToast } = props;
  const [lan, setLan] = useState<string[]>([]);
  const me = room.players.find((p) => p.id === myId);
  const isHost = me?.isHost;
  const meta = GAME_META[room.game];
  const allReady =
    room.players.length >= meta.minPlayers && room.players.every((p) => p.ready || p.id === myId);

  useEffect(() => {
    fetch('/api/lan')
      .then((r) => r.json())
      .then((d: { addresses: string[]; port: number }) => {
        setLan(d.addresses.map((a) => `http://${a}:${d.port}`));
      })
      .catch(() => undefined);
  }, []);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast('已复制到剪贴板');
    } catch {
      onToast('复制失败，请手动长按复制');
    }
  };

  return (
    <div className="screen">
      <div className="topbar">
        <span style={{ fontSize: 22 }}>{meta.icon}</span>
        <span className="title">{meta.name}</span>
        <span className="badge">
          {room.players.length}/{meta.maxPlayers}
        </span>
        <span className="spacer" />
        <button className="ghost" onClick={onLeave}>离开</button>
      </div>

      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--dim)' }}>房间号 · 发给朋友即可加入</div>
        <div
          className="code"
          style={{ fontSize: 40, letterSpacing: 8, cursor: 'pointer', marginTop: 4 }}
          onClick={() => copy(room.code)}
        >
          {room.code}
        </div>
        <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 6 }}>点击房间号复制</div>
        {lan.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.9 }}>
            <div>📶 局域网访问地址（同一 WiFi 手机用）：</div>
            {lan.map((u) => (
              <div
                key={u}
                style={{ fontFamily: 'ui-monospace, monospace', cursor: 'pointer' }}
                onClick={() => copy(u)}
              >
                {u}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 8 }}>
          玩家列表（至少 {meta.minPlayers} 人可开始）
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {room.players.map((p) => (
            <div key={p.id} className={`player-row ${p.id === myId ? 'me' : ''} ${p.connected ? '' : 'offline'}`}>
              <span className="avatar">{avatars[p.avatar] ?? '🙂'}</span>
              <span className="player-name">{p.name}</span>
              <span className="spacer" />
              {p.isHost && <span className="badge">房主</span>}
              {!p.connected && <span className="badge warn">离线</span>}
              {p.ready && <span className="badge ok">已就绪</span>}
            </div>
          ))}
        </div>
      </div>

      {me && (
        <button className="ghost" style={{ maxWidth: 520, width: '100%', padding: 12 }} onClick={ready}>
          {me.ready ? '取消就绪' : '✅ 我准备好了'}
        </button>
      )}

      {isHost && (
        <button
          className="primary"
          style={{ maxWidth: 520, width: '100%', padding: 14, fontSize: 17 }}
          disabled={room.players.length < meta.minPlayers}
          onClick={onStart}
        >
          {room.players.length < meta.minPlayers
            ? `还差 ${meta.minPlayers - room.players.length} 人`
            : '🎮 开始游戏'}
        </button>
      )}
      {isHost && allReady && room.players.length >= meta.minPlayers && (
        <div style={{ fontSize: 12.5, color: 'var(--ok)' }}>大家已就绪，可以开玩啦</div>
      )}
      {!isHost && <div style={{ fontSize: 13, color: 'var(--dim)' }}>等待房主开始游戏……</div>}
    </div>
  );
}
