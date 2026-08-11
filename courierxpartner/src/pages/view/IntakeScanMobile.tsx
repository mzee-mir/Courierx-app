import React, { useMemo } from 'react';
import {
    Box, Typography, Paper, Button, Fade,
    CircularProgress, IconButton, TextField,
    FormControl, Select, MenuItem, Grid, alpha
} from '@mui/material';
import {
    X, Plane, Ship, MapPin, Keyboard,
    Camera, Printer, Info, Zap, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';


import { TacticalScanner } from '../../components/scanner/TacticalScanner';
import { WeightKeypad } from '../../components/ui/WeightKeypad';
import { ThermalLabel } from '../../components/ui/ThermalLabel';
import { QuickCreateModal } from '../../components/QuickCreateModal';
import { useAuthStore } from '../../store/useAuthStore';


export const IntakeMobile = (props: any) => {
    const { user } = useAuthStore();


    // 1. DATA: Fetch Somali Hubs for the dropdown
    const { data: locations } = useQuery({
        queryKey: ['myLocations'],
        queryFn: () => api.get('/partner/my-locations').then(res => res.data.locations)
    });


    const somaliBranches = useMemo(() => {
        return locations?.filter((l: any) => l.country === 'SO') || [];
    }, [locations]);


    return (
        <Box sx={{ p: 2, pb: 15, display: 'flex', flexDirection: 'column', gap: 3 }}>


            {/* --- TACTICAL HEADER --- */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em' }}>
                        INTAKE_<span style={{ color: '#0052FF' }}>SCANNER</span>
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Box sx={{ width: 6, height: 6, bgcolor: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                        <Typography sx={{ fontSize: '0.55rem', fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>
                            NODE_ONLINE // {user?.assignedLocations?.[0]?.slice(-4).toUpperCase()}
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={props.resetFlow} sx={{ color: 'rgba(255,255,255,0.2)' }}><Activity size={18} /></IconButton>
            </Box>


            <AnimatePresence mode="wait">
                {!props.trackingId ? (
                    /* --- PHASE 1: IDENTIFICATION --- */
                    <Box
                        key="phase-1"
                        component={motion.div}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                    >
                        {props.isManualEntry ? (
                            <Paper sx={instrumentCardStyles}>
                                <Typography variant="caption" sx={sectionLabelStyles}>MANUAL_ID_INPUT</Typography>
                                <TextField
                                    fullWidth autoFocus placeholder="TYPE_ID..."
                                    variant="filled"
                                    value={props.manualInput}
                                    onChange={(e) => props.setTrackingId(e.target.value.toUpperCase())}
                                    slotProps={{ input: { sx: { fontFamily: 'monospace', fontWeight: 900, fontSize: '1.2rem' } } }}
                                />
                                <Button fullWidth onClick={() => props.setIsManualEntry(false)} sx={{ mt: 2, color: 'text.secondary', fontWeight: 800 }}>
                                    Return to Camera
                                </Button>
                            </Paper>
                        ) : (
                            <Box sx={{ position: 'relative', borderRadius: '32px', overflow: 'hidden' }}>
                                {/* HUD Overlay */}
                                <Box sx={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
                                    <Box sx={{ position: 'absolute', top: 30, left: 30, width: 30, height: 30, borderLeft: '3px solid #0052FF', borderTop: '3px solid #0052FF' }} />
                                    <Box sx={{ position: 'absolute', top: 30, right: 30, width: 30, height: 30, borderRight: '3px solid #0052FF', borderTop: '3px solid #0052FF' }} />
                                    <Box sx={{ position: 'absolute', bottom: 30, left: 30, width: 30, height: 30, borderLeft: '3px solid #0052FF', borderBottom: '3px solid #0052FF' }} />
                                    <Box sx={{ position: 'absolute', bottom: 30, right: 30, width: 30, height: 30, borderRight: '3px solid #0052FF', borderBottom: '3px solid #0052FF' }} />
                                </Box>


                                <TacticalScanner onScanSuccess={props.setTrackingId} isPaused={false} />


                                <Button
                                    fullWidth startIcon={<Keyboard size={16} />}
                                    onClick={() => props.setIsManualEntry(true)}
                                    sx={{ mt: 1, color: 'text.secondary', fontSize: '0.7rem', fontWeight: 800 }}
                                >
                                    Type ID Manually
                                </Button>
                            </Box>
                        )}
                    </Box>
                ) : (
                    /* --- PHASE 2: LOGISTICS SPECS --- */
                    <Box
                        key="phase-2"
                        component={motion.div}
                        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                        sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
                    >
                        {/* ACTIVE SESSION IDENTIFIER */}
                        <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'primary.main', color: 'white', position: 'relative' }}>
                            <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.7 }}>RESOLVED_ID</Typography>
                            <Typography variant="h5" sx={{ fontFamily: 'monospace', fontWeight: 900 }}>{props.trackingId}</Typography>
                            <IconButton onClick={props.resetFlow} sx={{ position: 'absolute', top: 10, right: 10, color: 'white' }}><X size={18} /></IconButton>
                        </Paper>


                        {/* 1. DESTINATION SELECT */}
                        <Paper sx={instrumentCardStyles}>
                            <Typography variant="caption" sx={sectionLabelStyles}>01_DESTINATION_HUB</Typography>
                            <FormControl fullWidth variant="filled">
                                <Select
                                    value={props.destBranchId}
                                    onChange={(e) => props.setDestBranchId(e.target.value)}
                                    sx={{ borderRadius: '14px', fontWeight: 800 }}
                                >
                                    {somaliBranches.map((branch: any) => (
                                        <MenuItem key={branch.id} value={branch.id}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <MapPin size={14} color="#0052FF" />
                                                <Typography sx={{ fontWeight: 800, fontSize: '0.8rem' }}>{branch.city.toUpperCase()}</Typography>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Paper>


                        {/* 2. MODE SELECT */}
                        <Paper sx={instrumentCardStyles}>
                            <Typography variant="caption" sx={sectionLabelStyles}>02_FREIGHT_MODE</Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                                <ModeButton active={props.mode === 'AIR'} icon={<Plane size={18} />} label="AIR" onClick={() => props.setMode('AIR')} />
                                <ModeButton active={props.mode === 'SEA'} icon={<Ship size={18} />} label="SEA" onClick={() => props.setMode('SEA')} />
                            </Box>
                        </Paper>


                        {/* 3. SEA DIMENSIONS (Conditional) */}
                        {props.mode === 'SEA' && (
                            <Paper sx={{ ...instrumentCardStyles, border: '1px solid #0052FF44' }}>
                                <Typography variant="caption" sx={sectionLabelStyles}>03_DIMENSIONS (CM)</Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                                    <TextField label="L" type="number" value={props.dims.l} onChange={e => props.setDims({ ...props.dims, l: e.target.value })} sx={tacticalInput} />
                                    <TextField label="W" type="number" value={props.dims.w} onChange={e => props.setDims({ ...props.dims, w: e.target.value })} sx={tacticalInput} />
                                    <TextField label="H" type="number" value={props.dims.h} onChange={e => props.setDims({ ...props.dims, h: e.target.value })} sx={tacticalInput} />
                                </Box>
                            </Paper>
                        )}


                        {/* 4. WEIGHT KEYPAD */}
                        <Paper sx={instrumentCardStyles}>
                            <Typography variant="caption" sx={sectionLabelStyles}>04_PHYSICAL_WEIGHT</Typography>
                            <WeightKeypad label="INTAKE_KG" value={props.weight} onChange={props.setWeight} onConfirm={props.handleIntakeSubmit} />
                        </Paper>


                        {/* 5. ACTION */}
                        <Button
                            fullWidth size="large" variant="contained"
                            disabled={!props.weight || props.isProcessing}
                            onClick={props.handleIntakeSubmit}
                            sx={primaryActionStyles}
                        >
                            {props.isProcessing ? <CircularProgress size={24} color="inherit" /> : (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    COMMIT & PRINT <Printer size={20} />
                                </Box>
                            )}
                        </Button>
                    </Box>
                )}
            </AnimatePresence>


            <QuickCreateModal
                isOpen={props.isQuickCreateOpen}
                onClose={() => props.setIsQuickCreateOpen(false)}
                onSuccess={props.onSuccess} // From useIntakeLogic or parent
                trackingNumber={props.trackingId}
                locationId={user?.assignedLocations?.[0]}
            />


            <ThermalLabel data={props.printData} />
        </Box>
    );
};


// --- STYLES ---


const instrumentCardStyles = {
    p: 2.5, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)'
};


const sectionLabelStyles = {
    fontWeight: 900, color: 'primary.main', mb: 1.5, display: 'block', letterSpacing: '0.1em', fontSize: '0.6rem'
};


const tacticalInput = {
    '& .MuiFilledInput-root': { borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)' }
};


const primaryActionStyles = {
    py: 2.5, borderRadius: '20px', fontWeight: 900,
    background: 'linear-gradient(45deg, #0052FF, #003db3)',
    boxShadow: '0 10px 30px rgba(0,82,255,0.4)'
};


const ModeButton = ({ active, icon, label, onClick }: any) => (
    <Button
        onClick={onClick}
        fullWidth
        variant={active ? 'contained' : 'outlined'}
        sx={{
            height: '50px', borderRadius: '14px', gap: 1, fontWeight: 900, fontSize: '0.75rem',
            bgcolor: active ? 'primary.main' : 'transparent',
            borderColor: active ? 'primary.main' : 'rgba(255,255,255,0.1)',
            color: active ? 'white' : 'rgba(255,255,255,0.3)'
        }}
    >
        {icon} {label}
    </Button>
);
