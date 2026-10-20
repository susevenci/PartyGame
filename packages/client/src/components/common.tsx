import { useEffect, useRef, useState } from 'react';
import { AVATARS, GAME_META } from '@party-games/shared';
import type { ClientMessage, PlayerId, RoomInfo } from '@party-games/shared';

export function GameTopBar(props: { room: RoomInfo; onLeave: () => void }) {
  const meta = GAME_META[props.room.game];
  return (
    <div className="topbar">
      <span style={{ fontSize: 20 }}>{meta.icon}</span>
      <span className="title">{meta.name}</span>
      <span className="code">{props.room.code}</span>
      <span className="spacer" />
      <button className="ghost" onClick={props.onLeave}>离开</button>
    </div>
  );
}

export function AvatarChip(props: { avatar: number; name: string; dead?: boolean; active?: boolean; self?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', borderRadius: 999,
        background: props.active ? 'linear-gradient(135deg,var(--accent),var(--accent2))' : 'rgba(255,255,255,.08)',
        opacity: props.dead ? 0.4 : 1,
        filter: props.dead ? 'grayscale(1)' : 'none',
        fontSize: 13, fontWeight: 600,
      }}
    >
      <span>{AVATARS[props.avatar] ?? '🙂'}</span>
      {props.name}
      {props.self && <span style={{ fontSize: 11, opacity: 0.8 }}>你</span>}
    </span>
  );
}

export interface ChatLine {
  kind: 'chat' | 'system' | 'card';
  name?: string;
  text: string;
  ts: number;
}

/** 所有游戏视图共用的房间/连接上下文 */
export interface GameViewProps {
  room: RoomInfo;
  myId: PlayerId;
  send: (m: ClientMessage) => void;
  feed: ChatLine[];
}

/** 聊天 + 系统消息滚动区（各游戏共用） */
export function Feed(props: { lines: ChatLine[]; input?: boolean; onSend?: (text: string) => void; disabled?: boolean }) {
  const { lines, input, onSend, disabled } = props;
  const [text, setText] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [lines.length]);
  return (
    <div className="card" style={{ padding: 10 }}>
      <div ref={boxRef} className="chat-box">
        {lines.map((l, i) =>
          l.kind === 'system' || l.kind === 'card' ? (
            <div key={i} className="chat-sys">
              {l.kind === 'card' ? '🃏 ' : ''}{l.text}
            </div>
          ) : (
            <div key={i} className="chat-msg">
              <span className="c-name">{l.name}:</span>
              {l.text}
            </div>
          ),
        )}
      </div>
      {input && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            placeholder="说点什么…"
            maxLength={100}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim() && !disabled) {
                onSend!(text.trim());
                setText('');
              }
            }}
          />
          <button
            className="primary"
            disabled={!text.trim() || disabled}
            onClick={() => {
              onSend!(text.trim());
              setText('');
            }}
          >
            发送
          </button>
        </div>
      )}
    </div>
  );
}

/** 简单的“谁是谁”玩家横排 */
export function PlayerStrip(props: { room: RoomInfo; myId: PlayerId; dead?: PlayerId[]; active?: PlayerId }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
      {props.room.players.map((p) => (
        <AvatarChip
          key={p.id}
          avatar={p.avatar}
          name={p.name}
          self={p.id === props.myId}
          dead={props.dead?.includes(p.id) || !p.connected}
          active={props.active === p.id}
        />
      ))}
    </div>
  );
}
