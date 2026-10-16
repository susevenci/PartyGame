import { useCallback, useRef, useState } from 'react';
import { AVATARS, GAME_META } from '@party-games/shared';
import type {
  GameId,
  GameState,
  PlayerId,
  RoomInfo,
  ServerMessage,
} from '@party-games/shared';
import { useSocket } from './net/useSocket';
import { Lobby } from './screens/Lobby';
import { RoomScreen } from './screens/Room';
import { WerewolfGameView } from './games/WerewolfGameView';
import { DrawingGameView } from './games/DrawingGameView';
import { TruthDareGameView } from './games/TruthDareGameView';
import type { ChatLine } from './components/common';

interface MyProfile {
  name: string;
  avatar: number;
}

const PROFILE_KEY = 'party-games-profile';

function loadProfile(): MyProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as MyProfile) : null;
  } catch {
    return null;
  }
}

function defaultGame(): GameId {
  const p = new URLSearchParams(location.search).get('game');
  return p && (GAME_META as Record<string, unknown>)[p] ? (p as GameId) : 'werewolf';
}

export function App() {
  const [profile, setProfile] = useState<MyProfile | null>(loadProfile);
  const [myId, setMyId] = useState<PlayerId | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [privateData, setPrivateData] = useState<ServerMessage & { type: 'game-private' } | null>(null);
  const [feed, setFeed] = useState<ChatLine[]>([]);
  const [drawOps, setDrawOps] = useState<import('@party-games/shared').DrawOp[]>([]);
  const prevRoundRef = useRef<number>(-1);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(0);

  const saveProfile = useCallback((p: MyProfile) => {
    setProfile(p);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const resetGame = useCallback(() => {
    setGame(null);
    setPrivateData(null);
    setFeed([]);
    setDrawOps([]);
    prevRoundRef.current = -1;
  }, []);

  const handleServerMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case 'hello':
          setMyId(msg.playerId);
          setRoom(msg.room);
          break;
        case 'room-update':
          setRoom(msg.room);
          break;
        case 'draw':
          setDrawOps((prev) => [...prev.slice(-300), msg.op]);
          break;
        case 'canvas-clear':
          setDrawOps([]);
          break;
        case 'game-state':
          setGame(msg.state);
          // 新一轮（换画家）时清空画布
          if (msg.state.game === 'drawing') {
            if (prevRoundRef.current !== msg.state.round) {
              prevRoundRef.current = msg.state.round;
              setDrawOps([]);
            }
          }
          break;
        case 'game-private':
          setPrivateData({ type: 'game-private', data: msg.data });
          break;
        case 'chat':
          setFeed((prev) => [...prev.slice(-199), { kind: 'chat', name: msg.name, text: msg.text, ts: msg.ts }]);
          break;
        case 'system':
          setFeed((prev) => [...prev.slice(-199), { kind: 'system', text: msg.text, ts: Date.now() }]);
          break;
        case 'card':
          setFeed((prev) => [...prev.slice(-199), { kind: 'card', text: msg.text, ts: Date.now() }]);
          break;
        case 'error':
          showToast(msg.message);
          break;
        default:
          break;
      }
    },
    [resetGame, showToast],
  );

  const { connected, send } = useSocket(handleServerMessage);

  const inRoom = room !== null && myId !== null;

  // 游戏进行中收到错误提示时不打断画面，仅 toast
  return (
    <div style={{ height: '100%' }}>
      {!connected && (
        <div className="topbar" style={{ margin: '12px auto', maxWidth: 520 }}>
          <span className="badge warn">连接中…</span>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>正在连接服务器，请稍候</span>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}

      {!inRoom ? (
        <Lobby
          profile={profile}
          onProfile={saveProfile}
          defaultGame={defaultGame()}
          onJoin={(code, game, name, avatar) => {
            saveProfile({ name, avatar });
            send({ type: 'join', name, avatar, code, game });
          }}
          connected={connected}
        />
      ) : !game || room!.status !== 'playing' ? (
        <RoomScreen
          room={room!}
          myId={myId!}
          avatars={AVATARS}
          ready={() => send({ type: 'ready', ready: !room!.players.find((p) => p.id === myId)?.ready })}
          onStart={() => send({ type: 'start-game' })}
          onLeave={() => {
            send({ type: 'leave' });
            setMyId(null);
            setRoom(null);
            resetGame();
          }}
          onToast={showToast}
        />
      ) : (
        <GameScreen
          game={game}
          room={room!}
          myId={myId!}
          privateData={privateData}
          feed={feed}
          drawOps={drawOps}
          send={send}
          onLeave={() => {
            send({ type: 'leave' });
            setMyId(null);
            setRoom(null);
            resetGame();
          }}
        />
      )}
    </div>
  );
}

function GameScreen(props: {
  game: GameState;
  room: RoomInfo;
  myId: PlayerId;
  privateData: (ServerMessage & { type: 'game-private' }) | null;
  feed: ChatLine[];
  drawOps: import('@party-games/shared').DrawOp[];
  send: (m: import('@party-games/shared').ClientMessage) => void;
  onLeave: () => void;
}) {
  const { game, room, myId, privateData, feed, drawOps, send, onLeave } = props;
  const common = { room, myId, send, feed };
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {game.game === 'werewolf' && (
        <WerewolfGameView state={game} privateRole={privateData?.data.game === 'werewolf' ? privateData.data : null} {...common} />
      )}
      {game.game === 'drawing' && (
        <DrawingGameView
          state={game}
          privateWord={privateData?.data.game === 'drawing' ? privateData.data.word : null}
          drawOps={drawOps}
          {...common}
        />
      )}
      {game.game === 'truth-dare' && <TruthDareGameView state={game} {...common} />}
      <button className="ghost" style={{ alignSelf: 'center', margin: '8px auto', marginBottom: 'calc(10px + env(safe-area-inset-bottom))' }} onClick={onLeave}>
        退出房间
      </button>
    </div>
  );
}
