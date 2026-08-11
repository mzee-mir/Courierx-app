import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  throw new Error('CRITICAL_SECURITY_ERROR: Missing Firebase Admin Environment Variables');
}

// Ensure private key handles newlines correctly for production environments
const formattedPrivateKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: formattedPrivateKey,
    }),
  });
  console.log('SECURITY_NOTICE: Firebase Admin SDK Initialized Successfully');
} catch (error) {
  console.error('SECURITY_ERROR: Firebase Admin Initialization Failed:', error);
  process.exit(1);
}

export const auth = admin.auth();