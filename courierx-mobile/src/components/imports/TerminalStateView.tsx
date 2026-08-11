import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { XCircle, HelpCircle, ArrowLeft } from 'lucide-react-native';

interface TerminalStateViewProps {
  shipment: any;
  navigation: any;
}

export const TerminalStateView: React.FC<TerminalStateViewProps> = ({ shipment, navigation }) => {
  const status = shipment.status;

  const getTerminalConfig = () => {
    switch (status) {
      case 'CANCELLED':
        return {
          title: 'Shipment Cancelled',
          desc: 'This import declaration was cancelled by you or our operations team.',
          bg: '#F3F4F6',
          border: '#E5E7EB',
          text: '#4B5563',
          iconColor: '#6B7280'
        };
      case 'EXPIRED':
        return {
          title: 'Declaration Expired',
          desc: 'This tracking declaration exceeded the 90-day intake window without arriving at the hub.',
          bg: '#FEF3C7',
          border: '#FDE68A',
          text: '#92400E',
          iconColor: '#D97706'
        };
      case 'LOST':
        return {
          title: 'Shipment Flagged Lost',
          desc: 'This item was flagged missing in transit. Our support team will issue compensation per insurance terms.',
          bg: '#FEF2F2',
          border: '#FCA5A5',
          text: '#991B1B',
          iconColor: '#DC2626'
        };
      default:
        return {
          title: `Status: ${status}`,
          desc: 'This shipment is in a finalized state.',
          bg: '#F3F4F6',
          border: '#E5E7EB',
          text: '#4B5563',
          iconColor: '#6B7280'
        };
    }
  };

  const config = getTerminalConfig();

  return (
    <View style={styles.container}>
      <View style={[styles.statusCard, { backgroundColor: config.bg, borderColor: config.border }]}>
        <View style={styles.iconCircle}>
          <XCircle size={36} color={config.iconColor} />
        </View>
        <Text style={[styles.title, { color: config.text }]}>{config.title}</Text>
        <Text style={[styles.desc, { color: config.text }]}>{config.desc}</Text>
      </View>

      <View style={styles.detailsCard}>
        <Text style={styles.cardHeaderTitle}>Summary Record</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Tracking Number</Text>
          <Text style={styles.detailValue}>{shipment.externalTrackingNumber}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Item Description</Text>
          <Text style={styles.detailValue}>{shipment.itemDescription}</Text>
        </View>

        <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.detailLabel}>Origin Country</Text>
          <Text style={styles.detailValue}>{shipment.originCountry}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
      >
        <ArrowLeft size={18} color="#FFFFFF" />
        <Text style={styles.backBtnText}>Back to Imports</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F9FAFB' },
  statusCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
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
  title: { fontSize: 20, fontWeight: '900' },
  desc: { fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 18 },

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

  backBtn: {
    backgroundColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 18,
    elevation: 3
  },
  backBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, marginLeft: 8 }
});
