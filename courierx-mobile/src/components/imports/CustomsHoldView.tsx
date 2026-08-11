import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ShieldAlert, FileText, PhoneCall } from 'lucide-react-native';

interface CustomsHoldViewProps {
  shipment: any;
  navigation: any;
}

export const CustomsHoldView: React.FC<CustomsHoldViewProps> = ({ shipment, navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.holdCard}>
        <View style={styles.iconCircle}>
          <ShieldAlert size={36} color="#C2410C" />
        </View>
        <Text style={styles.holdTitle}>Customs Hold</Text>
        <Text style={styles.holdDesc}>
          Your shipment is currently held by Somalia customs authorities for physical inspection or duty assessment.
        </Text>
      </View>

      <View style={styles.detailsCard}>
        <Text style={styles.cardHeaderTitle}>Shipment Information</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Tracking Number</Text>
          <Text style={styles.detailValue}>{shipment.externalTrackingNumber}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Declared Value</Text>
          <Text style={styles.detailValue}>
            ${shipment.customsDeclaration?.declaredValue?.toFixed(2) || '0.00'} USD
          </Text>
        </View>

        <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.detailLabel}>HS Code</Text>
          <Text style={styles.detailValue}>{shipment.customsDeclaration?.hsCode || 'Standard'}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.supportBtn}
        onPress={() => Alert.alert("Customs Support", "Connecting to CourierX clearing team support line.")}
        activeOpacity={0.85}
      >
        <PhoneCall size={18} color="#FFFFFF" />
        <Text style={styles.supportBtnText}>Contact Clearing Agent</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F9FAFB' },
  holdCard: {
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    marginBottom: 20
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  holdTitle: { fontSize: 20, fontWeight: '900', color: '#9A3412' },
  holdDesc: { fontSize: 13, color: '#C2410C', marginTop: 6, textAlign: 'center', lineHeight: 18 },

  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6
  },
  cardHeaderTitle: { fontSize: 13, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 14 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  detailLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  detailValue: { fontSize: 14, color: '#1F2937', fontWeight: '700' },

  supportBtn: {
    backgroundColor: '#EA580C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 18,
    elevation: 3
  },
  supportBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, marginLeft: 8 }
});
