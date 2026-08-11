// src/services/cloudinaryService.ts
import { api } from '../api/client';

export const uploadImageToCloudinary = async (uri: string, docType: string): Promise<string> => {
  try {
    // 1. Request signature from backend
    // This calls GET /api/v1/uploads/cloudinary-signature?type=...
    const sigRes = await api.get(`/uploads/cloudinary-signature?type=${docType}`);
    const { signature, timestamp, apiKey, cloudName, folder, publicId } = sigRes.data;

    // 2. Prepare Form Data
    const formData = new FormData();
    
    // The File Object
    // @ts-ignore
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: `${docType}.jpg`,
    });

    // CRITICAL: These must match the Backend 'params' object exactly
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', folder);
    formData.append('public_id', publicId);
    
    // MANDATORY: Add these because they were part of the backend signature
    formData.append('overwrite', 'true');
    formData.append('invalidate', 'true');

    // 3. Direct Upload to Cloudinary
    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const result = await uploadRes.json();
    
    if (result.secure_url) {
      return result.secure_url;
    } else {
      console.error("CLOUDINARY_INTERNAL_ERROR:", result.error?.message);
      throw new Error(result.error?.message || 'UPLOAD_FAILED');
    }
  } catch (error: any) {
    console.error('IMAGE_UPLOAD_SERVICE_ERROR:', error);
    throw error;
  }
};