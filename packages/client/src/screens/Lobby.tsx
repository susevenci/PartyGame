import { useState } from 'react';
import { AVATARS, GAME_LIST } from '@party-games/shared';
import type { GameId } from '@party-games/shared';

export function Lobby(props: {
  profile: { name: string; avatar: number } | null;
  onProfile: (p: { name: string; avatar: number }) => void;
  defaultGame: GameId;
  onJoin: (code: string, game: GameId, name: string, avatar: number) => void;
  connected: boolean;
}) {
  const { profile, onProfile, defaultGame, onJoin, connected } = props;
  const [name, setName] = useState(profile?.name ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? Math.floor(Math.random() * AVATARS.length));
  const [game, setGame] = useState<GameId>(defaultGame);
  const [code, setCode] = useState('');

  const pick = (n: string, a: number) => {
    onProfile({ name: n, avatar: a });
  };

  return (
    <div className="screen">
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <div style={{ fontSize: 44 }}>🎉</div>
        <h1 style={{ margin: '8px 0 0' }}>聚会小游戏</h1>
        <p style={{ color: 'var(--dim)', margin: '6px 0 0', fontSize: 14 }}>
          和朋友、和 TA，随时随地开一局
        </p>
      </div>

      <div className="card">
        <label style={{ fontSize: 13, color: 'var(--dim)' }}>你的昵称</label>
        <input
          maxLength={12}
          placeholder="给自己起个名字"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            pick(e.target.value, avatar);
          }}
        />
        <label style={{ display: 'block', margin: '12px 0 6px', fontSize: 13, color: 'var(--dim)' }}>
          选个头像
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
          {AVATARS.map((a, i) => (
            <button
              key={a}
              className={i === avatar ? 'primary' : ''}
              style={{ borderRadius: '50%', padding: 6, fontSize: 20 }}
              onClick={() => {
                setAvatar(i);
                pick(name, i);
              }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <label style={{ fontSize: 13, color: 'var(--dim)' }}>选一个游戏</label>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {GAME_LIST.map((g) => (
            <button
              key={g.id}
              className={game === g.id ? 'primary' : ''}
              style={{ textAlign: 'left', padding: 12 }}
              onClick={() => setGame(g.id)}
            >
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {g.icon} {g.name}
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{g.tagline}</div>
            </button>
          ))}
        </div>
        <ul style={{ fontSize: 12.5, color: 'var(--dim)', margin: '12px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
          {GAME_LIST.find((g) => g.id === game)?.howToPlay.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <button
          className="primary"
          style={{ width: '100%', padding: 14, fontSize: 17 }}
          disabled={!connected || !name.trim()}
          onClick={() => onJoin('', game, name.trim(), avatar)}
        >
          🚀 创建房间
        </button>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            placeholder="输入 6 位房间号加入"
            value={code}
            maxLength={6}
            style={{
              textTransform: 'uppercase',
              letterSpacing: 3,
              fontFamily: 'ui-monospace, monospace',
            }}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
          <button
            className="ghost"
            disabled={!connected || code.length !== 6 || !name.trim()}
            onClick={() => onJoin(code, game, name.trim(), avatar)}
          >
            加入
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--dim)', margin: '10px 0 0' }}>
          💡 加入时游戏以房主选择为准；同一 WiFi 下手机直接访问电脑显示的局域网地址即可。
        </p>
      </div>
    </div>
  );
}
