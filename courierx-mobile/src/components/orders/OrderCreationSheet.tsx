import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { MapPin, Bike, Car, Truck, ChevronRight, Check, X, Map as MapIcon } from 'lucide-react-native';
import { CustomLocationModal } from './CustomLocationModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Landmark {
  _id: string;
  label: string;
  description: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
}


interface Props {
  savedLandmarks: Landmark[];
  onConfirm: (pickup: Landmark, dropoff: Landmark, vehicle: string) => void; // Change: IDs to full objects
  onCancel: () => void;
  initialPickup?: Landmark | null;
  initialDropoff?: Landmark | null;
}

export const OrderCreationSheet: React.FC<Props> = ({ 
  savedLandmarks, onConfirm, onCancel, initialPickup = null, initialDropoff = null 
}) => {
  // Navigation State
  const [step, setStep] = useState<1 | 2>(1);
  
  // Selection State
  const [pickup, setPickup] = useState<Landmark | null>(initialPickup);
  const [dropoff, setDropoff] = useState<Landmark | null>(initialDropoff);
  const [vehicle, setVehicle] = useState<'BAJAJ' | 'CAR' | 'TRUCK'>('BAJAJ');

  // Custom Picker State
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'pickup' | 'dropoff'>('pickup');

  // -- Helper Functions --

  const openPicker = (target: 'pickup' | 'dropoff') => {
    setPickerTarget(target);
    setPickerVisible(true);
  };

  const handleCustomSelect = (landmark: any) => {
    if (pickerTarget === 'pickup') {
      setPickup(landmark);
    } else {
      setDropoff(landmark);
    }
  };

  const renderLandmarkList = (type: 'pickup' | 'dropoff') => {
    if (savedLandmarks.length === 0) {
      return (
        <View style={styles.emptyLandmarksHelper}>
          <Text style={styles.emptyLandmarksHelperText}>
            No saved landmarks found. Tap "Choose on Map" to set coordinates.
          </Text>
        </View>
      );
    }
    return savedLandmarks.map((item) => {
      // Security/Logic Rule: Cannot pick the same spot for both
      const isAlreadySelectedElsewhere = (type === 'pickup' ? dropoff?._id : pickup?._id) === item._id;
      const isCurrentSelection = (type === 'pickup' ? pickup?._id : dropoff?._id) === item._id;

      return (
        <TouchableOpacity 
          key={`${type}-${item._id}`}
          style={[
            styles.landmarkItem, 
            isCurrentSelection && styles.selectedItem,
            isAlreadySelectedElsewhere && styles.disabledItem
          ]}
          onPress={() => type === 'pickup' ? setPickup(item) : setDropoff(item)}
          disabled={isAlreadySelectedElsewhere}
        >
          <MapPin size={20} color={isAlreadySelectedElsewhere ? "#D1D5DB" : "#4B5563"} />
          <View style={styles.landmarkText}>
            <Text style={[styles.landmarkLabel, isAlreadySelectedElsewhere && styles.disabledText]}>
              {item.label}
            </Text>
            <Text style={styles.landmarkDesc} numberOfLines={1}>{item.description}</Text>
          </View>
          {isCurrentSelection && <Check size={20} color="#2563EB" />}
        </TouchableOpacity>
      );
    });
  };

  return (
    <View style={styles.sheetContainer}>
      {/* 1. Static Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.title}>{step === 1 ? "Delivery Details" : "Select Vehicle"}</Text>
          <Text style={styles.subtitle}>
            {step === 1 ? "Where are we picking up and dropping off?" : "Choose the best ride for your items"}
          </Text>
        </View>
        <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
          <X size={22} color="#4B5563" />
        </TouchableOpacity>
      </View>
      
      {/* 2. Scrollable Body */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {step === 1 ? (
          <View>
            {/* Pickup Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>1. Pickup Point</Text>
              <TouchableOpacity style={styles.mapAction} onPress={() => openPicker('pickup')}>
                <MapIcon size={14} color="#2563EB" />
                <Text style={styles.mapActionText}>Choose on Map</Text>
              </TouchableOpacity>
            </View>
            {pickup?.label === 'Custom Location' && (
               <View style={styles.customBadge}>
                 <Text style={styles.customBadgeText}>📍 Custom Pin Set: {pickup.description}</Text>
               </View>
            )}
            {renderLandmarkList('pickup')}

            <View style={{ height: 20 }} />

            {/* Dropoff Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>2. Drop-off Point</Text>
              <TouchableOpacity style={styles.mapAction} onPress={() => openPicker('dropoff')}>
                <MapIcon size={14} color="#2563EB" />
                <Text style={styles.mapActionText}>Choose on Map</Text>
              </TouchableOpacity>
            </View>
            {dropoff?.label === 'Custom Location' && (
               <View style={styles.customBadge}>
                 <Text style={styles.customBadgeText}>📍 Custom Pin Set: {dropoff.description}</Text>
               </View>
            )}
            {renderLandmarkList('dropoff')}

            <TouchableOpacity 
              style={[styles.nextButton, (!pickup || !dropoff) && styles.buttonDisabled]}
              disabled={!pickup || !dropoff}
              onPress={() => setStep(2)}
            >
              <Text style={styles.buttonText}>Select Vehicle</Text>
              <ChevronRight size={20} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {/* Vehicle Selection Grid */}
            <View style={styles.vehicleGrid}>
              {[
                { id: 'BAJAJ', icon: Bike, label: 'Bajaj', price: '$1.50' },
                { id: 'CAR', icon: Car, label: 'Car', price: '$3.00' },
                { id: 'TRUCK', icon: Truck, label: 'Truck', price: '$7.50' },
              ].map((item) => (
                <TouchableOpacity 
                  key={item.id}
                  style={[styles.vehicleCard, vehicle === item.id && styles.selectedVehicle]}
                  onPress={() => setVehicle(item.id as any)}
                >
                  <item.icon size={32} color={vehicle === item.id ? '#2563EB' : '#6B7280'} />
                  <Text style={styles.vehicleLabel}>{item.label}</Text>
                  <Text style={styles.vehiclePrice}>{item.price}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={() => onConfirm(pickup!, dropoff!, vehicle)} // Change: Pass the full objects
            >
              <Text style={styles.buttonText}>Confirm & Find Courier</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.backLink} onPress={() => setStep(1)}>
              <Text style={styles.backLinkText}>Change Locations</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 3. Global Custom Location Picker Modal */}
      <CustomLocationModal 
        isVisible={pickerVisible}
        title={pickerTarget === 'pickup' ? "Set Pickup Pin" : "Set Drop-off Pin"}
        onClose={() => setPickerVisible(false)}
        onSelect={handleCustomSelect}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    backgroundColor: 'white',
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitleGroup: { flex: 1 },
  closeButton: {
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 20,
    marginLeft: 15,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  body: { padding: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 },
  mapAction: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#EFF6FF', 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 8 
  },
  mapActionText: { color: '#2563EB', fontWeight: 'bold', fontSize: 12, marginLeft: 5 },
  customBadge: { backgroundColor: '#F0FDF4', padding: 10, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#DCFCE7' },
  customBadgeText: { color: '#166534', fontSize: 12, fontWeight: '600' },
  landmarkItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, backgroundColor: '#F9FAFB', marginBottom: 8, borderWidth: 1.5, borderColor: 'transparent' },
  selectedItem: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  disabledItem: { opacity: 0.3, backgroundColor: '#F3F4F6' },
  disabledText: { color: '#9CA3AF' },
  landmarkText: { flex: 1, marginLeft: 12 },
  landmarkLabel: { fontWeight: 'bold', fontSize: 15, color: '#1F2937' },
  landmarkDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  nextButton: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 18, marginTop: 20 },
  buttonDisabled: { backgroundColor: '#D1D5DB' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginRight: 8 },
  vehicleGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  vehicleCard: { width: '31%', paddingVertical: 24, borderRadius: 20, backgroundColor: '#F9FAFB', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  selectedVehicle: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  vehicleLabel: { marginTop: 10, fontWeight: '800', color: '#374151', fontSize: 14 },
  vehiclePrice: { fontSize: 12, color: '#2563EB', fontWeight: '900', marginTop: 4 },
  confirmButton: { backgroundColor: '#2563EB', padding: 20, borderRadius: 18, alignItems: 'center' },
  backLink: { marginTop: 20, alignItems: 'center' },
  backLinkText: { color: '#6B7280', fontWeight: 'bold', fontSize: 15 },
  emptyLandmarksHelper: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  emptyLandmarksHelperText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  }
});