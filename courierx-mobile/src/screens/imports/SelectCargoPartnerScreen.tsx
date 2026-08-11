import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Animated, Pressable, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ShieldCheck, Truck, Clock, X, Search,
  Zap, DollarSign, MapPin, Package, Star, ChevronRight
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { api } from '../../api/client';

type SortType = 'price' | 'speed';

// Progress Stepper Component
export const ProgressStepper = ({ currentStep }: { currentStep: 1 | 2 | 3 }) => {
  return (
    <View style={stepperStyles.container}>
      {/* Step 1 */}
      <View style={stepperStyles.stepWrapper}>
        <View style={[stepperStyles.circle, currentStep >= 1 && stepperStyles.circleActive]}>
          <Text style={[stepperStyles.circleText, currentStep >= 1 && stepperStyles.circleTextActive]}>1</Text>
        </View>
        <Text style={[stepperStyles.stepLabel, currentStep >= 1 && stepperStyles.stepLabelActive]}>Partner</Text>
      </View>

      {/* Line 1 */}
      <View style={[stepperStyles.line, currentStep >= 2 && stepperStyles.lineActive]} />

      {/* Step 2 */}
      <View style={stepperStyles.stepWrapper}>
        <View style={[stepperStyles.circle, currentStep >= 2 && stepperStyles.circleActive]}>
          <Text style={[stepperStyles.circleText, currentStep >= 2 && stepperStyles.circleTextActive]}>2</Text>
        </View>
        <Text style={[stepperStyles.stepLabel, currentStep >= 2 && stepperStyles.stepLabelActive]}>Address</Text>
      </View>

      {/* Line 2 */}
      <View style={[stepperStyles.line, currentStep >= 3 && stepperStyles.lineActive]} />

      {/* Step 3 */}
      <View style={stepperStyles.stepWrapper}>
        <View style={[stepperStyles.circle, currentStep >= 3 && stepperStyles.circleActive]}>
          <Text style={[stepperStyles.circleText, currentStep >= 3 && stepperStyles.circleTextActive]}>3</Text>
        </View>
        <Text style={[stepperStyles.stepLabel, currentStep >= 3 && stepperStyles.stepLabelActive]}>Declare</Text>
      </View>
    </View>
  );
};

// Animated Partner Card Component
const PartnerCard = ({ item, onPress, userCity }: { item: any, onPress: () => void, userCity: string | null }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleSelectPartner = (partner: any) => {
    analytics.track('import_partner_selected', {
      partnerId: partner._id,
      partnerName: partner.name,
      originCountry: selectedOrigin
    });
    navigation.navigate('DeclareImport', {
      partnerId: partner._id,
      partnerName: partner.name,
      origin: selectedOrigin
    });
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 40,
      friction: 5
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 40,
      friction: 5
    }).start();
  };

  const warehouses = item.warehouses || (item.publicProfile?.chinaAddress ? [{
    city: 'Guangzhou',
    country: 'China',
    fullAddress: item.publicProfile.chinaAddress,
    contactNumber: item.publicProfile.contactPhone || 'N/A'
  }] : []);

  const baseRate = item.requestedAirRate || item.baseRatePerKg || 8.00;
  const transitDays = item.airConfig?.avgTransitDays || item.estimatedTransitDays || 7;
  const routes = item.supportedRoutes && item.supportedRoutes.length > 0 ? item.supportedRoutes : ['China ➔ Somalia', 'Dubai ➔ Somalia'];

  const hasLocalWarehouse = warehouses.some((w: any) =>
    userCity && w.city.toLowerCase() === userCity.toLowerCase()
  );

  const mappedPartner = {
    ...item,
    baseRatePerKg: baseRate,
    estimatedTransitDays: transitDays,
    warehouses: warehouses,
    supportedRoutes: routes
  };

  const logoUrl = item.publicProfile?.logoUrl;

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => onPress()}
    >
      <Animated.View style={[styles.pCard, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.pHeader}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.partnerLogo as any} />
          ) : (
            <View style={styles.partnerLogoPlaceholder}>
              <Text style={styles.partnerLogoInitial}>{item.name.charAt(0)}</Text>
            </View>
          )}
          <View style={styles.nameGroup}>
            <Text style={styles.pName}>{item.name}</Text>
            {hasLocalWarehouse && (
              <View style={styles.localBadge}>
                <MapPin size={10} color="#059669" />
                <Text style={styles.localText}>Warehouse in {userCity}</Text>
              </View>
            )}
            <View style={styles.ratingRow}>
              <Star size={10} color="#FBBF24" fill="#FBBF24" />
              <Text style={styles.ratingText}>
                {item.ratingStats?.averageRating?.toFixed(1) || '4.8'} ({item.ratingStats?.totalReviews || '24'})
              </Text>
            </View>
          </View>
          <View style={styles.priceGroup}>
            <Text style={styles.priceValue}>${baseRate.toFixed(2)}</Text>
            <Text style={styles.priceUnit}>/kg</Text>
          </View>
        </View>

        <View style={styles.routeContainer}>
          {routes.map((r: string) => (
            <View key={r} style={styles.routeTag}>
              <Text style={styles.routeText}>{r}</Text>
            </View>
          ))}
        </View>

        <View style={styles.pFooter}>
          <View style={styles.stat}>
            <Clock size={14} color="#3B82F6" />
            <Text style={styles.statText}>{transitDays} Days Est.</Text>
          </View>
          <View style={styles.verifiedBadge}>
            <ShieldCheck size={14} color="#10B981" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
};

export const SelectCargoPartnerScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('price');
  const [userCity, setUserCity] = useState<string | null>(null);

  useEffect(() => {
    analytics.screen('SelectCargoPartner');
    initDiscovery();
  }, []);

  const initDiscovery = async () => {
    setLoading(true);
    try {
      // 1. Detect User City for Location-Aware Rates
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          const [addr] = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude
          });
          if (addr && addr.city) setUserCity(addr.city);
        }
      } catch (locErr) {
        console.warn("Location detection failed", locErr);
      }

      // 2. Fetch Partners
      const res = await api.get('/cargo/partners');
      if (res.data.success) {
        setPartners(res.data.partners);
      }
    } catch (err) {
      console.error("DISCOVERY_ERROR", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter & Sort Logic
  const processedPartners = useMemo(() => {
    let result = partners.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.supportedRoutes && p.supportedRoutes.some((r: string) => r.toLowerCase().includes(searchQuery.toLowerCase())))
    );

    if (sortBy === 'price') {
      result.sort((a, b) => {
        const rateA = a.requestedAirRate || a.baseRatePerKg || 8.00;
        const rateB = b.requestedAirRate || b.baseRatePerKg || 8.00;
        return rateA - rateB;
      });
    } else {
      result.sort((a, b) => {
        const daysA = a.airConfig?.avgTransitDays || a.estimatedTransitDays || 7;
        const daysB = b.airConfig?.avgTransitDays || b.estimatedTransitDays || 7;
        return daysA - daysB;
      });
    }

    return result;
  }, [partners, searchQuery, sortBy]);

  const handlePartnerSelect = (partner: any) => {
    // Reconstruct fields for details mappings
    const warehouses = partner.warehouses || (partner.publicProfile?.chinaAddress ? [{
      city: 'Guangzhou',
      country: 'China',
      fullAddress: partner.publicProfile.chinaAddress,
      contactNumber: partner.publicProfile.contactPhone || 'N/A'
    }] : []);

    const baseRate = partner.requestedAirRate || partner.baseRatePerKg || 8.00;
    const transitDays = partner.airConfig?.avgTransitDays || partner.estimatedTransitDays || 7;
    const routes = partner.supportedRoutes && partner.supportedRoutes.length > 0 ? partner.supportedRoutes : ['China ➔ Somalia', 'Dubai ➔ Somalia'];

    const mappedPartner = {
      ...partner,
      baseRatePerKg: baseRate,
      estimatedTransitDays: transitDays,
      warehouses: warehouses,
      supportedRoutes: routes
    };
    navigation.navigate('VirtualAddress', { partner: mappedPartner });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* 1. Header Row */}
      <View style={styles.header}>
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeBtn}
          >
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Cargo Partner</Text>
        </View>

        {/* Search Capsule Input */}
        <View style={styles.searchSection}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by route or name..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Sorting Pills */}
        <View style={styles.sortBar}>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'price' && styles.sortBtnActive]}
            onPress={() => setSortBy('price')}
          >
            <DollarSign size={14} color={sortBy === 'price' ? '#FFFFFF' : '#9CA3AF'} />
            <Text style={[styles.sortBtnText, sortBy === 'price' && styles.sortBtnTextActive]}>Cheapest</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'speed' && styles.sortBtnActive]}
            onPress={() => setSortBy('speed')}
          >
            <Zap size={14} color={sortBy === 'speed' ? '#FFFFFF' : '#9CA3AF'} />
            <Text style={[styles.sortBtnText, sortBy === 'speed' && styles.sortBtnTextActive]}>Fastest</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Progress Stepper */}
      <ProgressStepper currentStep={1} />

      {/* 3. List / Partners */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={processedPartners}
          renderItem={({ item }) => (
            <PartnerCard
              item={item}
              onPress={() => handlePartnerSelect(item)}
              userCity={userCity}
            />
          )}
          keyExtractor={p => p._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Package size={48} color="#6B7280" style={{ marginBottom: 15 }} />
              <Text style={styles.emptyTitle}>No cargo partners found.</Text>
              <Text style={styles.emptySubtitle}>Try searching for another route or country.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

// Stepper Styles
const stepperStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#0B132B'
  },
  stepWrapper: { alignItems: 'center' },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  circleActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
    elevation: 4,
    shadowColor: '#2563EB',
    shadowOpacity: 0.4,
    shadowRadius: 4
  },
  circleText: { fontSize: 11, fontWeight: '800', color: '#9CA3AF' },
  circleTextActive: { color: '#FFFFFF' },
  stepLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '800', marginTop: 4 },
  stepLabelActive: { color: '#FFFFFF' },
  line: {
    height: 2,
    width: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 8,
    marginTop: -14
  },
  lineActive: { backgroundColor: '#2563EB' }
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B132B' },
  header: { paddingHorizontal: 20, backgroundColor: '#0B132B' },
  navRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 15 },
  closeBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 15
  },
  headerTitle: { fontSize: 20, fontWeight: '800', marginLeft: 15, color: '#FFFFFF' },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    paddingHorizontal: 15,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#FFFFFF' },
  sortBar: { flexDirection: 'row', paddingVertical: 15 },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  sortBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6'
  },
  sortBtnText: { marginLeft: 6, fontSize: 13, color: '#9CA3AF', fontWeight: '800' },
  sortBtnTextActive: { color: '#FFFFFF' },
  list: { padding: 20, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Mapped partner cards matching shipments cards
  pCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  pHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  partnerLogo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F3F4F6'
  },
  partnerLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  partnerLogoInitial: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 20
  },
  nameGroup: { flex: 1, marginLeft: 14 },
  pName: { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  localBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  localText: { fontSize: 11, color: '#059669', fontWeight: '800', marginLeft: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ratingText: { fontSize: 11, color: '#6B7280', marginLeft: 4, fontWeight: '600' },
  priceGroup: { alignItems: 'flex-end' },
  priceValue: { fontSize: 20, fontWeight: '900', color: '#2563EB' },
  priceUnit: { fontSize: 10, color: '#9CA3AF', fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },
  routeContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
  routeTag: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 8, marginBottom: 4 },
  routeText: { fontSize: 11, fontWeight: '800', color: '#1E40AF' },
  pFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 15,
    alignItems: 'center'
  },
  stat: { flexDirection: 'row', alignItems: 'center' },
  statText: { marginLeft: 6, fontSize: 13, color: '#4B5563', fontWeight: '700' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center' },
  verifiedText: { fontSize: 12, color: '#10B981', fontWeight: '800', marginLeft: 4 },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 40
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  emptySubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 6, textAlign: 'center' }
});