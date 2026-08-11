import { Request, Response } from 'express';
import { User, UserRole } from '../models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AdminAuditLog } from '../models/AdminAuditLog';

export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 1. Find user with security fields
    const user = await User.findOne({ email }).select('+password +failedLoginAttempts +lockUntil');

    if (!user) {
      return res.status(401).json({ error: 'AUTHENTICATION_FAILED' });
    }

    // 2. Check Brute Force Lockout
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      return res.status(429).json({
        error: 'ACCOUNT_LOCKED',
        message: `Too many failed attempts. Try again in ${remainingMinutes} minutes.`
      });
    }

    // 3. Verify Role Eligibility
    const adminRoles = [
      UserRole.SUPER_ADMIN,
      UserRole.OPS_ADMIN,
      UserRole.FINANCE_ADMIN,
      UserRole.SUPPORT_ADMIN,
      UserRole.PARTNER_OWNER,
      UserRole.PARTNER_OPS,
      UserRole.PARTNER_READONLY,
    ];
    const hasAdminAccess = user.roles.some(role => adminRoles.includes(role as UserRole));

    if (!hasAdminAccess) {
      return res.status(403).json({ error: 'FORBIDDEN: NOT_AN_ADMIN' });
    }

    // 4. Validate Password
    const isMatch = await bcrypt.compare(password, user.password || '');

    if (!isMatch) {
      // Increment failed attempts
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30-minute lockout

        // Immutable Security Alert
        await AdminAuditLog.create({
          adminId: user._id,
          action: 'SECURITY_ALERT',
          targetId: user._id,
          targetModel: 'User',
          details: `Brute force detected. Account locked for 30 mins. IP: ${req.ip}`,
          requestId: req.id // Traceability
        });
      }

      await user.save();
      return res.status(401).json({ error: 'AUTHENTICATION_FAILED' });
    }

    // 5. Success: Reset security counters
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

    // 6. Create Session Fingerprint (SHA256 of IP + User Agent)
    const fingerprint = crypto
      .createHash('sha256')
      .update((req.ip || '') + (req.headers['user-agent'] || ''))
      .digest('hex');

    // 7. Issue Token with Fingerprint
    const token = jwt.sign(
      {
        userId: user._id,
        roles: user.roles,
        fp: fingerprint,
        version: user.tokenVersion
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '8h' } // Strict 8-hour shift length
    );

    // 8. Log successful entry
    await AdminAuditLog.create({
      adminId: user._id,
      action: 'ADMIN_LOGIN',
      targetId: user._id,
      targetModel: 'User',
      details: 'Successful administrative login.',
      requestId: req.id,
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles,
        imageUrl: user.imageUrl || "",
        assignedLocations: user.assignedLocations,
        permissions: user.permissions
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
};

export const verifySudoMode = async (req: Request, res: Response) => {
  const { password } = req.body;
  const user = await User.findById(req.user?.userId).select('+password');

  if (!user || !(await bcrypt.compare(password, user.password || ''))) {
    return res.status(401).json({ error: 'SUDO_VERIFICATION_FAILED' });
  }

  // Issue a 5-minute specialized token
  const sudoToken = jwt.sign(
    { sudo: true, userId: user._id },
    process.env.JWT_SECRET!,
    { expiresIn: '5m' }
  );

  res.json({ success: true, sudoToken });
};