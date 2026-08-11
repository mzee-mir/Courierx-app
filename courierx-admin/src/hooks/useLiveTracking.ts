import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useLiveTracking = () => {
  const [driverLocations, setDriverLocations] = useState<Record<string, any>>({});

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    // Connect to your local or production backend
    const socket: Socket = io('http://localhost:2026', {
      auth: { token },
      transports: ['websocket']
    });

    socket.on('driver_moved', (data) => {
      setDriverLocations(prev => ({
        ...prev,
        [data.driverId]: {
          lng: data.coordinates[0],
          lat: data.coordinates[1],
          lastSeen: data.timestamp
        }
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { driverLocations };
};