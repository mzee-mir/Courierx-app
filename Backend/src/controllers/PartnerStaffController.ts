import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, UserRole } from '../models/User';
import { AdminAuditLog } from '../models/AdminAuditLog';
import mongoose from 'mongoose';
import { redactUser } from '../utils/redact';
import { readIdempotency, writeIdempotency } from '../utils/idempotency';


export class PartnerStaffController {
  /**
   * createWorker: Onboards a new warehouse worker with a 10-person limit per location.
   */
  public static async createWorker(req: Request, res: Response) {
    // 1. Capture permissions from the request body
    const { email, password, displayName, assignedLocations, permissions } = req.body;
    const ownerPartnerId = req.user?.partnerId;
    const idempotencyKey = req.idempotencyKey;

    try {
      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = `partner:${ownerPartnerId}:create_worker:${idempotencyKey}`;
      const existingReq = await readIdempotency(lookupKey);
      if (existingReq) return res.status(201).json(existingReq.responseBody);

      const hashedPassword = await bcrypt.hash(password, 12);


      // 2. Create user with specific permissions
      const newWorker = await User.create({
        email,
        password: hashedPassword,
        displayName,
        roles: [UserRole.PARTNER_OPS],
        partnerId: ownerPartnerId,
        assignedLocations,
        permissions: permissions || [], // 👈 The specific keys picked by the Boss
        isVerified: true,
        firebaseUid: `PTR_INTERNAL_${Date.now()}`
      });

      const responsePayload = { success: true, workerId: newWorker._id };
      await writeIdempotency(lookupKey, responsePayload);
      res.status(201).json(responsePayload);
    } catch (error) {
      res.status(500).json({ error: 'WORKER_CREATION_FAILED' });
    }
  }


  /**
   * getStaffLoginHistory: Forensic visibility for the Partner Owner.
   */
  public static async getStaffLoginHistory(req: Request, res: Response) {
    const { staffId } = req.params;
    const ownerPartnerId = req.user?.partnerId;

    try {
      // Security Check: Is this staff member part of the owner's org?
      const staff = await User.findOne({ _id: staffId, partnerId: ownerPartnerId });
      if (!staff) return res.status(403).json({ error: 'ACCESS_DENIED' });

      const history = await AdminAuditLog.find({
        adminId: staffId,
        action: 'ADMIN_LOGIN'
      }).sort({ createdAt: -1 }).limit(20);

      res.json({ success: true, history });
    } catch (error) {
      res.status(500).json({ error: 'HISTORY_FETCH_FAILED' });
    }
  }


  /**
 * toggleWorkerStatus: Owner-level kill-switch for warehouse staff.
 */
  public static async toggleWorkerStatus(req: Request, res: Response) {
    const { id } = req.params; // The Worker's User ID
    const { isSuspended } = req.body;
    const ownerPartnerId = req.user?.partnerId;
    const idempotencyKey = req.idempotencyKey;


    try {
      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = `partner:${ownerPartnerId}:toggle_worker:${id}:${idempotencyKey}`;
      const existingReq = await readIdempotency(lookupKey);
      if (existingReq) return res.status(200).json(existingReq.responseBody);

      // 1. ATOMIC UPDATE: Flip suspension AND burn the current session token
      const worker = await User.findOneAndUpdate(
        { _id: id, partnerId: ownerPartnerId }, // 👈 Hard-scoped to Owner's Org
        {
          $set: { isSuspended },
          $inc: { tokenVersion: 1 } // 👈 Forces 403 on next request
        },
        { new: true }
      );


      if (!worker) return res.status(404).json({ error: 'WORKER_NOT_FOUND' });


      // 2. AUDIT LOG
      await AdminAuditLog.create({
        adminId: req.user?.userId,
        action: isSuspended ? 'SUSPEND_PARTNER_STAFF' : 'ACTIVATE_PARTNER_STAFF',
        targetId: worker._id,
        targetModel: 'User',
        details: `Partner staff ${worker.email} status set to ${isSuspended ? 'Suspended' : 'Active'}`,
        requestId: req.id
      });

      const responsePayload = { success: true, isSuspended: worker.isSuspended };
      await writeIdempotency(lookupKey, responsePayload);
      res.json(responsePayload);
    } catch (error) {
      res.status(500).json({ error: 'STATUS_UPDATE_FAILED' });
    }
  }


  /**
 * updateSelfProfile: Allows staff to change their name or picture
 */
  public static async updateSelfProfile(req: Request, res: Response) {
    try {
      const { displayName, imageUrl } = req.body;
      const userId = req.user?.userId;
      const idempotencyKey = req.idempotencyKey;

      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = `user:${userId}:self_profile:${idempotencyKey}`;
      const existingReq = await readIdempotency(lookupKey);
      if (existingReq) return res.status(200).json(existingReq.responseBody);

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { displayName, imageUrl } },
        { new: true }
      );

      const responsePayload = { success: true, user: redactUser(user) };
      await writeIdempotency(lookupKey, responsePayload);
      res.json(responsePayload);
    } catch (error) {
      res.status(500).json({ error: 'PROFILE_UPDATE_FAILED' });
    }
  }


  /**
   * updateSelfPassword: Required for staff security hygiene.
   */
  public static async updateSelfPassword(req: Request, res: Response) {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.userId;
    const idempotencyKey = req.idempotencyKey;

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `user:${userId}:self_password:${idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    const user = await User.findById(userId).select('+password');
    if (!user || !(await bcrypt.compare(currentPassword, user.password || ''))) {
      return res.status(401).json({ error: 'CURRENT_PASSWORD_INVALID' });
    }


    user.password = await bcrypt.hash(newPassword, 12);
    user.tokenVersion += 1; // 👈 Forces re-login on all devices
    await user.save();

    const responsePayload = { success: true, message: 'Password updated. Please log in again.' };
    await writeIdempotency(lookupKey, responsePayload);
    res.json(responsePayload);
  }


  /**
   * getStaffMembers: Fetches all warehouse workers for the logged-in partner.
   * Scoped by partnerId for zero-leakage security.
   */
  public static async getStaffMembers(req: Request, res: Response) {
    try {
      const ownerPartnerId = req.user?.partnerId;


      if (!ownerPartnerId) {
        return res.status(403).json({ error: 'ORG_CONTEXT_MISSING' });
      }


      // Find users matching this partnerId who have the operational role
      const staff = await User.find({
        partnerId: ownerPartnerId,
        roles: { $in: [UserRole.PARTNER_OPS, UserRole.PARTNER_READONLY] }
      })
        .select('displayName email roles isSuspended assignedLocations createdAt permissions')
        .populate('assignedLocations', 'name') // Show the warehouse name
        .lean();


      // Redact internal fields (id vs _id) before sending to frontend
      res.status(200).json({
        success: true,
        staff: staff.map(redactUser)
      });
    } catch (error) {
      console.error("FETCH_STAFF_ERROR:", error);
      res.status(500).json({ error: 'FETCH_STAFF_FAILED' });
    }
  }


  /**
 * updateWorkerPermissions: Boss-level override for a worker's keychain
 */
  public static async updateWorkerPermissions(req: Request, res: Response) {
    const { id } = req.params; // The Worker's User ID
    const { permissions } = req.body; // The new list of keys
    const ownerPartnerId = req.user?.partnerId;
    const idempotencyKey = req.idempotencyKey;


    try {
      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = `partner:${ownerPartnerId}:worker_permissions:${id}:${idempotencyKey}`;
      const existingReq = await readIdempotency(lookupKey);
      if (existingReq) return res.status(200).json(existingReq.responseBody);

      // 1. Security Check: Ensure the target worker belongs to the Boss's organization
      const worker = await User.findOneAndUpdate(
        { _id: id, partnerId: ownerPartnerId },
        { $set: { permissions: permissions } },
        { new: true }
      );


      if (!worker) return res.status(404).json({ error: 'WORKER_NOT_FOUND' });


      // 2. Log the authority shift
      await AdminAuditLog.create({
        adminId: req.user?.userId,
        action: 'PERMISSIONS_UPDATED',
        targetId: worker._id,
        targetModel: 'User',
        details: `Updated keychain for ${worker.displayName}. New keys count: ${permissions.length}`,
        requestId: req.id
      });

      const responsePayload = { success: true, permissions: worker.permissions };
      await writeIdempotency(lookupKey, responsePayload);
      res.json(responsePayload);
    } catch (error) {
      res.status(500).json({ error: 'UPDATE_FAILED' });
    }
  }
}
