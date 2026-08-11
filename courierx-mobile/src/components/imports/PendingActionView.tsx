import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { AlertTriangle, DollarSign, Upload, ArrowRight, Clock } from 'lucide-react-native';
import { api } from '../../api/client';

interface PendingActionViewProps {
  shipment: any;
  navigation: any;
  onRefresh?: () => void;
}

export const PendingActionView: React.FC<PendingActionViewProps> = ({ shipment, navigation, onRefresh }) => {
  const [submitting, setSubmitting] = useState(false);

  const isWeightDispute = shipment.status === 'WEIGHT_DISPUTE';
  const pendingAction = shipment.pendingAction;

  const handleAction = async () => {
    setSubmitting(true);
    try {
      if (isWeightDispute || pendingAction?.type === 'ACCEPT_REVISED_PRICE') {
        Alert.alert(
          "Accept Revised Weight & Price",
          `Original intake weight was updated to ${shipment.chargeableWeightKg || shipment.intake_weight} kg. Would you like to accept and proceed?`,
          [
            { text: "Cancel" },
            {
              text: "Accept",
              onPress: async () => {
                const res = await api.patch(`/cargo/status/${shipment._id}`, {
                  newStatus: 'IN_TRANSIT',
                  notes: 'Customer accepted revised weight & pricing'
                });
                if (res.data.success) {
                  Alert.alert("Success", "Revised pricing accepted.");
                  onRefresh?.();
                }
              }
            }
          ]
        );
      } else if (pendingAction?.type === 'UPLOAD_CUSTOMS_DOC') {
        Alert.alert("Customs Document", "Document upload options will open.");
      } else if (pendingAction?.type === 'PAY_DUTIES') {
        navigation.navigate('Checkout', { importId: shipment._id });
      }
    } catch (err: any) {
      Alert.alert("Action Failed", err.response?.data?.error || "Could not process request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.warningCard}>
        <View style={styles.iconCircle}>
          <AlertTriangle size={32} color="#B91C1C" />
        </View>
        <Text style={styles.warningTitle}>Customer Action Required</Text>
        <Text style={styles.warningDesc}>
          {isWeightDispute 
            ? "Your package weight was updated during origin intake. Please review the updated weight and cost to resume shipping."
            : (pendingAction?.details || "Additional verification or payment is required for customs processing.")}
        </Text>
      </View>

      <View style={styles.detailsCard}>
        <Text style={styles.cardHeaderTitle}>Action Details</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status Reason</Text>
          <Text style={styles.detailValue}>{isWeightDispute ? 'Weight Discrepancy' : pendingAction?.type}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Verified Weight</Text>
          <Text style={styles.detailValue}>{shipment.chargeableWeightKg || shipment.intake_weight || '--'} kg</Text>
        </View>

        <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.detailLabel}>Revised Freight Cost</Text>
          <Text style={[styles.detailValue, { color: '#B91C1C', fontWeight: '800' }]}>
            ${Number(shipment.pricingSnapshot?.totalCustomerPaid ?? shipment.totalFreightCost ?? 0).toFixed(2)} USD
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.actionBtn} 
        onPress={handleAction}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.actionBtnText}>Resolve Pending Action</Text>
            <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F9FAFB' },
  warningCard: {
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 20
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  warningTitle: { fontSize: 18, fontWeight: '900', color: '#991B1B' },
  warningDesc: { fontSize: 13, color: '#B91C1C', marginTop: 6, textAlign: 'center', lineHeight: 18 },

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
    justify.content: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  detailLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  detailValue: { fontSize: 14, color: '#1F2937', fontWeight: '700' },

  actionBtn: {
    backgroundColor: '#B91C1C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 18,
    elevation: 3
  },
  actionBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 }
});
