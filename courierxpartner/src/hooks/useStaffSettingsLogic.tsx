import { useState, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { uploadService } from '../api/upload.service';
import api from '../api/axios';
import { toast } from 'sonner';


export const useStaffSettingsLogic = () => {
    const { user, setAuth, token } = useAuthStore();
    const { scannerBeep, setScannerBeep, scannerVibrate, setScannerVibrate } = useSettingsStore();
    const fileInputRef = useRef<HTMLInputElement>(null);


    const [loading, setLoading] = useState(false);
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [passwords, setPasswords] = useState({ current: '', new: '' });


    // 1. Logic: Identity Image Update
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);
        try {
            const sig = await uploadService.getSignature('profile-pic');
            const result = await uploadService.uploadToCloudinary(file, sig);
            const res = await api.patch('/partner/profile/self', { imageUrl: result.secure_url });
            setAuth(res.data.user, token!);
            toast.success('IDENTITY_IMAGE_SYNCHRONIZED');
        } catch (err) { toast.error('UPLOAD_FAILED'); }
        finally { setLoading(false); }
    };


    // 2. Logic: Display Name Update
    const handleNameUpdate = async () => {
        try {
            const res = await api.patch('/partner/profile/self', { displayName });
            setAuth(res.data.user, token!);
            toast.success('CALLSIGN_UPDATED');
        } catch (err) { toast.error('UPDATE_FAILED'); }
    };


    // 3. Logic: Security Key Rotation
    const handleSecurityUpdate = async () => {
        try {
            await api.patch('/partner/profile/password', {
                currentPassword: passwords.current,
                newPassword: passwords.new
            });
            toast.success('SECURITY_KEY_ROTATED');
            setTimeout(() => window.location.href = '/login', 2000);
        } catch (err: any) {
            toast.error('AUTH_DENIED', { description: err.response?.data?.message });
        }
    };


    return {
        user,
        displayName, setDisplayName,
        passwords, setPasswords,
        loading,
        fileInputRef,
        handleImageUpload,
        handleNameUpdate,
        handleSecurityUpdate,
        // Hardware Toggles
        scannerBeep, setScannerBeep,
        scannerVibrate, setScannerVibrate
    };
};
