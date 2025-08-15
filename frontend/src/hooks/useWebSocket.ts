import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
}

export const useWebSocket = (url: string): UseWebSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    const socketInstance = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      console.log('WebSocket connecté');
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('WebSocket déconnecté:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // Le serveur a fermé la connexion, tentative de reconnexion
        socketInstance.connect();
      }
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Erreur de connexion WebSocket:', error);
      reconnectAttempts.current += 1;
      
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        setError('Impossible de se connecter au serveur. Vérifiez votre connexion.');
      } else {
        setError(`Tentative de reconnexion (${reconnectAttempts.current}/${maxReconnectAttempts})...`);
      }
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log(`Reconnecté après ${attemptNumber} tentatives`);
      setError(null);
      reconnectAttempts.current = 0;
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('Échec de reconnexion WebSocket');
      setError('Impossible de se reconnecter au serveur.');
    });

    setSocket(socketInstance);

    return () => {
      console.log('Nettoyage de la connexion WebSocket');
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [url]);

  return {
    socket,
    isConnected,
    error,
  };
};
