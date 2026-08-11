import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, Text, StyleSheet, ActivityIndicator, Alert, 
  TouchableOpacity, Modal, Dimensions, Platform,
  Image // Ensure Image is imported from react-native
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { 
  CheckCircle2, ShieldCheck, Phone, MessageCircle, 
  X, Bike, MapPin, Clock, ChevronRight, 
  Truck,
  User // ✅ FIXED: Changed from UserIcon to User
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { socketService } from '../../services/socketService';
import { api } from '../../api/client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');

// 1. Explicit Interface for Type Safety
interface IOrder {
  _id: string;
  status: string;
  pickupLocation: { coordinates: [number, number] };
  dropoffLocation: { coordinates: [number, number] };
  pickupLandmark: string;
  dropoffLandmark: string;
  vehicleType: string;
  price: number;
  commission: number;
  verificationPin: string;
  driverPlate?: string;
  driverId?: {
    displayName: string;
    phoneNumber: string;
    imageUrl?: string;
  };
}

export const OrderTrackingScreen = ({ route }: any) => {
  const{ user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { orderId } = route.params;

  // -- State --
  const [order, setOrder] = useState<IOrder | null>(null);
  const [driverLoc, setDriverLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // -- Logic Helpers --
  const isLive = useMemo(() => 
    order ? ['ACCEPTED', 'PICKED_UP', 'ARRIVED'].includes(order.status) : false
  , [order?.status]);

  useEffect(() => {
    const initTracking = async () => {
      try {
        const res = await api.get(`/orders/${orderId}`);
        const currentOrder = res.data.order;
        setOrder(currentOrder);

        if (currentOrder.status === 'DELIVERED') {
          setShowSuccess(true);
          setLoading(false);
          return;
        }

        await socketService.connect();
        socketService.socket?.emit('join_order_room', { orderId });

        socketService.socket?.on('order_status_update', (data) => {
          setOrder((prev: any) => ({ ...prev, ...data }));
          if (data.status === 'DELIVERED') setShowSuccess(true);
        });

        socketService.socket?.on('driver_moved', (data) => {
          setDriverLoc({
            latitude: data.coordinates[1],
            longitude: data.coordinates[0],
          });
        });

      } catch (err) {
        console.error("TRACKING_SYNC_ERROR", err);
      } finally {
        setLoading(false);
      }
    };

    initTracking();

    return () => {
      socketService.socket?.off('order_status_update');
      socketService.socket?.off('driver_moved');
    };
  }, [orderId]);

  const handleCall = () => {
    if (order?.driverId?.phoneNumber) {
      Linking.openURL(`tel:${order.driverId.phoneNumber}`);
    }
  };

  const handleWhatsApp = () => {
    if (order?.driverId?.phoneNumber) {
      const msg = `Hi, I'm #${user?.displayName} owner of Order #${order._id.slice(-5)}: Waiting at ${order.pickupLandmark}`;
      Linking.openURL(`https://wa.me/${order.driverId.phoneNumber}?text=${encodeURIComponent(msg)}`);
    }
  };

  const handleFinish = () => {
    setShowSuccess(false);
    navigation.navigate('MainTabs');
  };

  if (loading || !order) {
    return <View style={styles.centered}><ActivityIndicator color="#2563EB" size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* 1. THE LIVE MAP */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: order.pickupLocation.coordinates[1],
          longitude: order.pickupLocation.coordinates[0],
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        loadingEnabled
        rotateEnabled={false}
      >
        <Marker 
          coordinate={{ latitude: order.pickupLocation.coordinates[1], longitude: order.pickupLocation.coordinates[0] }} 
          title="Pickup"
        >
          <View style={styles.landmarkMarker}><MapPin size={24} color="#10B981" fill="#DCFCE7" /></View>
        </Marker>

        <Marker 
          coordinate={{ latitude: order.dropoffLocation.coordinates[1], longitude: order.dropoffLocation.coordinates[0] }} 
          title="Drop-off"
        >
          <View style={styles.landmarkMarker}><MapPin size={24} color="#EF4444" fill="#FEE2E2" /></View>
        </Marker>

        {driverLoc && (
          <Marker coordinate={driverLoc} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.bajajMarker}>
              <View style={styles.bajajCircle}><Bike size={20} color="white" /></View>
              <View style={styles.markerPointer} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* 2. HEADER: Navigation & Status */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <X size={20} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.statusBadge}>
          <Clock size={14} color="#2563EB" />
          <Text style={styles.statusText}>{order.status.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      {/* 3. BOTTOM PANEL: Actions & Info */}
      <View style={styles.bottomCard}>

        {/* Feature: Driver Identity Card */}
        {order.driverId && isLive && (
          <View style={styles.driverCard}>
            <View style={styles.driverMainInfo}>
              <View style={styles.driverAvatarBox}>
                {order.driverId.imageUrl ? (
                  <Image source={{ uri: order.driverId.imageUrl }} style={styles.driverImg} />
                ) : (
                  <User size={24} color="#9CA3AF" /> // ✅ FIXED: Changed to User
                )}
              </View>
              <View style={styles.driverNameGroup}>
                <Text style={styles.driverName}>{order.driverId.displayName}</Text>
                <Text style={styles.driverType}>{order.vehicleType}</Text>
                <View style={styles.plateBadge}>
                  <Truck size={12} color="#1E40AF" />
                  <Text style={styles.plateText}>{order.driverPlate || '...'}</Text>
                </View>
              </View>
            </View>
          {/* Integrated Communication Row */}     
          <View style={styles.commButtons}>
            <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
              <Phone size={20} color="white" />
              <Text style={styles.btnLabel}>Call Driver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.waBtn} onPress={handleWhatsApp}>
              <MessageCircle size={20} color="white" />
              <Text style={styles.btnLabel}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {order.status === 'ARRIVED' && (
          <View style={styles.pinSection}>
            <View style={styles.pinHeader}>
              <ShieldCheck size={18} color="#059669" />
              <Text style={styles.pinTitle}>Your Verification PIN</Text>
            </View>
            <Text style={styles.pinSub}>Give this code to the driver now:</Text>
            <View style={styles.pinCodeContainer}>
              {order.verificationPin?.split('').map((char: string, i: number) => (
                <View key={i} style={styles.pinBox}><Text style={styles.pinDigit}>{char}</Text></View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.orderInfo}>
          <Text style={styles.destLabel}>DELIVERING TO:</Text>
          <Text style={styles.destText} numberOfLines={1}>{order.dropoffLandmark}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.vehicleType}>{order.vehicleType}</Text>
            <Text style={styles.finalPrice}>Total: ${order.price.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* 4. SUCCESS OVERLAY */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}><CheckCircle2 size={50} color="#059669" /></View>
            <Text style={styles.successTitle}>Delivered!</Text>
            <Text style={styles.successSub}>Thank you for using CourierX. Your payment was settled from your wallet.</Text>
            <TouchableOpacity style={styles.doneBtn} onPress={handleFinish}>
              <Text style={styles.doneBtnText}>BACK TO DASHBOARD</Text>
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
  map: { flex: 1 },
  topHeader: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { backgroundColor: 'white', padding: 10, borderRadius: 12, elevation: 4 },
  statusBadge: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, elevation: 4 },
  statusText: { marginLeft: 8, fontWeight: 'bold', color: '#2563EB', fontSize: 12 },
  bajajMarker: { alignItems: 'center' },
  bajajCircle: { backgroundColor: '#2563EB', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'white', elevation: 5 },
  markerPointer: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#2563EB', marginTop: -2 },
  landmarkMarker: { padding: 5 },
  bottomCard: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: Platform.OS === 'ios' ? 40 : 25, elevation: 20, shadowOpacity: 0.1 },
  commButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  callBtn: { flex: 0.48, backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 15 },
  waBtn: { flex: 0.48, backgroundColor: '#25D366', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 15 },
  btnLabel: { color: 'white', fontWeight: 'bold', marginLeft: 10, fontSize: 13 },
  pinSection: { backgroundColor: '#F0FDF4', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#DCFCE7', marginBottom: 20 },
  pinHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pinTitle: { marginLeft: 10, fontWeight: 'bold', color: '#065F46' },
  pinSub: { color: '#065F46', fontSize: 12, marginBottom: 15 },
  pinCodeContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  pinBox: { backgroundColor: 'white', width: '22%', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB' },
  pinDigit: { fontSize: 24, fontWeight: '900', color: '#111827' },
  orderInfo: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 20 },
  destLabel: { fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', letterSpacing: 1 },
  destText: { fontSize: 15, fontWeight: '600', color: '#374151', marginTop: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  vehicleType: { fontSize: 12, fontWeight: 'bold', color: '#2563EB', textTransform: 'uppercase' },
  finalPrice: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 25 },
  successCard: { backgroundColor: 'white', borderRadius: 30, padding: 35, alignItems: 'center' },
  successIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 26, fontWeight: '900', color: '#111827' },
  successSub: { textAlign: 'center', color: '#6B7280', marginTop: 12, lineHeight: 22, marginBottom: 30 },
  doneBtn: { backgroundColor: '#111827', width: '100%', padding: 20, borderRadius: 18, alignItems: 'center' },
  doneBtnText: { color: 'white', fontWeight: 'bold', letterSpacing: 1 },
  driverCard: { backgroundColor: '#F9FAFB', borderRadius: 20, padding: 15, marginBottom: 20, elevation: 3 },
  driverMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  driverAvatarBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  driverImg: {
    width: '100%',
    height: '100%',
  },
  driverNameGroup: {
    marginLeft: 15,
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  driverType: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563EB',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  plateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  plateText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1E40AF',
    marginLeft: 5,
    letterSpacing: 1,
  },
  commRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  iconBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  verticalDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    height: '100%',
  },

});