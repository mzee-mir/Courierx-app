import React from 'react';
import { Box, Typography, Paper, TextField, Button, Avatar, IconButton, Switch, FormControlLabel, CircularProgress, Divider } from '@mui/material';
import { Camera, Volume2, Smartphone, Key, Activity, LogOut, CheckCircle2 } from 'lucide-react';


export const StaffSettingsMobile = (props: any) => {
    return (
        <Box sx={{ p: 2, pb: 15, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>MY_STATION</Typography>


            {/* 1. IDENTITY CARD */}
            <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
                <Box sx={{ position: 'relative', width: 90, height: 90, mx: 'auto', mb: 2 }}>
                    <Avatar
                        src={props.user?.imageUrl}
                        sx={{ width: 90, height: 90, borderRadius: '24px', bgcolor: 'primary.main', border: '2px solid #0052FF' }}
                    />
                    <IconButton
                        onClick={() => props.fileInputRef.current?.click()}
                        sx={{ position: 'absolute', bottom: -5, right: -5, bgcolor: '#0052FF', color: 'white' }}
                    >
                        {props.loading ? <CircularProgress size={16} color="inherit" /> : <Camera size={16} />}
                    </IconButton>
                    <input type="file" hidden ref={props.fileInputRef} onChange={props.handleImageUpload} />
                </Box>
                <Typography sx={{ fontWeight: 900 }}>{props.user?.displayName}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>{props.user?.email}</Typography>
                <TextField
                    fullWidth size="small" variant="filled" label="Callsgn"
                    value={props.displayName} onChange={(e) => props.setDisplayName(e.target.value)}
                    sx={{ mb: 1 }}
                />
                <Button fullWidth onClick={props.handleNameUpdate} sx={{ fontWeight: 900, fontSize: '0.7rem' }}>Sync Name</Button>
            </Paper>


            {/* 2. HARDWARE TOGGLES */}
            <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(0,82,255,0.03)', border: '1px solid #0052FF33' }}>
                <Typography variant="caption" sx={{ fontWeight: 900, mb: 2, display: 'block' }}>02_TERMINAL_FEEDBACK</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Volume2 size={18} className="text-blue-500" />
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 800 }}>Scanner Audio</Typography>
                        </Box>
                        <Switch checked={props.scannerBeep} onChange={(e) => props.setScannerBeep(e.target.checked)} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Smartphone size={18} className="text-blue-500" />
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 800 }}>Haptic Vibration</Typography>
                        </Box>
                        <Switch checked={props.scannerVibrate} onChange={(e) => props.setScannerVibrate(e.target.checked)} />
                    </Box>
                </Box>
            </Paper>


            {/* 3. QUICK SECURITY */}
            <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: '#000', border: '1px solid rgba(255,59,48,0.2)' }}>
                <Typography variant="caption" sx={{ fontWeight: 900, color: 'error.main', mb: 2, display: 'block' }}>03_SECURITY_KEY</Typography>
                <TextField
                    fullWidth type="password" label="New Secure Key"
                    value={props.passwords.new} onChange={(e) => props.setPasswords({ ...props.passwords, new: e.target.value })}
                    sx={{ mb: 2 }}
                />
                <Button fullWidth variant="contained" color="error" onClick={props.handleSecurityUpdate} sx={{ borderRadius: '12px', fontWeight: 900 }}>Authorize New Key</Button>
            </Paper>
        </Box>
    );
};
