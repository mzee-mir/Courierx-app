import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Dimensions, Modal 
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Package, Clock, ArrowRight, MapPin, Bell, Globe, User, 
  Plus, X, ArrowUpRight, Home, Briefcase, Heart 
} from 'lucide-react-native';

import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { OrderCreationSheet } from '../../components/orders/OrderCreationSheet';
import { RootStackParamList } from '../../navigation/AppNavigator';

export const HomeScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  
  // -- State --
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null); // For shortcut banner
  const [isBooking, setIsBooking] = useState(false);
  const [preselectedPickup, setPreselectedPickup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  /**
   * FEATURE: Reactive Dashboard Sync
   * Runs whenever the user views this tab.
   */
  useFocusEffect(
    useCallback(() => {
      syncHomeData();
    }, [])
  );

  const syncHomeData = async () => {
    setLoading(true);
    try {
      // Fetch landmarks and active orders in parallel without doing heavy GPS calculations
      const [landmarkRes, activeOrderRes] = await Promise.all([
        api.get('/profile/landmarks'),
        api.get('/orders?status=active&limit=1'),
      ]);

      if (landmarkRes.data.success) {
        setLandmarks(landmarkRes.data.landmarks);
      }
      if (activeOrderRes.data.success) {
        setActiveOrder(activeOrderRes.data.orders[0] || null);
      }
    } catch (err: any) {
      console.error("HOME_SYNC_ERROR", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBooking = (initialPickup: any = null) => {
    // Unblocked: Allowed to book even if user has no saved landmarks
    setPreselectedPickup(initialPickup);
    setIsBooking(true);
  };

  const handleConfirmOrder = async (pickup: any, dropoff: any, vehicleType: string) => {
    setOrderSubmitting(true);
    try {
      const payload = {
        pickupLocation: pickup.location,
        pickupLandmark: `${pickup.label}: ${pickup.description}`,
        dropoffLocation: dropoff.location,
        dropoffLandmark: `${dropoff.label}: ${dropoff.description}`,
        vehicleType,
        distanceKm: 5,
      };

      const res = await api.post('/orders', payload);
      if (res.data.success) {
        setIsBooking(false);
        navigation.navigate('OrderTracking', { orderId: res.data.order._id });
      }
    } catch (err: any) {
      Alert.alert("Booking Failed", "Check your wallet balance or connection.");
    } finally {
      setOrderSubmitting(false);
    }
  };

  // Helper for Landmark Icons
  const getLandmarkIcon = (label: string) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('home')) return <Home size={20} color="#3B82F6" />;
    if (lowerLabel.includes('work') || lowerLabel.includes('office') || lowerLabel.includes('warehouse')) {
      return <Briefcase size={20} color="#10B981" />;
    }
    return <Heart size={20} color="#EC4899" />;
  };

  if (loading && landmarks.length === 0 && !activeOrder) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        
        {/* 1. Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingTitle}>Good morning,</Text>
            <Text style={styles.userName}>{user?.displayName || 'CourierX User'}! ☀️</Text>
          </View>
          <TouchableOpacity style={styles.notificationBell}>
            <Bell size={24} color="#FFFFFF" />
            <View style={styles.bellBadge} />
          </TouchableOpacity>
        </View>

        {/* 2. Premium Virtual Wallet Card */}
        <LinearGradient
          colors={['#1E293B', '#4338CA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.walletCard}
        >
          <View style={styles.walletDetails}>
            <Text style={styles.walletTitle}>Virtual Wallet</Text>
            <Text style={styles.balanceLabel}>CXC balance:</Text>
            <Text style={styles.balanceValue}>
              {(user?.tokenBalance ?? 0).toLocaleString()} <Text style={styles.currencySub}>CourierX Coins</Text>
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.topUpButton}
            onPress={() => navigation.navigate('MainTabs', { screen: 'WalletTab' } as any)}
          >
            <Plus size={16} color="#4338CA" style={{ marginRight: 4 }} />
            <Text style={styles.topUpText}>Top Up</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* 3. Quick Actions Grid */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            
            {/* Primary Action Card: Book a Delivery */}
            <TouchableOpacity 
              style={[styles.actionCard, styles.primaryActionCard]}
              onPress={() => handleOpenBooking(null)}
            >
              <View style={styles.primaryIconWrapper}>
                <Package size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.primaryActionTitle}>Book a Delivery</Text>
              <Text style={styles.primaryActionDesc}>Book a delivery from your selected locations.</Text>
            </TouchableOpacity>

            {/* Action Card: Track Cargo */}
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('MainTabs', { screen: 'OrdersTab' } as any)}
            >
              <View style={[styles.iconWrapper, { backgroundColor: '#EFF6FF' }]}>
                <Clock size={22} color="#3B82F6" />
              </View>
              <Text style={styles.actionTitle}>Track Cargo</Text>
              <Text style={styles.actionDesc}>Track cargo destination and live status updates.</Text>
            </TouchableOpacity>

            {/* Action Card: Declare Import */}
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('MainTabs', { screen: 'ImportsTab' } as any)}
            >
              <View style={[styles.iconWrapper, { backgroundColor: '#F0FDF4' }]}>
                <Globe size={22} color="#10B981" />
              </View>
              <Text style={styles.actionTitle}>Declare Import</Text>
              <Text style={styles.actionDesc}>Declare ship container imports instantly.</Text>
            </TouchableOpacity>

            {/* Action Card: My Profile */}
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('MainTabs', { screen: 'ProfileTab' } as any)}
            >
              <View style={[styles.iconWrapper, { backgroundColor: '#FDF2F8' }]}>
                <User size={22} color="#EC4899" />
              </View>
              <Text style={styles.actionTitle}>My Profile</Text>
              <Text style={styles.actionDesc}>Manage your profile details and settings.</Text>
            </TouchableOpacity>

          </View>
        </View>

        {/* 4. Active Order Notification Banner */}
        {activeOrder && !bannerDismissed && (
          <View style={styles.bannerContainer}>
            <View style={styles.bannerContent}>
              <View style={styles.bannerIconWrapper}>
                <Package size={20} color="#FFFFFF" />
              </View>
              <View style={styles.bannerTextContainer}>
                <Text style={styles.bannerTitle}>Active Order Status</Text>
                <Text style={styles.bannerStatus}>
                  Package is being picked up! ({activeOrder.status.replace(/_/g, ' ')})
                </Text>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('OrderTracking', { orderId: activeOrder._id })}
                  style={styles.viewDetailsLink}
                >
                  <Text style={styles.viewDetailsText}>View Details</Text>
                  <ArrowRight size={14} color="#93C5FD" style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={styles.closeBannerButton}
                onPress={() => setBannerDismissed(true)}
              >
                <X size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.progressBar} />
          </View>
        )}

        {/* 5. Quick Landmarks */}
        <View style={[styles.sectionContainer, { marginBottom: 30 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Quick Landmarks</Text>
            <TouchableOpacity onPress={() => handleOpenBooking(null)}>
              <Text style={styles.shortcutLink}>Quick-booking &gt;</Text>
            </TouchableOpacity>
          </View>

          {landmarks.length === 0 ? (
            <View style={styles.emptyLandmarksCard}>
              <MapPin size={24} color="#9CA3AF" />
              <Text style={styles.emptyLandmarksText}>No saved landmarks found.</Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate('MainTabs', { screen: 'ProfileTab' } as any)}
                style={styles.addLandmarkShortcut}
              >
                <Text style={styles.addLandmarkShortcutText}>Add Saved Places in Profile</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {landmarks.map((item) => (
                <TouchableOpacity 
                  key={item._id}
                  style={styles.landmarkCard}
                  onPress={() => handleOpenBooking(item)}
                >
                  <View style={styles.landmarkCardHeader}>
                    <View style={styles.landmarkIconBox}>
                      {getLandmarkIcon(item.label)}
                    </View>
                    <ArrowUpRight size={16} color="#9CA3AF" />
                  </View>
                  <Text style={styles.landmarkLabel} numberOfLines={1}>{item.label}</Text>
                  <Text style={styles.landmarkDesc} numberOfLines={1}>{item.description}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

      </ScrollView>

      {/* Booking Modal */}
      <Modal visible={isBooking} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {orderSubmitting ? (
              <View style={styles.submitting}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.submittingText}>Syncing with dispatch...</Text>
              </View>
            ) : (
              <OrderCreationSheet 
                savedLandmarks={landmarks}
                onConfirm={handleConfirmOrder}
                onCancel={() => setIsBooking(false)}
                initialPickup={preselectedPickup}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B132B' },
  scrollContent: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B132B' },
  
  // Header
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15 
  },
  greetingTitle: { fontSize: 16, color: '#9CA3AF', fontWeight: '500' },
  userName: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  notificationBell: { 
    padding: 10, 
    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
    borderRadius: 20,
    position: 'relative'
  },
  bellBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444'
  },

  // Wallet
  walletCard: {
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#4338CA',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  walletDetails: { flex: 1 },
  walletTitle: { fontSize: 13, color: '#93C5FD', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  balanceLabel: { fontSize: 12, color: '#D1D5DB', marginTop: 12 },
  balanceValue: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },
  currencySub: { fontSize: 14, fontWeight: '500', color: '#D1D5DB' },
  topUpButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
    elevation: 4
  },
  topUpText: { color: '#4338CA', fontWeight: '800', fontSize: 14 },

  // Sections
  sectionContainer: { marginTop: 25 },
  sectionHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginHorizontal: 20, marginBottom: 12 },
  sectionHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginHorizontal: 20, 
    marginBottom: 12 
  },
  shortcutLink: { fontSize: 13, color: '#3B82F6', fontWeight: '700' },

  // Quick Actions Grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  primaryActionCard: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14
  },
  primaryIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14
  },
  actionTitle: { fontSize: 15, fontWeight: '800', color: '#1F2937' },
  primaryActionTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  actionDesc: { fontSize: 11, color: '#6B7280', marginTop: 4, lineHeight: 15 },
  primaryActionDesc: { fontSize: 11, color: '#DBEAFE', marginTop: 4, lineHeight: 15 },

  // Active Order Banner
  bannerContainer: {
    marginHorizontal: 20,
    backgroundColor: '#1E40AF',
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 10,
    elevation: 6,
    shadowColor: '#1E40AF',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    position: 'relative'
  },
  bannerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTextContainer: {
    flex: 1,
    marginLeft: 12,
    paddingRight: 10
  },
  bannerTitle: { fontSize: 13, fontWeight: '800', color: '#93C5FD', textTransform: 'uppercase', letterSpacing: 0.5 },
  bannerStatus: { fontSize: 12, color: '#FFFFFF', fontWeight: '600', marginTop: 2 },
  viewDetailsLink: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  viewDetailsText: { fontSize: 12, color: '#93C5FD', fontWeight: '800' },
  closeBannerButton: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12
  },
  progressBar: {
    height: 4,
    backgroundColor: '#3B82F6',
    width: '45%' // Visual progress bar
  },

  // Landmarks Section
  landmarkCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
  },
  horizontalScroll: { paddingLeft: 20, paddingRight: 8, paddingVertical: 4 },
  landmarkCardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 16 
  },
  landmarkIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  landmarkLabel: { fontSize: 14, fontWeight: '800', color: '#1F2937' },
  landmarkDesc: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  emptyLandmarksCard: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed'
  },
  emptyLandmarksText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600', marginTop: 10 },
  addLandmarkShortcut: {
    marginTop: 12,
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14
  },
  addLandmarkShortcutText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },

  // Booking Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  submitting: { padding: 80, alignItems: 'center' },
  submittingText: { marginTop: 15, fontWeight: 'bold', color: '#111827' }
});