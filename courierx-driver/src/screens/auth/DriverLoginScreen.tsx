import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, 
  Alert, StyleSheet, KeyboardAvoidingView, Platform 
} from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const DriverLoginScreen = () => {
  const { signIn } = useAuth();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<'PHONE' | 'OTP'>('PHONE');

  const isPhoneValid = phoneNumber.length === 10;
  const isOtpValid = otp.length === 6;

  const handleSendCode = async () => {
    if (!isPhoneValid || loading) return;
    setLoading(true);
    try {
      const formatted = phoneNumber.startsWith('+') ? phoneNumber : `+252${phoneNumber.replace(/^0+/, '')}`;
      const confirmation = await auth().signInWithPhoneNumber(formatted);
      setConfirm(confirmation);
      setStage('OTP');
    } catch (err: any) {
      Alert.alert('SMS Error', 'Could not send verification code. Try a test number.');
    } finally {
      setLoading(false);
    }
  };

  // Inside handleVerifyOtp:
const handleVerifyOtp = async () => {
  if (otp.length < 6 || !confirm || loading) return;
  setLoading(true);

  try {
    // 1. Verify code first
    const userCredential = await confirm.confirm(otp);

    // 2. Validate that Firebase returned a user
    if (!userCredential || !userCredential.user) {
      throw new Error('Firebase verification failed');
    }

    // 3. Now it is safe to get the token
    const idToken = await userCredential.user.getIdToken();

    // 4. Sync with Backend
    const res = await api.post('/auth/verify', { 
      idToken, 
      appRole: 'driver'
    });

    if (res.data.success) {
      await signIn(res.data.token, res.data.user);
    }
  } catch (err: any) {
    // Check if it's a role issue or a code issue
    if (err.message === 'NOT_A_DRIVER_ACCOUNT') {
       Alert.alert("Denied", "This account is for customers.");
    } else {
       Alert.alert("Error", "The code is incorrect or expired.");
    }
  } finally {
    setLoading(false);
  }
};
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.badge}>COURIERX LOGISTICS</Text>
        <Text style={styles.title}>Driver Duty</Text>
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
            style={[styles.btn, (!isPhoneValid || loading) && styles.btnDisabled]} 
            onPress={handleSendCode} 
            disabled={!isPhoneValid || loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Login to Start Duty</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.infoLabel}>Enter 6-digit code sent to {phoneNumber}</Text>
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
            style={[styles.btn, (!isOtpValid || loading) && styles.btnDisabled]} 
            onPress={handleVerifyOtp} 
            disabled={!isOtpValid || loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Verify & Start</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStage('PHONE')}>
            <Text style={styles.backBtnText}>Use different number</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', padding: 30 },
  header: { marginBottom: 40 },
  badge: { color: '#2563EB', fontWeight: '900', fontSize: 11, letterSpacing: 2, marginBottom: 5 },
  title: { fontSize: 36, fontWeight: '900', color: '#111827' },
  form: { width: '100%' },
  infoLabel: { textAlign: 'center', color: '#6B7280', marginBottom: 15, fontSize: 14 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 16, padding: 22, fontSize: 18, marginBottom: 15, color: '#111827', fontWeight: '600' },
  otpInput: { backgroundColor: '#F3F4F6', borderRadius: 16, padding: 22, fontSize: 36, textAlign: 'center', letterSpacing: 10, marginBottom: 15, fontWeight: 'bold' },
  btn: { backgroundColor: '#111827', borderRadius: 18, padding: 22, alignItems: 'center', elevation: 4 },
  btnDisabled: { backgroundColor: '#9CA3AF', elevation: 0 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  backBtn: { marginTop: 20, alignItems: 'center' },
  backBtnText: { color: '#6B7280', fontWeight: '600' }
});