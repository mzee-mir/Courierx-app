// src/socket.ts
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User, UserRole } from './models/User';
import { Order } from './models/Order';

// How often a live socket re-validates the user against the DB (suspension/role/version).
const SOCKET_REVALIDATE_MS = 30_000;

// Roles that are granted access to the admin "god view" room.
export const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.OPS_ADMIN,
  UserRole.FINANCE_ADMIN,
  UserRole.SUPPORT_ADMIN,
];

export const hasAdminRole = (roles: (string | UserRole)[]): boolean =>
  roles.some(r => ADMIN_ROLES.includes(r as UserRole));

export const isDriverRole = (roles: (string | UserRole)[]): boolean =>
  roles.includes(UserRole.DRIVER);

/**
 * Sliding-window rate limiter keyed by userId.
 * Used to prevent SOS spam.
 */
export class SosRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number
  ) {}

  public allow(userId: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(userId) || []).filter(t => t > cutoff);

    if (recent.length >= this.max) {
      this.hits.set(userId, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(userId, recent);
    return true;
  }
}

export class SocketService {
  public io: Server;

  constructor(server: any) {
    this.io = new Server(server, {
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

  /**
   * Re-validates the connecting/reconnecting user against DB truth:
   *  - user must still exist
   *  - must not be suspended
   *  - tokenVersion must match (session invalidation)
   * Also refreshes socket.user.roles with fresh DB roles so room grants reflect reality.
   */
  private async validateActiveUser(socket: any): Promise<boolean> {
    const decoded = socket.user as { userId: string; version?: number };
    const user = await User.findById(decoded.userId)
      .select('isSuspended roles tokenVersion')
      .lean();

    if (!user || user.isSuspended) return false;

    const tokenVersion = decoded.version ?? 0;
    if (user.tokenVersion !== tokenVersion) return false;

    socket.user = { ...decoded, roles: user.roles, version: user.tokenVersion };
    return true;
  }

  private setupMiddleware() {
    this.io.use(async (socket: any, next) => {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('AUTHENTICATION_ERROR'));

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        socket.user = decoded;
      } catch (err) {
        return next(new Error('INVALID_TOKEN'));
      }

      try {
        const active = await this.validateActiveUser(socket);
        if (!active) return next(new Error('AUTH_SESSION_REVOKED'));
        next();
      } catch (err) {
        next(new Error('SESSION_REVALIDATION_FAILED'));
      }
    });
  }

  private setupHandlers() {
    this.io.on('connection', (socket: any) => {
      // 1. Identify User
      const userId = socket.user.userId;
      const roles = socket.user.roles;

      // 2. If Admin, join the God View room (any admin role intersection)
      if (hasAdminRole(roles)) {
        socket.join('admin_god_view');
        console.log(`ADMIN_GOD_VIEW: Admin ${userId} joined`);
      }

      socket.join(userId);

      const sosLimiter = new SosRateLimiter(3, 10 * 60 * 1000);

      socket.on('emergency_sos', async (data: { orderId?: string, location: [number, number] }) => {
        // M4c: SOS is restricted to drivers and rate-limited
        if (!isDriverRole(socket.user.roles)) {
          socket.emit('sos_rejected', { error: 'FORBIDDEN', reason: 'Only drivers may trigger an SOS.' });
          return;
        }

        if (!sosLimiter.allow(userId)) {
          socket.emit('sos_rejected', {
            error: 'SOS_RATE_LIMITED',
            reason: 'Too many SOS alerts. Please wait before sending another.'
          });
          return;
        }

        try {
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
        } catch (err: any) {
          console.error(`[socket] SOS handler failed for ${userId}:`, err.message);
        }
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

      // 4. Periodic revalidation — kick suspended/revoked users promptly
      const interval = setInterval(async () => {
        try {
          const active = await this.validateActiveUser(socket);
          if (!active) {
            socket.emit('session_revoked', { error: 'AUTH_SESSION_REVOKED' });
            socket.disconnect(true);
          }
        } catch (err: any) {
          console.error(`[socket] Revalidation failed for ${userId}:`, err.message);
        }
      }, SOCKET_REVALIDATE_MS);

      socket.on('disconnect', () => {
        clearInterval(interval);
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

  /**
   * Emits a targeted 15-second offer to a specific candidate driver.
   */
  public emitNewOrderOffer(driverId: string, offerData: any) {
    console.log(`SOCKET_EMIT: Sending targeted offer for Order ${offerData.orderId} to Driver ${driverId}`);
    this.io.to(driverId).emit('new_order_offer', offerData);
  }

  /**
   * Emits offer_cancelled to sibling drivers when an offer was accepted by another operator.
   */
  public emitOfferCancelled(driverIds: string[], data: { orderId: string }) {
    console.log(`SOCKET_EMIT: Cancelling offer for Order ${data.orderId} for ${driverIds.length} sibling drivers`);
    driverIds.forEach(id => {
      this.io.to(id).emit('offer_cancelled', data);
    });
  }

  /**
   * Emits order_dispatch_exhausted to the customer with refund confirmation.
   */
  public emitDispatchExhausted(customerId: string, data: { orderId: string; refundedAmount: number }) {
    console.log(`SOCKET_EMIT: Dispatch exhausted for Order ${data.orderId}, notifying Customer ${customerId}`);
    this.io.to(customerId).emit('order_dispatch_exhausted', data);
  }

  /**
   * Emits round progression update to the customer.
   */
  public emitDispatchRoundUpdate(customerId: string, data: { orderId: string; roundNumber: number }) {
    this.io.to(customerId).emit('order_dispatch_round', data);
  }
}
