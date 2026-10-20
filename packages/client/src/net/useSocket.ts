import { useEffect, useRef, useState, useCallback } from 'react';
import type { ClientMessage, ServerMessage } from '@party-games/shared';

type Handler = (msg: ServerMessage) => void;

/**
 * 轻量 WebSocket 客户端：自动重连（1s 起步，最多 10s），
 * 重连后由调用方通过 onOpen 重新 join 房间。
 */
export function useSocket(onMessage: Handler) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const retryTimer = useRef(0);
  const disposed = useRef(false);
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => {
      retryRef.current = 0;
      setConnected(true);
    };
    ws.onmessage = (ev) => {
      try {
        handlerRef.current(JSON.parse(String(ev.data)) as ServerMessage);
      } catch {
        /* ignore bad frame */
      }
    };
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      if (disposed.current) return;
      const delay = Math.min(1000 * 2 ** retryRef.current++, 10000);
      retryTimer.current = window.setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    disposed.current = false;
    connect();
    return () => {
      disposed.current = true;
      window.clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { connected, send, reconnect: connect };
}
