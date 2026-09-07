import { useEffect, useRef, useState } from 'react';
import type { WSServerMessage } from '@tolti/contracts';

export type WSEvent = WSServerMessage & { ts: string; _id: string };

export function useTaskSocket(taskId: string | null, enabled: boolean = true) {
    const [connected, setConnected] = useState(false);
    const [events, setEvents] = useState<WSEvent[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const pingRef = useRef<number | null>(null);

    useEffect(() => {
        if (!taskId || !enabled) return;
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${proto}//${location.host}/ws/tasks/${taskId}?token=${encodeURIComponent(localStorage.getItem('tolti.access') ?? '')}`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            pingRef.current = window.setInterval(() => {
                try { ws.send(JSON.stringify({ type: 'ping', payload: { ts: Date.now() } })); } catch { /* */ }
            }, 25_000);
        };
        ws.onclose = () => {
            setConnected(false);
            if (pingRef.current) window.clearInterval(pingRef.current);
        };
        ws.onmessage = (ev) => {
            try {
                const env = JSON.parse(ev.data) as WSEvent;
                setEvents((cur) => [...cur, env].slice(-500));
            } catch { /* ignore */ }
        };
        ws.onerror = () => setConnected(false);

        return () => {
            ws.close();
            if (pingRef.current) window.clearInterval(pingRef.current);
            wsRef.current = null;
        };
    }, [taskId, enabled]);

    function send(msg: unknown) {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    }

    return { connected, events, send };
}
