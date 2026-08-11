import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Copy, MapPin, ChevronRight, Info, Check, ArrowRight, Home, Briefcase } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { ProgressStepper } from './SelectCargoPartnerScreen';
import { analytics } from '../../utils/analytics';

export const VirtualAddressScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { partner } = route.params;
  const { user } = useAuth();
  
  // Logic: The unique ID is the "Shipping Mark" used in international logistics
  const shippingMark = `CX-${user?.phoneNumber?.slice(-5)}`;

  // -- Micro-interaction Copy States --
  const [copiedMark, setCopiedMark] = useState(false);
  const [copiedAddressIndex, setCopiedAddressIndex] = useState<number | null>(null);

  useEffect(() => {
    analytics.screen('VirtualAddress');
    analytics.track('import_screen_viewed', { screen: 'VirtualAddress', partnerId: partner._id });
  }, []);

  const copyMarkToClipboard = async () => {
    await Clipboard.setStringAsync(shippingMark);
    setCopiedMark(true);
    setTimeout(() => setCopiedMark(false), 2000);
  };

  const copyAddressToClipboard = async (address: string, index: number) => {
    await Clipboard.setStringAsync(address);
    setCopiedAddressIndex(index);
    setTimeout(() => setCopiedAddressIndex(null), 2000);
    analytics.track('import_address_copied', { partnerId: partner._id });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      {/* 1. Header Section */}
      <View style={styles.header}>
        <Text style={styles.title}>Your {partner.name} Address</Text>
        <Text style={styles.subtitle}>Copy this to Alibaba/AliExpress checkout</Text>
      </View>

      {/* 2. Progress Stepper */}
      <ProgressStepper currentStep={2} />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        
        {/* 3. Visual Stepper Workflow Guideline */}
        <View style={styles.workflowCard}>
          <Text style={styles.workflowHeaderTitle}>Logistics Checkout Steps</Text>
          <View style={styles.stepsList}>
            <View style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
              <Text style={styles.stepRowText}>Copy shipping mark code below</Text>
            </View>
            <View style={styles.lineDivider} />
            <View style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
              <Text style={styles.stepRowText}>Copy partner warehouse address</Text>
            </View>
            <View style={styles.lineDivider} />
            <View style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
              <Text style={styles.stepRowText}>Paste details into Alibaba Checkout</Text>
            </View>
            <View style={styles.lineDivider} />
            <View style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>4</Text></View>
              <Text style={styles.stepRowText}>Pay supplier for order shipping</Text>
            </View>
            <View style={styles.lineDivider} />
            <View style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>5</Text></View>
              <Text style={styles.stepRowText}>Return here to declare tracking ID</Text>
            </View>
          </View>
        </View>

        {/* 4. Mandatory Shipping Mark Alert Box */}
        <View style={styles.markCard}>
          <View style={styles.markHeader}>
            <Info size={16} color="#FFFFFF" />
            <Text style={styles.markTitle}>MANDATORY SHIPPING MARK</Text>
          </View>
          <Text style={styles.markValue}>{shippingMark}</Text>
          <Text style={styles.markInstruction}>
            Must be added to the "Company Name" or "Apartment" checkout fields. Without this, cargo matches fail.
          </Text>
          
          <TouchableOpacity 
            style={[styles.copyBtnSmall, copiedMark && styles.copyBtnSuccess]} 
            onPress={copyMarkToClipboard}
            activeOpacity={0.8}
          >
            {copiedMark ? (
              <>
                <Check size={14} color="#10B981" />
                <Text style={[styles.copyBtnText, styles.copySuccessText]}>✓ Copied</Text>
              </>
            ) : (
              <>
                <Copy size={14} color="#2563EB" />
                <Text style={styles.copyBtnText}>Copy Mark</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 5. Warehouse Trust Showcase */}
        <View style={styles.trustShowcaseCard}>
          <View style={styles.trustIconContainer}>
            <Briefcase size={24} color="#3B82F6" />
          </View>
          <View style={styles.trustDetails}>
            <Text style={styles.trustTitle}>{partner.warehouses?.[0]?.city || 'Overseas'} Warehouse Hub</Text>
            <View style={styles.verifiedRow}>
              <Check size={12} color="#10B981" />
              <Text style={styles.verifiedLabel}>Verified CourierX Facility</Text>
            </View>
          </View>
        </View>

        {/* 6. Warehouse Address Card */}
        {partner.warehouses?.map((wh: any, index: number) => {
          const isCopied = copiedAddressIndex === index;
          
          return (
            <View key={index} style={styles.addressCard}>
              <View style={styles.whHeader}>
                <MapPin size={20} color="#2563EB" />
                <Text style={styles.whTitle}>{wh.city}, {wh.country}</Text>
              </View>
              <Text style={styles.addressText}>{wh.fullAddress}</Text>
              <Text style={styles.phoneText}>Warehouse Tel: {wh.contactNumber}</Text>
              
              <TouchableOpacity 
                style={[styles.copyBtnLarge, isCopied && styles.copyBtnLargeSuccess]} 
                onPress={() => copyAddressToClipboard(wh.fullAddress, index)}
                activeOpacity={0.85}
              >
                {isCopied ? (
                  <>
                    <Check size={18} color="#FFFFFF" />
                    <Text style={styles.copyBtnTextLarge}>✓ Address Copied</Text>
                  </>
                ) : (
                  <>
                    <Copy size={18} color="#FFFFFF" />
                    <Text style={styles.copyBtnTextLarge}>Copy Full Address</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        {/* 7. Return/Declaration CTA */}
        <TouchableOpacity 
          style={styles.nextBtn} 
          onPress={() => navigation.navigate('DeclareImport', { partnerId: partner._id, origin: partner.warehouses?.[0]?.country || 'CN' })}
          activeOpacity={0.8}
        >
          <Text style={styles.nextBtnText}>I've Placed My Order</Text>
          <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B132B' },
  header: { paddingHorizontal: 24, paddingVertical: 20, backgroundColor: '#0B132B' },
  title: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // Workflow visual timeline
  workflowCard: { 
    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
    padding: 20, 
    borderRadius: 24, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  workflowHeaderTitle: { fontSize: 13, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 16 },
  stepsList: { paddingLeft: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepNum: { 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    backgroundColor: '#3B82F6', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  stepNumText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  stepRowText: { fontSize: 13, color: '#FFFFFF', fontWeight: '800', marginLeft: 12 },
  lineDivider: { 
    width: 1, 
    height: 12, 
    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
    marginLeft: 10,
    marginVertical: 4
  },

  // Mandatory Shipping Mark
  markCard: { 
    backgroundColor: '#1E3A8A', 
    padding: 20, 
    borderRadius: 24, 
    marginBottom: 20,
    elevation: 6,
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8
  },
  markHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  markTitle: { fontSize: 11, fontWeight: '800', color: '#93C5FD', marginLeft: 8, letterSpacing: 0.5 },
  markValue: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2, marginBottom: 8 },
  markInstruction: { fontSize: 12, color: '#DBEAFE', opacity: 0.8, lineHeight: 18, marginBottom: 16 },
  
  // Custom copy buttons micro-interaction
  copyBtnSmall: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    alignSelf: 'flex-start', 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 12, 
  },
  copyBtnSuccess: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#A5D6A7'
  },
  copyBtnText: { marginLeft: 6, fontSize: 12, fontWeight: '800', color: '#2563EB' },
  copySuccessText: { color: '#2E7D32' },

  // Trust showcase block
  trustShowcaseCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)'
  },
  trustIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  trustDetails: { marginLeft: 14 },
  trustTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  verifiedLabel: { fontSize: 11, color: '#10B981', fontWeight: '800', marginLeft: 4 },

  // Address Details Card
  addressCard: { 
    backgroundColor: '#FFFFFF', 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 20, 
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6
  },
  whHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  whTitle: { fontSize: 16, fontWeight: '800', marginLeft: 10, color: '#1F2937' },
  addressText: { fontSize: 14, color: '#4B5563', lineHeight: 22, marginBottom: 10, fontWeight: '600' },
  phoneText: { fontSize: 13, color: '#9CA3AF', marginBottom: 20, fontWeight: '600' },
  
  copyBtnLarge: { 
    backgroundColor: '#2563EB', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 16, 
    borderRadius: 14 
  },
  copyBtnLargeSuccess: {
    backgroundColor: '#10B981'
  },
  copyBtnTextLarge: { color: 'white', fontWeight: '800', fontSize: 15, marginLeft: 8 },

  // Premium Next button CTA
  nextBtn: { 
    backgroundColor: '#2563EB',
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 18, 
    borderRadius: 20, 
    marginTop: 10,
    elevation: 4
  },
  nextBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 }
});