import * as jwt from 'jsonwebtoken'; // 👈 Namespace import
import { NextFunction, Request, Response } from "express";
export const requireSudo = (req: Request, res: Response, next: NextFunction) => {
  const sudoToken = req.headers['x-sudo-token'] as string;
  if (!sudoToken) return res.status(403).json({ error: 'SUDO_MODE_REQUIRED' });

  try {
    // 👈 verify now exists on the jwt namespace
    const decoded = jwt.verify(sudoToken, process.env.JWT_SECRET!) as {
      sudo: boolean;
      userId: string;
    };

    if (!decoded.sudo || decoded.userId !== req.user?.userId) {
      return res.status(403).json({ error: 'SUDO_IDENTITY_MISMATCH' });
    }
    
    next();
  } catch (err) {
    res.status(403).json({ error: 'SUDO_SESSION_EXPIRED' });
  }
};