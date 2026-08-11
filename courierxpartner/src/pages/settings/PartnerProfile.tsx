import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, Paper, TextField, Button, Grid,
    Divider, Avatar, IconButton, CircularProgress, Chip,
    InputAdornment, Tooltip
} from '@mui/material';
import {
    Building2, MapPin, Phone, Save, Camera,
    Copy, Check, Info, ShieldAlert, Clock,
    MessageCircle, Globe
} from 'lucide-react';
import api from '../../api/axios';
import { uploadService } from '../../api/upload.service'; // 👈 Use your existing service
import { toast } from 'sonner';


export const PartnerProfileDesktop = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [copied, setCopied] = useState(false);


    const [profile, setProfile] = useState({
        bio: '',
        logoUrl: '',
        chinaAddress: '',
        contactPhone: '',
        whatsappNumber: '',
        markingInstructions: '',
        operatingHours: '',
        prohibitedItems: [] as string[],
        collectionPoints: [] as any[]
    });


    useEffect(() => {
        api.get('/partner/profile/public').then(res => {
            if (res.data.data) setProfile(prev => ({ ...prev, ...res.data.data }));
        });
    }, []);


    // --- 📸 LOGO UPLOAD LOGIC ---
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;


        setUploading(true);
        try {
            // 1. Get secure signature (Using 'partner-logo' type)
            const sig = await uploadService.getSignature('brand-logo');


            // 2. Upload to Cloudinary
            const result = await uploadService.uploadToCloudinary(file, sig);


            // 3. Update local state
            setProfile(prev => ({ ...prev, logoUrl: result.secure_url }));
            toast.success('LOGO_UPLOADED');
        } catch (err) {
            toast.error('UPLOAD_FAILED');
        } finally {
            setUploading(false);
        }
    };


    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('COPIED_TO_CLIPBOARD');
    };


    const handleSave = async () => {
        try {
            await api.patch('/partner/profile/public', profile);
            toast.success('STOREFRONT_PUBLISHED');
        } catch (err) {
            toast.error('SAVE_FAILED');
        }
    };


    return (
        <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4, pb: 15 }}>


            {/* --- TACTICAL HEADER --- */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ position: 'relative' }}>
                    <Avatar
                        src={profile.logoUrl}
                        sx={{ width: 100, height: 100, borderRadius: '24px', bgcolor: 'primary.main', fontSize: '2.5rem', border: '2px solid rgba(255,255,255,0.1)' }}
                    >
                        {profile.bio.charAt(0) || <Building2 />}
                    </Avatar>
                    <IconButton
                        onClick={() => fileInputRef.current?.click()}
                        sx={{ position: 'absolute', bottom: -5, right: -5, bgcolor: '#0052FF', color: 'white', '&:hover': { bgcolor: '#003db3' }, width: 32, height: 32 }}
                    >
                        {uploading ? <CircularProgress size={16} color="inherit" /> : <Camera size={16} />}
                    </IconButton>
                    <input type="file" hidden ref={fileInputRef} onChange={handleLogoUpload} accept="image/*" />
                </Box>


                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 900, fontStyle: 'italic', color: 'white' }}>
                        BRAND_<span style={{ color: '#0052FF' }}>STOREFRONT</span>
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Globe size={12} /> MARKET_STATUS: ACTIVE // LAST_SYNC: {new Date().toLocaleDateString()}
                    </Typography>
                </Box>
            </Box>


            <Grid container spacing={3}>


                {/* LEFT COLUMN: IDENTITY */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 4, borderRadius: '32px', bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', mb: 2, display: 'block' }}>01_BRAND_STORY</Typography>
                        <TextField
                            fullWidth label="Company Bio" multiline rows={4}
                            placeholder="Tell customers about your service speed and reliability..."
                            value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })}
                            sx={tacticalInput}
                        />


                        <Box sx={{ mt: 4 }}>
                            <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', mb: 1.5, display: 'block' }}>OPERATING_HOURS</Typography>
                            <TextField
                                fullWidth placeholder="e.g. Sat - Thu: 8am - 5pm"
                                value={profile.operatingHours} onChange={e => setProfile({ ...profile, operatingHours: e.target.value })}
                                InputProps={{ startAdornment: <Clock size={18} style={{ marginRight: 12, opacity: 0.5 }} /> }}
                                sx={tacticalInput}
                            />
                        </Box>
                    </Paper>
                </Grid>


                {/* RIGHT COLUMN: LOGISTICS TERMINAL */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 4, borderRadius: '32px', bgcolor: '#000', border: '1px solid #0052FF33', position: 'relative' }}>
                        <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', mb: 2, display: 'block' }}>02_CHINA_LOGISTICS_DATA</Typography>


                        <Box sx={{ bgcolor: 'rgba(0,82,255,0.05)', p: 3, borderRadius: '20px', border: '1px solid rgba(0,82,255,0.1)', mb: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary' }}>ALIBABA_PASTE_ADDRESS</Typography>
                                <IconButton size="small" onClick={() => handleCopy(profile.chinaAddress)} sx={{ color: 'primary.main' }}>
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </IconButton>
                            </Box>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'white', wordBreak: 'break-all' }}>
                                {profile.chinaAddress || 'ADDRESS_NOT_SET'}
                            </Typography>
                        </Box>


                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <TextField
                                fullWidth label="Copy/Paste Chinese Address"
                                value={profile.chinaAddress} onChange={e => setProfile({ ...profile, chinaAddress: e.target.value })}
                                sx={tacticalInput}
                            />
                            <TextField
                                fullWidth label="Marking Instructions"
                                placeholder="e.g. Name / CX-CODE"
                                value={profile.markingInstructions} onChange={e => setProfile({ ...profile, markingInstructions: e.target.value })}
                                sx={tacticalInput}
                            />
                        </Box>
                    </Paper>
                </Grid>


                {/* --- NEW SECTION: SOMALIA COLLECTION POINTS --- */}
                <Grid size={{ xs: 12 }}>
                    <Paper sx={{ p: 4, borderRadius: '32px', bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                            <MapPin size={18} color="#10b981" />
                            <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main' }}>
                                04_SOMALIA_COLLECTION_POINTS (AUTO_FETCHED)
                            </Typography>
                        </Box>


                        <Grid container spacing={2}>
                            {profile.collectionPoints?.map((point, index) => (
                                <Grid size={{ xs: 12, md: 3 }} key={index}>
                                    <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <Typography sx={{ fontWeight: 900, fontSize: '0.75rem', color: 'white' }}>{point.city.toUpperCase()}</Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{point.name}</Typography>
                                        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', mt: 1, fontStyle: 'italic' }}>
                                            {point.address}
                                        </Typography>
                                    </Box>
                                </Grid>
                            ))}
                            {profile.collectionPoints?.length === 0 && (
                                <Typography variant="caption" sx={{ ml: 2, opacity: 0.5 }}>No Somali branches registered in Terminal Settings.</Typography>
                            )}
                        </Grid>


                        <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1, opacity: 0.5 }}>
                            <Info size={12} />
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700 }}>To add or edit these locations, go to Terminal Settings.</Typography>
                        </Box>
                    </Paper>
                </Grid>


                {/* BOTTOM: CONTACT HUB */}
                <Grid size={{ xs: 12 }}>
                    <Paper sx={{ p: 4, borderRadius: '32px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', mb: 3, display: 'block' }}>03_COMMUNICATION_CHANNELS</Typography>
                        <Grid container spacing={3}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    fullWidth label="Customer Support Phone"
                                    value={profile.contactPhone} onChange={e => setProfile({ ...profile, contactPhone: e.target.value })}
                                    InputProps={{ startAdornment: <Phone size={18} style={{ marginRight: 12, color: '#0052FF' }} /> }}
                                    sx={tacticalInput}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    fullWidth label="WhatsApp Number"
                                    value={profile.whatsappNumber} onChange={e => setProfile({ ...profile, whatsappNumber: e.target.value })}
                                    InputProps={{ startAdornment: <MessageCircle size={18} style={{ marginRight: 12, color: '#10b981' }} /> }}
                                    sx={tacticalInput}
                                />
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>
            </Grid>


            <Box sx={{ pt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.4 }}>
                    <Info size={14} />
                    <Typography variant="caption" sx={{ fontWeight: 800 }}>CHANGES SYNC TO CUSTOMER APP INSTANTLY</Typography>
                </Box>
                <Button
                    variant="contained" size="large" onClick={handleSave}
                    startIcon={<Save size={20} />}
                    sx={{ py: 2, px: 8, borderRadius: '20px', fontWeight: 900, background: 'linear-gradient(90deg, #0052FF 0%, #003db3 100%)', boxShadow: '0 10px 30px rgba(0,82,255,0.3)' }}
                >
                    Publish to Marketplace
                </Button>
            </Box>
        </Box>
    );
};


const tacticalInput = {
    '& .MuiFilledInput-root': {
        borderRadius: '16px',
        bgcolor: 'rgba(255,255,255,0.03)',
        '&:before, &:after': { display: 'none' },
        '&.Mui-focused': { border: '1px solid #0052FF' }
    }
};
