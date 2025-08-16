import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(baseUrl: string) {
  if (!socket) {
    socket = io(baseUrl, {
      path: '/socket.io',
      transports: ['polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      forceNew: true,
      withCredentials: false,
    });
    socket.on('connect', () => console.log('[WS] connected'));
    socket.on('connect_error', (e) => console.warn('[WS] connect_error', e?.message));
    socket.on('error', (e) => console.warn('[WS] error', e));
  }
  return socket;
}

export function subscribeToCall(baseUrl: string, callId: string, onTranscript: (t: any) => void) {
  const s = getSocket(baseUrl);
  s.emit('subscribe-call', callId);
  const handler = (payload: any) => {
    if (payload?.callId === callId) onTranscript(payload);
  };
  s.on('transcript', handler);
  return () => {
    s.emit('unsubscribe-call', callId);
    s.off('transcript', handler);
  };
}


