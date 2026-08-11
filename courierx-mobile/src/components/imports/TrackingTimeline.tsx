import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { 
  Package, Truck, Ship, Anchor, CheckCircle2, 
  MapPin, ArrowRight, ShieldCheck, User, X, Clock 
} from 'lucide-react-native';
import { api } from '../../api/client';

const STATUS_STAGES = [
  { id: 'DECLARED', label: 'Shipment Declared', icon: Package },
  { id: 'RECEIVED_AT_ORIGIN', label: 'Received at Origin Hub', icon: ShieldCheck },
  { id: 'IN_TRANSIT', label: 'In Transit (International)', icon: Ship },
  { id: 'ARRIVED_LOCAL', label: 'Arrived in Somalia', icon: Anchor },
  { id: 'READY_FOR_LOCAL_HANDOFF', label: 'Cleared Customs', icon: CheckCircle2 },
  { id: 'DELIVERED', label: 'Handoff Complete', icon: Truck },
];

interface TrackingTimelineProps {
  shipment: any;
  navigation: any;
  onRefresh?: () => void;
}

export const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ shipment, navigation, onRefresh }) => {
  const [processing, setProcessing] = useState(false);
  const [showPickupInstructions, setShowPickupInstructions] = useState(false);

  const currentIdx = STATUS_STAGES.findIndex(s => s.id === shipment.status);

  const localWarehouse = shipment.partnerId?.warehouses?.find((w: any) => 
    w.country?.toLowerCase().includes('somalia')
  );

  const handleLocalHandoff = async () => {
    setProcessing(true);
    try {
      const landmarkRes = await api.get('/profile/landmarks');
      const defaultLandmark = landmarkRes.data.landmarks[0];

      if (!defaultLandmark) {
        Alert.alert("Address Needed", "Save a landmark in Profile first.");
        navigation.navigate('ProfileTab');
        return;
      }

      const orderPayload = {
        pickupLocation: { type: 'Point', coordinates: [45.33, 2.03] }, // Port Coordinates
        pickupLandmark: `Warehouse: ${shipment.partnerId?.name || 'Partner'} Section`,
        dropoffLocation: defaultLandmark.location,
        dropoffLandmark: defaultLandmark.label,
        vehicleType: shipment.chargeableWeightKg > 20 ? 'CAR' : 'BAJAJ',
        distanceKm: 5,
      };

      const orderRes = await api.post('/orders', orderPayload);

      if (orderRes.data.success) {
        await api.post(`/cargo/shipment/${shipment._id}/request-delivery`, {
          vehicleType: shipment.chargeableWeightKg > 20 ? 'car' : 'bajaj',
          dropoffLandmark: defaultLandmark.label,
          dropoffLocation: defaultLandmark.location
        });
        navigation.navigate('OrderTracking', { orderId: orderRes.data.order._id });
      }
    } catch (err: any) {
      if (err.response?.status === 402) {
        Alert.alert(
          "Payment Required",
          err.response.data.message || "Please settle outstanding customs/domestic charges before requesting delivery.",
          [
            { text: "Cancel" },
            {
              text: "Pay Now",
              onPress: () => navigation.navigate('Checkout', { importId: shipment._id })
            }
          ]
        );
      } else {
        Alert.alert("Delivery Error", err.response?.data?.error || "Could not initiate local delivery.");
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Weight & Freight Header Card */}
      <View style={styles.statsCard}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Verified Weight</Text>
          <Text style={styles.statValue}>{shipment.chargeableWeightKg || shipment.intake_weight || '--'} kg</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Freight Cost</Text>
          <Text style={styles.statValue}>${shipment.pricingSnapshot?.totalCustomerPaid?.toFixed(2) || shipment.totalFreightCost?.toFixed(2) || '0.00'}</Text>
        </View>
      </View>

      {/* Stepper Timeline */}
      <View style={styles.timelineContainer}>
        <Text style={styles.sectionTitle}>Shipment Progress</Text>
        {STATUS_STAGES.map((stage, index) => {
          const isCompleted = index <= currentIdx;
          const isCurrent = index === currentIdx;
          const Icon = stage.icon;

          return (
            <View key={stage.id} style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <View style={[styles.dot, isCompleted && styles.dotActive]}>
                  {isCompleted && <CheckCircle2 size={12} color="white" />}
                </View>
                {index !== STATUS_STAGES.length - 1 && (
                  <View style={[styles.line, isCompleted && styles.lineActive]} />
                )}
              </View>
              <View style={styles.timelineRight}>
                <View style={styles.stageIconBox}>
                  <Icon size={20} color={isCompleted ? '#2563EB' : '#9CA3AF'} />
                </View>
                <View>
                  <Text style={[styles.stageLabel, isCompleted && styles.textActive]}>{stage.label}</Text>
                  {isCurrent && <Text style={styles.currentTag}>Current Status</Text>}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Action Options for Cleared Customs */}
      {(shipment.status === 'READY_FOR_LOCAL_HANDOFF' || shipment.status === 'READY_FOR_DELIVERY') && (
        <View style={styles.handoffSection}>
          <Text style={styles.handoffTitle}>How would you like to receive your item?</Text>
          
          <TouchableOpacity 
            style={styles.primaryActionBtn} 
            onPress={handleLocalHandoff}
            disabled={processing}
            activeOpacity={0.85}
          >
            <Truck size={20} color="white" />
            <View style={styles.btnTextGroup}>
              <Text style={styles.btnMainText}>Deliver to My Address</Text>
              <Text style={styles.btnSubText}>A Bajaj driver will deliver to your doorstep</Text>
            </View>
            <ArrowRight size={20} color="white" />
          </TouchableOpacity>

          <View style={styles.orDivider}>
            <View style={styles.line} /><Text style={styles.orText}>OR</Text><View style={styles.line} />
          </View>

          <TouchableOpacity 
            style={styles.secondaryActionBtn} 
            onPress={() => setShowPickupInstructions(true)}
            disabled={processing}
            activeOpacity={0.85}
          >
            <User size={20} color="#2563EB" />
            <View style={styles.btnTextGroup}>
              <Text style={styles.btnMainTextBlue}>I'll Pick It Up Myself</Text>
              <Text style={styles.btnSubTextGrey}>Collect from Somalia terminal hub</Text>
            </View>
            <ArrowRight size={20} color="#2563EB" />
          </TouchableOpacity>
        </View>
      )}

      {/* Self-Pickup Modal */}
      <Modal visible={showPickupInstructions} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.instructionCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Warehouse Pickup Instructions</Text>
              <TouchableOpacity onPress={() => setShowPickupInstructions(false)}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.infoRow}>
              <MapPin size={20} color="#2563EB" />
              <View style={{ marginLeft: 15 }}>
                <Text style={styles.infoLabel}>Warehouse Location</Text>
                <Text style={styles.infoValue}>{localWarehouse?.fullAddress || "Port of Mogadishu Terminal Gate 4"}</Text>
              </View>
            </View>

            <View style={styles.pinCard}>
              <ShieldCheck size={24} color="#059669" />
              <Text style={styles.pinLabel}>Show this PIN to Warehouse Staff:</Text>
              <Text style={styles.pinValue}>{(shipment.externalTrackingNumber || '0000').slice(-4).toUpperCase()}</Text>
            </View>

            <Text style={styles.note}>Please bring your original ID and the phone number associated with your CourierX account.</Text>
            
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowPickupInstructions(false)}>
              <Text style={styles.closeModalBtnText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 20 },
  statsCard: { backgroundColor: '#1F2937', borderRadius: 20, padding: 24, flexDirection: 'row', marginBottom: 25 },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { color: '#9CA3AF', fontSize: 11, textTransform: 'uppercase', marginBottom: 8, fontWeight: '700' },
  statValue: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  divider: { width: 1, backgroundColor: '#374151', marginHorizontal: 10 },
  timelineContainer: { backgroundColor: 'white', borderRadius: 24, padding: 24, marginBottom: 25, elevation: 1 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 25, color: '#374151' },
  timelineRow: { flexDirection: 'row', minHeight: 70 },
  timelineLeft: { alignItems: 'center', width: 30 },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E5E7EB', zIndex: 1, justifyContent: 'center', alignItems: 'center' },
  dotActive: { backgroundColor: '#2563EB' },
  line: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: -5 },
  lineActive: { backgroundColor: '#2563EB' },
  timelineRight: { flex: 1, marginLeft: 15, flexDirection: 'row', alignItems: 'flex-start' },
  stageIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  stageLabel: { fontSize: 15, color: '#9CA3AF', fontWeight: '600' },
  textActive: { color: '#111827' },
  currentTag: { color: '#2563EB', fontSize: 11, fontWeight: 'bold', marginTop: 2 },

  handoffSection: { marginTop: 10, marginBottom: 20 },
  handoffTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 20, textAlign: 'center' },
  primaryActionBtn: { backgroundColor: '#2563EB', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', elevation: 3 },
  secondaryActionBtn: { backgroundColor: '#EFF6FF', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  btnTextGroup: { flex: 1, marginLeft: 15 },
  btnMainText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  btnMainTextBlue: { color: '#2563EB', fontWeight: 'bold', fontSize: 16 },
  btnSubText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  btnSubTextGrey: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  orDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  orText: { marginHorizontal: 15, color: '#9CA3AF', fontWeight: 'bold', fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  instructionCard: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  infoLabel: { fontSize: 11, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase' },
  infoValue: { fontSize: 14, color: '#111827', marginTop: 4, fontWeight: '600' },
  pinCard: { backgroundColor: '#F0FDF4', padding: 20, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#DCFCE7', marginBottom: 20 },
  pinLabel: { color: '#065F46', fontSize: 12, marginTop: 8, fontWeight: '700' },
  pinValue: { fontSize: 32, fontWeight: '900', color: '#065F46', letterSpacing: 4, marginTop: 6 },
  note: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, lineHeight: 18, marginBottom: 20 },
  closeModalBtn: { backgroundColor: '#1F2937', padding: 16, borderRadius: 16, alignItems: 'center' },
  closeModalBtnText: { color: 'white', fontWeight: 'bold' }
});
