import { Request, Response, NextFunction } from 'express';
import { ImportRequest } from '../models/ImportRequest';
import mongoose from 'mongoose';

export const importOwnershipGuard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const importId = req.params.id || req.params.importId;
    const userId = req.user?.userId;

    if (!importId || !mongoose.Types.ObjectId.isValid(importId)) {
      return res.status(400).json({ error: 'INVALID_IMPORT_ID' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    // Attempt to find the import request.
    const shipment = await ImportRequest.findById(importId);

    // If it doesn't exist, or doesn't belong to the user, return 404 to avoid leaking existence
    if (!shipment || shipment.userId.toString() !== userId) {
      return res.status(404).json({ error: 'IMPORT_NOT_FOUND' });
    }

    // Attach to request for downstream controllers so they don't have to query again
    (req as any).importRequest = shipment;

    next();
  } catch (error) {
    res.status(500).json({ error: 'OWNERSHIP_GUARD_FAILED' });
  }
};
