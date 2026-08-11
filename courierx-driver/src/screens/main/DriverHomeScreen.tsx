import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ActivityIndicator, Switch, ScrollView, Alert, Modal, RefreshControl 
} from 'react-native';
import * as Location from 'expo-location';
import { 
  Power, MapPin, DollarSign, Clock, ShieldCheck, 
  RefreshCcw, X, Check, Globe, Package, ArrowRight, ShieldAlert 
} from 'lucide-react-native';
import { format } from 'date-fns';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { socketService } from '../../services/socketService';
import { DriverStackParamList } from '../../navigation/DriverNavigator';

export const DriverHomeScreen = () => {
  const { driver, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  
  // -- Backend-Authoritative State --
  const [profile, setProfile] = useState<any>(null);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  
  // -- Logic & UI State --
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR'>('IDLE');
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentCity, setCurrentCity] = useState('Somalia');
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  
  // -- Job Alert State --
  const [incomingJob, setIncomingJob] = useState<any>(null);
  const [accepting, setAccepting] = useState(false);
  const [locationSub, setLocationSub] = useState<Location.LocationSubscription | null>(null);

  // -- Feature: Authoritative Dashboard Sync --
  const syncDashboard = async () => {
    try {
      const [profileRes, dashRes] = await Promise.all([
      api.get('/driver/profile'),
      api.get('/driver/dashboard')
    ]);

      if (profileRes.data.success) setProfile(profileRes.data.profile);
      
      if (dashRes.data.success) {
      setActiveOrder(dashRes.data.activeOrder);
      setRecentJobs(dashRes.data.recentJobs);

        // Logical Alignment: Ensure UI switch matches DB availability
        const serverDutyStatus = dashRes.data.isOnline;
      setIsOnline(serverDutyStatus);

        // Auto-Reconnect services if server says we are online
        if (serverDutyStatus && !locationSub) {
        initiateLiveServices();
        }
      }
      setLastSynced(new Date());
      setSyncStatus('IDLE');
    } catch (err) {
      setSyncStatus('ERROR');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Sync on every tab focus
  useFocusEffect(
    useCallback(() => {
      syncDashboard();
    }, [])
  );

  // -- Feature: Location & Service Management --
  const initiateLiveServices = async () => {
    await socketService.connect(
      (connected) => setSocketConnected(connected),
      () => setSocketConnected(false)
    );

    // Listen for real-time dispatches
    socketService.socket?.on('new_order_available', (job) => setIncomingJob(job));

    // Start GPS Heartbeat
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 30000 },
        (loc) => {
          if (currentCity === 'Somalia') detectCity(loc.coords.latitude, loc.coords.longitude);
          api.post('/driver/location', {
            coordinates: [loc.coords.longitude, loc.coords.latitude]
          }).catch(() => {});
        }
      );
      setLocationSub(sub);
    }
  };

  const detectCity = async (latitude: number, longitude: number) => {
    try {
      const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addr.city || addr.region) setCurrentCity(addr.city || addr.region || 'Somalia');
    } catch (e) { /* fallback */ }
  };

  const stopTracking = () => {
    locationSub?.remove();
    setLocationSub(null);
    socketService.disconnect();
    setSocketConnected(false);
  };

  // -- Feature: Resilient Duty Toggle --
  const toggleDuty = async () => {
    if (!profile?.isVerified) {
      Alert.alert("Locked", "Account pending admin approval.");
      return;
    }

    setSyncStatus('SYNCING');
    const targetState = !isOnline;

    try {
      const res = await api.patch('/driver/status', { isAvailable: targetState });
      if (res.data.success) {
        setIsOnline(targetState);
        if (targetState) initiateLiveServices();
        else stopTracking();
        setSyncStatus('IDLE');
      }
    } catch (err) {
      setSyncStatus('ERROR');
    }
  };

  const handleAcceptJob = async () => {
    if (!incomingJob) return;
    setAccepting(true);
    try {
      const res = await api.patch(`/orders/${incomingJob.orderId}/accept`);
      if (res.data.success) {
        const id = incomingJob.orderId;
        setIncomingJob(null);
        navigation.navigate('ActiveOrder', { orderId: id });
      }
    } catch (err) {
      setIncomingJob(null);
      Alert.alert("Missed", "Job taken by another operator.");
    } finally { setAccepting(false); }
  };

  if (loading && !refreshing) return <View style={styles.centered}><ActivityIndicator color="#111827" size="large" /></View>;

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); syncDashboard();}} />}
      >
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Salaam, {profile?.fullName || driver?.displayName}</Text>
            <Text style={styles.plateText}>Plate: {profile?.vehicle?.plateNumber || '...'}</Text>
          </View>
          <View style={[styles.badge, profile?.isVerified ? styles.bgVerified : styles.bgPending]}>
            <ShieldCheck size={12} color="white" />
            <Text style={styles.badgeText}>{profile?.isVerified ? 'VERIFIED' : 'PENDING'}</Text>
          </View>
        </View>

        {/* 1. Feature: Account Gate Banner */}
        {!profile?.isVerified && (
          <View style={styles.gateBanner}>
            <ShieldAlert size={20} color="#92400E" />
            <View style={styles.gateContent}>
              <Text style={styles.gateTitle}>Application Under Review</Text>
              <Text style={styles.gateText}>Verification takes 24-48h. You cannot take jobs yet.</Text>
            </View>
          </View>
        )}

        {/* 2. Feature: Active Job Recovery Banner */}
        {activeOrder && (
          <TouchableOpacity 
            style={styles.activeJobBanner}
            onPress={() => navigation.navigate('ActiveOrder', { orderId: activeOrder._id })}
          >
            <View style={styles.bannerLeft}>
              <View style={styles.pulseDot} />
              <View>
                <Text style={styles.bannerTitle}>ACTIVE DELIVERY IN PROGRESS</Text>
                <Text style={styles.bannerSub}>Tap to return to Map ➔</Text>
              </View>
            </View>
            <Package size={20} color="white" />
          </TouchableOpacity>
        )}

        {/* 3. Duty Switch Card */}
        <View style={[styles.dutyCard, isOnline ? styles.cardOnline : styles.cardOffline]}>
          <View style={styles.dutyTop}>
            <View style={styles.dutyInfo}>
              <Text style={styles.dutyTitle}>
                {syncStatus === 'SYNCING' ? 'SYNCING...' : isOnline ? 'ONLINE & ACTIVE' : 'OFFLINE'}
              </Text>
              <Text style={styles.syncLabel}>Last synced: {format(lastSynced, 'HH:mm:ss')}</Text>
            </View>
            <Switch 
              value={isOnline} 
              onValueChange={toggleDuty}
              disabled={syncStatus === 'SYNCING' || !profile?.isVerified}
              trackColor={{ false: "#D1D5DB", true: "#10B981" }}
            />
          </View>

          <View style={styles.socketIndicator}>
            <View style={[styles.dot, { backgroundColor: socketConnected ? '#10B981' : '#EF4444' }]} />
            <Text style={styles.socketText}>
              {socketConnected ? 'Dispatch System Connected' : 'Waiting for connection...'}
            </Text>
          </View>
        </View>

        {/* 4. Region Indicator */}
        <View style={styles.regionCard}>
          <Globe size={18} color={isOnline ? "#2563EB" : "#9CA3AF"} />
          <Text style={styles.regionText}>Duty Region: {currentCity}</Text>
        </View>

        {/* 5. Feature: Authoritative History Section */}
        <View style={styles.historySection}>
          <Text style={styles.sectionLabel}>Recent Completed Jobs</Text>
          {recentJobs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Package size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No completed jobs found on server.</Text>
            </View>
          ) : (
            recentJobs.map((job) => (
              <View key={job._id} style={styles.historyRow}>
                <View style={styles.historyIcon}><Check size={16} color="#059669" /></View>
                <View style={styles.historyData}>
                  <Text style={styles.historyDest} numberOfLines={1}>{job.dropoffLandmark}</Text>
                  <Text style={styles.historyDate}>{format(new Date(job.updatedAt), 'MMM dd, HH:mm')}</Text>
                </View>
                <Text style={styles.historyPrice}>+${job.price.toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>

      </ScrollView>

      {/* --- NEW JOB ALERT MODAL --- */}
      <Modal visible={!!incomingJob} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.jobCard}>
            <View style={styles.jobHeader}>
              <Text style={styles.jobBadge}>NEW JOB OFFER</Text>
              <TouchableOpacity onPress={() => setIncomingJob(null)}><X size={24} color="#9CA3AF" /></TouchableOpacity>
            </View>
            <Text style={styles.jobPrice}>${incomingJob?.price.toFixed(2)}</Text>
            <View style={styles.locBlock}>
              <View style={styles.locRow}>
                <MapPin size={18} color="#2563EB" /><Text style={styles.locValue} numberOfLines={1}>{incomingJob?.pickupLandmark}</Text>
              </View>
              <View style={styles.locConnector} />
              <View style={styles.locRow}>
                <MapPin size={18} color="#EF4444" /><Text style={styles.locValue} numberOfLines={1}>{incomingJob?.dropoffLandmark}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAcceptJob} disabled={accepting}>
              {accepting ? <ActivityIndicator color="white" /> : <Text style={styles.acceptText}>ACCEPT JOB</Text>}
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
  scroll: { padding: 25, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 },
  greeting: { fontSize: 22, fontWeight: '900', color: '#111827' },
  plateText: { color: '#6B7280', fontWeight: 'bold', fontSize: 13, marginTop: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  bgVerified: { backgroundColor: '#059669' },
  bgPending: { backgroundColor: '#F59E0B' },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: 'white', marginLeft: 5 },
  gateBanner: { backgroundColor: '#FFFBEB', padding: 16, borderRadius: 16, flexDirection: 'row', marginBottom: 20, borderWidth: 1, borderColor: '#FEF3C7' },
  gateContent: { marginLeft: 12, flex: 1 },
  gateTitle: { fontSize: 14, fontWeight: 'bold', color: '#92400E' },
  gateText: { fontSize: 12, color: '#B45309', marginTop: 2 },
  activeJobBanner: { backgroundColor: '#2563EB', padding: 16, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25, elevation: 6 },
  bannerLeft: { flexDirection: 'row', alignItems: 'center' },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#60A5FA', marginRight: 15 },
  bannerTitle: { color: 'white', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  bannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2, fontWeight: '600' },
  dutyCard: { backgroundColor: 'white', padding: 25, borderRadius: 28, elevation: 4 },
  cardOnline: { borderLeftWidth: 8, borderLeftColor: '#10B981' },
  cardOffline: { borderLeftWidth: 8, borderLeftColor: '#D1D5DB' },
  dutyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dutyInfo: { flex: 1 },
  dutyTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  syncLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 4, fontWeight: 'bold' },
  socketIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 15, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 15 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  socketText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  regionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 25, backgroundColor: 'white', padding: 15, borderRadius: 16, elevation: 1 },
  regionText: { marginLeft: 10, fontSize: 13, color: '#4B5563', fontWeight: 'bold' },
  historySection: { marginTop: 40 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 15 },
  historyRow: { backgroundColor: 'white', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  historyIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },
  historyData: { flex: 1, marginLeft: 15 },
  historyDest: { fontSize: 14, fontWeight: '600', color: '#111827' },
  historyDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  historyPrice: { fontSize: 16, fontWeight: 'bold', color: '#059669' },
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#D1D5DB', marginTop: 10, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 25 },
  jobCard: { backgroundColor: 'white', borderRadius: 32, padding: 30, alignItems: 'center' },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 15 },
  jobBadge: { backgroundColor: '#DBEAFE', color: '#1E40AF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, fontSize: 11, fontWeight: 'bold' },
  jobPrice: { fontSize: 56, fontWeight: '900', color: '#111827' },
  locBlock: { width: '100%', marginVertical: 25 },
  locRow: { flexDirection: 'row', alignItems: 'center' },
  locConnector: { width: 2, height: 20, backgroundColor: '#F3F4F6', marginLeft: 8, marginVertical: 2 },
  locValue: { flex: 1, marginLeft: 15, fontSize: 15, fontWeight: '600', color: '#374151' },
  acceptBtn: { backgroundColor: '#111827', width: '100%', padding: 22, borderRadius: 20, alignItems: 'center' },
  acceptText: { color: 'white', fontWeight: '900', fontSize: 18 }
});