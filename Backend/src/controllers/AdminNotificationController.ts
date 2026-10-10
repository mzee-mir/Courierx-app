import { Broadcast } from "../models/Broadcast";
import { User } from "../models/User";
import { Request, Response } from 'express';
import { readIdempotency, writeIdempotency } from '../utils/idempotency';

export class AdminNotificationController {
  public static async createDraft(req: Request, res: Response) {
    const { targetRole, title, body } = req.body;
    const adminId = req.user?.userId;
    const idempotencyKey = req.idempotencyKey;

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `admin:${adminId}:broadcast_draft:${idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    // 1. Rate Limit Check (24h cooldown per role)
    const recent = await Broadcast.findOne({ 
      targetRole, status: 'SENT', 
      createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) } 
    });
    if (recent) return res.status(429).json({ error: 'BROADCAST_COOLDOWN_ACTIVE' });

    // 2. Impact Calculation
    const count = await User.countDocuments(targetRole === 'all' ? {} : { roles: targetRole });

    const draft = await Broadcast.create({
      targetRole, title, body, impactCount: count, requestId: req.id 
    });

    const responsePayload = { success: true, draftId: draft._id, impactCount: count };
    await writeIdempotency(lookupKey, responsePayload);
    res.json(responsePayload);
  }

  public static async execute(req: Request, res: Response) {
    const { id } = req.params;
    const adminId = req.user?.userId;
    const idempotencyKey = req.idempotencyKey;

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `admin:${adminId}:broadcast_execute:${id}:${idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    // Set to QUEUED. A background worker (node-cron) picks this up after 5 mins.
    const broadcast = await Broadcast.findOneAndUpdate(
      { _id: id, status: 'DRAFT' },
      { status: 'QUEUED', scheduledFor: new Date(Date.now() + 5*60*1000), executedBy: req.user?.userId },
      { new: true }
    );
    if (!broadcast) return res.status(404).json({ error: 'DRAFT_NOT_FOUND_OR_ALREADY_QUEUED' });

    const responsePayload = { success: true, message: 'Broadcast queued. You have 5 minutes to abort.' };
    await writeIdempotency(lookupKey, responsePayload);
    res.json(responsePayload);
  }
}