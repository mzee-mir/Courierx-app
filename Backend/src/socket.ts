// src/socket.ts
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { DriverLocation } from './models/DriverLocation';
import { User } from './models/User';
import { Order } from './models/Order';

export class SocketService {
  public io: Server;

  constructor(server: any) {
    this.io = new Server(server, {
      // ✅ FIX: Strict CORS for development
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      // Allow both polling (fallback) and websocket (speed)
      transports: ['websocket', 'polling'] 
    });

    this.setupMiddleware();
    this.setupHandlers();
  }

  private setupMiddleware() {
    this.io.use((socket: any, next) => {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('AUTHENTICATION_ERROR'));
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        socket.user = decoded;
        next();
      } catch (err) {
        next(new Error('INVALID_TOKEN'));
      }
    });
  }
  

  private setupHandlers() {
  this.io.on('connection', (socket: any) => {
    // 1. Identify User
    const userId = socket.user.userId;
    const roles = socket.user.roles;

    // 2. If Admin, join the God View room
    if (roles.includes('admin')) {
      socket.join('admin_god_view');
      console.log(`ADMIN_GOD_VIEW: Admin ${userId} joined`);
    }

    socket.join(userId);

    socket.on('emergency_sos', async (data: { orderId?: string, location: [number, number] }) => {
    const userId = socket.user.userId;

    const [driver, order] = await Promise.all([
    User.findById(userId).select('displayName phoneNumber'),
    Order.findOne({ 
      _id: data.orderId, 
      status: { $in: ['ACCEPTED', 'PICKED_UP', 'ARRIVED'] } 
    }).populate('customerId', 'displayName phoneNumber')
    ]);

    // 2. Broadcast "RED ALERT" to all Admins
    this.io.to('admin_god_view').emit('sos_alert', {
      driver,
      order,
      location: data.location,
      timestamp: new Date()
    });

    console.log(`🚨 SOS_TRIGGERED: Driver ${userId} at ${data.location}`);
  });

    // 3. When a driver moves, broadcast to all Admins
    socket.on('update_location', async (data: { coordinates: [number, number] }) => {
      // Update DB (as you already do)
      // ... (your existing update logic)

      // Emit to Admins
      this.io.to('admin_god_view').emit('driver_moved', {
        driverId: userId,
        coordinates: data.coordinates,
        timestamp: new Date()
      });
    });

      socket.on('disconnect', () => {
        console.log(`REALTIME_DISCONNECTED: User ${socket.user.userId}`);
      });
    });
  }

  /**
   * ✅ This is an INSTANCE method. 
   * It needs to be called on a created instance of SocketService.
   */
  public broadcastNewOrder(driverIds: string[], orderData: any) {
    console.log(`SOCKET_EMIT: Broadcasting job to ${driverIds.length} drivers`);
    driverIds.forEach(id => {
      this.io.to(id).emit('new_order_available', orderData);
    });
  }
}