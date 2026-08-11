// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../models/User';
import { Permission, ROLE_PERMISSIONS } from '../enums/permissions';
import * as crypto from 'crypto';
import { redisClient } from '../config/redis';

/**
 * 1. Define the internal structure of our JWT payload.
 * This represents the "Identity" of the requester as defined in verifyIdentity controller.
 */
export interface AuthPayload {
  name: string;
  userId: string;
  firebaseUid: string;
  roles: UserRole[];
  isVerified: boolean;
  assignedLocations: string[];
  partnerId?: string; // 👈 Add this line (optional because customers don't have it)
  fp?: string;        // Ensure fingerprint is also here from previous hardening
  version?: number;     // For token versioning (global logout)
}

/**
 * 2. TypeScript Declaration Merging: 
 * Informs the Express framework that the 'user' property exists on all 'Request' objects.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * PHASE 1: AUTHENTICATION
 * Extracts the JWT from the Authorization header and verifies it.
 * This must be the first middleware in any protected route chain.
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED: Missing token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    // 1. Persistence Check: Verify user still exists and isn't suspended
    const user = await User.findById(decoded.userId).select('isSuspended');
    if (!user || user.isSuspended) {
      return res.status(403).json({ error: 'ACCOUNT_INACTIVE' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'SESSION_EXPIRED' });
  }
};

/**
 * PHASE 2: GENERIC ROLE AUTHORIZATION
 * Checks if the user possesses at least one of the roles required for the route.
 */
export const authorize = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const identity = req.user;

    if (!identity) {
      return res.status(401).json({ error: 'UNAUTHORIZED: Authentication required' });
    }

    // Support for multiple roles per user (Array check)
    const hasPermission = identity.roles.some(role => allowedRoles.includes(role));

    if (!hasPermission) {
      return res.status(403).json({ error: 'FORBIDDEN: Insufficient role permissions' });
    }

    next();
  };
};

/**
 * authenticateHardened: Live Session Re-Validation
 * Re-fetches user from DB to ensure they aren't suspended or demoted mid-session.
 */
export const authenticateHardened = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    // 👈 THE LOCK: Verify status against Database Truth
    const user = await User.findById(decoded.userId).select('isSuspended roles').lean();
    
    if (!user || user.isSuspended) {
      return res.status(403).json({ error: 'AUTH_SESSION_REVOKED', message: 'Account inactive.' });
    }

    // Overwrite JWT roles with fresh DB roles
    req.user = { ...decoded, roles: user.roles };
    next();
  } catch (error) {
    res.status(401).json({ error: 'SESSION_INVALID' });
  }
};

/**
 * enforceCapability: Action-Level Authorization
 */
export const enforceCapability = (required: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const roles = req.user?.roles || [];
    
    // Super Admin bypass
    if (roles.includes(UserRole.SUPER_ADMIN)) return next();

    const hasPower = roles.some(role => ROLE_PERMISSIONS[role]?.includes(required));

    if (!hasPower) {
      return res.status(403).json({ 
        error: 'ERROR_INSUFFICIENT_CAPABILITY', 
        message: `Action requires specific authority: ${required}` 
      });
    }
    next();
  };
};

// 3. Self-Action Protection Middleware
export const blockSelfAction = (req: Request, res: Response, next: NextFunction) => {
  const targetId = req.params.id || req.body.userId;
  if (req.user?.userId === targetId) {
    return res.status(403).json({ error: 'SELF_ACTION_BLOCKED' });
  }
  next();
};

/**
 * Advanced Admin Authorization
 * Usage: authorizeAdmin(['super_admin', 'finance_admin'])
 */
export const authorizeAdmin = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    // 1. Super Admins can do anything (The Master Key)
    if (user.roles.includes(UserRole.SUPER_ADMIN)) {
      return next();
    }

    // 2. Check if the user has at least one of the allowed roles
    const hasAccess = user.roles.some(role => allowedRoles.includes(role as UserRole));

    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'FORBIDDEN', 
        message: 'You do not have permission to access this resource.' 
      });
    }

    next();
  };
};

/**
 * PHASE 3: DRIVER ONBOARDING GATE (Strict Authorization)
 * Ensures the user has the 'driver' role AND has passed Admin verification.
 * Use this for operational APIs like going online or accepting orders.
 */
export const authorizeDriver = (req: Request, res: Response, next: NextFunction) => {
  const identity = req.user;

  if (!identity) {
    return res.status(401).json({ error: 'UNAUTHORIZED: Authentication required' });
  }

  // 1. Check Role: Must be a driver
  if (!identity.roles.includes(UserRole.DRIVER)) {
    return res.status(403).json({ error: 'FORBIDDEN: Access restricted to Driver accounts' });
  }

  // 2. Check Verification: The "Onboarding Gate"
  // If role is driver but isVerified is false, return specific error code for frontend redirection
  if (!identity.isVerified) {
    return res.status(403).json({ 
      error: 'VERIFICATION_REQUIRED', 
      message: 'Account pending admin review and approval.' 
    });
  }

  next();
};

export const hydrateIdentity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED: Identity missing' });

    // 1. Fetch live truth from DB
    const user = await User.findById(userId)
      .select('isSuspended roles tokenVersion partnerId assignedLocations')
      .lean();

    // 2. Safety Check: User exists and is active
    if (!user || user.isSuspended) {
      return res.status(403).json({ error: 'AUTH_SESSION_REVOKED', message: 'User is suspended or not found' });
    }

    // 3. Defensive Check: Token Version
    // If the token is old and doesn't have a version, default it to 0 for comparison
    const tokenVersion = (req.user as any).version ?? 0;
    if (user.tokenVersion !== tokenVersion) {
      return res.status(403).json({ 
        error: 'AUTH_SESSION_REVOKED', 
        message: 'Session invalidated. Please log in again.' 
      });
    }

    // 4. Data Preparation: Convert ObjectIds to Strings safely
    const assignedLocations = (user.assignedLocations || []).map(loc => loc.toString());
    const partnerId = user.partnerId ? user.partnerId.toString() : undefined;

    // 5. Hydrate req.user with fresh data
    req.user = {
      ...req.user,
      roles: user.roles,
      partnerId,
      assignedLocations,
      version: user.tokenVersion
    } as any;

    next();
  } catch (error: any) {
    // 👈 LOG THE ACTUAL ERROR TO TERMINAL
    console.error("❌ HYDRATION_CRASH:", error.message);
    res.status(500).json({ error: 'IDENTITY_HYDRATION_FAILURE', detail: error.message });
  }
};