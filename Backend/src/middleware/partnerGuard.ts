import { Request, Response, NextFunction } from 'express';
import { PartnerOrganization } from '../models/PartnerOrganization';

/**
 * ARCHITECTURAL RULE: UI is never trusted. 
 * This middleware verifies the Partner's organizational status at the database level
 * before allowing any state-changing logic to proceed.
 */
export const checkPartnerStatus = async (req: Request, res: Response, next: NextFunction) => {
  // If user is not associated with a partner (e.g., internal Admin), bypass
  if (!req.user?.partnerId) return next();

  try {
    const org = await PartnerOrganization.findById(req.user.partnerId).lean();

    if (!org) {
      return res.status(403).json({ error: 'ORG_NOT_FOUND', message: 'Access revoked.' });
    }

    if (org.status === 'SUSPENDED') {
      return res.status(403).json({ 
        error: 'PARTNER_SUSPENDED', 
        message: 'Your organization has been suspended. All write actions are blocked.' 
      });
    }

    // Attach status to request for granular control in controllers
    req.partnerStatus = org.status; 
    next();
  } catch (error) {
    return res.status(500).json({ error: 'PARTNER_VERIFICATION_FAILED' });
  }
};