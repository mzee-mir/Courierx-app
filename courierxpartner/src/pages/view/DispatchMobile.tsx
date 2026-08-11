import React from 'react';
import { Box, Typography, Paper, TextField, InputAdornment, Button } from '@mui/material';
import { Search, MapPin, Truck, PackageCheck, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';


export const DispatchMobile = ({ queue, search, setSearch, executeHandoff, isProcessing }: any) => {
    return (
        <Box sx={{ p: 2, pb: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>


            <Box>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>DISPATCH_QUEUE</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                    {queue.length} ITEMS READY FOR RELEASE
                </Typography>
            </Box>


            <TextField
                fullWidth
                placeholder="SEARCH_TRACKING..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                variant="filled"
                InputProps={{
                    startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>,
                    sx: { borderRadius: '16px' }
                }}
            />


            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {queue.map((item: any) => (
                    <Paper
                        key={item._id}
                        sx={{ p: 2.5, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography sx={{ fontFamily: 'monospace', fontWeight: 900 }}>{item.externalTrackingNumber}</Typography>
                            <Typography sx={{ fontWeight: 900, color: 'primary.main', fontSize: '0.8rem' }}>{item.arrival_weight}kg</Typography>
                        </Box>


                        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                            <MapPin size={14} color="#666" style={{ marginTop: 2 }} />
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                                {item.dropoffLandmark}
                            </Typography>
                        </Box>


                        <Button
                            fullWidth variant="contained"
                            disabled={isProcessing}
                            onClick={() => executeHandoff(item._id)}
                            startIcon={<Truck size={18} />}
                            sx={{ py: 1.5, borderRadius: '14px', fontWeight: 900 }}
                        >
                            Release to Driver
                        </Button>
                    </Paper>
                ))}


                {queue.length === 0 && (
                    <Box sx={{ py: 10, textAlign: 'center', opacity: 0.2 }}>
                        <PackageCheck size={64} style={{ margin: '0 auto 16px' }} />
                        <Typography variant="button">NO_PENDING_HANDOFFS</Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};
