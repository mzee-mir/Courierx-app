import React, { useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { Camera, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { uploadService } from '../../api/upload.service';
import { toast } from 'sonner';


interface Props {
  shipmentId: string;
  onUploadComplete: (urls: string[]) => void;
  maxPhotos?: number;
}


export const PhotoUploader = ({ shipmentId, onUploadComplete, maxPhotos = 3 }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);


  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;


    if (previewUrls.length >= maxPhotos) {
      toast.error('LIMIT_REACHED', { description: `Maximum ${maxPhotos} photos allowed.` });
      return;
    }


    setUploading(true);
    try {
      // 1. Get Secure Handshake
      const sig = await uploadService.getSignature(shipmentId);


      // 2. Execute Direct Upload
      const result = await uploadService.uploadToCloudinary(file, sig);

      const newUrls = [...previewUrls, result.secure_url];
      setPreviewUrls(newUrls);
      onUploadComplete(newUrls);

      toast.success('EVIDENCE_CAPTURED');
    } catch (err) {
      toast.error('UPLOAD_FAILED', { description: 'Check network or contact support.' });
    } finally {
      setUploading(false);
    }
  };


  return (
    <Box sx={{ spaceY: 3 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900, tracking: '0.1em', ml: 1 }}>
        EVIDENCE_COLLECTION ({previewUrls.length}/{maxPhotos})
      </Typography>


      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mt: 1 }}>
        {previewUrls.map((url, i) => (
          <Box key={i} sx={{ position: 'relative', aspectSquare: 1, borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="evidence" />
            <Box sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '50%', p: 0.5 }}>
              <CheckCircle2 size={12} className="text-green-500" />
            </Box>
          </Box>
        ))}


        {previewUrls.length < maxPhotos && (
          <Button
            component="label"
            disabled={uploading}
            sx={{
              aspectSquare: 1,
              borderRadius: '16px',
              border: '2px dashed rgba(255,255,255,0.1)',
              bgcolor: 'rgba(255,255,255,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              color: uploading ? 'primary.main' : 'text.secondary',
              '&:hover': { border: '2px dashed #0052FF', bgcolor: 'rgba(0,82,255,0.05)' }
            }}
          >
            {uploading ? <CircularProgress size={24} /> : <Camera size={24} />}
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 900 }}>{uploading ? 'UPLOADING' : 'CAPTURE'}</Typography>
            <input
              type="file"
              accept="image/*"
              capture="environment" // 👈 Opens camera directly on Mobile
              hidden
              onChange={handleCapture}
            />
          </Button>
        )}
      </Box>
    </Box>
  );
};