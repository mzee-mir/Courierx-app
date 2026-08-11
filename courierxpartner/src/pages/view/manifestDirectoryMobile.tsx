import React from 'react';
import { Box, Typography, Paper, TextField, InputAdornment, Button, Chip, IconButton } from '@mui/material';
import { Search, Plus, Plane, Ship, ChevronRight, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';


export const ManifestDirectoryMobile = ({ manifests, filters, setSearch }: any) => {
    const navigate = useNavigate();


    return (
        <Box sx={{ p: 2, pb: 15, display: 'flex', flexDirection: 'column', gap: 2 }}>


            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 900, fontStyle: 'italic' }}>MANIFEST_LEDGER</Typography>
                <IconButton onClick={() => navigate('/manifests')} sx={{ bgcolor: 'primary.main', color: 'white' }}><Plus size={20} /></IconButton>
            </Box>


            <TextField
                fullWidth placeholder="SEARCH_MANIFEST_CODE..."
                value={filters.search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                    startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>,
                    sx: { borderRadius: '16px', height: '48px', bgcolor: 'rgba(255,255,255,0.02)' }
                }}
            />


            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {manifests.map((m: any) => (
                    <Paper
                        key={m.id}
                        onClick={() => navigate(`/manifests/${m.id}`)}
                        sx={{ p: 2, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {m.shippingMode === 'AIR' ? <Plane size={14} color="#0052FF" /> : <Ship size={14} color="#10b981" />}
                                <Typography sx={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.9rem' }}>{m.manifestCode}</Typography>
                            </Box>
                            <Chip label={m.status} size="small" sx={{ fontSize: '0.55rem', fontWeight: 900, height: 18 }} />
                        </Box>


                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                                UNITS: {m.shipmentIds?.length || 0} PCS
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                {m.updatedAt ? format(new Date(m.updatedAt), 'MMM dd, HH:mm') : 'N/A'}
                            </Typography>
                        </Box>
                    </Paper>
                ))}
            </Box>
        </Box>
    );
};
