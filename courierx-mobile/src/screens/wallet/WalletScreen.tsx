import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert, Modal, TextInput 
} from 'react-native';
import { ShieldCheck, Info, Clock, CheckCircle, X } from 'lucide-react-native';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const WalletScreen = () => {
  const { user } = useAuth();
  const [isModalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [isPending, setIsPending] = useState(false); // Lag management
  const [isSubmitting, setIsSubmitting] = useState(false);

  // -- Feature: Real-time Fee Display --
  const carrierFee = amount ? (parseFloat(amount) > 10 ? 0.25 : 0.10) : 0;
  const totalAmount = amount ? parseFloat(amount) + carrierFee : 0;

  const fetchBalance = async () => {
    // Balance derived from user tokenBalance; no API call needed.
    return;
  };

  const handleDeposit = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.post('/wallet/deposit', { 
        amount: parseFloat(amount),
        phoneNumber: 'user_phone' 
      });

      if (res.data.success) {
        setIsPending(true); // Move to "Waiting for PIN" state
        setModalVisible(false);
        startPolling(res.data.transactionId);
      }
    } catch (err) {
      Alert.alert("Error", "Request failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -- Feature: Verification Lag Polling --
  const startPolling = (txId: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await api.get(`/wallet/status/${txId}`);
        // For MVP, the backend will auto-complete after simulation
        if (res.data.status === 'completed' || attempts > 5) {
          clearInterval(interval);
          setIsPending(false);
          setAmount('');
          
        }
      } catch (e) { clearInterval(interval); }
    }, 3000);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>My Funds</Text>
        
        <View style={styles.balanceCard}>
          <Text style={styles.balLabel}>Current Balance</Text>
          <Text style={styles.balValue}>{user?.tokenBalance ?? 0} CXC</Text>
          <TouchableOpacity style={styles.btn} onPress={() => setModalVisible(true)}>
            <Text style={styles.btnText}>+ Add Money (EVC+)</Text>
          </TouchableOpacity>
        </View>

        {/* Security Notice */}
        <View style={styles.securityNote}>
          <ShieldCheck size={16} color="#059669" />
          <Text style={styles.securityText}>Your balance is secured by CourierX Backend.</Text>
        </View>
      </ScrollView>

      {/* Top-up Modal with Fee Preview */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deposit Funds</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><X color="black" /></TouchableOpacity>
            </View>

            <TextInput 
              style={styles.input} 
              placeholder="0.00" 
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />

            {/* Feature: Fee Breakdown */}
            {amount !== '' && (
              <View style={styles.feeBox}>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Carrier Fee (Hormuud/Somtel):</Text>
                  <Text style={styles.feeValue}>${carrierFee.toFixed(2)}</Text>
                </View>
                <View style={[styles.feeRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Charge on Phone:</Text>
                  <Text style={styles.totalValue}>${totalAmount.toFixed(2)}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.confirmBtn} onPress={handleDeposit} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="white" /> : <Text style={styles.confirmText}>Confirm & Send STK Push</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Feature: Pending Verification Lag State */}
      <Modal visible={isPending} transparent animationType="fade">
        <View style={styles.pendingOverlay}>
          <View style={styles.pendingCard}>
            <Clock size={48} color="#2563EB" />
            <Text style={styles.pendingTitle}>Check your phone!</Text>
            <Text style={styles.pendingSub}>We sent an EVC+ push. Enter your PIN on your phone to complete the deposit.</Text>
            <ActivityIndicator style={{marginTop: 20}} />
            <Text style={styles.timerText}>Waiting for carrier confirmation...</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  balanceCard: { backgroundColor: '#1F2937', padding: 30, borderRadius: 24, alignItems: 'center' },
  balLabel: { color: '#9CA3AF', marginBottom: 10 },
  balValue: { color: 'white', fontSize: 48, fontWeight: 'bold', marginBottom: 25 },
  btn: { backgroundColor: '#2563EB', paddingHorizontal: 25, paddingVertical: 15, borderRadius: 15 },
  btnText: { color: 'white', fontWeight: 'bold' },
  securityNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  securityText: { fontSize: 12, color: '#059669', marginLeft: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 15, padding: 20, fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  feeBox: { backgroundColor: '#F0F9FF', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#BAE6FD' },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  feeLabel: { fontSize: 12, color: '#0369A1' },
  feeValue: { fontSize: 12, fontWeight: 'bold', color: '#0369A1' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#BAE6FD', marginTop: 5, paddingTop: 5 },
  totalLabel: { fontWeight: 'bold', color: '#0C4A6E' },
  totalValue: { fontWeight: 'bold', color: '#0C4A6E' },
  confirmBtn: { backgroundColor: '#2563EB', padding: 18, borderRadius: 15, alignItems: 'center' },
  confirmText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  pendingOverlay: { flex: 1, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', padding: 40 },
  pendingCard: { alignItems: 'center' },
  pendingTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 20, color: '#111827' },
  pendingSub: { textAlign: 'center', color: '#6B7280', marginTop: 10, lineHeight: 20 },
  timerText: { fontSize: 12, color: '#9CA3AF', marginTop: 15 }
});