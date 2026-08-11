import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Internal Imports
import { setupNotificationListeners, registerAndSyncPushToken } from './src/services/notificationService';
import { useAuth, AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

/**
 * ARCHITECTURAL FIX: 
 * We create an 'AppContent' component to hold logic that requires AuthContext.
 * This component is rendered AS A CHILD of AuthProvider.
 */
const AppContent = () => {
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'AUTHENTICATED') {
      // 1. Refresh token on every Cold Start
      registerAndSyncPushToken();

      // 2. Setup Foreground Data Listener
      const sub = setupNotificationListeners((data) => {
        console.log('Silent Update Received:', data.type);
        if (data.type === 'ORDER_ACCEPTED') {
           // Refetch logic goes here
        }
      });

      return () => sub.remove();
    }
  }, [status]);

  return (
    <NavigationContainer>
      <AppNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* 
            Now AppContent is a child of AuthProvider, 
            so useAuth() inside it will work perfectly. 
          */}
          <AppContent />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}