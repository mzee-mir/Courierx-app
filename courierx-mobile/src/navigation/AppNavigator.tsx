import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

// Screens & Navigators
import { LoginScreen } from '../screens/auth/LoginScreen';
import { OrderTrackingScreen } from '../screens/main/OrderTrackingScreen';
import { MainTabNavigator } from './MainTabNavigator';

// 1. UPDATED: Define Type-Safe Route Parameters
// We must include every 'name' used in Stack.Screen here.
export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined; // This resolves the "MainTabs is not assignable" error
  OrderTracking: { orderId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { status } = useAuth();

  // Handle System Initialization
  if (status === 'INITIALIZING' || status === 'VALIDATING') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {status === 'AUTHENTICATED' || status === 'OFFLINE_AUTH' ? (
        <Stack.Group>
          {/* MainTabs is now correctly typed in RootStackParamList above */}
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});