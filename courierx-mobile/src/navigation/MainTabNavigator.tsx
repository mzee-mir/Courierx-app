import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Platform } from 'react-native';
import { Map, Package, Wallet as WalletIcon, User, Wallet, Globe } from 'lucide-react-native';

// Screens
import { HomeScreen } from '../screens/main/HomeScreen';
import { OrdersListScreen } from '../screens/orders/OrdersListScreen'; // Placeholder to be built

import { WalletScreen } from '../screens/wallet/WalletScreen'; // Placeholder to be built

import { ProfileScreen } from '../screens/profile/ProfileScreen'; // Placeholder to be built
import { ImportsStack } from './ImportsStack';

const Tab = createBottomTabNavigator();

export const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: { height: 70, paddingBottom: 10, paddingTop: 10 },
      }}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen} 
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ color }) => <Map color={color} size={24} /> }} 
      />
      <Tab.Screen 
        name="ImportsTab" 
        component={ImportsStack} 
        options={{ tabBarLabel: 'Imports', tabBarIcon: ({ color }) => <Globe color={color} size={24} /> }} 
      />
      <Tab.Screen 
        name="WalletTab" 
        component={WalletScreen} 
        options={{ tabBarLabel: 'Wallet', tabBarIcon: ({ color }) => <Wallet color={color} size={24} /> }} 
      />
      <Tab.Screen 
        name="OrdersTab" 
        component={OrdersListScreen} 
        options={{ tabBarLabel: 'Orders', tabBarIcon: ({ color }) => <Package color={color} size={24} /> }} 
      />
      <Tab.Screen 
        name="ProfileTab" 
        component={ProfileScreen} 
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ color }) => <User color={color} size={24} /> }} 
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    elevation: 8, // Shadow for Android
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});