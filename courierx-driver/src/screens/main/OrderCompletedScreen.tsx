import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { CheckCircle2, DollarSign, MapPin, User, ChevronRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export const OrderCompletedScreen = ({ route, navigation }: any) => {
  const { order, earnings } = route.params;

  const handleFinish = () => {
    navigation.navigate('MainTabs'); // Return to Duty Board
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* 1. Success Header */}
        <View style={styles.successHeader}>
          <View style={styles.iconCircle}>
            <CheckCircle2 size={60} color="#059669" />
          </View>
          <Text style={styles.title}>Job Completed!</Text>
          <Text style={styles.subtitle}>Payment has been settled and added to your wallet.</Text>
        </View>

        {/* 2. Earnings Card */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>YOU EARNED</Text>
          <View style={styles.priceRow}>
            <Text style={styles.currency}>$</Text>
            <Text style={styles.amount}>{earnings.toFixed(2)}</Text>
          </View>
        </View>

        {/* 3. Trip Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionLabel}>Trip Summary</Text>
          
          <View style={styles.summaryRow}>
            <User size={18} color="#6B7280" />
            <Text style={styles.summaryText}>{order.customerId.displayName}</Text>
          </View>

          <View style={styles.summaryRow}>
            <MapPin size={18} color="#6B7280" />
            <Text style={styles.summaryText} numberOfLines={1}>{order.dropoffLandmark}</Text>
          </View>

          <View style={styles.feeInfo}>
            <Text style={styles.feeLabel}>Total Fare: ${order.price.toFixed(2)}</Text>
            <Text style={styles.feeLabel}>Platform Fee (15%): -${order.commission.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* 4. Bottom Action */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneBtn} onPress={handleFinish}>
          <Text style={styles.doneBtnText}>BACK TO DUTY BOARD</Text>
          <ChevronRight size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, padding: 30, paddingTop: 100, alignItems: 'center' },
  successHeader: { alignItems: 'center', marginBottom: 40 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#111827' },
  subtitle: { textAlign: 'center', color: '#6B7280', marginTop: 10, lineHeight: 22, fontSize: 15 },
  earningsCard: { backgroundColor: '#111827', width: '100%', borderRadius: 24, padding: 30, alignItems: 'center', marginBottom: 30 },
  earningsLabel: { color: '#10B981', fontWeight: 'bold', fontSize: 12, letterSpacing: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
  currency: { color: 'white', fontSize: 24, fontWeight: 'bold', marginTop: 8, marginRight: 4 },
  amount: { color: 'white', fontSize: 56, fontWeight: '900' },
  summarySection: { width: '100%', padding: 20, backgroundColor: '#F9FAFB', borderRadius: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  summaryText: { marginLeft: 12, fontSize: 15, fontWeight: '600', color: '#374151' },
  feeInfo: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  feeLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  footer: { padding: 30, paddingBottom: 50 },
  doneBtn: { backgroundColor: '#2563EB', padding: 22, borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  doneBtnText: { color: 'white', fontWeight: '900', fontSize: 16, marginRight: 10 }
});