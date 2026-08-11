import { Request, Response } from 'express';
import cloudinary from '../config/cloudinary';

export class UploadController {
  /**
   * Generates a signed upload signature for the mobile app.
   * This ensures only our authenticated users can upload to Cloudinary.
   */
  public static getCloudinarySignature(req: Request, res: Response) {
    try {
      const { type, shipmentId } = req.query; 
      const userId = req.user?.userId;

      // 1. UPDATE THIS ARRAY: Add 'shipment' to the whitelist
      const allowedTypes = [
        'avatar', 
        'national_id', 
        'license', 
        'vehicle', 
        'plate', 
        'shipment' 
      ];

      if (!allowedTypes.includes(type as string)) {
        return res.status(400).json({ error: 'INVALID_DOCUMENT_TYPE' });
      }

      const timestamp = Math.round(new Date().getTime() / 1000);
      
      // 2. DEFINE FOLDER LOGIC: Where should shipment photos go?
      let subFolder = 'profile';
      if (['national_id', 'license'].includes(type as string)) subFolder = 'id';
      if (['vehicle', 'plate'].includes(type as string)) subFolder = 'vehicle';
      
      // If it's a shipment, store it in a dedicated folder with the shipmentId
      if (type === 'shipment') subFolder = `shipments/${shipmentId || 'uncategorized'}`;

      const folderPath = `courierx/partners/${userId}/${subFolder}`;
      const publicId = `${type}_${timestamp}`; // Use timestamp to allow multiple photos

      const params = {
        timestamp,
        folder: folderPath,
        public_id: publicId,
        overwrite: true,
        invalidate: true,
      };

      const signature = cloudinary.utils.api_sign_request(
        params,
        process.env.CLOUDINARY_API_SECRET as string
      );

      return res.status(200).json({
        success: true,
        signature,
        timestamp,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        folder: folderPath,
        publicId: publicId
      });
    } catch (error) {
      return res.status(500).json({ error: 'SIGNATURE_FAILED' });
    }
  }
}