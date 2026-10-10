// controllers/ProfileController.ts
import { Request, Response } from 'express';
import { User } from '../models/User';
import { DriverProfile } from '../models/DriverProfile';
import { Landmark } from '../models/Landmark';
import { readIdempotency, writeIdempotency } from '../utils/idempotency';

export class ProfileController {
  /**
   * Retrieves the full user profile including their saved landmarks.
   */
  public static async getProfile(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;

      const user = await User.findById(userId).select('-__v');
      const landmarks = await Landmark.find({ userId }).select('-__v');

      if (!user) {
        return res.status(404).json({ error: 'USER_NOT_FOUND' });
      }

      return res.status(200).json({
        success: true,
        profile: user,
        landmarks: landmarks,
      });
    } catch (error) {
      return res.status(500).json({ error: 'FETCH_PROFILE_FAILED' });
    }
  }

  /**
   * Handles the initial submission of driver documents.
   * Logic: Upserts a DriverProfile and keeps the status as 'pending'.
   */

  public static async submitDriverOnboarding(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;
      const { fullName, email, imageUrl, vehicle, documents } = req.body;
      const idempotencyKey = req.idempotencyKey;

      // 1. Validation: Ensure required fields are present
      if (!fullName || !imageUrl || !vehicle.plateNumber) {
        return res.status(400).json({ error: 'MISSING_REQUIRED_ONBOARDING_DATA' });
      }

      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = `user:${userId}:onboarding:${idempotencyKey}`;
      const existingReq = await readIdempotency(lookupKey);
      if (existingReq) return res.status(201).json(existingReq.responseBody);

      // 2. Data Persistence: Create or update the professional profile
      const profile = await DriverProfile.findOneAndUpdate(
        { userId },
        {
          userId,
          fullName,
          email,
          imageUrl,
          vehicle,
          documents,
          status: 'pending' // Force reset to pending on every new submission
        },
        { upsert: true, new: true }
      );

      // 3. Update core User metadata (Syncing email/displayName if provided)
      await User.findByIdAndUpdate(userId, {
        displayName: fullName,
        ...(email && { email })
      });

      const responsePayload = {
        success: true,
        message: 'APPLICATION_SUBMITTED',
        profile
      };
      await writeIdempotency(lookupKey, responsePayload);
      return res.status(201).json(responsePayload);
    } catch (error) {
      console.error('ONBOARDING_SUBMISSION_ERROR:', error);
      return res.status(500).json({ error: 'DATABASE_SAVE_FAILED' });
    }
  }

  /**
   * Retrieves the full professional profile for a driver.
   * Merges User verification status with DriverProfile metadata.
   */
  public static async getDriverProfile(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;
      const { DriverProfile } = require('../models/DriverProfile');
      const { User } = require('../models/User');

      const [user, profile] = await Promise.all([
        User.findById(userId).select('isVerified phoneNumber'),
        DriverProfile.findOne({ userId }) // This fetches the whole doc including avatarUrl
      ]);

      if (!profile) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });

      return res.status(200).json({
        success: true,
        profile: {
          ...profile.toJSON(),
          isVerified: user.isVerified,
          phoneNumber: user.phoneNumber,
        }
      });
    } catch (error) {
      return res.status(500).json({ error: 'FETCH_FAILED' });
    }
  }

  public static async updateDriverAvatar(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const { imageUrl } = req.body;
    const idempotencyKey = req.idempotencyKey;

    if (!imageUrl) {
      return res.status(400).json({ error: 'IMAGE_REQUIRED' });
    }

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `user:${userId}:avatar:${idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    const profile = await DriverProfile.findOneAndUpdate(
      { userId },
      { imageUrl },
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    }

    const responsePayload = { success: true, profile };
    await writeIdempotency(lookupKey, responsePayload);
    return res.status(200).json(responsePayload);
  } catch (err) {
    return res.status(500).json({ error: 'AVATAR_UPDATE_FAILED' });
  }
}


  /**
   * Updates basic profile information.
   * Only allows modification of non-sensitive fields.
   */
   public static async updateProfile(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;
      // ✅ FIX: Extract 'imageUrl' to match the payload from the phone
      const { displayName, imageUrl } = req.body; 
      const idempotencyKey = req.idempotencyKey;

      const updateData: any = {};
      if (displayName) updateData.displayName = displayName;
      // ✅ FIX: Map to the 'imageUrl' field in your User Model
      if (imageUrl) updateData.imageUrl = imageUrl; 

      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = `user:${userId}:update_profile:${idempotencyKey}`;
      const existingReq = await readIdempotency(lookupKey);
      if (existingReq) return res.status(200).json(existingReq.responseBody);

      const user = await User.findByIdAndUpdate(
        userId, 
        { $set: updateData }, 
        { new: true }
      ).select('-__v');

      const responsePayload = { success: true, user };
      await writeIdempotency(lookupKey, responsePayload);
      return res.status(200).json(responsePayload);
    } catch (error) {
      return res.status(500).json({ error: 'UPDATE_PROFILE_FAILED' });
    }
  }

  /**
   * Task 5.3b: Update notification preferences for import events.
   * Accepts a partial object — only provided keys are updated.
   */
  public static async updateNotificationPreferences(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;
      const idempotencyKey = req.idempotencyKey;
      const allowed = [
        'import_received',
        'import_in_transit',
        'import_customs_hold',
        'import_arrived',
        'import_ready',
        'import_weight_dispute',
        'import_delivered',
      ];

      // Build a safe $set payload — only allow known preference keys
      const updateData: Record<string, boolean> = {};
      for (const key of allowed) {
        if (typeof req.body[key] === 'boolean') {
          updateData[`notificationPreferences.${key}`] = req.body[key];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'NO_VALID_PREFERENCES_PROVIDED' });
      }

      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = `user:${userId}:notification_prefs:${idempotencyKey}`;
      const existingReq = await readIdempotency(lookupKey);
      if (existingReq) return res.status(200).json(existingReq.responseBody);

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      ).select('notificationPreferences');

      const responsePayload = { success: true, notificationPreferences: user?.notificationPreferences };
      await writeIdempotency(lookupKey, responsePayload);
      return res.status(200).json(responsePayload);
    } catch (error) {
      return res.status(500).json({ error: 'UPDATE_PREFERENCES_FAILED' });
    }
  }

  /**
   * Creates a new saved landmark for the user.
   * The description field is mandatory for last-mile delivery instructions.
   */
  public static async createLandmark(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;
      const { label, location, description, isDefault } = req.body;
      const idempotencyKey = req.idempotencyKey;

      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = `user:${userId}:landmark:${idempotencyKey}`;
      const existingReq = await readIdempotency(lookupKey);
      if (existingReq) return res.status(201).json(existingReq.responseBody);

      // Logic: If setting as default, unset other defaults for this user
      if (isDefault) {
        await Landmark.updateMany({ userId }, { isDefault: false });
      }

      const landmark = await Landmark.create({
        userId,
        label,
        location,
        description,
        isDefault,
      });

      const responsePayload = { success: true, landmark };
      await writeIdempotency(lookupKey, responsePayload);
      return res.status(201).json(responsePayload);
    } catch (error) {
      return res.status(400).json({ error: 'CREATE_LANDMARK_FAILED' });
    }
  }

  public static async updatePushToken(req: Request, res: Response): Promise<Response> {
  try {
    const userId = req.user?.userId;
    const { pushToken } = req.body;
    const idempotencyKey = req.idempotencyKey;

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `user:${userId}:push_token:${idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    await User.findByIdAndUpdate(userId, { pushToken });
    
    const responsePayload = { success: true };
    await writeIdempotency(lookupKey, responsePayload);
    return res.status(200).json(responsePayload);
  } catch (error) {
    return res.status(500).json({ error: 'TOKEN_UPDATE_FAILED' });
  }
}

  /**
   * Securely deletes a landmark.
   * Ensures the landmark belongs to the authenticated user.
   */
  public static async deleteLandmark(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      const idempotencyKey = req.idempotencyKey;

      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = `user:${userId}:delete_landmark:${id}:${idempotencyKey}`;
      const existingReq = await readIdempotency(lookupKey);
      if (existingReq) return res.status(200).json(existingReq.responseBody);

      const landmark = await Landmark.findOneAndDelete({ _id: id, userId });

      if (!landmark) {
        return res.status(404).json({ error: 'LANDMARK_NOT_FOUND_OR_UNAUTHORIZED' });
      }

      const responsePayload = { success: true, message: 'LANDMARK_DELETED' };
      await writeIdempotency(lookupKey, responsePayload);
      return res.status(200).json(responsePayload);
    } catch (error) {
      return res.status(400).json({ error: 'DELETE_LANDMARK_FAILED' });
    }
  }

  public static async getLandmarks(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;
      const { Landmark } = require('../models/Landmark'); // Ensure import
      
      const landmarks = await Landmark.find({ userId }).select('-__v');
      
      return res.status(200).json({
        success: true,
        landmarks: landmarks || []
      });
    } catch (error) {
      return res.status(500).json({ error: 'FETCH_LANDMARKS_FAILED' });
    }
  }
}