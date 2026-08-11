import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Image, ActivityIndicator, Alert, RefreshControl 
} from 'react-native';
import { 
  User as UserIcon, ShieldCheck, Truck, Phone, Camera,
  LogOut, FileText, Clock, AlertCircle, ChevronRight 
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { uploadImageToCloudinary } from '../../services/cloudinaryService';

export const DriverProfileScreen = ({ navigation }: any) => {
  const { signOut } = useAuth();
  
  // State
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/driver/profile');
      if (res.data.success) {
        setProfile(res.data.profile);
      }
    } catch (err: any) {
      /**
       * ARCHITECTURAL FIX: 
       * If backend returns 404, it means the DriverProfile document 
       * hasn't been created yet (onboarding not finished).
       */
      if (err.response?.status === 404) {
        setProfile(null); 
      } else {
        console.error("SYNC_ERROR", err.message);
        Alert.alert("Sync Error", "Unable to reach CourierX server.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const handleUpdateAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
    });

    if (!result.canceled) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    setIsUpdatingAvatar(true);
    try {
      const secureUrl = await uploadImageToCloudinary(uri, 'avatar');
      const response = await api.patch('/driver/profile/avatar', {
        imageUrl: secureUrl
      });
      if (response.data.success) {
        setProfile((prev: any) => ({ ...prev, avatarUrl: secureUrl }));
        Alert.alert("Success", "Profile photo updated.");
      }
    } catch (err) {
      Alert.alert("Upload Error", "Could not save photo.");
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const renderStatusBadge = (isSubmitted: boolean) => (
    <View style={[styles.miniBadge, isSubmitted ? styles.bgSuccess : styles.bgWarning]}>
      <Text style={styles.miniBadgeText}>{isSubmitted ? 'SUBMITTED' : 'MISSING'}</Text>
    </View>
  );

  if (loading && !refreshing) return <View style={styles.centered}><ActivityIndicator color="#111827" /></View>;

  // --- Feature: Empty State for Un-onboarded Drivers ---
  if (!profile) {
    return (
      <View style={styles.centeredContainer}>
        <AlertCircle size={64} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>Incomplete Profile</Text>
        <Text style={styles.emptySub}>You must submit your driver verification documents before you can see your profile.</Text>
        
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Onboarding')}
        >
          <Text style={styles.actionBtnText}>Complete Onboarding</Text>
          <ChevronRight size={20} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutEmpty} onPress={signOut}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Main Render: Verified or Pending Driver Profile ---
  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} />}
      >
        <View style={styles.headerCard}>
          <TouchableOpacity 
            style={styles.avatarWrapper} 
            onPress={handleUpdateAvatar}
            disabled={isUpdatingAvatar}
          >
            <View style={styles.avatarBox}>
              {/* ✅ FIX: Ensure we use 'avatarUrl' strictly */}
              {profile?.imageUrl ? (
                <Image 
                  source={{ uri: profile.imageUrl }} 
                  style={styles.avatarImg}
                  // Force reload if URL is the same but image changed on Cloudinary
                  key={profile.imageUrl} 
                />
              ) : (
                <UserIcon size={40} color="white" />
              )}
            </View>
            <View style={styles.cameraBadge}><Camera size={14} color="white" /></View>
            {isUpdatingAvatar && <View style={styles.avatarLoader}><ActivityIndicator color="white" /></View>}
          </TouchableOpacity>

          <Text style={styles.name}>{profile?.fullName}</Text>
          <View style={[styles.verifBadge, profile?.isVerified ? styles.bgVerified : styles.bgPending]}>
            <Text style={styles.verifText}>{profile?.isVerified ? 'VERIFIED DRIVER' : 'PENDING APPROVAL'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duty Information</Text>
          <View style={styles.row}>
            <Truck size={18} color="#6B7280" />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Vehicle</Text>
              <Text style={styles.rowValue}>{profile?.vehicle?.vehicleType?.toUpperCase()} • {profile?.vehicle?.plateNumber}</Text>
            </View>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Phone size={18} color="#6B7280" />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Login ID</Text>
              <Text style={styles.rowValue}>{profile?.phoneNumber || 'Registered SIM'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Audit</Text>
          <View style={styles.checkRow}>
            <Text style={styles.checkLabel}>National ID Photo</Text>
            {renderStatusBadge(!!profile?.documents?.nationalIdUrl)}
          </View>
          <View style={styles.checkRow}>
            <Text style={styles.checkLabel}>Vehicle Equipment Photo</Text>
            {renderStatusBadge(!!profile?.vehicle?.vehicleImageUrl)}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <LogOut size={20} color="#EF4444" />
          <Text style={styles.logoutText}>End Duty & Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: 'white' },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', marginTop: 20, color: '#111827' },
  emptySub: { textAlign: 'center', color: '#6B7280', marginTop: 10, lineHeight: 22, marginBottom: 30 },
  actionBtn: { backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 18, borderRadius: 16 },
  actionBtnText: { color: 'white', fontWeight: 'bold', marginRight: 10 },
  logoutEmpty: { marginTop: 30 },
  headerCard: { alignItems: 'center', backgroundColor: 'white', borderRadius: 30, padding: 35, marginBottom: 20, elevation: 1 },
  avatarWrapper: { position: 'relative' },
  avatarBox: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 90, height: 90, borderRadius: 45 },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2563EB', padding: 8, borderRadius: 20, borderWidth: 3, borderColor: 'white' },
  avatarLoader: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '900', color: '#111827', marginTop: 15 },
  verifBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 12 },
  bgVerified: { backgroundColor: '#059669' },
  bgPending: { backgroundColor: '#F59E0B' },
  verifText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  section: { backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 15 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 20, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowContent: { flex: 1, marginLeft: 15 },
  rowLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: 'bold' },
  rowValue: { fontSize: 15, color: '#111827', fontWeight: 'bold', marginTop: 2 },
  checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  checkLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
  miniBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  miniBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  bgSuccess: { backgroundColor: '#10B981' },
  bgWarning: { backgroundColor: '#D1D5DB' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', marginLeft: 10 }
});