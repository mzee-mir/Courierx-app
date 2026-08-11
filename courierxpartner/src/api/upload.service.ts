import api from './axios';


export const uploadService = {
  /**
   * getSignature: Request a secure token from our backend
   */
  getSignature: async (shipmentId: string) => {
    const { data } = await api.get('/uploads/cloudinary-signature', {
      params: { type: 'shipment', shipmentId, }
    });
    return data; // Returns { signature, timestamp, apiKey, cloudName, folder }
  },


  /**
   * uploadToCloudinary: Direct-to-cloud secure transfer
   */
  uploadToCloudinary: async (file: File, signatureData: any) => {
    const formData = new FormData();


    // 1. Standard Fields
    formData.append('file', file);
    formData.append('api_key', signatureData.apiKey);
    formData.append('timestamp', signatureData.timestamp.toString());
    formData.append('signature', signatureData.signature);


    // 2. SIGNED PARAMETERS (These MUST match the backend signature exactly)
    formData.append('folder', signatureData.folder);
    formData.append('public_id', signatureData.publicId);


    // If your backend signed 'overwrite' and 'invalidate', you must send them too
    formData.append('overwrite', 'true');
    formData.append('invalidate', 'true');


    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    );


    const result = await res.json();


    if (result.error) {
      throw new Error(result.error.message);
    }


    return result;
  }
};