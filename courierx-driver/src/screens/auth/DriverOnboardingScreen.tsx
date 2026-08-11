import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Camera, CheckCircle2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '../../services/cloudinaryService';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

type VehicleType = 'bajaj' | 'car' | 'van';
type UploadType = 'avatar' | 'national_id' | 'license' | 'vehicle' | 'plate';

export const DriverOnboardingScreen = ({ navigation }: any) => {
  const { signOut } = useAuth();

  /* ---------------- Permissions ---------------- */
  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

  /* ---------------- Text State ---------------- */
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    plateNumber: '',
    vehicleType: 'bajaj' as VehicleType,
  });

  /* ---------------- Image State ---------------- */
  const [images, setImages] = useState<Record<UploadType, { url?: string; loading: boolean }>>({
    avatar: { loading: false },
    national_id: { loading: false },
    license: { loading: false },
    vehicle: { loading: false },
    plate: { loading: false },
  });

  /* ---------------- Upload Handler ---------------- */
  const handlePickAndUpload = async (type: UploadType) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.4,
    });

    if (result.canceled) return;

    setImages(prev => ({ ...prev, [type]: { ...prev[type], loading: true } }));

    try {
      // Direct direct direct upload to Cloudinary (Step 15.11 architecture)
      const url = await uploadImageToCloudinary(result.assets[0].uri, type);

      if (!url) throw new Error('UPLOAD_FAILED');

      setImages(prev => ({
        ...prev,
        [type]: { url, loading: false },
      }));
    } catch (error: any) {
      Alert.alert('Upload Failed', 'Check your connection and try again.');
      setImages(prev => ({
        ...prev,
        [type]: { ...prev[type], loading: false },
      }));
    }
  };

  /* ---------------- Validation Gate ---------------- */
  const isFormValid =
    formData.fullName.trim().length > 2 &&
    formData.plateNumber.trim().length > 3 &&
    images.avatar.url &&
    images.national_id.url &&
    images.license.url &&
    images.vehicle.url &&
    images.plate.url;

  /* ---------------- Submit Logic (FIXED SYNTAX) ---------------- */
  const handleSubmit = async () => {
    try {
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim() || undefined,
        // ✅ KEY FIX: Must be imageUrl to match Backend Step 15.11
        imageUrl: images.avatar.url, 
        vehicle: {
          vehicleType: formData.vehicleType,
          plateNumber: formData.plateNumber.trim().toUpperCase(),
          vehicleImageUrl: images.vehicle.url,
          plateImageUrl: images.plate.url,
        },
        documents: {
          nationalIdUrl: images.national_id.url,
          licenseUrl: images.license.url,
        },
      };

      const res = await api.post('/driver/profile', payload);

      if (res.data?.success) {
        navigation.replace('WaitingForApproval');
      }
    } catch (err: any) {
      const serverError = err.response?.data?.error || "Check your network connection";
      Alert.alert('Submission Error', `Reason: ${serverError}`);
    }
  };

  /* ---------------- UI Helper ---------------- */
  const renderUploadCard = (type: UploadType, label: string) => {
    const data = images[type];
    return (
      <TouchableOpacity
        style={[styles.uploadCard, data.url && styles.cardDone]}
        onPress={() => handlePickAndUpload(type)}
        disabled={data.loading}
      >
        <View style={styles.cardLeft}>
          {data.loading ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : data.url ? (
            <CheckCircle2 size={24} color="#059669" />
          ) : (
            <Camera size={24} color="#6B7280" />
          )}
          <Text style={styles.cardLabel}>{label}</Text>
        </View>

        {data.url && (
          <Image source={{ uri: data.url }} style={styles.thumbnail} />
        )}
      </TouchableOpacity>
    );
  };

  /* ---------------- Main Render ---------------- */
  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Driver Verification</Text>
          <Text style={styles.subtitle}>Complete your professional profile to start earning</Text>

          {/* Personal Info */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>1. Personal Info</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={formData.fullName}
              onChangeText={t => setFormData({ ...formData, fullName: t })}
            />
            <TextInput
              style={styles.input}
              placeholder="Email (Optional)"
              value={formData.email}
              onChangeText={t => setFormData({ ...formData, email: t })}
            />
            {renderUploadCard('avatar', 'Profile Photo (Selfie)')}
          </View>

          {/* Identity */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>2. Legal Identity</Text>
            {renderUploadCard('national_id', 'National ID Card')}
            {renderUploadCard('license', 'Driving License')}
          </View>

          {/* Vehicle */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>3. Vehicle Information</Text>
            <View style={styles.typeRow}>
              {(['bajaj', 'car', 'van'] as VehicleType[]).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeBtn, formData.vehicleType === type && styles.typeBtnActive]}
                  onPress={() => setFormData({ ...formData, vehicleType: type })}
                >
                  <Text style={[styles.typeText, formData.vehicleType === type && styles.typeTextActive]}>
                    {type.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Plate Number (e.g. MOG-1234)"
              value={formData.plateNumber}
              onChangeText={t => setFormData({ ...formData, plateNumber: t })}
            />
            {renderUploadCard('vehicle', 'Vehicle Photo')}
            {renderUploadCard('plate', 'Plate Number Photo')}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !isFormValid && styles.btnDisabled]}
            disabled={!isFormValid}
            onPress={handleSubmit}
          >
            <Text style={styles.submitBtnText}>Submit Application</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={signOut} style={styles.logout}>
            <Text style={styles.logoutText}>Cancel & Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: '900', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 8, marginBottom: 30 },
  section: { marginBottom: 30 },
  sectionHeader: { fontSize: 12, fontWeight: 'bold', color: '#9CA3AF', marginBottom: 15, letterSpacing: 1, textTransform: 'uppercase' },
  input: { backgroundColor: 'white', padding: 18, borderRadius: 16, borderColor: '#E5E7EB', borderWidth: 1, marginBottom: 15, fontSize: 16, color: '#111827' },
  uploadCard: { backgroundColor: 'white', padding: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10 },
  cardDone: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  cardLeft: { flexDirection: 'row', alignItems: 'center' },
  cardLabel: { marginLeft: 15, fontWeight: '600', color: '#374151' },
  thumbnail: { width: 40, height: 40, borderRadius: 8 },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  typeBtn: { flex: 1, padding: 12, marginHorizontal: 4, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: 'white' },
  typeBtnActive: { backgroundColor: '#111827', borderColor: '#111827' },
  typeText: { fontWeight: 'bold', color: '#6B7280', fontSize: 11 },
  typeTextActive: { color: 'white' },
  submitBtn: { backgroundColor: '#111827', padding: 22, borderRadius: 18, alignItems: 'center', marginTop: 20, elevation: 4 },
  btnDisabled: { backgroundColor: '#9CA3AF', elevation: 0 },
  submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  logout: { marginTop: 25, alignItems: 'center', padding: 10 },
  logoutText: { color: '#EF4444', fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center' }
});