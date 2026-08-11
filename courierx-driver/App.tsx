import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Driver App Specific Imports
import { DriverNavigator } from './src/navigation/DriverNavigator';
import { AuthProvider } from './src/context/AuthContext';
// 1. Configure React Query for Logistics Reliability
// We prioritize longer stale times to handle Somali network intermittency
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* 
            The AuthProvider handles the 'Driver Role' enforcement 
            logic we built in Step 15.1.
          */}
          <NavigationContainer>
            <DriverNavigator />
            <StatusBar style="dark" />
          </NavigationContainer>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}