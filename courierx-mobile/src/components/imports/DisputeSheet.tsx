import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  TextInput, ScrollView, ActivityIndicator, Alert, Image
} from 'react-native';
import { X, AlertTriangle, Send, PackageX, HelpCircle, ShieldAlert, Camera, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../api/client';
import { uploadImageToCloudinary } from '../../services/cloudinaryService';

interface DisputeSheetProps {
  isVisible: boolean;
  importId: string;
  externalTrackingNumber: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const PROBLEM_TYPES = [
  { id: 'DAMAGED', label: 'Item Damaged / Broken', icon: PackageX },
  { id: 'WRONG_ITEM', label: 'Wrong Item / Missing Contents', icon: ShieldAlert },
  { id: 'LATE', label: 'Excessive Shipping Delay', icon: AlertTriangle },
  { id: 'OTHER', label: 'Other Issue', icon: HelpCircle },
];

export const DisputeSheet: React.FC<DisputeSheetProps> = ({
  isVisible,
  importId,
  externalTrackingNumber,
  onClose,
  onSuccess
}) => {
  const [problemType, setProblemType] = useState(PROBLEM_TYPES[0].id);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]); // local URIs

  const MAX_PHOTOS = 3;

  const handleAddPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.6,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotos(prev => [...prev, result.assets[0].uri]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert("Description Required", "Please explain the problem you experienced with this shipment.");
      return;
    }

    setSubmitting(true);
    try {
      // Upload any attached photos to Cloudinary first
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        photoUrls = await Promise.all(
          photos.map(uri => uploadImageToCloudinary(uri, 'dispute'))
        );
      }
      const payload = {
        problemType,
        description: description.trim(),
        photoUrls,
      };

      const res = await api.post(`/cargo/${importId}/dispute`, payload);

      if (res.data.success) {
        Alert.alert(
          "Report Submitted",
          "Your dispute report has been registered. Our operations team will review it within 24 hours."
        );
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      Alert.alert("Submission Failed", err.response?.data?.error || "Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Report a Problem</Text>
              <Text style={styles.headerSub}>Tracking #: {externalTrackingNumber}</Text>
            </View>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeBtn}
              accessibilityLabel="Close problem report form"
              accessibilityRole="button"
            >
              <X size={20} color="#1F2937" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Problem Type Selector */}
            <Text style={styles.sectionLabel}>Select Problem Category</Text>
            <View style={styles.typesContainer}>
              {PROBLEM_TYPES.map((type) => {
                const selected = problemType === type.id;
                const Icon = type.icon;
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.typeOption, selected && styles.typeOptionSelected]}
                    onPress={() => setProblemType(type.id)}
                    activeOpacity={0.8}
                  >
                    <Icon size={18} color={selected ? '#2563EB' : '#6B7280'} />
                    <Text style={[styles.typeText, selected && styles.typeTextSelected]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Photo Attachment */}
            <Text style={styles.sectionLabel}>Photo Evidence (optional, up to 3)</Text>
            <View style={styles.photoRow}>
              {photos.map((uri, index) => (
                <View key={index} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.thumbImage} />
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => handleRemovePhoto(index)}
                    accessibilityLabel="Remove photo"
                  >
                    <Trash2 size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <TouchableOpacity
                  style={styles.addPhotoBtn}
                  onPress={handleAddPhoto}
                  activeOpacity={0.8}
                >
                  <Camera size={20} color="#6B7280" />
                  <Text style={styles.addPhotoText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Description Textarea */}
            <Text style={styles.sectionLabel}>Problem Details</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe what went wrong with your package in detail..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Send size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Submit Dispute Report</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end'
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2, fontWeight: '600' },
  closeBtn: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 14
  },
  scrollContent: { padding: 24, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12
  },
  typesContainer: { marginBottom: 20 },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10
  },
  typeOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6'
  },
  typeText: { marginLeft: 10, fontSize: 14, fontWeight: '700', color: '#4B5563' },
  typeTextSelected: { color: '#2563EB' },

  textArea: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 100,
    marginBottom: 24
  },

  submitBtn: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 3
  },
  submitBtnDisabled: { backgroundColor: '#9CA3AF' },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  // Photo upload styles
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  photoThumb: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  thumbImage: { width: '100%', height: '100%' },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 4,
  },
  addPhotoBtn: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: { fontSize: 11, color: '#6B7280', fontWeight: '700' },
});
