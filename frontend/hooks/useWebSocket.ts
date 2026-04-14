import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  job_id: string;
  timestamp: string;
  [key: string]: any;
}

export function useWebSocket(jobId: string | null) {
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!jobId) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001/ws';
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
      setError(null);
      
      const token = localStorage.getItem('orion_token');
      ws.current?.send(JSON.stringify({
        type: 'SUBSCRIBE',
        job_id: jobId,
        token: token
      }));
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'ERROR') {
          setError(message.message);
        } else {
          setMessages((prev) => [...prev, message]);
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    ws.current.onerror = () => {
      setError('WebSocket connection error');
    };

    ws.current.onclose = () => {
      setIsConnected(false);
    };
  }, [jobId]);

  useEffect(() => {
    connect();
    return () => {
      ws.current?.close();
    };
  }, [connect]);

  return { messages, isConnected, error };
}
