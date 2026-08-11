import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

const TOKEN_CACHE_KEY = '@courierx_fcm_token';

export const getNotificationPermissionStatus = async () => {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
};

export const openAppSettings = () => {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    Linking.openSettings();
  }
};

export const registerAndSyncPushToken = async () => {
  if (!Device.isDevice) return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    // Get FCM Token
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data;

    // Feature: Token Refresh Logic (Sync only if changed)
    const cachedToken = await AsyncStorage.getItem(TOKEN_CACHE_KEY);
    if (token !== cachedToken) {
      await api.patch('/profile/push-token', { pushToken: token });
      await AsyncStorage.setItem(TOKEN_CACHE_KEY, token);
      console.log('FCM Token Refreshed & Synced');
    }

    return token;
  } catch (err) {
    console.error('PUSH_REG_ERROR', err);
    return null;
  }
};

// Feature: Data Message Handling
// This listener runs when a notification is received while the app is foregrounded
export const setupNotificationListeners = (onDataReceived: (data: any) => void) => {
  const subscription = Notifications.addNotificationReceivedListener(notification => {
    const data = notification.request.content.data;
    
    // Logic: If the payload has a 'type: ORDER_UPDATE', trigger the callback
    if (data && data.type) {
      onDataReceived(data);
    }
  });

  return subscription;
};