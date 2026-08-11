import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Package, ChevronRight, Clock, AlertCircle } from 'lucide-react-native';

interface ActiveImportCardProps {
  item: any;
  onPress: () => void;
}

export const ActiveImportCard: React.FC<ActiveImportCardProps> = ({ item, onPress }) => {
  const trackingID = (item.externalTrackingNumber || '').slice(-10).toUpperCase();

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s.includes('ARRIVED') || s.includes('READY')) {
      return { label: 'ARRIVED LOCAL', bg: '#DCFCE7', text: '#15803D' };
    }
    if (s.includes('TRANSIT') || s.includes('CONSOLIDATED')) {
      return { label: 'IN TRANSIT', bg: '#DBEAFE', text: '#1D4ED8' };
    }
    if (s.includes('HOLD') || s.includes('DISPUTE')) {
      return { label: 'ACTION NEEDED', bg: '#FEE2E2', text: '#B91C1C' };
    }
    if (s.includes('RECEIVED')) {
      return { label: 'RECEIVED ORIGIN', bg: '#FEF3C7', text: '#B45309' };
    }
    return { label: 'DECLARED', bg: '#F3F4F6', text: '#4B5563' };
  };

  const statusBadge = getStatusBadge(item.status);

  // Compute days in current status
  const updatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date();
  const daysInStatus = Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress} 
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Active shipment ${item.itemDescription}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.trackingGroup}>
          <Package size={16} color="#3B82F6" />
          <Text style={styles.idText}>CX-{trackingID}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
          <Text style={[styles.statusText, { color: statusBadge.text }]}>
            {statusBadge.label}
          </Text>
        </View>
      </View>

      <Text style={styles.itemTitle} numberOfLines={1}>{item.itemDescription}</Text>

      {item.pendingAction && (
        <View style={styles.pendingActionNotice}>
          <AlertCircle size={14} color="#B91C1C" />
          <Text style={styles.pendingActionText} numberOfLines={1}>
            {item.pendingAction.details || 'Customer action required for clearance'}
          </Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.timeInfo}>
          <Clock size={12} color="#6B7280" />
          <Text style={styles.timeText}>
            {daysInStatus === 0 ? 'Updated today' : `${daysInStatus}d in status`}
          </Text>
        </View>

        <View style={styles.detailsBtn}>
          <Text style={styles.detailsBtnText}>Track Progress</Text>
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
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  trackingGroup: { flexDirection: 'row', alignItems: 'center' },
  idText: { fontSize: 13, color: '#3B82F6', fontWeight: '800', marginLeft: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937', marginBottom: 10 },
  
  pendingActionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  pendingActionText: { marginLeft: 6, fontSize: 12, fontWeight: '700', color: '#991B1B' },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12
  },
  timeInfo: { flexDirection: 'row', alignItems: 'center' },
  timeText: { color: '#6B7280', fontSize: 12, marginLeft: 4, fontWeight: '600' },
  detailsBtn: { flexDirection: 'row', alignItems: 'center' },
  detailsBtnText: { color: '#3B82F6', fontWeight: '800', fontSize: 13, marginRight: 2 },
});
