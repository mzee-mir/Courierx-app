import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';


export const useFloorActivity = () => {
    const [activities, setActivities] = useState<any[]>([]);
    const { token } = useAuthStore();
    const socketRef = useRef<Socket | null>(null);
    const { scannerBeep } = useSettingsStore();


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
            if (scannerBeep) playBeep(); // 👈 Now respects user settings!
            setActivities(prev => [data, ...prev].slice(0, 50));
        });


        socketRef.current = socket;


        return () => {
            socket.disconnect();
        };
    }, [token, playBeep]);


    return { activities };
};
