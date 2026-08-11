import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { uploadService } from '../api/upload.service';
import { toast } from 'sonner';


export const usePartnerProfileLogic = () => {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);


    const [uploading, setUploading] = useState(false);
    const [profile, setProfile] = useState({
        bio: '',
        logoUrl: '',
        chinaAddress: '',
        contactPhone: '',
        whatsappNumber: '',
        markingInstructions: '',
        operatingHours: '',
        collectionPoints: [] as any[]
    });


    // 1. Fetch current data
    const { isLoading } = useQuery({
        queryKey: ['partnerPublicProfile'],
        queryFn: async () => {
            const res = await api.get('/partner/profile/public');
            if (res.data.data) setProfile(prev => ({ ...prev, ...res.data.data }));
            return res.data.data;
        }
    });


    // 2. Mutation: Save Profile
    const saveMutation = useMutation({
        mutationFn: (data: any) => api.patch('/partner/profile/public', data),
        onSuccess: () => toast.success('STOREFRONT_PUBLISHED'),
        onError: () => toast.error('SAVE_FAILED')
    });


    // 3. Image Upload
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const sig = await uploadService.getSignature('brand-logo');
            const result = await uploadService.uploadToCloudinary(file, sig);
            setProfile(prev => ({ ...prev, logoUrl: result.secure_url }));
            toast.success('LOGO_READY');
        } catch (err) {
            toast.error('UPLOAD_FAILED');
        } finally {
            setUploading(false);
        }
    };


    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('COPIED_FOR_ALIBABA');
    };


    return {
        profile, setProfile,
        isLoading,
        uploading,
        fileInputRef,
        handleLogoUpload,
        handleSave: () => saveMutation.mutate(profile),
        isSaving: saveMutation.isPending,
        copyToClipboard
    };
};
