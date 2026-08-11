import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  TextInput, ActivityIndicator, Alert, Dimensions 
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { X, Check, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

interface Props {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (landmark: any) => void;
  title: string;
}

export const CustomLocationModal: React.FC<Props> = ({ isVisible, onClose, onSelect, title }) => {
  const [region, setRegion] = useState<any>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isVisible) {
      (async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          setRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        } catch (err) {
          console.warn("Could not get current location, using fallback (Mogadishu)", err);
          setRegion({
            latitude: 2.0433,
            longitude: 45.3369,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isVisible]);

  const handleConfirm = () => {
    if (!description || description.length < 5) {
      Alert.alert("Missing Details", "Please describe the gate or shop so the driver can find you.");
      return;
    }
    onSelect({
      _id: 'custom-' + Date.now(),
      label: 'Custom Location',
      description: description,
      location: {
        type: 'Point',
        coordinates: [region.longitude, region.latitude]
      }
    });
    setDescription('');
    onClose();
  };

  return (
    <Modal visible={isVisible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}><X size={28} color="black" /></TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={handleConfirm}><Check size={28} color="#2563EB" /></TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color="#2563EB" /></View>
        ) : (
          <View style={styles.mapWrapper}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={region}
              onRegionChangeComplete={setRegion}
            >
              <Marker coordinate={region} />
            </MapView>
            <View style={styles.markerFixed} pointerEvents="none">
               <MapPin size={40} color="#EF4444" fill="rgba(239, 68, 68, 0.2)" />
            </View>
            <Text style={styles.hint}>Drag the map to move the pin</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.inputLabel}>Arrival Instructions (Mandatory)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Near the blue shop, white gate #4"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>Use This Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapWrapper: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  markerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -40, alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', top: 20, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, fontSize: 12 },
  footer: { padding: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  inputLabel: { fontWeight: 'bold', marginBottom: 10, color: '#374151' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 15, height: 80, textAlignVertical: 'top', marginBottom: 20 },
  confirmBtn: { backgroundColor: '#2563EB', padding: 18, borderRadius: 15, alignItems: 'center' },
  confirmBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});