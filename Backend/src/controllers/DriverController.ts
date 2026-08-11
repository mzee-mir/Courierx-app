import { Request, Response } from 'express';
import { DriverLocation } from '../models/DriverLocation';
import mongoose from 'mongoose';
import { DispatchService } from '../services/DispatchService';

export class DriverController {
  public static async toggleStatus(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;
      const { isAvailable } = req.body;

      console.log(`SYSTEM_ACTION: User ${userId} going ${isAvailable ? 'ONLINE' : 'OFFLINE'}`);

      await DriverLocation.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId) },
        { 
          $set: { 
            isAvailable, 
            lastUpdated: new Date() 
          } 
        },
        { 
          upsert: true, 
          new: true,
          runValidators: false, // ✅ FIX: Prevents Mongoose from adding empty required fields
          setDefaultsOnInsert: false // ✅ FIX: Prevents Mongoose from adding default empty objects
        }
      );

      return res.status(200).json({ success: true, status: isAvailable ? 'ONLINE' : 'OFFLINE' });
    } catch (error: any) {
      console.error('DATABASE_ERROR_TOGGLE_STATUS:', error.message);
      return res.status(400).json({ error: 'STATUS_TOGGLE_FAILED' });
    }
  }

  public static async getNearbyDrivers(req: Request, res: Response): Promise<Response> {
    try {
      const { lat, lng, vehicleType } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({ error: 'LOCATION_REQUIRED' });
      }

      // Logic: Delegate to the DispatchService we built in Step 3
      // We search within a 50km radius for testing
      const drivers = await DispatchService.findNearbyDrivers(
        [parseFloat(lng as string), parseFloat(lat as string)],
        (vehicleType as string) || 'bajaj',
        50000 
      );

      // Return full location objects for the map markers
      const { DriverLocation } = require('../models/DriverLocation');
      const locations = await DriverLocation.find({
        userId: { $in: drivers },
        isAvailable: true
      }).select('userId location');

      return res.status(200).json({
        success: true,
        drivers: locations
      });
    } catch (error) {
      return res.status(500).json({ error: 'DISCOVERY_FAILED' });
    }
  }

  /**
   * This is where the location actually gets set properly.
   */
  public static async updateLocation(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;
      const { coordinates } = req.body; // [lng, lat]

      if (!coordinates || coordinates.length !== 2) {
        return res.status(400).json({ error: 'INVALID_COORDINATES' });
      }

      await DriverLocation.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId) },
        { 
          $set: {
            location: { type: 'Point', coordinates }, // ✅ Valid GeoJSON
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('LOCATION_SYNC_ERROR:', error.message);
      return res.status(500).json({ error: 'SYNC_FAILED' });
    }
  }
}