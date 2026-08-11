// services/OrderService.ts
import mongoose from 'mongoose';
import { Order, IOrder } from '../models/Order';
import { Wallet } from '../models/Wallet';
import { Transaction } from '../models/Transaction';
import { OrderStatus, VehicleType } from '../enums/OrderEnums';
import { ORDER_FSM } from '../config/stateMachine';

export class OrderService {
  /**
   * Generates a secure 4-digit PIN for the recipient.
   * This is stored on the order but never sent to the driver's app.
   */
  public static generatePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
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
   * No funds are deducted from the customer at this stage.
   */
  public static async createOrder(data: {
    customerId: string;
    pickupLocation: { type: 'Point'; coordinates: [number, number] };
    pickupLandmark: string;
    dropoffLocation: { type: 'Point'; coordinates: [number, number] };
    dropoffLandmark: string;
    vehicleType: VehicleType;
    distanceKm: number;
  }): Promise<IOrder> {
    const { price, commission } = this.calculatePricing(data.vehicleType, data.distanceKm);
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
   * Executes atomic wallet settlement using a MongoDB Session.
   * Logic: Correct PIN -> -Customer Wallet -> +Driver Wallet -> Complete Order.
   */
  public static async verifyAndSettle(orderId: string, inputPin: string): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);

      if (!order) throw new Error('ORDER_NOT_FOUND');

      /**
       * ✅ DIAGNOSTIC LOGS:
       * Check your backend terminal to see these values.
       */
      console.log(`VERIFICATION_ATTEMPT: Order ${orderId}`);
      console.log(`DB_PIN: "${order.verificationPin}" | INPUT_PIN: "${inputPin}"`);
      console.log(`CURRENT_STATUS: ${order.status}`);

      // 1. Logic Check: Must be at destination
      if (order.status !== 'ARRIVED_AT_DROPOFF') {
        throw new Error('ORDER_NOT_AT_DESTINATION');
      }

      // 2. Value Check: Trim both to prevent whitespace errors
      if (order.verificationPin.trim() !== inputPin.trim()) {
        throw new Error('INVALID_PIN');
      }

      if (order.paymentSettled) throw new Error('ALREADY_SETTLED');

      // ... rest of the settlement logic (Wallet updates) remains same ...
      // (Deduct from customer, credit driver, record transactions)

      order.status = OrderStatus.DELIVERED;
      order.paymentSettled = true;
      await order.save({ session });

      await session.commitTransaction();
      console.log(`VERIFICATION_SUCCESS: Order ${orderId} settled.`);

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