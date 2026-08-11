import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle2, FileText, ChevronRight, DollarSign } from 'lucide-react-native';

interface HistoryImportCardProps {
  item: any;
  onPress: () => void;
  onViewReceipt?: () => void;
}

export const HistoryImportCard: React.FC<HistoryImportCardProps> = ({ item, onPress, onViewReceipt }) => {
  const trackingID = (item.externalTrackingNumber || '').slice(-10).toUpperCase();

  const isDelivered = item.status === 'DELIVERED';
  const deliveredDate = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : 'Delivered';

  const totalCost = item.pricingSnapshot?.totalCustomerPaid ?? item.totalFreightCost ?? 0;

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress} 
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Completed shipment ${item.itemDescription}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.trackingGroup}>
          <CheckCircle2 size={16} color={isDelivered ? "#059669" : "#6B7280"} />
          <Text style={styles.idText}>CX-{trackingID}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: isDelivered ? '#DCFCE7' : '#F3F4F6' }]}>
          <Text style={[styles.statusText, { color: isDelivered ? '#15803D' : '#4B5563' }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <Text style={styles.itemTitle} numberOfLines={1}>{item.itemDescription}</Text>

      <View style={styles.metaRow}>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Delivered On</Text>
          <Text style={styles.metaValue}>{deliveredDate}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Freight Paid</Text>
          <Text style={styles.metaValue}>${Number(totalCost).toFixed(2)} USD</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Weight</Text>
          <Text style={styles.metaValue}>{item.chargeableWeightKg || item.intake_weight || '--'} kg</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        {isDelivered && onViewReceipt ? (
          <TouchableOpacity 
            style={styles.receiptBtn} 
            onPress={onViewReceipt}
            activeOpacity={0.7}
          >
            <FileText size={14} color="#2563EB" />
            <Text style={styles.receiptBtnText}>View Receipt</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}

        <View style={styles.detailsBtn}>
          <Text style={styles.detailsBtnText}>View Summary</Text>
          <ChevronRight size={16} color="#3B82F6" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  trackingGroup: { flexDirection: 'row', alignItems: 'center' },
  idText: { fontSize: 13, color: '#4B5563', fontWeight: '800', marginLeft: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937', marginBottom: 14 },
  
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
  },
  metaCol: { flex: 1, alignItems: 'flex-start' },
  metaLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' },
  metaValue: { fontSize: 12, fontWeight: '800', color: '#1F2937', marginTop: 2 },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  receiptBtnText: { color: '#2563EB', fontWeight: '800', fontSize: 12, marginLeft: 4 },
  detailsBtn: { flexDirection: 'row', alignItems: 'center' },
  detailsBtnText: { color: '#3B82F6', fontWeight: '800', fontSize: 13, marginRight: 2 },
});
