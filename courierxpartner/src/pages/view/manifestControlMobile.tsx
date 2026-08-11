import React from 'react';
import { Box, Typography, Paper, Button, Chip, Divider, Alert, IconButton } from '@mui/material';
import { MapPin, Plane, Ship, Package, ChevronRight, History, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


export const ManifestMobile = ({ auth, executeTransition, isTransitioning, canAction }: any) => {
    const navigate = useNavigate();
    const { manifest, calculatedTotalWeight } = auth;


    return (
        <Box sx={{ p: 2, pb: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>


            {/* 1. TACTICAL STATUS BAR */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <IconButton onClick={() => navigate(-1)} sx={{ color: 'text.secondary' }}>
                    <ChevronLeft size={20} />
                </IconButton>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{manifest.manifestCode}</Typography>
                <Chip label={manifest.status} color="primary" size="small" sx={{ fontWeight: 900, borderRadius: '4px' }} />
            </Box>


            {/* 2. VERTICAL TRANSIT LANE (Fixes the horizontal cramping) */}
            <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <MapPin size={18} color="#0052FF" />
                        <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900 }}>ORIGIN</Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>{manifest.originHub.name}</Typography>
                        </Box>
                    </Box>


                    <Box sx={{ width: '2px', height: '30px', bgcolor: 'rgba(255,255,255,0.1)', ml: 1 }} />


                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <MapPin size={18} color={manifest.status === 'ARRIVED' ? "#10b981" : "#444"} />
                        <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900 }}>DESTINATION</Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>{manifest.destinationHub.name}</Typography>
                        </Box>
                    </Box>
                </Box>
            </Paper>


            {/* 3. MOBILE CARDS (Replaces the Table) */}
            <Box>
                <Typography variant="caption" sx={{ fontWeight: 900, mb: 1, display: 'block', ml: 1 }}>BATCH_CONTENTS</Typography>
                {manifest.shipmentIds.map((s: any) => (
                    <Paper
                        key={s._id}
                        onClick={() => navigate(`/shipments/${s._id}`)}
                        sx={{ p: 2, mb: 1.5, borderRadius: '16px', bgcolor: '#0A0A0A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <Box>
                            <Typography sx={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.8rem' }}>{s.externalTrackingNumber}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{s.status.replace(/_/g, ' ')}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                            <Typography sx={{ fontWeight: 900 }}>{s.intake_weight}kg</Typography>
                            <ChevronRight size={14} className="text-gray-600" />
                        </Box>
                    </Paper>
                ))}
            </Box>


            {/* 4. LARGE ACTION BUTTON (Security Aware) */}
            {/* 🚨 FIX: Only show if allowed by FSM AND the user has Node Authority */}
            {auth.allowed.length > 0 && canAction && (
                <Box sx={{ position: 'fixed', bottom: 100, left: 16, right: 16, zIndex: 100 }}>
                    <Button
                        fullWidth variant="contained" size="large"
                        disabled={isTransitioning}
                        onClick={() => executeTransition(auth.allowed[0].code)}
                        sx={{
                            py: 2.5, borderRadius: '20px', fontWeight: 900,
                            background: 'linear-gradient(45deg, #0052FF, #003db3)',
                            boxShadow: '0 10px 30px rgba(0,82,255,0.4)'
                        }}
                    >
                        {auth.allowed[0].label}
                    </Button>
                </Box>
            )}


            {/* Optional: Show a "Locked" message if they don't have authority */}
            {!canAction && auth.allowed.length > 0 && (
                <Alert severity="info" sx={{ borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.4)' }}>
                    Physical custody is currently at {manifest.status === 'CONSOLIDATED' ? 'Origin' : 'Destination'}. No actions available for your hub.
                </Alert>
            )}
        </Box>
    );
};
