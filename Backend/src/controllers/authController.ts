import { Request, Response } from 'express';
import admin from 'firebase-admin';
import { User, UserRole } from '../models/User';
import jwt from 'jsonwebtoken';

export const verifyIdentity = async (req: Request, res: Response) => {
  console.log("the phone reached the server")
  // 'appRole' is the role requested by the app context (customer or driver)
  const { idToken, appRole } = req.body; 

  if (!idToken || !appRole) {
    return res.status(400).json({ error: 'INVALID_REQUEST: Identity token and appRole required' });
  }
  console.log("the phone reached the server")
  try {
    // 1. Verify Identity via Firebase Admin SDK
    const decodedFirebaseToken = await admin.auth().verifyIdToken(idToken);
    const { uid, phone_number, email } = decodedFirebaseToken;

    // 2. Resolve internal identity
    let user = await User.findOne({ firebaseUid: uid });
      console.log("the phone reached the server")
    if (!user) {
      // 3. NEW USER: Initialize with requested role
      // Note: Drivers start as isVerified: false (The Onboarding Gate)
      user = await User.create({
        firebaseUid: uid,
        phoneNumber: phone_number,
        email: email,
        roles: [appRole as UserRole],
        isVerified: false, 
      });
    } else {
      // 4. EXISTING USER: cumulative Role Assignment
      // If a 'customer' logs into the 'driver' app, we add 'driver' to their roles array
      if (!user.roles.includes(appRole as UserRole)) {
        user.roles.push(appRole as UserRole);
        
        // Logical Security: If they just became a driver, they MUST be unverified 
        // until the Admin reviews their new driver documents.
        if (appRole === UserRole.DRIVER) {
          user.isVerified = false;
        }
      }
      
      user.lastLogin = new Date();
      await user.save();
    }

    // 5. Issue Internal session JWT
    const internalToken = jwt.sign(
      { 
        userId: user._id, 
        firebaseUid: uid, 
        roles: user.roles,
        isVerified: user.isVerified 
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      token: internalToken,
      user: {
        _id: user._id,
        phoneNumber: user.phoneNumber,
        roles: user.roles,
        isVerified: user.isVerified,
        displayName: user.displayName
      }
    });

  } catch (error) {
    console.error('AUTH_SYNC_ERROR:', error);
    return res.status(401).json({ error: 'AUTHENTICATION_FAILED' });
  }
};