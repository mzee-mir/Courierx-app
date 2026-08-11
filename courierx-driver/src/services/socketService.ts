import { io, Socket } from 'socket.io-client';
import { authEventEmitter } from '../api/client';
import { storage } from '../utils/storage';

class SocketService {
  public socket: Socket | null = null;

  async connect(onStatusChange?: (connected: boolean) => void) {
    if (this.socket?.connected) {
      if (onStatusChange) onStatusChange(true);
      return;
    }

    const { token } = await storage.getAuth();
    if (!token) return;

    // Logic: Strip /api/v1 and spaces to find the root Render URL
    const rawUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || "";
    const socketUrl = rawUrl.replace('/api/v1', '');

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'], // Mandatory for Render/Somalia
      reconnection: true,
      reconnectionAttempts: Infinity,
    });

    this.socket.on('connect', () => {
      console.log('REALTIME_SYSTEM: Connected');
      if (onStatusChange) onStatusChange(true);
    });

    this.socket.on('disconnect', () => {
      if (onStatusChange) onStatusChange(false);
    });

    this.socket.on('connect_error', (err) => {
      if (err.message === 'AUTHENTICATION_ERROR') {
        authEventEmitter.emit('UNAUTHORIZED_ACCESS');
      }
      if (onStatusChange) onStatusChange(false);
    });
  }

  joinOrder(orderId: string) {
    this.socket?.emit('join_order_room', { orderId });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();