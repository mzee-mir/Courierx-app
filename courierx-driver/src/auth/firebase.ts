import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Use the SAME config from your Firebase Console (Web App)
export const firebaseConfig = {
  apiKey: "AIzaSy...", 
  authDomain: "courierx-718ae.firebaseapp.com",
  projectId: "courierx-718ae",
  storageBucket: "courierx-718ae.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});