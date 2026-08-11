import React from 'react';
import { Box, Typography, Paper, TextField, InputAdornment, Stack, Button } from '@mui/material';
import { Search, Package, Plane, Ship, ChevronRight, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DraftInitModal } from '../../components/DraftInitModal';


export const InventoryMobile = ({ items, filters, setSearch, setMode }: any) => {
    const navigate = useNavigate();
    const [isInitModalOpen, setIsInitModalOpen] = React.useState(false);


    return (
        <Box sx={{ p: 2, pb: 15, display: 'flex', flexDirection: 'column', gap: 2 }}>


            {/* 1. COMPACT HEADER */}
            <Box sx={{ mb: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>FLOOR_INVENTORY</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                    {items.length} ITEMS READY
                </Typography>
            </Box>


            {/* 2. SEARCH & MODE (Stacked for Thumb access) */}
            <TextField
                fullWidth
                placeholder="SEARCH_REF..."
                value={filters.search}
                onChange={(e) => setSearch(e.target.value)}
                variant="filled"
                InputProps={{
                    startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>,
                    sx: { borderRadius: '16px', height: '50px' }
                }}
            />


            <Stack direction="row" spacing={1}>
                {['', 'AIR', 'SEA'].map((m) => (
                    <Button
                        key={m}
                        fullWidth
                        variant={filters.mode === m ? 'contained' : 'outlined'}
                        onClick={() => setMode(m)}
                        sx={{ borderRadius: '12px', fontSize: '0.6rem', fontWeight: 900, height: '40px' }}
                    >
                        {m || 'ALL'}
                    </Button>
                ))}
            </Stack>


            {/* 3. TACTICAL CARDS */}
            <Box sx={{ mt: 1 }}>
                {items.map((item: any) => (
                    <Paper
                        key={item.id}
                        onClick={() => navigate(`/shipments/${item.id}`)}
                        component={motion.div}
                        whileTap={{ scale: 0.98 }}
                        sx={{
                            p: 2, mb: 1.5, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 2
                        }}
                    >
                        <Box sx={{ p: 1.5, bgcolor: item.transportMode === 'AIR' ? 'rgba(0,82,255,0.1)' : 'rgba(16,185,129,0.1)', borderRadius: '12px' }}>
                            {item.transportMode === 'AIR' ? <Plane size={20} color="#0052FF" /> : <Ship size={20} color="#10b981" />}
                        </Box>


                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.85rem' }}>{item.tracking}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>{item.description}</Typography>
                        </Box>


                        <Box sx={{ textAlign: 'right' }}>
                            <Typography sx={{ fontWeight: 900, fontSize: '0.85rem' }}>{item.weight}kg</Typography>
                            <ChevronRight size={14} color="#333" />
                        </Box>
                    </Paper>
                ))}
            </Box>


            {/* 4. FLOATING BATCH TRIGGER */}
            <Box sx={{ position: 'fixed', bottom: 100, right: 16 }}>
                <Button
                    variant="contained" size="large"
                    onClick={() => setIsInitModalOpen(true)}
                    startIcon={<ClipboardList size={20} />}
                    sx={{ borderRadius: '24px', px: 4, py: 2, fontWeight: 900, boxShadow: '0 10px 30px rgba(0,82,255,0.4)' }}
                >
                    Consolidate
                </Button>
            </Box>


            <DraftInitModal isOpen={isInitModalOpen} onClose={() => setIsInitModalOpen(false)} />
        </Box>
    );
};
