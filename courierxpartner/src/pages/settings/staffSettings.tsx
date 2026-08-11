import React from 'react';
import {
    Box, Typography, Paper, TextField, Button, Avatar,
    IconButton, Switch, Grid, CircularProgress,
    Chip
} from '@mui/material';
import {
    Camera, Volume2, Smartphone, Key, LogOut,
    ShieldCheck, Activity, Zap
} from 'lucide-react';
import { useStaffSettingsLogic } from '../../hooks/useStaffSettingsLogic';

// Use ReturnType to automatically map all returned properties from your logic hook
type StaffSettingsProps = ReturnType<typeof useStaffSettingsLogic>;

export const StaffSettingsDesktop = ({
    user,
    displayName, setDisplayName,
    passwords, setPasswords,
    loading,
    fileInputRef,
    handleImageUpload,
    handleNameUpdate,
    handleSecurityUpdate,
    scannerBeep, setScannerBeep,
    scannerVibrate, setScannerVibrate
}: StaffSettingsProps) => {

    return (
        <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4, pb: 15 }}>

            {/* --- HEADER READOUT --- */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.05em', color: 'white' }}>
                        MY_<span style={{ color: '#0052FF' }}>WORKSPACE</span>
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, fontFamily: 'monospace' }}>
                        <Activity size={12} color="#0052FF" /> OPERATIVE_SESSION: ACTIVE // NODE_ID: {user?.id.slice(-8).toUpperCase()}
                    </Typography>
                </Box>

                <Button
                    variant="outlined"
                    color="error"
                    startIcon={<LogOut size={16} />}
                    sx={{ borderRadius: '12px', fontWeight: 900, fontSize: '0.65rem', px: 3, borderColor: 'rgba(255,59,48,0.3)', bgcolor: 'rgba(255,59,48,0.02)' }}
                    onClick={() => window.location.href = '/login'}
                >
                    RELEASE_STATION
                </Button>
            </Box>

            <Grid container spacing={3}>

                {/* --- 01. PERSONNEL DOSSIER --- */}
                <Grid size={{ xs: 12, md: 7 }}>
                    <Paper sx={instrumentCardStyles}>
                        <Typography variant="caption" sx={sectionLabelStyles}>01_PERSONNEL_DOSSIER</Typography>

                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 4, mb: 4 }}>
                            <Box sx={{ position: 'relative' }}>
                                <Avatar
                                    src={user?.imageUrl}
                                    sx={{ width: 130, height: 130, borderRadius: '32px', bgcolor: 'primary.main', border: '3px solid rgba(0,82,255,0.2)', boxShadow: '0 0 30px rgba(0,82,255,0.1)' }}
                                >
                                    {user?.displayName?.charAt(0)}
                                </Avatar>
                                <IconButton
                                    onClick={() => fileInputRef.current?.click()}
                                    sx={{ position: 'absolute', bottom: -5, right: -5, bgcolor: '#0052FF', color: 'white', '&:hover': { bgcolor: '#003db3' }, width: 36, height: 36, border: '4px solid #0A0A0A' }}
                                >
                                    {loading ? <CircularProgress size={18} color="inherit" /> : <Camera size={18} />}
                                </IconButton>
                                <input type="file" hidden ref={fileInputRef} onChange={handleImageUpload} />
                            </Box>

                            <Box sx={{ flex: 1, textAlign: { xs: 'center', sm: 'left' } }}>
                                <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>{user?.displayName}</Typography>
                                <Typography variant="body2" sx={{ color: 'primary.main', fontFamily: 'monospace', fontWeight: 700, mb: 2 }}>{user?.email}</Typography>
                                <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'center', sm: 'flex-start' } }}>
                                    <Chip label={user?.roles[0]?.replace('_', ' ')} size="small" sx={chipStyles} />
                                    <Chip icon={<ShieldCheck size={12} />} label="SECURE_LINK" size="small" sx={{ ...chipStyles, color: '#10b981', bgcolor: 'rgba(16,185,129,0.1)' }} />
                                </Box>
                            </Box>
                        </Box>

                        <Box sx={{ bgcolor: 'rgba(255,255,255,0.02)', p: 2, borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 2 }}>
                            <TextField
                                fullWidth label="Adjust Callsign"
                                variant="filled"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                sx={tacticalInputStyles}
                            />
                            <Button
                                variant="contained"
                                disableElevation
                                onClick={handleNameUpdate}
                                sx={{ borderRadius: '14px', px: 4, fontWeight: 900, height: '56px' }}
                            >
                                SYNC
                            </Button>
                        </Box>
                    </Paper>
                </Grid>

                {/* --- 02. HARDWARE CALIBRATION --- */}
                <Grid size={{ xs: 12, md: 5 }}>
                    <Paper sx={{ ...instrumentCardStyles, height: '100%' }}>
                        <Typography variant="caption" sx={sectionLabelStyles}>02_HARDWARE_CALIBRATION</Typography>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
                            <PreferenceSwitch
                                icon={<Volume2 size={20} />}
                                label="Scanner Audio"
                                subLabel="Terminal beep on valid scan"
                                checked={scannerBeep}
                                onChange={setScannerBeep}
                            />
                            <PreferenceSwitch
                                icon={<Smartphone size={20} />}
                                label="Haptic Feedback"
                                subLabel="Vibration pulse on mobile"
                                checked={scannerVibrate}
                                onChange={setScannerVibrate}
                            />
                        </Box>

                        <Box sx={{ mt: 'auto', pt: 5 }}>
                            <Box sx={{ p: 2, bgcolor: 'rgba(0,82,255,0.03)', borderRadius: '16px', border: '1px dashed rgba(0,82,255,0.2)', display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Zap size={16} className="text-[#0052FF] animate-pulse" />
                                <Typography sx={{ fontSize: '0.65rem', fontWeight: 900, color: 'primary.main', letterSpacing: '0.05em' }}>
                                    SYSTEM_OPTIMIZATION: LATENCY_MINIMIZED
                                </Typography>
                            </Box>
                        </Box>
                    </Paper>
                </Grid>

                {/* --- 03. SECURITY KEY ROTATION --- */}
                <Grid size={{ xs: 12 }}>
                    <Paper sx={{ ...instrumentCardStyles, border: '1px solid rgba(255,59,48,0.15)' }}>
                        <Typography variant="caption" sx={{ ...sectionLabelStyles, color: '#FF3B30' }}>03_SECURITY_KEY_ROTATION</Typography>

                        <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    fullWidth type="password" label="Current Access Key"
                                    value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                    sx={tacticalInputStyles}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    fullWidth type="password" label="New Secure Key"
                                    value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                    sx={tacticalInputStyles}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Button
                                    fullWidth variant="contained" color="error"
                                    startIcon={<Key size={20} />}
                                    onClick={handleSecurityUpdate}
                                    disabled={!passwords.new || !passwords.current}
                                    sx={{ height: '56px', borderRadius: '16px', fontWeight: 900, background: 'linear-gradient(90deg, #FF3B30 0%, #991b1b 100%)', boxShadow: '0 10px 30px rgba(255,59,48,0.2)' }}
                                >
                                    AUTHORIZE NEW KEY
                                </Button>
                            </Grid>
                        </Grid>

                        <Typography sx={{ display: 'block', mt: 2, color: 'rgba(255,59,48,0.5)', fontWeight: 800, fontSize: '0.65rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            SECURITY_PROTOCOL: Updating key forces global session invalidation.
                        </Typography>
                    </Paper>
                </Grid>

            </Grid>
        </Box>
    );
};

// --- SUB-COMPONENTS & STYLES ---

const PreferenceSwitch = ({ icon, label, subLabel, checked, onChange }: any) => (
    <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)'
    }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '12px', color: 'primary.main' }}>{icon}</Box>
            <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'white' }}>{label}</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block' }}>{subLabel}</Typography>
            </Box>
        </Box>
        <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} color="primary" />
    </Box>
);

const instrumentCardStyles = {
    p: 4,
    borderRadius: '32px',
    bgcolor: '#0A0A0A',
    border: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden'
};

const sectionLabelStyles = {
    fontWeight: 900,
    color: 'primary.main',
    mb: 3,
    display: 'block',
    letterSpacing: '0.2em',
    fontSize: '0.65rem'
};

const chipStyles = {
    bgcolor: 'rgba(255,255,255,0.03)',
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 900,
    fontSize: '0.6rem',
    borderRadius: '8px',
    height: 24,
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
};

const tacticalInputStyles = {
    '& .MuiFilledInput-root': {
        borderRadius: '16px',
        bgcolor: 'rgba(255,255,255,0.03)',
        '&:before, &:after': { display: 'none' },
        '&.Mui-focused': { border: '1px solid #0052FF', bgcolor: 'transparent' }
    },
    '& .MuiInputLabel-root': {
        fontSize: '0.8rem',
        fontWeight: 700,
        color: 'rgba(255,255,255,0.3)'
    }
};