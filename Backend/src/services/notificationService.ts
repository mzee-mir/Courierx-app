import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { User } from '../models/User';

// Push delivery goes through the Expo push service (expo-server-sdk).
// Clients must register an Expo push token (getExpoPushTokenAsync) for delivery
// to succeed; native FCM/APNs tokens are not deliverable on this channel.
const expo = new Expo();

// Maps an ImportStatus → the user preference key that can disable it
const STATUS_PREFERENCE_MAP: Record<string, keyof NonNullable<any>> = {
  RECEIVED_AT_ORIGIN:      'import_received',
  IN_TRANSIT:              'import_in_transit',
  CUSTOMS_HOLD:            'import_customs_hold',
  ARRIVED_LOCAL:           'import_arrived',
  READY_FOR_LOCAL_HANDOFF: 'import_ready',
  WEIGHT_DISPUTE:          'import_weight_dispute',
  DELIVERED:               'import_delivered',
};

// Per-status notification copy
const STATUS_NOTIFICATION_COPY: Record<string, (itemDescription: string, extra?: string) => { title: string; body: string }> = {
  RECEIVED_AT_ORIGIN: (item, weight) => ({
    title: '📦 Package Received',
    body: `Your "${item}" arrived at the partner hub. Verified weight: ${weight || 'pending'}.`,
  }),
  IN_TRANSIT: (item) => ({
    title: '✈️ Shipment Departed',
    body: `Your "${item}" is on its way to Somalia.`,
  }),
  CUSTOMS_HOLD: (item) => ({
    title: '⚠️ Customs Hold',
    body: `Your "${item}" is being held by customs. Action may be required.`,
  }),
  ARRIVED_LOCAL: (item) => ({
    title: '🇸🇴 Arrived in Somalia',
    body: `Your "${item}" has arrived in Somalia and is being processed.`,
  }),
  READY_FOR_LOCAL_HANDOFF: (item) => ({
    title: '✅ Ready for Delivery',
    body: `Your "${item}" has cleared customs. Choose how to receive it.`,
  }),
  WEIGHT_DISPUTE: (item, details) => ({
    title: '⚖️ Weight Update',
    body: `Weight update for "${item}": ${details || 'revised weight recorded'}. Tap to review.`,
  }),
  DELIVERED: (item) => ({
    title: '🎉 Delivered!',
    body: `Your "${item}" has been delivered. View your receipt.`,
  }),
};

// Pure helpers (testable without a network/DB round trip)
export const isExpoPushToken = (token: unknown): token is string => Expo.isExpoPushToken(token);

export const buildPushMessage = (
  token: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): ExpoPushMessage => ({
  to: token,
  title,
  body,
  data,
  sound: 'default',
  priority: 'high',
  channelId: 'default',
});

export const isDeviceNotRegistered = (ticket: ExpoPushTicket | undefined): boolean =>
  !!ticket && ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered';

export class NotificationService {
  /**
   * Send a push notification to a single user by their userId.
   * Respects the user's notificationPreferences for import events.
   */
  public static async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<void> {
    const user = await User.findById(userId).select('+pushToken').lean();
    if (!user?.pushToken) return;

    // Only Expo push tokens are deliverable via expo-server-sdk.
    // Retire legacy/native tokens so we stop retrying them forever.
    if (!isExpoPushToken(user.pushToken)) {
      await User.updateOne({ _id: user._id }, { $unset: { pushToken: 1 } });
      return;
    }

    try {
      const tickets = await expo.sendPushNotificationsAsync([
        buildPushMessage(user.pushToken, title, body, data || {}),
      ]);

      // Device removed the app / token no longer registered — stop targeting it.
      if (isDeviceNotRegistered(tickets[0])) {
        await User.updateOne({ _id: user._id }, { $unset: { pushToken: 1 } });
      }
    } catch (err: any) {
      console.error(`[NotificationService] Failed to send to ${userId}:`, err.message);
    }
  }

  /**
   * Fire a push notification for a specific import status transition.
   * Checks the user's notificationPreferences before sending.
   */
  public static async sendImportStatusNotification(opts: {
    userId: string;
    importId: string;
    itemDescription: string;
    newStatus: string;
    extraDetail?: string; // e.g. "weight: 3.2kg" for WEIGHT_DISPUTE
  }): Promise<void> {
    const { userId, importId, itemDescription, newStatus, extraDetail } = opts;

    const copyFn = STATUS_NOTIFICATION_COPY[newStatus];
    if (!copyFn) return; // No notification defined for this status

    const prefKey = STATUS_PREFERENCE_MAP[newStatus];

    // Check user preferences if a key exists for this status
    if (prefKey) {
      const user = await User.findById(userId).select('+pushToken notificationPreferences').lean();
      if (!user?.pushToken) return;

      const prefs = (user as any).notificationPreferences;
      if (prefs && prefs[prefKey] === false) {
        // User has opted out of this notification type
        return;
      }
    }

    const { title, body } = copyFn(itemDescription, extraDetail);
    await NotificationService.sendToUser(userId, title, body, {
      type: 'IMPORT_STATUS',
      importId,
      status: newStatus,
    });
  }

  /**
   * Sends a push notification to specific roles (e.g., all DRIVERS).
   * Original method preserved.
   */
  public static async broadcastToRole(role: string, title: string, body: string) {
    const users = await User.find({
      roles: role,
      pushToken: { $exists: true }
    }).select('_id +pushToken').lean();

    const targets = users.filter(u => isExpoPushToken(u.pushToken));
    if (targets.length === 0) return null;

    const messages = targets.map(u => buildPushMessage(u.pushToken, title, body, {}));

    try {
      const tickets = await expo.sendPushNotificationsAsync(messages);

      // Retire tokens that are no longer registered
      for (let i = 0; i < tickets.length; i++) {
        if (isDeviceNotRegistered(tickets[i])) {
          await User.updateOne({ _id: targets[i]._id }, { $unset: { pushToken: 1 } });
        }
      }

      return tickets;
    } catch (err: any) {
      console.error(`[NotificationService] Broadcast to role ${role} failed:`, err.message);
      return null;
    }
  }
}
