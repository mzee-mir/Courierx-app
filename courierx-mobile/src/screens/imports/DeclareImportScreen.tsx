import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, 
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  X, ArrowRight, Plane, Ship, MapPin, 
  Bike, Car as CarIcon, Truck as TruckIcon, DollarSign, Package, Tag, Weight
} from 'lucide-react-native';

import { api } from '../../api/client';
import { ProgressStepper } from './SelectCargoPartnerScreen';
import { CustomLocationModal } from '../../components/orders/CustomLocationModal';
import { analytics } from '../../utils/analytics';

const CATEGORIES = [
  { label: 'Electronics & Gadgets', value: 'ELECTRONICS', hsCode: '8517' },
  { label: 'Clothing & Apparel', value: 'CLOTHING', hsCode: '6109' },
  { label: 'Shoes & Footwear', value: 'SHOES', hsCode: '6403' },
  { label: 'Beauty & Cosmetics', value: 'BEAUTY', hsCode: '3304' },
  { label: 'Home & Kitchen', value: 'HOME', hsCode: '9403' },
  { label: 'General Goods', value: 'GENERAL', hsCode: '9999' },
];

export const DeclareImportScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const partnerId = route.params?.partnerId;
  const origin = route.params?.origin || 'CN';
  const shippingMark = route.params?.shippingMark || 'CX-88492';

  // -- Form State --
  const [tracking, setTracking] = useState('');
  const [desc, setDesc] = useState('');
  const [declaredValue, setDeclaredValue] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [quantity, setQuantity] = useState('1');
  const [estimatedWeight, setEstimatedWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [transportMode, setTransportMode] = useState<'AIR' | 'SEA'>('AIR');
  const [vehicle, setVehicle] = useState<'bajaj' | 'car' | 'truck'>('bajaj');
  
  // Destination Coordinates Dropoff Landmark
  const [dropoff, setDropoff] = useState<any | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDeclare = async () => {
    if (!tracking.trim()) {
      Alert.alert("Missing Tracking ID", "Please enter the tracking number provided by your supplier.");
      return;
    }
    if (!desc.trim()) {
      Alert.alert("Missing Description", "Please briefly describe the contents of your shipment.");
      return;
    }
    if (!declaredValue.trim() || isNaN(Number(declaredValue))) {
      Alert.alert("Invalid Customs Value", "Please enter a valid numeric value for customs declaration (USD).");
      return;
    }
    if (!dropoff) {
      Alert.alert("Destination Required", "Please select a Somalia delivery destination on the map.");
      return;
    }

    const weightInKg = estimatedWeight.trim() && !isNaN(Number(estimatedWeight))
      ? (weightUnit === 'lbs' ? Number(estimatedWeight) * 0.453592 : Number(estimatedWeight))
      : undefined;

    setLoading(true);
    try {
      const payload = {
        partnerId,
        externalTrackingNumber: tracking.trim(),
        itemDescription: desc.trim(),
        originCountry: origin,
        transportMode,
        preferredLocalVehicle: vehicle,
        dropoffLandmark: dropoff.description,
        dropoffLocation: {
          type: 'Point',
          coordinates: [dropoff.location.coordinates[0], dropoff.location.coordinates[1]] // [lng, lat]
        },
        estimatedWeightKg: weightInKg ? Number(weightInKg.toFixed(2)) : undefined,
        customsDeclaration: {
          declaredValue: Number(Number(declaredValue).toFixed(2)),
          declaredCurrency: 'USD',
          category: category.value,
          hsCode: category.hsCode,
          quantity: parseInt(quantity, 10) || 1,
          countryOfManufacture: origin
        }
      };

      const res = await api.post('/cargo/declare', payload);

      if (res.data.success) {
        analytics.track('import_declared', {
          partnerId,
          transportMode,
          originCountry: origin,
          category: category.value,
          declaredValue: payload.customsDeclaration.declaredValue,
          estimatedWeightKg: payload.estimatedWeightKg
        });

        Alert.alert(
          "Declared Successfully", 
          "Your shipment has been declared. We will notify you when it reaches our origin hub."
        );
        navigation.navigate('ImportsHome');
      }
    } catch (err: any) {
      analytics.track('import_declaration_failed', {
        errorCode: err.response?.data?.error || err.response?.status || 'UNKNOWN'
      });

      if (err.response?.status === 409) {
        const existingId = err.response.data?.existingImportId;
        Alert.alert(
          "Duplicate Declaration",
          "This tracking number is already declared in your active imports.",
          [
            { text: "OK" },
            {
              text: "View Shipment",
              onPress: () => {
                if (existingId) {
                  navigation.navigate('ImportDetail', { id: existingId });
                }
              }
            }
          ]
        );
      } else {
        Alert.alert("Declaration Failed", err.response?.data?.error || err.response?.data?.message || "Unable to save declaration. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* 1. Header Section */}
      <View style={styles.header}>
        <View style={styles.navRow}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.closeBtn}
            accessibilityLabel="Close declaration form"
            accessibilityRole="button"
          >
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Declare Shipment</Text>
        </View>
        <Text style={styles.subtitle}>Fill in details to track & clear your shipment through Somalia customs</Text>
      </View>

      {/* 2. Progress Stepper */}
      <ProgressStepper currentStep={3} />

      {/* 3. Form */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.formScroll}
      >
        
        {/* Shipping Mark Card (Read-only) */}
        <View style={styles.shippingMarkCard}>
          <View>
            <Text style={styles.shippingMarkLabel}>Your Assigned Shipping Mark</Text>
            <Text style={styles.shippingMarkValue}>{shippingMark}</Text>
          </View>
          <View style={styles.markBadge}>
            <Text style={styles.markBadgeText}>AUTO-LINKED</Text>
          </View>
        </View>

        {/* Tracking ID input */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Supplier Tracking Number *</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. 77312345678 (Alibaba / DHL / Fedex)" 
            placeholderTextColor="#9CA3AF"
            value={tracking} 
            onChangeText={setTracking}
            autoCapitalize="characters"
          />
        </View>

        {/* Short Description */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Item Description *</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. 20 pairs of running shoes, 2 Laptops" 
            placeholderTextColor="#9CA3AF"
            value={desc} 
            onChangeText={setDesc} 
          />
        </View>

        {/* Customs Value & Quantity Row */}
        <View style={styles.rowTwo}>
          <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Customs Value (USD) *</Text>
            <View style={styles.iconInputWrap}>
              <DollarSign size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, { paddingLeft: 40 }]} 
                placeholder="45.00" 
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={declaredValue} 
                onChangeText={setDeclaredValue} 
              />
            </View>
          </View>

          <View style={[styles.formGroup, { width: 110 }]}>
            <Text style={styles.label}>Quantity</Text>
            <View style={styles.iconInputWrap}>
              <Package size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, { paddingLeft: 40 }]} 
                placeholder="1" 
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={quantity} 
                onChangeText={setQuantity} 
              />
            </View>
          </View>
        </View>

        {/* Item Category Selector */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Item Category / Customs Code</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {CATEGORIES.map((cat) => {
              const selected = category.value === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.categoryChip, selected && styles.categoryChipActive]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Tag size={14} color={selected ? '#FFFFFF' : '#9CA3AF'} style={{ marginRight: 6 }} />
                  <Text style={[styles.categoryChipText, selected && styles.categoryChipTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Estimated Weight Input with Unit Toggle */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Estimated Weight (Optional)</Text>
          <View style={styles.weightRow}>
            <View style={[styles.iconInputWrap, { flex: 1, marginRight: 10 }]}>
              <Weight size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, { paddingLeft: 40 }]} 
                placeholder="e.g. 3.5" 
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={estimatedWeight} 
                onChangeText={setEstimatedWeight} 
              />
            </View>
            <View style={styles.unitToggleContainer}>
              <TouchableOpacity
                style={[styles.unitToggleBtn, weightUnit === 'kg' && styles.unitToggleBtnActive]}
                onPress={() => setWeightUnit('kg')}
              >
                <Text style={[styles.unitToggleText, weightUnit === 'kg' && styles.unitToggleTextActive]}>KG</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitToggleBtn, weightUnit === 'lbs' && styles.unitToggleBtnActive]}
                onPress={() => setWeightUnit('lbs')}
              >
                <Text style={[styles.unitToggleText, weightUnit === 'lbs' && styles.unitToggleTextActive]}>LBS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Shipping Mode Segmented Selector */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Preferred Shipping Mode</Text>
          <View style={styles.modeSelector}>
            
            {/* Air Option */}
            <TouchableOpacity 
              style={[styles.modeCard, transportMode === 'AIR' && styles.modeCardActive]}
              onPress={() => setTransportMode('AIR')}
              activeOpacity={0.8}
            >
              <Plane size={22} color={transportMode === 'AIR' ? '#FFFFFF' : '#9CA3AF'} />
              <Text style={[styles.modeCardText, transportMode === 'AIR' && styles.modeCardTextActive]}>AIR Freight</Text>
            </TouchableOpacity>

            {/* Sea Option */}
            <TouchableOpacity 
              style={[styles.modeCard, transportMode === 'SEA' && styles.modeCardActive]}
              onPress={() => setTransportMode('SEA')}
              activeOpacity={0.8}
            >
              <Ship size={22} color={transportMode === 'SEA' ? '#FFFFFF' : '#9CA3AF'} />
              <Text style={[styles.modeCardText, transportMode === 'SEA' && styles.modeCardTextActive]}>SEA Freight</Text>
            </TouchableOpacity>

          </View>
        </View>

        {/* Preferred Delivery Vehicle Segmented Selector */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Somalia Delivery Vehicle</Text>
          <View style={styles.vehicleSelector}>
            
            {/* Bajaj Option */}
            <TouchableOpacity 
              style={[styles.vehicleCard, vehicle === 'bajaj' && styles.vehicleCardActive]}
              onPress={() => setVehicle('bajaj')}
              activeOpacity={0.8}
            >
              <Bike size={20} color={vehicle === 'bajaj' ? '#FFFFFF' : '#9CA3AF'} />
              <Text style={[styles.vehicleCardText, vehicle === 'bajaj' && styles.vehicleCardTextActive]}>Bajaj</Text>
            </TouchableOpacity>

            {/* Car Option */}
            <TouchableOpacity 
              style={[styles.vehicleCard, vehicle === 'car' && styles.vehicleCardActive]}
              onPress={() => setVehicle('car')}
              activeOpacity={0.8}
            >
              <CarIcon size={20} color={vehicle === 'car' ? '#FFFFFF' : '#9CA3AF'} />
              <Text style={[styles.vehicleCardText, vehicle === 'car' && styles.vehicleCardTextActive]}>Car</Text>
            </TouchableOpacity>

            {/* Truck Option */}
            <TouchableOpacity 
              style={[styles.vehicleCard, vehicle === 'truck' && styles.vehicleCardActive]}
              onPress={() => setVehicle('truck')}
              activeOpacity={0.8}
            >
              <TruckIcon size={20} color={vehicle === 'truck' ? '#FFFFFF' : '#9CA3AF'} />
              <Text style={[styles.vehicleCardText, vehicle === 'truck' && styles.vehicleCardTextActive]}>Truck</Text>
            </TouchableOpacity>

          </View>
        </View>

        {/* Map Destination Coordinates Selector */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Somalia Delivery Address *</Text>
          
          {!dropoff ? (
            <TouchableOpacity 
              style={styles.mapTriggerBtn}
              onPress={() => setPickerVisible(true)}
              activeOpacity={0.8}
            >
              <MapPin size={20} color="#2563EB" />
              <Text style={styles.mapTriggerBtnText}>Set Destination on Map</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.addressSummaryCard}>
              <View style={styles.addressSummaryIconBox}>
                <MapPin size={22} color="#2563EB" />
              </View>
              <View style={styles.addressSummaryDetails}>
                <Text style={styles.addressSummaryLabel}>Landmark Destination</Text>
                <Text style={styles.addressSummaryDesc} numberOfLines={2}>{dropoff.description}</Text>
              </View>
              <TouchableOpacity 
                style={styles.addressChangeBtn}
                onPress={() => setPickerVisible(true)}
              >
                <Text style={styles.addressChangeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Submit Declaration CTA */}
        <TouchableOpacity 
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
          onPress={handleDeclare} 
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Start Cargo Tracking</Text>
              <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </>
          )}
        </TouchableOpacity>

      </ScrollView>

      {/* 4. Global Custom Map Coordinate Picker Modal */}
      <CustomLocationModal 
        isVisible={pickerVisible}
        title="Set Delivery Pin"
        onClose={() => setPickerVisible(false)}
        onSelect={(landmark) => setDropoff(landmark)}
      />

    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B132B' },
  header: { paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#0B132B' },
  navRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 15 },
  closeBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 15
  },
  headerTitle: { fontSize: 20, fontWeight: '800', marginLeft: 15, color: '#FFFFFF' },
  subtitle: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  formScroll: { padding: 20, paddingBottom: 40 },
  
  shippingMarkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  shippingMarkLabel: { fontSize: 11, fontWeight: '700', color: '#93C5FD', textTransform: 'uppercase' },
  shippingMarkValue: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginTop: 2, letterSpacing: 1 },
  markBadge: { backgroundColor: '#2563EB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  markBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },

  formGroup: { marginBottom: 20 },
  rowTwo: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { 
    backgroundColor: 'rgba(255, 255, 255, 0.04)', 
    borderRadius: 14, 
    padding: 16, 
    fontSize: 15, 
    color: '#FFFFFF',
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.08)' 
  },
  
  iconInputWrap: { position: 'relative', justifyContent: 'center' },
  inputIcon: { position: 'absolute', left: 14, zIndex: 2 },

  categoryScroll: { flexDirection: 'row', marginHorizontal: -4 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 4,
  },
  categoryChipActive: { backgroundColor: '#2563EB', borderColor: '#3B82F6' },
  categoryChipText: { color: '#9CA3AF', fontSize: 13, fontWeight: '700' },
  categoryChipTextActive: { color: '#FFFFFF' },

  weightRow: { flexDirection: 'row', alignItems: 'center' },
  unitToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  unitToggleBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  unitToggleBtnActive: { backgroundColor: '#2563EB' },
  unitToggleText: { fontSize: 12, fontWeight: '800', color: '#9CA3AF' },
  unitToggleTextActive: { color: '#FFFFFF' },

  // Segmented selectors
  modeSelector: { flexDirection: 'row', justifyContent: 'space-between' },
  modeCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  modeCardActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6'
  },
  modeCardText: { marginLeft: 8, color: '#9CA3AF', fontWeight: '800', fontSize: 14 },
  modeCardTextActive: { color: '#FFFFFF' },

  vehicleSelector: { flexDirection: 'row', justifyContent: 'space-between' },
  vehicleCard: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  vehicleCardActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6'
  },
  vehicleCardText: { marginLeft: 6, color: '#9CA3AF', fontWeight: '800', fontSize: 13 },
  vehicleCardTextActive: { color: '#FFFFFF' },

  // Map pin trigger
  mapTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#EFF6FF'
  },
  mapTriggerBtnText: { color: '#2563EB', fontWeight: '800', fontSize: 15, marginLeft: 8 },

  addressSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4
  },
  addressSummaryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  addressSummaryDetails: { flex: 1, marginLeft: 12, paddingRight: 10 },
  addressSummaryLabel: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase' },
  addressSummaryDesc: { fontSize: 13, color: '#1F2937', fontWeight: '700', marginTop: 2 },
  addressChangeBtn: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  addressChangeBtnText: { color: '#2563EB', fontSize: 12, fontWeight: '800' },

  // Submit button
  submitBtn: { 
    backgroundColor: '#2563EB', 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18, 
    borderRadius: 20, 
    marginTop: 15,
    elevation: 4,
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  submitBtnDisabled: { backgroundColor: '#9CA3AF' },
  submitBtnText: { color: 'white', fontWeight: '800', fontSize: 16 }
});