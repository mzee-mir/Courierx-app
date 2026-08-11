import React, { useState, useCallback, useMemo } from 'react';
import { analytics } from '../../utils/analytics';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl, Image, Modal, Alert
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus, Globe, ChevronRight, Info, Package,
  ArrowRight, Truck, Anchor,
  Copy, Clock, ShieldCheck, Star, X
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ActiveImportCard } from '../../components/imports/ActiveImportCard';
import { HistoryImportCard } from '../../components/imports/HistoryImportCard';

export const ImportsHomeScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const shippingMark = `CX-${user?.phoneNumber?.slice(-5) || '88492'}`;

  // -- State --
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [imports, setImports] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ active: number; history: number }>({ active: 0, history: 0 });
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [howItWorksExpanded, setHowItWorksExpanded] = useState(false);
  const [cachedTime, setCachedTime] = useState<string | null>(null);

  const topPartners = useMemo(() => {
    return [...partners].slice(0, 5);
  }, [partners]);

  const [selectedPartner, setSelectedPartner] = useState<any | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Read offline cache on mount
  const loadOfflineCache = async () => {
    try {
      const cached = await AsyncStorage.getItem('imports_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        setImports(parsed.data || []);
        if (parsed.summary) setSummary(parsed.summary);
        if (parsed.cachedAt) {
          const mins = Math.max(1, Math.floor((Date.now() - parsed.cachedAt) / (1000 * 60)));
          setCachedTime(`${mins}m ago`);
        }
      }
    } catch (e) {
      console.log('CACHE_READ_ERROR', e);
    }
  };

  const fetchData = async (tab: 'active' | 'history' = activeTab) => {
    try {
      const [importsRes, partnersRes] = await Promise.all([
        api.get(`/cargo/my-imports?status=${tab}`),
        api.get('/cargo/partners')
      ]);

      if (importsRes.data.success) {
        const fetchedImports = importsRes.data.imports || [];
        const fetchedSummary = importsRes.data.summary || { active: 0, history: 0 };

        setImports(fetchedImports);
        setSummary(fetchedSummary);
        setCachedTime(null);

        // Cache locally
        await AsyncStorage.setItem('imports_cache', JSON.stringify({
          data: fetchedImports,
          summary: fetchedSummary,
          cachedAt: Date.now()
        }));
      }
      if (partnersRes.data.success) {
        setPartners(partnersRes.data.partners || []);
      }
    } catch (err) {
      console.log("FETCH_IMPORTS_ERROR", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      analytics.screen('ImportsHome');
      loadOfflineCache();
      fetchData(activeTab);
    }, [activeTab])
  );

  const handleTabChange = (newTab: 'active' | 'history') => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
    setLoading(true);
    fetchData(newTab);
  };

  const copyToClipboard = async (text: string, label: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert("Copied", `${label} copied to clipboard.`);
  };

  const handlePartnerPress = (partner: any) => {
    setSelectedPartner(partner);
    setIsModalVisible(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* 1. Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Global Imports</Text>
          <Text style={styles.subtitle}>Ship from China, Dubai, or Turkey</Text>
        </View>
        <View style={styles.headerIconContainer}>
          <Globe size={28} color="#FFFFFF" opacity={0.8} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(activeTab); }}
            tintColor="#3B82F6"
          />
        }
      >

        {/* 2. Start New Import CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => navigation.navigate('SelectPartner')}
          activeOpacity={0.8}
        >
          <Plus color="#FFFFFF" size={20} />
          <Text style={styles.ctaText}>Import a New Package</Text>
        </TouchableOpacity>

        {/* 3. Horizontal Partner Brands Section */}
        <View style={styles.brandsSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Shipping Partners</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SelectPartner')} activeOpacity={0.7}>
              <Text style={styles.sectionSeeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.brandsScroll}
          >
            {topPartners.length === 0 ? (
              [1, 2, 3].map(i => (
                <View key={i} style={[styles.brandCard, styles.brandCardSkeleton]}>
                  <View style={styles.brandLogoSkeletonBox} />
                  <View style={styles.brandNameSkeleton} />
                  <View style={styles.brandRateSkeleton} />
                </View>
              ))
            ) : (
              topPartners.map((partner) => {
                const logoUrl = partner.publicProfile?.logoUrl;
                const rate = partner.requestedAirRate ? `$${partner.requestedAirRate}/kg` : '$8.00/kg';

                return (
                  <TouchableOpacity
                    key={partner._id}
                    style={styles.brandCard}
                    onPress={() => handlePartnerPress(partner)}
                    activeOpacity={0.85}
                  >
                    {logoUrl ? (
                      <Image source={{ uri: logoUrl }} style={styles.brandLogoHero as any} />
                    ) : (
                      <View style={styles.brandLogoHeroPlaceholder}>
                        <Text style={styles.brandLogoHeroInitial}>{partner.name.charAt(0)}</Text>
                      </View>
                    )}
                    <View style={styles.brandCardBody}>
                      <Text style={styles.brandName} numberOfLines={1}>{partner.name}</Text>
                      <View style={styles.brandMeta}>
                        <View style={styles.brandRating}>
                          <Star size={10} color="#FBBF24" fill="#FBBF24" />
                          <Text style={styles.ratingText}>
                            {partner.ratingStats?.averageRating?.toFixed(1) || '4.8'}
                          </Text>
                        </View>
                        <Text style={styles.brandRate}>{rate}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* 4. How It Works — collapsible */}
        <View style={styles.guideCard}>
          <TouchableOpacity
            style={styles.guideHeader}
            onPress={() => setHowItWorksExpanded(prev => !prev)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Info size={16} color="#3B82F6" />
              <Text style={styles.guideTitle}>How Imports Work</Text>
            </View>
            <Text style={styles.guideToggle}>{howItWorksExpanded ? '▲ Hide' : '▼ Learn More'}</Text>
          </TouchableOpacity>

          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={styles.bulletCol}>
                <View style={styles.bullet}><Text style={styles.bulletText}>1</Text></View>
                <View style={styles.timelineLine} />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Select Partner & Address</Text>
                <Text style={styles.stepText}>Choose a verified cargo partner and get your unique overseas warehouse address.</Text>
              </View>
            </View>
            <View style={[styles.timelineItem, !howItWorksExpanded && { marginBottom: 0 }]}>
              <View style={styles.bulletCol}>
                <View style={styles.bullet}><Text style={styles.bulletText}>2</Text></View>
                {howItWorksExpanded && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Supplier Checkout</Text>
                <Text style={styles.stepText}>Buy on Alibaba/AliExpress and use your unique CourierX Shipping Mark at checkout.</Text>
              </View>
            </View>

            {howItWorksExpanded && (
              <>
                <View style={styles.timelineItem}>
                  <View style={styles.bulletCol}>
                    <View style={styles.bullet}><Text style={styles.bulletText}>3</Text></View>
                    <View style={styles.timelineLine} />
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Declare Tracking ID</Text>
                    <Text style={styles.stepText}>Enter your package tracking number so we can monitor its status.</Text>
                  </View>
                </View>
                <View style={[styles.timelineItem, { marginBottom: 0 }]}>
                  <View style={styles.bulletCol}>
                    <View style={[styles.bullet, { backgroundColor: '#10B981' }]}><Text style={styles.bulletText}>4</Text></View>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Doorstep Delivery</Text>
                    <Text style={styles.stepText}>We receive, clear customs, ship, and deliver directly to your gate in Somalia.</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* 5. My Shipments Tabs & List */}
        <View style={styles.listContainer}>
          <View style={styles.tabRowHeader}>
            <View style={styles.segmentedTabContainer}>
              <TouchableOpacity
                style={[styles.segmentedTab, activeTab === 'active' && styles.segmentedTabActive]}
                onPress={() => handleTabChange('active')}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentedTabText, activeTab === 'active' && styles.segmentedTabTextActive]}>
                  Active ({summary.active})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentedTab, activeTab === 'history' && styles.segmentedTabActive]}
                onPress={() => handleTabChange('history')}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentedTabText, activeTab === 'history' && styles.segmentedTabTextActive]}>
                  History ({summary.history})
                </Text>
              </TouchableOpacity>
            </View>

            {cachedTime && (
              <Text style={styles.cachedBadgeText}>Updated {cachedTime}</Text>
            )}
          </View>

          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : imports.length === 0 ? (
            activeTab === 'active' ? (
              <View style={styles.emptyShipmentsCard}>
                <Package size={40} color="#9CA3AF" />
                <Text style={styles.emptyShipmentsTitle}>No active shipments</Text>
                <Text style={styles.emptyShipmentsSubtitle}>Import your next package from China or Dubai.</Text>
                <TouchableOpacity
                  style={styles.emptyCtaBtn}
                  onPress={() => navigation.navigate('SelectPartner')}
                >
                  <Text style={styles.emptyCtaBtnText}>Start Import</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyShipmentsCard}>
                <Package size={40} color="#9CA3AF" />
                <Text style={styles.emptyShipmentsTitle}>No completed shipments yet</Text>
                <Text style={styles.emptyShipmentsSubtitle}>Delivered packages and past records will appear here.</Text>
              </View>
            )
          ) : (
            <FlatList
              data={imports}
              renderItem={({ item }) => (
                activeTab === 'active' ? (
                  <ActiveImportCard
                    item={item}
                    onPress={() => navigation.navigate('ImportDetail', { importId: item._id })}
                  />
                ) : (
                  <HistoryImportCard
                    item={item}
                    onPress={() => navigation.navigate('ImportDetail', { importId: item._id })}
                    onViewReceipt={() => navigation.navigate('ImportDetail', { importId: item._id })}
                  />
                )
              )}
              keyExtractor={item => item._id}
              scrollEnabled={false}
              contentContainerStyle={styles.list}
            />
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Brand Details Modal Sheet */}
      {selectedPartner && (
        <Modal
          visible={isModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>

              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTitle}>Partner Organization Profile</Text>
                <TouchableOpacity
                  onPress={() => setIsModalVisible(false)}
                  style={styles.closeModalBtn}
                >
                  <X size={20} color="#1F2937" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScroll}
              >

                <View style={styles.showcaseBlock}>
                  {selectedPartner.publicProfile?.logoUrl ? (
                    <Image
                      source={{ uri: selectedPartner.publicProfile.logoUrl }}
                      style={styles.showcaseLogo as any}
                    />
                  ) : (
                    <View style={styles.showcaseLogoPlaceholder}>
                      <Text style={styles.showcaseLogoInitial}>{selectedPartner.name.charAt(0)}</Text>
                    </View>
                  )}
                  <View style={styles.showcaseDetails}>
                    <Text style={styles.showcaseName}>{selectedPartner.name}</Text>
                    <View style={styles.statusRow}>
                      <View style={styles.activeIndicator} />
                      <Text style={styles.statusLabel}>MARKET_STATUS: ACTIVE</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>01_BRAND_STORY</Text>

                  <View style={styles.bioContainer}>
                    <Text style={styles.bioTitle}>Company Bio</Text>
                    <Text style={styles.bioText}>
                      {selectedPartner.publicProfile?.bio || "Fast international freight & clearance services into Somalia."}
                    </Text>
                  </View>

                  <View style={styles.hoursContainer}>
                    <Text style={styles.hoursTitle}>Operating Hours</Text>
                    <View style={styles.hoursRow}>
                      <Clock size={16} color="#4B5563" />
                      <Text style={styles.hoursText}>
                        {selectedPartner.publicProfile?.operatingHours || "Sat - Thu: 8am - 5pm"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>02_CHINA_LOGISTICS_DATA</Text>

                  <View style={styles.addressBox}>
                    <View style={styles.addressBoxHeader}>
                      <Text style={styles.addressBoxTitle}>ALIBABA_PASTE_ADDRESS</Text>
                      <TouchableOpacity
                        onPress={() => copyToClipboard(
                          selectedPartner.publicProfile?.chinaAddress || "123 Logistics Way, Baiyun District, Guangzhou, China.",
                          "Warehouse Address"
                        )}
                        style={styles.copyBtn}
                      >
                        <Copy size={14} color="#2563EB" />
                        <Text style={styles.copyBtnText}>Copy Address</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.addressBoxValue}>
                      {selectedPartner.publicProfile?.chinaAddress || "123 Logistics Way, Baiyun District, Guangzhou, China."}
                    </Text>
                  </View>

                  <View style={styles.addressBox}>
                    <View style={styles.addressBoxHeader}>
                      <Text style={styles.addressBoxTitle}>MARKING_INSTRUCTIONS</Text>
                      <TouchableOpacity
                        onPress={() => copyToClipboard(shippingMark, "Shipping Mark")}
                        style={styles.copyBtn}
                      >
                        <Copy size={14} color="#2563EB" />
                        <Text style={styles.copyBtnText}>Copy Mark</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.addressBoxValue}>
                      Shipping Mark: <Text style={styles.markCode}>{shippingMark}</Text>
                      {"\n"}
                      Add this to the "Company Name" or "Apartment" checkout fields.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.modalCtaBtn}
                  onPress={() => {
                    setIsModalVisible(false);
                    navigation.navigate('DeclareImport', {
                      partnerId: selectedPartner._id,
                      origin: selectedPartner.operatingCountries?.[0] || 'CN',
                      shippingMark
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCtaBtnText}>Proceed to Import Package</Text>
                  <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </TouchableOpacity>

              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B132B' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15
  },
  headerTitleContainer: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { color: '#9CA3AF', marginTop: 2, fontSize: 13 },
  headerIconContainer: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20
  },
  scroll: { paddingHorizontal: 20, paddingTop: 10 },

  ctaButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  ctaText: { color: 'white', fontWeight: '800', fontSize: 16, marginLeft: 8 },

  brandsSection: { marginBottom: 25 },
  brandsScroll: { paddingRight: 8, paddingVertical: 4 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  sectionSeeAll: { fontSize: 13, fontWeight: '700', color: '#3B82F6' },
  brandCard: {
    width: 185,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden'
  },
  brandCardSkeleton: { opacity: 0.5 },
  brandLogoHero: { width: '100%', height: 90, backgroundColor: '#1E293B' },
  brandLogoHeroPlaceholder: {
    width: '100%',
    height: 90,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandLogoHeroInitial: { color: '#FFFFFF', fontWeight: '800', fontSize: 32 },
  brandLogoSkeletonBox: { width: '100%', height: 90, backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  brandCardBody: { padding: 12 },
  brandMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  brandRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8
  },
  ratingText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', marginLeft: 3 },
  brandName: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  brandRate: { color: '#3B82F6', fontSize: 11, fontWeight: '800' },
  brandNameSkeleton: { height: 12, width: 80, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, margin: 12, marginBottom: 6 },
  brandRateSkeleton: { height: 10, width: 50, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, marginHorizontal: 12, marginBottom: 12 },

  guideCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20
  },
  guideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  guideTitle: { fontSize: 15, fontWeight: '800', marginLeft: 8, color: '#FFFFFF' },
  guideToggle: { fontSize: 12, fontWeight: '700', color: '#3B82F6' },

  timeline: { paddingLeft: 4 },
  timelineItem: { flexDirection: 'row', marginBottom: 24 },
  bulletCol: { alignItems: 'center', marginRight: 16, width: 28 },
  bullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2
  },
  bulletText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 4,
    marginBottom: -10,
    zIndex: 1
  },
  stepContent: { flex: 1, paddingTop: 2 },
  stepTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  stepText: { fontSize: 12, color: '#9CA3AF', marginTop: 4, lineHeight: 18 },

  listContainer: { marginTop: 10, marginBottom: 10 },
  tabRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  segmentedTabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 4,
  },
  segmentedTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  segmentedTabActive: { backgroundColor: '#2563EB' },
  segmentedTabText: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  segmentedTabTextActive: { color: '#FFFFFF' },
  cachedBadgeText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },

  loadingContainer: { marginTop: 40, alignItems: 'center' },

  emptyShipmentsCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  emptyShipmentsTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginTop: 12 },
  emptyShipmentsSubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 6, textAlign: 'center' },
  emptyCtaBtn: { marginTop: 16, backgroundColor: '#2563EB', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  emptyCtaBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  list: { paddingBottom: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '85%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  modalHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  closeModalBtn: { padding: 6, backgroundColor: '#F3F4F6', borderRadius: 15 },
  modalScroll: { padding: 24, paddingBottom: 40 },

  showcaseBlock: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  showcaseLogo: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#F3F4F6' },
  showcaseLogoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  showcaseLogoInitial: { color: '#FFFFFF', fontWeight: '800', fontSize: 24 },
  showcaseDetails: { marginLeft: 16 },
  showcaseName: { fontSize: 22, fontWeight: '900', color: '#111827' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  activeIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 },
  statusLabel: { fontSize: 10, fontWeight: '800', color: '#6B7280', letterSpacing: 0.5 },

  modalSection: { marginBottom: 25 },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12
  },

  bioContainer: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 16, marginBottom: 12 },
  bioTitle: { fontSize: 11, fontWeight: '800', color: '#4B5563', textTransform: 'uppercase', marginBottom: 6 },
  bioText: { fontSize: 14, color: '#1F2937', lineHeight: 20 },

  hoursContainer: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 16 },
  hoursTitle: { fontSize: 11, fontWeight: '800', color: '#4B5563', textTransform: 'uppercase', marginBottom: 6 },
  hoursRow: { flexDirection: 'row', alignItems: 'center' },
  hoursText: { fontSize: 14, color: '#1F2937', marginLeft: 8, fontWeight: '600' },

  addressBox: {
    backgroundColor: '#F9FAFB',
    padding: 18,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  addressBoxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addressBoxTitle: { fontSize: 10, fontWeight: '800', color: '#6B7280' },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  copyBtnText: { color: '#2563EB', fontWeight: '800', fontSize: 11, marginLeft: 4 },
  addressBoxValue: { fontSize: 13, color: '#1F2937', lineHeight: 20, fontWeight: '500' },
  markCode: { color: '#2563EB', fontWeight: '900', letterSpacing: 0.5 },

  modalCtaBtn: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 10
  },
  modalCtaBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 }
});