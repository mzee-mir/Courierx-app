import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, 
  KeyboardAvoidingView, Platform, Alert, StyleSheet 
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { GoogleLoginButton } from './GoogleLoginButton.';

const SOMALI_PHONE_REGEX = /^(?:\+252|252|0)?(6|7|9)\d{8}$/;

export const LoginScreen = () => {
  const { signIn } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [otp, setOtp] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<'PHONE' | 'OTP'>('PHONE');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const syncWithBackend = async (idToken: string) => {
    setLoading(true);
    try {
      // ARCHITECTURAL CHANGE: Use 'appRole' to trigger dynamic assignment
      const response = await api.post('/auth/verify', { 
        idToken,
        appRole: 'customer' // Verified: matches new backend logic
      });
      
      if (response.data.success) {
        // Customers are generally auto-verified in our current logic
        await signIn(response.data.token, response.data.user);
      }
    } catch (err) {
      Alert.alert('Sync Error', 'Identity verified but CourierX sync failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      Alert.alert('Offline', 'Internet connection required to send SMS.');
      return;
    }

    if (!SOMALI_PHONE_REGEX.test(phoneNumber)) {
      Alert.alert('Invalid Number', 'Please enter a valid Somali phone number.');
      return;
    }

    if (cooldown > 0) return;

    setLoading(true);
    try {
      const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+252${phoneNumber.replace(/^0/, '')}`;
      const confirmation = await auth().signInWithPhoneNumber(formattedNumber);
      setConfirm(confirmation);
      setCooldown(60); 
      setStage('OTP');
    } catch (err: any) {
      Alert.alert('SMS Error', 'Could not send code. Try a test number or check billing.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6 || !confirm) return;
    
    setLoading(true);
    try {
      const userCredential = await confirm.confirm(otp);
      if (userCredential?.user) {
        const idToken = await userCredential.user.getIdToken();
        await syncWithBackend(idToken);
      }
    } catch (err) {
      Alert.alert('Invalid OTP', 'The code entered is incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>CourierX</Text>
        <Text style={styles.subtitle}>Logistics Intelligence for Somalia</Text>
      </View>

      {stage === 'PHONE' ? (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="061XXXXXXX"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            maxLength={10}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            editable={!loading}
          />
          <TouchableOpacity 
            style={[styles.primaryButton, (loading || phoneNumber.length < 10 || cooldown > 0) && styles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={loading || phoneNumber.length < 10 || cooldown > 0}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : 
              <Text style={styles.buttonText}>
                {cooldown > 0 ? `Wait ${cooldown}s` : 'Send Verification Code'}
              </Text>
            }
          </TouchableOpacity>
          
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <GoogleLoginButton 
            onSuccess={syncWithBackend} 
            onLoading={setLoading} 
            disabled={loading} 
          />
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.infoText}>Enter code sent to {phoneNumber}</Text>
          <TextInput
            style={styles.otpInput}
            placeholder="000000"
            placeholderTextColor="#D1D5DB"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
            editable={!loading}
          />
          <TouchableOpacity 
            style={[styles.primaryButton, (loading || otp.length < 6) && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading || otp.length < 6}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Verify Identity</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.textButton} onPress={() => { setStage('PHONE'); setConfirm(null); }}>
            <Text style={styles.textButtonText}>Change phone number</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', paddingHorizontal: 24 },
  header: { marginBottom: 40 },
  title: { fontSize: 42, fontWeight: '900', color: '#2563EB' },
  subtitle: { fontSize: 18, color: '#6B7280', marginTop: 8 },
  form: { width: '100%' },
  input: { backgroundColor: '#F3F4F6', padding: 16, borderRadius: 16, fontSize: 18, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', color: '#1F2937' },
  otpInput: { backgroundColor: '#F3F4F6', padding: 16, borderRadius: 16, fontSize: 32, marginBottom: 16, textAlign: 'center', letterSpacing: 8, fontWeight: 'bold', color: '#1F2937' },
  primaryButton: { backgroundColor: '#2563EB', padding: 18, borderRadius: 16, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#9CA3AF' },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { marginHorizontal: 16, color: '#9CA3AF', fontWeight: '500' },
  infoText: { textAlign: 'center', color: '#4B5563', marginBottom: 16, fontSize: 16 },
  textButton: { marginTop: 24, alignItems: 'center' },
  textButtonText: { color: '#2563EB', fontWeight: '600', fontSize: 16 }
});