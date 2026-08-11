import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CheckCircle2, Download, RefreshCw, FileText } from 'lucide-react-native';
import { api } from '../../api/client';

interface DeliveredSummaryProps {
  shipment: any;
  navigation: any;
}

export const DeliveredSummary: React.FC<DeliveredSummaryProps> = ({ shipment, navigation }) => {
  const [downloading, setDownloading] = useState(false);

  const deliveredDate = shipment.updatedAt ? new Date(shipment.updatedAt).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : 'Delivered';

  const partnerName = shipment.partnerId?.name || 'CourierX Logistics';
  const verifiedWeight = shipment.chargeableWeightKg ?? shipment.intake_weight ?? '--';
  const freightPaid = shipment.pricingSnapshot?.totalCustomerPaid ?? shipment.totalFreightCost ?? 0;
  const vehicle = shipment.preferredLocalVehicle?.toUpperCase() || 'BAJAJ';

  const handleDownloadReceipt = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/cargo/${shipment._id}/receipt`);
      if (res.data.success && res.data.receipt) {
        const r = res.data.receipt;
        Alert.alert(
          `Receipt #${r.receiptNumber}`,
          `Item: ${r.shipment.itemDescription}\nFreight Paid: $${r.financials.totalFreightPaid.toFixed(2)} USD\nVerified Weight: ${r.weights.verified} ${r.weights.unit}\nIssued: ${new Date(r.issuedAt).toLocaleDateString()}`
        );
      }
    } catch (err: any) {
      Alert.alert("Receipt Error", "Unable to fetch receipt details at this time.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.successBanner}>
        <View style={styles.iconCircle}>
          <CheckCircle2 size={36} color="#15803D" />
        </View>
        <Text style={styles.bannerTitle}>Delivered Successfully</Text>
        <Text style={styles.bannerSubtitle}>Your package arrived and handoff was confirmed</Text>
      </View>

      <View style={styles.detailsCard}>
        <Text style={styles.cardHeaderTitle}>Shipment Summary</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Delivered On</Text>
          <Text style={styles.detailValue}>{deliveredDate}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Origin Partner</Text>
          <Text style={styles.detailValue}>{partnerName}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Verified Weight</Text>
          <Text style={styles.detailValue}>{verifiedWeight} kg</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Freight Paid</Text>
          <Text style={[styles.detailValue, { color: '#2563EB', fontWeight: '800' }]}>
            ${Number(freightPaid).toFixed(2)} USD
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Delivery Method</Text>
          <Text style={styles.detailValue}>{vehicle}</Text>
        </View>

        <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.detailLabel}>Tracking Number</Text>
          <Text style={[styles.detailValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
            {shipment.externalTrackingNumber}
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={styles.receiptBtn} 
          onPress={handleDownloadReceipt}
          disabled={downloading}
          activeOpacity={0.8}
        >
          {downloading ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <>
              <FileText size={18} color="#2563EB" />
              <Text style={styles.receiptBtnText}>View Receipt</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.reimportBtn} 
          onPress={() => navigation.navigate('SelectPartner')}
          activeOpacity={0.8}
        >
          <RefreshCw size={18} color="#FFFFFF" />
          <Text style={styles.reimportBtnText}>Import Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F9FAFB' },
  successBanner: {
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#BBF7D0',
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
  bannerTitle: { fontSize: 20, fontWeight: '900', color: '#14532D' },
  bannerSubtitle: { fontSize: 13, color: '#15803D', marginTop: 4, textAlign: 'center' },

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
  cardHeaderTitle: { fontSize: 14, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 0.5 },
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

  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  receiptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 16,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  receiptBtnText: { color: '#2563EB', fontWeight: '800', fontSize: 14, marginLeft: 8 },
  reimportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 16,
    marginLeft: 8
  },
  reimportBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, marginLeft: 8 }
});
