import { useEffect, useRef, useCallback } from 'react';

const WS_URL = `ws://${window.location.hostname}:3001`;

export function useSocket({ onMessage, onOpen, onClose }) {
  const wsRef      = useRef(null);
  const timerRef   = useRef(null);
  const mountedRef = useRef(true);
  const cbRef      = useRef({ onMessage, onOpen, onClose });

  // Mantém os callbacks atualizados sem recriar o connect
  useEffect(() => {
    cbRef.current = { onMessage, onOpen, onClose };
  });

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Não abre nova conexão se já tem uma viva
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
      // Reconecta com backoff exponencial
      let delay = 1000;
      timerRef.current = setTimeout(() => {
        delay = Math.min(delay * 2, 15_000);
        connect();
      }, delay);
    };
  }, []); // sem dependências — usa cbRef para callbacks

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
      // Só fecha se não está no meio de conectar
      const ws = wsRef.current;
      if (ws) {
        ws.onclose = null; // impede reconexão no cleanup
        ws.onerror = null;
        if (ws.readyState === WebSocket.OPEN) ws.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { send };
}
