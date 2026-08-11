import React, { useEffect } from 'react';
import { TouchableOpacity, Text, Alert, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google'; // Fix: Import Google provider
import NetInfo from '@react-native-community/netinfo';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

WebBrowser.maybeCompleteAuthSession();

interface Props {
  onSuccess: (idToken: string) => void;
  onLoading: (isLoading: boolean) => void;
  disabled?: boolean;
}

export const GoogleLoginButton: React.FC<Props> = ({ onSuccess, onLoading, disabled }) => {
  // Configured with Client IDs from Google Cloud Console
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_GOOGLE_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_IOS_GOOGLE_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID, // Highly recommended for cross-platform
  });

  // Effect to handle the response when it changes
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleFirebaseSignIn(id_token);
    } else if (response?.type === 'error' || response?.type === 'cancel') {
      onLoading(false);
    }
  }, [response]);

  const handleFirebaseSignIn = async (idToken: string) => {
    try {
      const auth = getAuth();
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseToken = await userCredential.user.getIdToken();
      
      onSuccess(firebaseToken);
    } catch (error) {
      console.error('FIREBASE_AUTH_ERROR:', error);
      Alert.alert('Auth Error', 'Failed to sync with Firebase.');
      onLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      Alert.alert('System Offline', 'Please check your internet connection.');
      return;
    }

    onLoading(true);
    promptAsync();
  };

  return (
    <TouchableOpacity 
      onPress={handleGoogleAuth}
      disabled={!request || disabled}
      style={[styles.button, (!request || disabled) && styles.buttonDisabled]}
    >
      <Text style={styles.buttonText}>Continue with Google</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#374151',
    fontWeight: 'bold',
    fontSize: 18,
  },
});