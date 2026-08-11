import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth, 
  getReactNativePersistence 
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * These credentials are found in your Firebase Console:
 * Project Settings > General > Your Apps > (Add Android/iOS app)
 * 
 * SECURITY NOTE: These are NOT the same as your Backend Service Account JSON.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyDPmyOnNC_FyRYtpWCuhlTykCnowOiM8gc",
  projectId: "courierx-718ae",
  storageBucket: "courierx-718ae.firebasestorage.app",
  messagingSenderId: "538311912712",
  appId: "1:538311912712:android:74e1fa2e5ef3d6c0ad90bd",
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/**
 * We use ReactNativePersistence with AsyncStorage to ensure that 
 * Firebase's internal "Identity" survives when the user closes the app.
 * This is separate from our "Session" (Internal JWT) stored in SecureStore.
 */
let auth;

if (!getApps().length) {
  const app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  auth = getAuth(getApp());
}

export { auth };;