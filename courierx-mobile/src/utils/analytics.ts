/**
 * Central Analytics Service for CourierX Mobile
 * Handles event logging, funnel tracking, and user behavior telemetry.
 */

type AnalyticsEventName =
  | 'import_screen_viewed'
  | 'import_partner_selected'
  | 'import_address_copied'
  | 'import_shipping_mark_copied'
  | 'import_declared'
  | 'import_declaration_failed'
  | 'import_delivery_requested'
  | 'import_self_pickup_viewed'
  | 'import_receipt_downloaded'
  | 'import_dispute_submitted';

class AnalyticsService {
  private isDebug = __DEV__;

  public track(eventName: AnalyticsEventName, properties?: Record<string, any>) {
    const payload = {
      event: eventName,
      properties: properties || {},
      timestamp: new Date().toISOString(),
    };

    if (this.isDebug) {
      console.log(`[ANALYTICS] 📊 ${eventName}`, payload.properties);
    }

    // Connect to external telemetry provider (e.g. PostHog, Mixpanel, Firebase Analytics)
    // Example: posthog.capture(eventName, properties);
  }

  public screen(screenName: string, properties?: Record<string, any>) {
    this.track('import_screen_viewed', { screen: screenName, ...properties });
  }
}

export const analytics = new AnalyticsService();
