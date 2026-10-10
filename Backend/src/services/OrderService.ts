// services/OrderService.ts
import mongoose from 'mongoose';
import { Order, IOrder } from '../models/Order';
import { Wallet } from '../models/Wallet';
import { Transaction } from '../models/Transaction';
import { OrderStatus, VehicleType } from '../enums/OrderEnums';
import { ORDER_FSM } from '../config/stateMachine';
import { WalletService } from './WalletService';
import { InternalAccount } from '../config/accounts';
import { LandmarkService } from './LandmarkService';

export class OrderService {
  /**
   * Generates a secure 4-digit PIN for the recipient.
   * This is stored on the order but never sent to the driver's app.
   */
  public static generatePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Calculates the great-circle distance (km) between two GPS points using the
   * haversine formula. Server-side only — the client never supplies distance.
   */
  public static haversineKm(a: [number, number], b: [number, number]): number {
    const [lon1, lat1] = a;
    const [lon2, lat2] = b;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  /**
   * Calculates pricing from GPS coordinates.
   * Distance is computed server-side; client-supplied distanceKm is never trusted.
   */
  public static calculatePricingForOrder(
    vehicleType: VehicleType,
    pickupCoords: [number, number],
    dropoffCoords: [number, number]
  ) {
    const distanceKm = this.haversineKm(pickupCoords, dropoffCoords);
    const pricing = this.calculatePricing(vehicleType, distanceKm);
    return { ...pricing, distanceKm: Number(distanceKm.toFixed(2)) };
  }

  /**
   * Calculates pricing based on vehicle type and distance.
   * Rates are defined server-side to prevent client-side manipulation.
   */
  public static calculatePricing(vehicleType: VehicleType, distanceKm: number) {
    const rates = {
      [VehicleType.BAJAJ]: 0.5, // $0.50 per km
      [VehicleType.CAR]: 1.0,   // $1.00 per km
      [VehicleType.TRUCK]: 2.5, // $2.50 per km
    };

    const baseFare = 1.0;
    const price = baseFare + (rates[vehicleType] * distanceKm);
    const commission = price * 0.15; // 15% platform commission

    return {
      price: Number(price.toFixed(2)),
      commission: Number(commission.toFixed(2))
    };
  }

  /**
   * Creates an order in PENDING state.
   * Pricing is computed server-side from the supplied coordinates.
   */
  public static async createOrder(data: {
    customerId: string;
    pickupLocation: { type: 'Point'; coordinates: [number, number] };
    pickupLandmark: string;
    dropoffLocation: { type: 'Point'; coordinates: [number, number] };
    dropoffLandmark: string;
    vehicleType: VehicleType;
  }): Promise<IOrder> {
    const { price, commission } = this.calculatePricingForOrder(
      data.vehicleType,
      data.pickupLocation.coordinates,
      data.dropoffLocation.coordinates
    );
    const verificationPin = this.generatePin();

    const order = await Order.create({
      ...data,
      price,
      commission,
      verificationPin,
      status: OrderStatus.PENDING,
      paymentSettled: false,
    });

    return this.sanitizeOrder(order);
  }

  /**
   * Manages lifecycle transitions with a strict finite state machine.
   */
  public static async transitionStatus(data: {
    orderId: string;
    currentStatus: OrderStatus;
    newStatus: OrderStatus;
    userId: string;
    version: number; // 👈 Passed from Frontend to ensure data wasn't stale
  }) {
    const { orderId, currentStatus, newStatus, userId, version } = data;

    // 1. Validate FSM
    if (!ORDER_FSM[currentStatus].includes(newStatus)) {
      throw new Error(`ILLEGAL_TRANSITION: ${currentStatus} -> ${newStatus}`);
    }

    // 2. Atomic Update with Version Check
    const query: any = {
      _id: orderId,
      status: currentStatus, // 👈 Ensures status hasn't changed
      __v: version          // 👈 Ensures document hasn't been modified
    };

    const update: any = { $set: { status: newStatus } };

    if (newStatus === OrderStatus.ACCEPTED) {
      update.$set.driverId = new mongoose.Types.ObjectId(userId);
    }

    const order = await Order.findOneAndUpdate(query, update, { new: true });

    if (!order) {
      throw new Error('CONCURRENCY_ERROR: Order modified or already accepted by another driver.');
    }

    return order;
  }

  /**
   * Executes the single, idempotent settlement path.
   * Guards (all enforced inside one session):
   *   - Driver ownership: only the assigned driver may settle.
   *   - FSM: order must be ARRIVED_AT_DROPOFF.
   *   - PIN: recipient-provided PIN must match.
   *   - paymentSettled: prevents double-pay.
   * Wallet moves (escrow → driver, escrow → revenue) are ledger-backed and keyed.
   */
  public static async verifyAndSettle(orderId: string, inputPin: string, driverId: string): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId)
        .session(session)
        .select('+verificationPin');

      if (!order) throw new Error('ORDER_NOT_FOUND');

      // 0. Ownership: only the assigned driver may settle this order.
      if (!order.driverId || order.driverId.toString() !== driverId) {
        throw new Error('NOT_ASSIGNED_DRIVER');
      }

      // 1. FSM check: must be at destination.
      if (order.status !== OrderStatus.ARRIVED_AT_DROPOFF) {
        throw new Error('ORDER_NOT_AT_DESTINATION');
      }

      // 2. PIN check (trim both to prevent whitespace errors).
      if (order.verificationPin.trim() !== String(inputPin).trim()) {
        throw new Error('INVALID_PIN');
      }

      // 3. Double-payment guard.
      if (order.paymentSettled) throw new Error('ALREADY_SETTLED');

      // 4. Move escrow → driver earnings and escrow → system commission.
      await WalletService.transferFunds({
        from: InternalAccount.SYSTEM_ESCROW,
        to: order.driverId.toString(),
        amount: order.price - order.commission,
        referenceId: order._id,
        idempotencyKey: `PAYOUT:${order._id}`,
        description: `Driver earnings for Order ${order._id}`,
        requestId: `order-settle-${orderId}`,
        session
      });

      await WalletService.transferFunds({
        from: InternalAccount.SYSTEM_ESCROW,
        to: InternalAccount.SYSTEM_REVENUE,
        amount: order.commission,
        referenceId: order._id,
        idempotencyKey: `COMMISSION:${order._id}`,
        description: `System commission for Order ${order._id}`,
        requestId: `order-settle-${orderId}`,
        session
      });

      // 5. Commit state.
      order.status = OrderStatus.DELIVERED;
      order.paymentSettled = true;
      order.settledAt = new Date();
      await order.save({ session });

      // 6. Connect DriverLandmarkStat and SystemLandmark to successful delivery
      if (order.dropoffLandmarkId) {
        await LandmarkService.recordSuccessfulDelivery(order.driverId, order.dropoffLandmarkId, session);
      }
      if (
        order.pickupLandmarkId &&
        (!order.dropoffLandmarkId || order.pickupLandmarkId.toString() !== order.dropoffLandmarkId.toString())
      ) {
        await LandmarkService.recordSuccessfulDelivery(order.driverId, order.pickupLandmarkId, session);
      }

      // 7. Auto-activate any chained order assigned to this driver
      let activatedChainedOrder: any = null;
      const chainedOrder = await Order.findOne({
        driverId: order.driverId,
        status: OrderStatus.CHAINED_RESERVED,
      }).session(session);

      if (chainedOrder) {
        chainedOrder.status = OrderStatus.ACCEPTED;
        chainedOrder.isChained = false;
        await chainedOrder.save({ session });
        activatedChainedOrder = chainedOrder;
      }

      await session.commitTransaction();

      // Post-commit: Cancel unchain timeout and emit socket notifications
      if (activatedChainedOrder && order.driverId) {
        try {
          const { cancelUnchainTimeout } = await import('../queues/dispatchQueue');
          await cancelUnchainTimeout(activatedChainedOrder._id.toString(), order.driverId.toString());
        } catch (err: any) {
          console.warn('[OrderService] Cancel unchain timeout warn:', err.message);
        }

        try {
          const { getSocketService } = await import('../socketInstance');
          getSocketService().io.to(activatedChainedOrder.customerId.toString()).emit('order_status_update', {
            orderId: activatedChainedOrder._id,
            status: OrderStatus.ACCEPTED,
            driverId: order.driverId,
          });
          getSocketService().io.to(order.driverId.toString()).emit('chained_order_activated', {
            orderId: activatedChainedOrder._id,
          });
        } catch (err: any) {
          console.warn('[OrderService] Socket emit chained activation warn:', err.message);
        }
      }
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Security Rule: Strips sensitive fields like verificationPin before returning to API.
   */
  private static sanitizeOrder(order: IOrder): IOrder {
    const sanitized = order.toObject();
    delete sanitized.verificationPin;
    return sanitized;
  }
}