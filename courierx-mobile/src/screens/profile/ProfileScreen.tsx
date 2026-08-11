import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert, Modal, TextInput, Image, 
  KeyboardAvoidingView, Platform, 
  AppState, Switch
} from 'react-native';
import { 
  User as UserIcon, MapPin, Plus, LogOut, Trash2, X, 
  Camera, BellOff, Bell, Mail, ShieldCheck, Phone, Edit2, Check, Info
} from 'lucide-react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';

import { getNotificationPermissionStatus, openAppSettings } from '../../services/notificationService';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { uploadImageToCloudinary } from '../../services/cloudinaryService';

interface Landmark {
  _id: string;
  label: string;
  description: string;
  location: { type: 'Point'; coordinates: [number, number] };
}

const CACHE_KEY = '@courierx_profile_cache';


export const ProfileScreen = () => {
  const { user, token, updateUser, signIn, signOut } = useAuth();
  
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifStatus, setNotifStatus] = useState<string>('granted');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.displayName || '');

  // Phase 5.3 — Import notification preferences
  const [importNotifPrefs, setImportNotifPrefs] = useState({
    import_received:       true,
    import_in_transit:     true,
    import_customs_hold:   true,
    import_arrived:        true,
    import_ready:          true,
    import_weight_dispute: true,
    import_delivered:      true,
  });
  const [savingPref, setSavingPref] = useState(false);
  
  const [isModalVisible, setModalVisible] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    initProfile();
    // Seed prefs from user context if available
    if ((user as any)?.notificationPreferences) {
      const p = (user as any).notificationPreferences;
      setImportNotifPrefs(prev => ({ ...prev, ...p }));
    }
  }, []);

  useEffect(() => {
  const sub = AppState.addEventListener('change', async (state) => {
    if (state === 'active') {
      try {
        const res = await api.get('/auth/me');
        if (res.data.success) {
          await updateUser(res.data.user);
        }
      } catch {}
    }
  });

  return () => sub.remove();
}, []);

  const initProfile = async () => {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) setLandmarks(JSON.parse(cached));
    try {
      const landmarkRes = await api.get('/profile/landmarks');
      if (landmarkRes.data.success) {
        setLandmarks(landmarkRes.data.landmarks);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(landmarkRes.data.landmarks));
      }
      const status = await getNotificationPermissionStatus();
      setNotifStatus(status);
    } catch (err) { console.log("Offline mode"); }
    finally { setLoading(false); }
  };

  // -- Feature: Cloudinary Avatar Flow --
  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3, // Optimization for Somalia data speeds
    });

    if (!result.canceled) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    setIsUpdating(true);
    try {
      // ✅ FIX 1: Must pass 'avatar' as the second argument for Signed Cloudinary
      const secureUrl = await uploadImageToCloudinary(uri, 'avatar');
      
      // ✅ FIX 2: Use 'imageUrl' to match refined Backend and MongoDB
      await performGlobalSync({ imageUrl: secureUrl });
    } catch (err) {
      Alert.alert("Upload Failed", "Could not reach Cloudinary. Check connection.");
    } finally {
      setIsUpdating(false);
    }
  };

  const performGlobalSync = async (updates: { displayName?: string; imageUrl?: string }) => {
  if (!token) return;
  setIsUpdating(true);
  try {
    if (auth().currentUser) {
      await auth().currentUser?.updateProfile({
        displayName: updates.displayName,
        photoURL: updates.imageUrl
      });
    }
    const response = await api.patch('/profile', updates);
    if (response.data.success) {
      await updateUser(response.data.user);
      setIsEditingName(false);
      Alert.alert("Success", "Profile photo updated.");
    }
  } catch (err) {
    Alert.alert("Sync Error", "Storage worked but database failed to save.");
  } finally {
    setIsUpdating(false);
  }
};

  // Phase 5.3 — Toggle a single import notification preference
  const toggleImportPref = async (key: keyof typeof importNotifPrefs) => {
    const newValue = !importNotifPrefs[key];
    const optimistic = { ...importNotifPrefs, [key]: newValue };
    setImportNotifPrefs(optimistic);
    setSavingPref(true);
    try {
      await api.patch('/profile/notification-preferences', { [key]: newValue });
    } catch {
      // Roll back on failure
      setImportNotifPrefs(importNotifPrefs);
      Alert.alert('Error', 'Could not save preference. Check your connection.');
    } finally {
      setSavingPref(false);
    }
  };

  const openPicker = async () => {
    setModalVisible(true);
    try {
      let loc = await Location.getCurrentPositionAsync({});
      setSelectedLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch (err) {
      console.warn("Could not get current location for landmark picker, using fallback (Mogadishu)", err);
      setSelectedLocation({ lat: 2.0433, lng: 45.3369 });
    }
  };

  const handleAddLandmark = async () => {
    if (!newLabel || !newDesc || !selectedLocation) {
      Alert.alert("Error", "All fields and map pin are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        label: newLabel,
        description: newDesc,
        location: {
          type: 'Point',
          coordinates: [selectedLocation.lng, selectedLocation.lat]
        }
      };

      const res = await api.post('/profile/landmarks', payload);
      if (res.data.success) {
        const updated = [...landmarks, res.data.landmark];
        setLandmarks(updated);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated));
        setModalVisible(false);
        setNewLabel(''); setNewDesc('');
      }
    } catch (err) {
      Alert.alert("Error", "Could not save landmark.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLandmark = (id: string, label: string) => {
    Alert.alert(
      "Delete Landmark",
      `Are you sure you want to remove "${label}" from your saved locations?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              const response = await api.delete(`/profile/landmarks/${id}`);
              
              if (response.data.success) {
                // 1. Update local state immediately for a smooth UX
                setLandmarks(prev => prev.filter(l => l._id !== id));
                
                // 2. Update local cache (Step 5 logic)
                const updatedCache = landmarks.filter(l => l._id !== id);
                await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updatedCache));
              }
            } catch (err) {
              Alert.alert("Error", "Could not delete landmark. Check your connection.");
            }
          } 
        }
      ]
    );
  };

  if (loading && landmarks.length === 0) {
    return <View style={styles.centered}><ActivityIndicator color="#2563EB" /></View>;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* User Identity Section */}
        <View style={styles.headerCard}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage} disabled={isUpdating}>
            {/* ✅ FIX 3: Strictly check for 'imageUrl' */}
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}><UserIcon size={40} color="white" /></View>
            )}
            <View style={styles.cameraBadge}><Camera size={14} color="white" /></View>
            {isUpdating && <ActivityIndicator style={styles.loaderOverlay} color="white" />}
          </TouchableOpacity>

          {isEditingName ? (
            <View style={styles.editNameRow}>
              <TextInput 
                style={styles.nameInput}
                value={editedName}
                onChangeText={(val) => setEditedName(val.slice(0, 30))}
                autoFocus
              />
              <TouchableOpacity onPress={() => performGlobalSync({ displayName: editedName.trim() })}>
                <Check size={24} color="#059669" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.nameRow} onPress={() => setIsEditingName(true)}>
              <Text style={styles.userName}>{user?.displayName || 'Set Name'}</Text>
              <Edit2 size={16} color="#9CA3AF" style={{marginLeft: 8}} />
            </TouchableOpacity>
          )}
          <Text style={styles.userRole}>Verified CourierX Customer</Text>
        </View>

        {/* Account Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <View style={styles.detailRow}>
            <Phone size={18} color="#6B7280" />
            <View style={styles.detailTextGroup}>
              <Text style={styles.detailLabel}>Phone Number</Text>
              <Text style={styles.detailValue}>{user?.phoneNumber}</Text>
            </View>
            <ShieldCheck size={16} color="#059669" />
          </View>
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Mail size={18} color="#6B7280" />
            <View style={styles.detailTextGroup}>
              <Text style={styles.detailLabel}>Email Address</Text>
              <Text style={styles.detailValue}>{user?.email || 'Not linked'}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Info size={18} color="#6B7280" />
            <View style={styles.detailTextGroup}>
              <Text style={styles.detailLabel}>Token Balance</Text>
              <Text style={styles.detailValue}>{user?.tokenBalance ?? 0} CXC</Text>
            </View>
          </View>
        </View>

        {/* Landmarks Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved Landmarks</Text>
            <TouchableOpacity style={styles.addBtn} onPress={openPicker}>
              <Plus size={16} color="#2563EB" />
              <Text style={styles.addBtnText}>Add New</Text>
            </TouchableOpacity>
          </View>
          
          {landmarks.length === 0 ? (
            <Text style={styles.emptyText}>No saved locations yet.</Text>
          ) : (
            landmarks.map((l) => (
              <View key={l._id} style={styles.landmarkCard}>
                <MapPin size={18} color="#2563EB" />
                <View style={styles.landmarkInfo}>
                  <Text style={styles.landmarkLabel}>{l.label}</Text>
                  <Text style={styles.landmarkDesc} numberOfLines={1}>{l.description}</Text>
                </View>
                
                {/* ✅ FIXED: Button now triggers the delete handler with ID and Label */}
                <TouchableOpacity 
                  style={styles.deleteBtn} 
                  onPress={() => handleDeleteLandmark(l._id, l.label)}
                >
                  <Trash2 size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Notification Health Check */}
        {notifStatus !== 'granted' && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <BellOff size={20} color="#92400E" />
              <Text style={styles.alertTitle}>Notifications Disabled</Text>
            </View>
            <Text style={styles.alertText}>Enable notifications to get live updates on your Bajaj courier.</Text>
            <TouchableOpacity style={styles.alertBtn} onPress={openAppSettings}>
              <Text style={styles.alertBtnText}>Enable in Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Phase 5.3 — Import Notification Preferences */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Import Notifications</Text>
            {savingPref && <ActivityIndicator size="small" color="#2563EB" />}
          </View>
          {[
            { key: 'import_received',       label: 'Package Received at Hub' },
            { key: 'import_in_transit',     label: 'Shipment In Transit' },
            { key: 'import_customs_hold',   label: 'Customs Hold Alerts' },
            { key: 'import_arrived',        label: 'Arrived in Somalia' },
            { key: 'import_ready',          label: 'Ready for Delivery' },
            { key: 'import_weight_dispute', label: 'Weight Updates' },
            { key: 'import_delivered',      label: 'Delivery Confirmed' },
          ].map(({ key, label }, index, arr) => (
            <View
              key={key}
              style={[
                styles.prefRow,
                index === arr.length - 1 && { borderBottomWidth: 0 }
              ]}
            >
              <Bell size={16} color="#6B7280" style={{ marginRight: 12 }} />
              <Text style={styles.prefLabel}>{label}</Text>
              <Switch
                value={importNotifPrefs[key as keyof typeof importNotifPrefs]}
                onValueChange={() => toggleImportPref(key as keyof typeof importNotifPrefs)}
                trackColor={{ false: '#E5E7EB', true: '#BFDBFE' }}
                thumbColor={importNotifPrefs[key as keyof typeof importNotifPrefs] ? '#2563EB' : '#9CA3AF'}
                ios_backgroundColor="#E5E7EB"
              />
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <LogOut size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Map Picker Modal */}
      <Modal visible={isModalVisible} animationType="slide">
        <View style={styles.fullModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Landmark</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}><X size={28} color="black" /></TouchableOpacity>
          </View>
          <ScrollView style={{flex: 1}}>
            <View style={styles.mapContainer}>
              {selectedLocation && (
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={{flex: 1}}
                  initialRegion={{
                    latitude: selectedLocation.lat, longitude: selectedLocation.lng,
                    latitudeDelta: 0.005, longitudeDelta: 0.005,
                  }}
                  onPress={(e) => setSelectedLocation({
                    lat: e.nativeEvent.coordinate.latitude,
                    lng: e.nativeEvent.coordinate.longitude
                  })}
                >
                  <Marker coordinate={{ latitude: selectedLocation.lat, longitude: selectedLocation.lng }} />
                </MapView>
              )}
            </View>
            <View style={{padding: 20}}>
              <Text style={styles.inputLabel}>Name (e.g. Home)</Text>
              <TextInput style={styles.input} value={newLabel} onChangeText={setNewLabel} placeholder="Enter name" />
              <Text style={styles.inputLabel}>Description (for driver)</Text>
              <TextInput style={[styles.input, {height: 80}]} value={newDesc} onChangeText={setNewDesc} multiline placeholder="Near the blue shop..." />
              <TouchableOpacity style={styles.submitBtn} onPress={handleAddLandmark} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Save Landmark</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard: { alignItems: 'center', backgroundColor: 'white', borderRadius: 24, padding: 30, marginBottom: 20, elevation: 1 },
  avatarContainer: { position: 'relative' },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1F2937', padding: 8, borderRadius: 20, borderWidth: 3, borderColor: 'white' },
  loaderOverlay: { position: 'absolute', top: '35%', alignSelf: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  editNameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, borderBottomWidth: 1, borderBottomColor: '#2563EB' },
  userName: { fontSize: 22, fontWeight: '800', color: '#111827' },
  nameInput: { fontSize: 20, fontWeight: '800', color: '#111827', minWidth: 150, textAlign: 'center' },
  userRole: { fontSize: 12, color: '#6B7280', marginTop: 6, fontWeight: '700', textTransform: 'uppercase' },
  section: { backgroundColor: 'white', borderRadius: 20, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#374151', textTransform: 'uppercase', marginBottom: 15 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  detailTextGroup: { flex: 1, marginLeft: 15 },
  detailLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: 'bold' },
  detailValue: { fontSize: 15, color: '#1F2937', fontWeight: '600', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  addBtnText: { color: '#2563EB', fontWeight: 'bold', fontSize: 13, marginLeft: 4 },
  landmarkLabel: { fontWeight: 'bold', fontSize: 15 },
  landmarkDesc: { fontSize: 12, color: '#6B7280' },
  alertCard: { backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FDE68A' },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  alertTitle: { fontSize: 16, fontWeight: 'bold', color: '#92400E', marginLeft: 8 },
  alertText: { fontSize: 13, color: '#B45309', marginBottom: 12 },
  alertBtn: { backgroundColor: '#F59E0B', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  alertBtnText: { color: 'white', fontWeight: 'bold' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', marginLeft: 8 },
  fullModal: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 60, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  mapContainer: { height: 300, width: '100%' },
  inputLabel: { fontSize: 14, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 15, fontSize: 16 },
  submitBtn: { backgroundColor: '#2563EB', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  landmarkCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6' 
  },
  landmarkInfo: { 
    flex: 1, 
    marginLeft: 12,
    marginRight: 10 // Space before delete button
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
  },
  emptyText:{ color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  submitBtnText: { color: 'white', fontWeight: 'bold' },
  // Phase 5.3 — Notification preference toggle row
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  prefLabel: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '600' },
});