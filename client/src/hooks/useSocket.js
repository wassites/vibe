import { useEffect, useRef, useCallback } from 'react';

// Em produção usa o servidor do Render, em dev usa o local
const WS_URL = window.location.hostname === 'localhost'
  ? `ws://${window.location.hostname}:3001`
  : 'wss://vibe-server-dy2z.onrender.com';

export function useSocket({ onMessage, onOpen, onClose }) {
  const wsRef      = useRef(null);
  const timerRef   = useRef(null);
  const mountedRef = useRef(true);
  const cbRef      = useRef({ onMessage, onOpen, onClose });

  useEffect(() => {
    cbRef.current = { onMessage, onOpen, onClose };
  });

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const ws = wsRef.current;
    if (ws && (ws.readyState === WebSocket.CONNECTING ||
               ws.readyState === WebSocket.OPEN)) return;
    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;
    socket.onopen = () => {
      if (!mountedRef.current) { socket.close(); return; }
      timerRef.current && clearTimeout(timerRef.current);
      cbRef.current.onOpen?.();
    };
    socket.onmessage = e => {
      if (!mountedRef.current) return;
      try { cbRef.current.onMessage?.(JSON.parse(e.data)); } catch {}
    };
    socket.onerror = () => {};
    socket.onclose = () => {
      if (!mountedRef.current) return;
      cbRef.current.onClose?.();
      let delay = 1000;
      timerRef.current = setTimeout(() => {
        delay = Math.min(delay * 2, 15_000);
        connect();
      }, delay);
    };
  }, []);

  const send = useCallback((event, data = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, ...data }));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      const ws = wsRef.current;
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        if (ws.readyState === WebSocket.OPEN) ws.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { send };
}
