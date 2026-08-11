import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';

export const useFloorActivity = () => {
  const [activities, setActivities] = useState<any[]>([]);
  const { token } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  // 1. Initialize the Beep Sound
  const playBeep = useCallback(() => {
    const audio = new Audio('/sounds/terminal_beep.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Browser likely blocked autoplay. Requires one user click on page to unlock.
      console.log("Audio feedback pending user interaction.");
    });
  }, []);

  useEffect(() => {
    if (!token) return;

    // 2. Establish Secure WebSocket Link
    const socket = io(import.meta.env.VITE_API_URL.replace('/api/v1', ''), {
      auth: { token },
      transports: ['websocket']
    });

    socket.on('floor_activity', (data) => {
      playBeep(); 
      setActivities(prev => [data, ...prev].slice(0, 50)); // Keep last 50 events
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token, playBeep]);

  return { activities };
};