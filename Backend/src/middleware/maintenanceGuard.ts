import { Request, Response, NextFunction } from 'express';
import { SystemSettings } from '../models/SystemSettings';
import { UserRole } from '../models/User';

export const checkMaintenanceMode = async (req: Request, res: Response, next: NextFunction) => {
  // 1. Bypass check for Admin routes
  if (req.path.startsWith('/api/v1/admin')) return next();

  // 2. Fetch the live status (Cache this in Redis in production)
  const maintenanceMode = await SystemSettings.findOne({ 
    key: 'MAINTENANCE_MODE_ENABLED', 
    isActive: true 
  });

  if (maintenanceMode?.value === true) {
    const notice = await SystemSettings.findOne({ key: 'MAINTENANCE_NOTICE_MESSAGE', isActive: true });
    
    return res.status(503).json({
      error: 'SYSTEM_UNDER_MAINTENANCE',
      message: notice?.value || 'CourierX is currently undergoing scheduled maintenance. Please check back later.'
    });
  }

  next();
};