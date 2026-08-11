import { Request, Response, NextFunction } from 'express';
import { ImportRequest } from '../models/ImportRequest';

/**
 * CUSTODY_GUARD: Enforces the "Location determines Authority" principle.
 * prevents "Authority Hijacking" by verifying that the shipment's 
 * currentLocationId matches the user's assigned warehouse nodes.
 */
export const enforceCustody = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' });

  // 1. Super Admins bypass physical custody for global intervention
  if (user.roles.includes('super_admin' as any)) return next();

  try {
    const shipment = await ImportRequest.findById(id);
    if (!shipment) return res.status(404).json({ error: 'SHIPMENT_NOT_FOUND' });

    // 2. Handle DECLARED state (no physical node yet)
    // Only the partner assigned as the chinaAgent (or original partnerId) can intake
    if (!shipment.currentLocationId) {
      const isAssignedPartner = shipment.partnerId?.toString() === user.partnerId?.toString();
      if (isAssignedPartner) return next();

      return res.status(403).json({
        error: 'CUSTODY_VIOLATION',
        message: 'This shipment has not been received by your organization yet.'
      });
    }

    // 3. Authority Check: Does the user's keychain include the current physical node?
    const hasPhysicalAuthority = user.assignedLocations?.some(
      locId => locId?.toString() === shipment.currentLocationId?.toString()
    );

    if (!hasPhysicalAuthority) {
      return res.status(403).json({
        error: 'CUSTODY_VIOLATION',
        message: 'Action denied. Shipment is not physically present at your assigned location.'
      });
    }

    // Attach shipment to request to save DB calls in the controller
    (req as any).shipment = shipment;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'CUSTODY_VERIFICATION_SYSTEM_FAILURE' });
  }
};