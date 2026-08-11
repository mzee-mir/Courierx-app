import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Power, DollarSign, User } from 'lucide-react-native';

// Screens
import { DriverHomeScreen } from '../screens/main/DriverHomeScreen';
import { EarningsScreen } from '../screens/main/EarningsScreen';
import { DriverProfileScreen } from '../screens/profile/DriverProfileScreen';

const Tab = createBottomTabNavigator();

export const DriverTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#111827', // Industrial Black
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { 
          height: 120, 
          paddingBottom: 12, 
          paddingTop: 12,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB'
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: 'bold' },
      }}
    >
      <Tab.Screen
        name="Duty"
        component={DriverHomeScreen}
        options={{
          tabBarLabel: 'DUTY',
          tabBarIcon: ({ color }) => 
          <Power color={color} size={24} />,
        }}
      />
      <Tab.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{
          tabBarLabel: 'EARNINGS',
          tabBarIcon: ({ color }) => 
          <DollarSign color={color} size={24} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={DriverProfileScreen}
        options={{
          tabBarLabel: 'PROFILE',
          tabBarIcon: ({ color }) => 
          <User color={color} size={24} />,
        }}
      />
    </Tab.Navigator>
  );
};