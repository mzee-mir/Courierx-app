import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ActivityIndicator, Alert, ScrollView 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Package, AlertTriangle } from 'lucide-react-native';
import { api } from '../../api/client';
import { analytics } from '../../utils/analytics';

import { DeliveredSummary } from '../../components/imports/DeliveredSummary';
import { TrackingTimeline } from '../../components/imports/TrackingTimeline';
import { PendingActionView } from '../../components/imports/PendingActionView';
import { CustomsHoldView } from '../../components/imports/CustomsHoldView';
import { TerminalStateView } from '../../components/imports/TerminalStateView';
import { DisputeSheet } from '../../components/imports/DisputeSheet';

export const ImportDetailScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const importId = route.params?.importId || route.params?.id;

  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disputeVisible, setDisputeVisible] = useState(false);

  const fetchDetail = async (signal?: AbortSignal) => {
    if (!importId) {
      setError("Invalid shipment identifier.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Task 2.1 API Endpoint
      const res = await api.get(`/cargo/${importId}`, { signal });
      if (res.data.success && res.data.import) {
        setShipment(res.data.import);
        analytics.track('import_screen_viewed', { screen: 'ImportDetail', importId });
      } else {
        setError("Shipment record not found.");
      }
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        return; // Component unmounted
      }
      // Fallback lookup if single endpoint fails
      try {
        const fallbackRes = await api.get('/cargo/my-imports', { signal });
        const found = fallbackRes.data?.imports?.find((i: any) => i._id === importId);
        if (found) {
          setShipment(found);
        } else {
          setError("Could not retrieve shipment details.");
        }
      } catch {
        setError("Network failure while syncing shipment.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(controller.signal);
    return () => {
      controller.abort();
    };
  }, [importId]);

  if (loading) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Fetching shipment data...</Text>
      </View>
    );
  }

  if (error || !shipment) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <Package size={48} color="#9CA3AF" />
        <Text style={styles.errorTitle}>Shipment Not Found</Text>
        <Text style={styles.errorSub}>{error || "Unable to display details."}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Sub-View Orchestrator ---
  const renderContent = () => {
    const status = shipment.status;

    if (status === 'DELIVERED') {
      return <DeliveredSummary shipment={shipment} navigation={navigation} />;
    }

    if (['CANCELLED', 'EXPIRED', 'LOST', 'RETURN_TO_SENDER'].includes(status)) {
      return <TerminalStateView shipment={shipment} navigation={navigation} />;
    }

    if (status === 'WEIGHT_DISPUTE' || shipment.pendingAction) {
      return (
        <PendingActionView 
          shipment={shipment} 
          navigation={navigation} 
          onRefresh={() => fetchDetail()} 
        />
      );
    }

    if (status === 'CUSTOMS_HOLD') {
      return <CustomsHoldView shipment={shipment} navigation={navigation} />;
    }

    return (
      <TrackingTimeline 
        shipment={shipment} 
        navigation={navigation} 
        onRefresh={() => fetchDetail()} 
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerBackBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerTitle} numberOfLines={1}>{shipment.itemDescription}</Text>
          <Text style={styles.headerSub}>CX-{(shipment.externalTrackingNumber || '').slice(-10).toUpperCase()}</Text>
        </View>

        {['ARRIVED_LOCAL', 'READY_FOR_LOCAL_HANDOFF', 'READY_FOR_DELIVERY', 'DELIVERED', 'LOST'].includes(shipment.status) && (
          <TouchableOpacity
            style={styles.disputeHeaderBtn}
            onPress={() => setDisputeVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Report a problem with this shipment"
          >
            <AlertTriangle size={16} color="#B91C1C" />
            <Text style={styles.disputeHeaderBtnText}>Report</Text>
          </TouchableOpacity>
        )}
      </View>

      {renderContent()}

      <DisputeSheet
        isVisible={disputeVisible}
        importId={shipment._id}
        externalTrackingNumber={shipment.externalTrackingNumber}
        onClose={() => setDisputeVisible(false)}
        onSuccess={() => fetchDetail()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14, fontWeight: '600' },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginTop: 16 },
  errorSub: { fontSize: 13, color: '#6B7280', marginTop: 6, textAlign: 'center' },
  backBtn: { marginTop: 20, backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  headerBackBtn: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginRight: 14
  },
  headerTextGroup: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1F2937' },
  headerSub: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginTop: 2 },
  disputeHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  disputeHeaderBtnText: { color: '#B91C1C', fontSize: 12, fontWeight: '800', marginLeft: 4 }
});