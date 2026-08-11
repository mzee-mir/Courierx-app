import React from 'react';
import { Box, Typography, Paper, TextField, Button, Avatar, IconButton, CircularProgress } from '@mui/material';
import { Camera, Copy, MessageCircle, Save, MapPin, Globe } from 'lucide-react';


export const PartnerProfileMobile = (props: any) => {
    const { profile, setProfile, handleLogoUpload, fileInputRef, uploading, copyToClipboard } = props;


    return (
        <Box sx={{ p: 2, pb: 15, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>BRAND_PROFILE</Typography>


            {/* 1. BRAND IDENTITY CARD */}
            <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
                <Box sx={{ position: 'relative', width: 80, height: 80, mx: 'auto', mb: 2 }}>
                    <Avatar src={profile.logoUrl} sx={{ width: 80, height: 80, borderRadius: '16px', bgcolor: 'primary.main' }} />
                    <IconButton
                        onClick={() => fileInputRef.current?.click()}
                        sx={{ position: 'absolute', bottom: -5, right: -5, bgcolor: '#0052FF', color: 'white', p: 0.5 }}
                    >
                        {uploading ? <CircularProgress size={16} color="inherit" /> : <Camera size={16} />}
                    </IconButton>
                    <input type="file" hidden ref={fileInputRef} onChange={handleLogoUpload} />
                </Box>
                <TextField
                    fullWidth label="Company Bio" multiline rows={3} variant="filled"
                    value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })}
                />
            </Paper>


            {/* 2. ALIBABA UTILITY BOX (The most important part for mobile) */}
            <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: '#000', border: '1px solid #0052FF33' }}>
                <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', mb: 1, display: 'block' }}>CHINA_LOGISTICS_DATA</Typography>
                <Box
                    onClick={() => copyToClipboard(profile.chinaAddress)}
                    sx={{ p: 2, bgcolor: 'rgba(0,82,255,0.05)', borderRadius: '12px', border: '1px dashed #0052FF66', mb: 2, cursor: 'pointer' }}
                >
                    <Typography sx={{ fontSize: '0.7rem', color: 'white', fontFamily: 'monospace', mb: 1 }}>{profile.chinaAddress || 'Tap to set address'}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'primary.main' }}>
                        <Copy size={12} /> <Typography sx={{ fontSize: '0.6rem', fontWeight: 900 }}>COPY_FOR_SUPPLIER</Typography>
                    </Box>
                </Box>
                <TextField
                    fullWidth label="Update Chinese Address" variant="filled"
                    value={profile.chinaAddress} onChange={e => setProfile({ ...profile, chinaAddress: e.target.value })}
                />
            </Paper>


            {/* 3. CONTACTS */}
            <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Typography variant="caption" sx={{ fontWeight: 900, mb: 2, display: 'block' }}>CONTACT_CHANNELS</Typography>
                <TextField fullWidth label="WhatsApp" value={profile.whatsappNumber} onChange={e => setProfile({ ...profile, whatsappNumber: e.target.value })} sx={{ mb: 2 }} />
                <TextField fullWidth label="Support Phone" value={profile.contactPhone} onChange={e => setProfile({ ...profile, contactPhone: e.target.value })} />
            </Paper>


            {/* 4. SOMALIA COLLECTION POINTS (NEW) */}
            <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <MapPin size={18} color="#10b981" />
                    <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main' }}>
                        04_SOMALIA_BRANCHES
                    </Typography>
                </Box>


                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {profile.collectionPoints?.length > 0 ? (
                        profile.collectionPoints.map((point: any, index: number) => (
                            <Box
                                key={index}
                                sx={{
                                    p: 2, bgcolor: 'rgba(255,255,255,0.03)',
                                    borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)'
                                }}
                            >
                                <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', color: 'white' }}>
                                    {point.city.toUpperCase()}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                                    {point.name}
                                </Typography>
                                <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                                    {point.address}
                                </Typography>
                            </Box>
                        ))
                    ) : (
                        <Typography variant="caption" sx={{ textAlign: 'center', opacity: 0.5, py: 2 }}>
                            No Somali branches registered. Add them in Terminal Settings.
                        </Typography>
                    )}
                </Box>
            </Paper>


            <Button
                fullWidth variant="contained" size="large" onClick={props.handleSave}
                sx={{ position: 'fixed', bottom: 100, left: 16, right: 16, py: 2, borderRadius: '20px', fontWeight: 900 }}
            >
                Publish Storefront
            </Button>
        </Box>
    );
};
