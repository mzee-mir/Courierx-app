// services/DispatchService.ts
import { DriverLocation } from '../models/DriverLocation';
import { User, UserRole } from '../models/User';
import { VehicleType } from '../enums/OrderEnums';
import { DriverProfile } from '../models/DriverProfile';

export class DispatchService {
  /**
   * Finds available drivers near a specific location.
   * Logic: 2dsphere $near query + availability filter + vehicle type match.
   * Radius: 5000 meters (5km) for urban Somali centers like Mogadishu.
   */
  public static async findNearbyDrivers(
    coordinates: [number, number],
    requiredVehicle: string,
    radiusInMeters: number = 50000 // 🚀 INCREASED TO 50KM FOR TESTING
  ): Promise<string[]> {
    
    console.log(`DISPATCH_LOG: Searching for ${requiredVehicle} near [${coordinates}]`);

    // 1. Find all ONLINE drivers with a valid location
    const nearbyLocations = await DriverLocation.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates },
          $maxDistance: radiusInMeters,
        },
      },
      isAvailable: true,
    }).select('userId');

    console.log(`DISPATCH_LOG: Found ${nearbyLocations.length} active drivers in radius.`);

    if (nearbyLocations.length === 0) return [];

    const potentialDriverIds = nearbyLocations.map(loc => loc.userId);

    // 2. Filter by Vehicle Type (Case Insensitive)
    const matchingDrivers = await DriverProfile.find({
      userId: { $in: potentialDriverIds },
      // ✅ FIX: Ensure lowercase comparison to match Onboarding Enum
      "vehicle.vehicleType": requiredVehicle.toLowerCase(), 
      status: 'approved' // Driver MUST be approved in their profile
    }).select('userId');

    console.log(`DISPATCH_LOG: Found ${matchingDrivers.length} matching the vehicle: ${requiredVehicle}`);

    return matchingDrivers.map(d => d.userId.toString());
  }

  /**
   * Simulated Broadcast Logic
   * In production, this would trigger Firebase Cloud Messaging (FCM) 
   * to push notifications to the drivers' Android devices.
   */
  public static async broadcastOrder(orderId: string, driverIds: string[]): Promise<void> {
    if (driverIds.length === 0) {
      console.log(`DISPATCH_NOTICE: No drivers found for Order ${orderId}`);
      return;
    }

    console.log(`DISPATCH_BROADCAST: Notifying ${driverIds.length} drivers for Order ${orderId}`);
    
    // Logic: Trigger FCM Push Notifications here
    // driverIds.forEach(id => pushService.send(id, "New Order Nearby"));
  }
}