import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  Modal, 
  TextInput, 
  Platform,
  Dimensions
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as ExpoLocation from 'expo-location';
import { 
  Phone, 
  Navigation as NavIcon, 
  AlertOctagon, 
  ShieldCheck, 
  Info, 
  Copy, 
  Clock, 
  CheckCircle2,
  ArrowRight,
  ChevronLeft
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { api } from '../../api/client';
import { getDistanceInMeters } from '../../utils/geo';

const { width } = Dimensions.get('window');

// Logic Rule: Driver must be within this distance (meters) to trigger status changes
const GEOFENCE_LIMIT = 1000; 

export const ActiveOrderScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;

  // -- State --
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [driverLoc, setDriverLoc] = useState<any>(null);
  const [distanceToTarget, setDistanceToTarget] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);

  // -- Initialization & Location Tracking --
  useEffect(() => {
    fetchOrderDetails();

    let subscription: ExpoLocation.LocationSubscription | null = null;

    const startTracking = async () => {
      subscription = await ExpoLocation.watchPositionAsync(
        { accuracy: ExpoLocation.Accuracy.High, distanceInterval: 10 },
        (loc: ExpoLocation.LocationObject) => {
          setDriverLoc(loc.coords);
        }
      );
    };

    startTracking();

    return () => {
      if (subscription) subscription.remove();
    };
  }, [orderId]);

  // -- Proximity Calculation --
  useEffect(() => {
    if (driverLoc && order) {
      // Determine if we are going to Pickup or Drop-off
      const isGoingToPickup = ['ACCEPTED', 'ARRIVED'].includes(order.status);
      const targetCoords = isGoingToPickup ? order.pickupLocation : order.dropoffLocation;

      const dist = getDistanceInMeters(
        driverLoc.latitude,
        driverLoc.longitude,
        targetCoords.coordinates[1],
        targetCoords.coordinates[0]
      );
      setDistanceToTarget(dist);
    }
  }, [driverLoc, order]);

  const fetchOrderDetails = async () => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      if (res.data.success) setOrder(res.data.order);
    } catch (err) {
      Alert.alert("Sync Error", "Could not load order details.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      const res = await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      if (res.data.success) setOrder(res.data.order);
    } catch (err) {
      Alert.alert("Update Failed", "Connection error. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFinalVerification = async () => {
    if (pin.length < 4) return;
    setIsUpdating(true);
    try {
      const res = await api.post(`/orders/${orderId}/verify`, { verificationPin: pin });
      if (res.data.success) {
        setIsPinVisible(false);
        // Calculate earnings for the summary screen
        const earnings = order.price - order.commission;
        navigation.replace('OrderCompleted', { order, earnings });
      }
    } catch (err) {
      Alert.alert("Invalid PIN", "The code entered is incorrect.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExternalNav = () => {
    if (!order) return;
    const target = ['ACCEPTED', 'PICKED_UP'].includes(order.status) ? order.pickupLocation : order.dropoffLocation;
    const lat = target.coordinates[1];
    const lng = target.coordinates[0];
    const label = encodeURIComponent(order.status === 'ACCEPTED' ? "Pickup Point" : "Drop-off Point");

    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`
    });

    if (url) Linking.openURL(url);
  };

  const handleSOS = () => {
    Alert.alert("EMERGENCY", "Send live location to CourierX Security?", [
      { text: "Cancel", style: "cancel" },
      { text: "SEND ALERT", style: "destructive", onPress: () => Alert.alert("Success", "Help is on the way.") }
    ]);
  };

  // -- UI Configuration --
  const statusConfig: any = {
  ACCEPTED: { color: '#2563EB', next: 'ARRIVED_AT_PICKUP', btn: 'I HAVE ARRIVED AT PICKUP' },
  ARRIVED_AT_PICKUP: { color: '#F59E0B', next: 'PICKED_UP', btn: 'ITEM COLLECTED' },
  PICKED_UP: { color: '#7C3AED', next: 'ARRIVED_AT_DROPOFF', btn: 'AT DROP-OFF POINT' },
  ARRIVED_AT_DROPOFF: { color: '#059669', next: 'DELIVERED', btn: 'VERIFY PIN' },
};

  const canAction = useMemo(() => {
    if (!distanceToTarget) return false;
    return distanceToTarget <= GEOFENCE_LIMIT;
  }, [distanceToTarget]);

  if (loading || !order) return <View style={styles.centered}><ActivityIndicator color="#000" size="large" /></View>;

  return (
    <View style={styles.container}>
      {/* 1. TOP OVERLAY: Landmarks & Actions */}
      <View style={styles.header}>
        {/* ✅ ADDED: Back button to minimize order */}
        <TouchableOpacity 
          style={styles.backCircle} 
          onPress={() => navigation.navigate('MainTabs')}
        >
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.landmarkCard}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: statusConfig[order.status]?.color || '#059669' }]} />
            <Text style={styles.statusLabel}>{order.status.replace(/_/g, ' ')}</Text>
          </View>
          
          <Text style={styles.landmarkText} numberOfLines={2}>
            {order.status === 'PICKED_UP' ? order.dropoffLandmark : order.pickupLandmark}
          </Text>

          <TouchableOpacity style={styles.navBtn} onPress={handleExternalNav}>
            <NavIcon size={16} color="#2563EB" />
            <Text style={styles.navBtnText}>START NAVIGATION</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sideActions}>
          <TouchableOpacity style={styles.callCircle} onPress={() => Linking.openURL(`tel:${order.customerId.phoneNumber}`)}>
            <Phone size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sosCircle} onPress={handleSOS}>
            <AlertOctagon size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. MAP VIEW */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: order.pickupLocation.coordinates[1],
          longitude: order.pickupLocation.coordinates[0],
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={false} // We use our custom marker for the driver
      >
        <Marker coordinate={{ latitude: order.pickupLocation.coordinates[1], longitude: order.pickupLocation.coordinates[0] }} title="Pickup" />
        <Marker coordinate={{ latitude: order.dropoffLocation.coordinates[1], longitude: order.dropoffLocation.coordinates[0] }} title="Dropoff" />
        
        {driverLoc && (
          <Marker coordinate={driverLoc} flat anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverDot} />
          </Marker>
        )}
      </MapView>

      {/* 3. BOTTOM PANEL: Payout & Geofenced Actions */}
      <View style={styles.bottomCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.custName}>{order.customerId.displayName}</Text>
            <Text style={styles.orderType}>Delivery • Wallet Payment</Text>
          </View>
          <View style={styles.payoutBox}>
            <Text style={styles.payoutLabel}>YOUR PAY</Text>
            <Text style={styles.payoutValue}>${(order.price - order.commission).toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.proximityBar}>
          <Clock size={14} color={canAction ? "#059669" : "#6B7280"} />
          <Text style={[styles.proximityText, canAction && { color: '#059669' }]}>
            {distanceToTarget ? `${distanceToTarget}m to target` : 'Locating...'}
            {canAction ? ' • IN RANGE' : ' • TOO FAR'}
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.mainBtn, !canAction && styles.btnDisabled]} 
          disabled={!canAction || isUpdating}
          onPress={() => {
            if (order.status === 'ARRIVED_AT_DROPOFF') setIsPinVisible(true);
            else handleStatusUpdate(statusConfig[order.status].next);
          }}
        >
          {isUpdating ? <ActivityIndicator color="white" /> : (
            <View style={styles.btnContent}>
              <Text style={styles.mainBtnText}>
                {canAction ? (statusConfig[order.status]?.btn || 'VERIFY PIN') : `GET WITHIN 1KM`}
              </Text>
              {canAction && <ArrowRight size={20} color="white" />}
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 4. SETTLEMENT MODAL */}
      <Modal visible={isPinVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.pinCard}>
            <ShieldCheck size={50} color="#059669" />
            <Text style={styles.pinTitle}>Final Verification</Text>
            <Text style={styles.pinSub}>Ask the recipient for their 4-digit code</Text>
            
            <TextInput
              style={styles.pinInput}
              placeholder="0000"
              keyboardType="number-pad"
              maxLength={4}
              value={pin}
              onChangeText={setPin}
              autoFocus
            />

            <TouchableOpacity 
              style={styles.completeBtn} 
              onPress={handleFinalVerification}
              disabled={isUpdating || pin.length < 4}
            >
              <Text style={styles.completeBtnText}>FINALIZE & COLLECT PAY</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsPinVisible(false)} style={styles.cancelLink}>
              <Text style={styles.cancelLinkText}>Back to Map</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { position: 'absolute', top: 60, left: 20, right: 20, zIndex: 10, flexDirection: 'row' },
  landmarkCard: { flex: 1, backgroundColor: 'white', padding: 20, borderRadius: 20, elevation: 10, shadowOpacity: 0.15 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusLabel: { fontSize: 11, fontWeight: '900', color: '#111827' },
  landmarkText: { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  navBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginTop: 15, alignSelf: 'flex-start' },
  navBtnText: { color: '#2563EB', fontWeight: 'bold', fontSize: 11, marginLeft: 8 },
  sideActions: { marginLeft: 15, justifyContent: 'space-between' },
  callCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  sosCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', elevation: 5, marginTop: 10 },
  map: { flex: 1 },
  driverDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#2563EB', borderWidth: 4, borderColor: 'white', elevation: 10 },
  bottomCard: { backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 25, paddingBottom: 45, elevation: 30 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  backCircle: {
    width: 40,
    height: 40,
  },
  custName: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  orderType: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  payoutBox: { alignItems: 'flex-end' },
  payoutLabel: { fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', letterSpacing: 1 },
  payoutValue: { fontSize: 24, fontWeight: '900', color: '#059669' },
  proximityBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 12, borderRadius: 12, marginBottom: 25 },
  proximityText: { marginLeft: 10, fontSize: 13, fontWeight: '700', color: '#4B5563' },
  mainBtn: { backgroundColor: '#111827', padding: 22, borderRadius: 20, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnContent: { flexDirection: 'row', alignItems: 'center' },
  mainBtnText: { color: 'white', fontWeight: '900', fontSize: 16, marginRight: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 25 },
  pinCard: { backgroundColor: 'white', borderRadius: 32, padding: 35, alignItems: 'center' },
  pinTitle: { fontSize: 24, fontWeight: '900', color: '#111827', marginTop: 15 },
  pinSub: { textAlign: 'center', color: '#6B7280', marginTop: 10, lineHeight: 22 },
  pinInput: { backgroundColor: '#F3F4F6', width: '100%', borderRadius: 16, padding: 20, fontSize: 48, textAlign: 'center', letterSpacing: 25, fontWeight: 'bold', marginVertical: 30, color: '#111827' },
  completeBtn: { backgroundColor: '#059669', width: '100%', padding: 20, borderRadius: 18, alignItems: 'center' },
  completeBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  cancelLink: { marginTop: 25 },
  cancelLinkText: { color: '#6B7280', fontWeight: '600' }
});