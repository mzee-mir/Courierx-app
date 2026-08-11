import React from 'react';
import { Box, Typography, Paper, Button, Grid, Chip } from '@mui/material';
import { ShieldAlert, CheckCircle, XCircle, Camera, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


export const ExceptionMobile = ({ blocked, handleResolve }: any) => {
    const navigate = useNavigate();


    return (
        <Box sx={{ p: 2, pb: 15, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#FF3B30' }}>RED_ZONE</Typography>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                    {blocked.length} BLOCKED SHIPMENTS
                </Typography>
            </Box>


            {blocked.length === 0 && (
                <Box sx={{ py: 10, textAlign: 'center', opacity: 0.2 }}>
                    <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 16px' }} />
                    <Typography variant="button">NO_ACTIVE_EXCEPTIONS</Typography>
                </Box>
            )}


            {blocked.map((item: any) => {
                const variance = Math.abs((Number(item.intake_weight) || 0) - (Number(item.arrival_weight) || 0)).toFixed(2);


                return (
                    <Paper key={item._id} sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255,59,48,0.02)', border: '1px solid rgba(255,59,48,0.1)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography sx={{ fontFamily: 'monospace', fontWeight: 900 }}>{item.externalTrackingNumber}</Typography>
                            <Chip label={item.exceptionType} color="error" size="small" sx={{ fontWeight: 900, fontSize: '0.5rem' }} />
                        </Box>


                        <Grid container spacing={1} sx={{ mb: 3 }}>
                            <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>VARIANCE</Typography>
                                <Typography sx={{ fontWeight: 900, color: '#FF3B30' }}>{variance}kg</Typography>
                            </Grid>
                            <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                                <Button
                                    size="small"
                                    startIcon={<Camera size={14} />}
                                    onClick={() => navigate(`/shipments/${item._id}`)}
                                    sx={{
                                        color: 'primary.main',
                                        fontWeight: 900,
                                        fontSize: '0.65rem',
                                        bgcolor: 'rgba(0,82,255,0.05)',
                                        px: 2,
                                        borderRadius: '8px'
                                    }}
                                >
                                    View Evidence
                                </Button>
                            </Grid>
                        </Grid>


                        <Box sx={{ display: 'flex', gap: 1.5 }}>
                            <Button fullWidth variant="contained" color="success" onClick={() => handleResolve(item._id, 'RELEASE')} sx={{ borderRadius: '12px', fontWeight: 900 }}>Force Release</Button>
                            <Button fullWidth variant="contained" color="error" onClick={() => handleResolve(item._id, 'CANCEL')} sx={{ borderRadius: '12px', fontWeight: 900 }}>Void</Button>
                        </Box>
                    </Paper>
                );
            })}
        </Box>
    );
};
