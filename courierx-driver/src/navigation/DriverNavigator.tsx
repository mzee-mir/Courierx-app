import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

// Screen Imports
import { DriverLoginScreen } from '../screens/auth/DriverLoginScreen';
import { DriverOnboardingScreen } from '../screens/auth/DriverOnboardingScreen';
import { OrderCompletedScreen } from '../screens/main/OrderCompletedScreen';
import { WaitingForApprovalScreen } from '../screens/auth/WaitingForApprovalScreen';
import { ActiveOrderScreen } from '../screens/main/ActiveOrderScreen';
import { DriverTabNavigator } from './DriverTabNavigator';

export type DriverStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  WaitingForApproval: undefined;
  MainTabs: undefined; 
  ActiveOrder: { orderId: string };
  OrderCompleted: { order: any; earnings: number };
};

const Stack = createNativeStackNavigator<DriverStackParamList>();

export const DriverNavigator = () => {
  const { status } = useAuth();

  if (status === 'INITIALIZING') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      // ✅ FIX: Removed initialRouteName. 
      // React Navigation will pick the first screen available in the logic below.
    >
      {status === 'UNAUTHENTICATED' ? (
        // Branch 1: User must log in
        <Stack.Group>
          <Stack.Screen name="Login" component={DriverLoginScreen} />
        </Stack.Group>
      ) : status === 'PENDING_APPROVAL' ? (
        // Branch 2: User is logged in but unverified
        <Stack.Group>
          <Stack.Screen name="Onboarding" component={DriverOnboardingScreen} />
          <Stack.Screen name="WaitingForApproval" component={WaitingForApprovalScreen} />
        </Stack.Group>
      ) : (
        // Branch 3: User is fully authorized
        <Stack.Group>
          {/* MainTabs is now the 'First' screen in this group, so it becomes the initial route */}
          <Stack.Screen name="MainTabs" component={DriverTabNavigator} />
          <Stack.Screen name="OrderCompleted" component={OrderCompletedScreen} />
          <Stack.Screen name="ActiveOrder" component={ActiveOrderScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});