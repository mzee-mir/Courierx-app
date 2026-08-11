import React from 'react';
import { Box, Typography, Paper, Button, Grid } from '@mui/material';
import { Truck, MapPin, PackageCheck, Zap } from 'lucide-react';

interface DispatchTerminalDesktopProps {
    queue: any[];
    executeHandoff: (id: string) => void;
    isProcessing: boolean;
}

export const DispatchTerminalDesktop: React.FC<DispatchTerminalDesktopProps> = ({
    queue,
    executeHandoff,
    isProcessing
}) => {


    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 4, pb: 12 }}>
            {/* HEADER */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.05em' }}>
                        DISPATCH_<span style={{ color: '#0052FF' }}>TERMINAL</span>
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                        {queue?.length || 0} ITEMS_READY_FOR_LAST_MILE
                    </Typography>
                </Box>
                <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(0,82,255,0.1)', border: '1px solid #0052FF33', borderRadius: '12px' }}>
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: 'primary.main' }}>NODE_STATUS: READY</Typography>
                </Paper>
            </Box>


            {/* THE QUEUE */}
            <Grid container spacing={2}>
                {queue?.length === 0 ? (
                    <Box sx={{ p: 10, width: '100%', textAlign: 'center', opacity: 0.1 }}>
                        <PackageCheck size={64} style={{ margin: '0 auto 16px' }} />
                        <Typography variant="h6" sx={{ fontWeight: 900 }}>QUEUE_EMPTY</Typography>
                    </Box>
                ) : queue?.map((item: any) => (
                    <Grid size={{ xs: 12, md: 6 }} key={item._id}>
                        <Paper sx={{
                            p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.05)', position: 'relative'
                        }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                <Typography sx={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.9rem' }}>{item.externalTrackingNumber}</Typography>
                                <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', color: 'primary.main' }}>
                                    IN: {item.intake_weight}kg
                                </Typography>
                                {/* Add this to show the verified weight */}
                                <Typography sx={{ fontWeight: 900, fontSize: '0.65rem', color: 'success.main' }}>
                                    ARR: {item.arrival_weight || '??'}kg
                                </Typography>
                            </Box>


                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 3 }}>
                                <MapPin size={14} className="text-gray-500" style={{ marginTop: 4 }} />
                                <Box>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>DESTINATION_LANDMARK</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.dropoffLandmark}</Typography>
                                </Box>
                            </Box>


                            <Button
                                fullWidth
                                variant="contained"
                                disabled={isProcessing}
                                onClick={() => executeHandoff(item._id)}
                                startIcon={<Truck size={18} />}
                                sx={{
                                    py: 1.5, borderRadius: '14px', fontWeight: 900,
                                    background: 'linear-gradient(90deg, #0052FF 0%, #003db3 100%)',
                                    boxShadow: '0 8px 20px rgba(0,82,255,0.2)'
                                }}
                            >
                                Release to CourierX
                            </Button>
                        </Paper>
                    </Grid>
                ))}
            </Grid>


            {/* FOOTER INTELLIGENCE */}
            <Box sx={{ mt: 'auto', p: 3, bgcolor: 'rgba(255,255,255,0.01)', borderRadius: '24px', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <Zap size={12} /> Handoff generates an automated local order and notifies the customer via SMS.
                </Typography>
            </Box>
        </Box>
    );
};
