import React, { useState } from 'react';
import { Box, Typography, Paper, Button, IconButton, Badge } from '@mui/material';
import { Plus, X, Package, ChevronLeft, CheckCircle2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';


export const ManifestBuilderMobile = (props: any) => {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const navigate = useNavigate();


    return (
        <Box sx={{ p: 2, pb: 20, display: 'flex', flexDirection: 'column', gap: 3 }}>


            {/* HEADER */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton onClick={() => navigate('/manifests/directory')}><ChevronLeft /></IconButton>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>BUILDER: {props.draft?.shippingMode}</Typography>
            </Box>


            {/* DRAFT IDENTITY */}
            <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'primary.main', color: 'white' }}>
                <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.8 }}>MANIFEST_CODE</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'monospace' }}>{props.draft?.manifestCode}</Typography>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, mt: 1 }}>DEST: {props.draft?.destinationHub.name}</Typography>
            </Paper>


            {/* STAGED ITEMS */}
            <Box>
                <Typography variant="caption" sx={{ fontWeight: 900, ml: 1, mb: 1, display: 'block' }}>STAGED_INVENTORY ({props.totals.count})</Typography>
                {props.draft.shipmentIds.map((item: any) => (
                    <Paper key={item._id} sx={{ p: 2, mb: 1.5, borderRadius: '16px', bgcolor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 900, fontFamily: 'monospace' }}>{item.externalTrackingNumber}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{item.intake_weight}kg</Typography>
                        </Box>
                        <IconButton onClick={() => props.handleRemoveItem(item._id)} color="error" size="small"><X size={18} /></IconButton>
                    </Paper>
                ))}
            </Box>


            {/* ACTIONS */}
            <Box sx={{ position: 'fixed', bottom: 100, left: 16, right: 16, display: 'flex', gap: 2 }}>
                <Button
                    fullWidth variant="contained"
                    onClick={() => setIsPickerOpen(true)}
                    sx={{ py: 2, borderRadius: '16px', bgcolor: 'white', color: 'black', fontWeight: 900 }}
                    startIcon={<Plus />}
                >
                    Add Items
                </Button>
                <Button
                    fullWidth variant="contained"
                    disabled={props.totals.count === 0 || props.isSealing}
                    onClick={() => props.sealManifest()}
                    sx={{ py: 2, borderRadius: '16px', fontWeight: 900 }}
                >
                    Seal Batch
                </Button>
            </Box>


            {/* PICKER OVERLAY */}
            <AnimatePresence>
                {isPickerOpen && (
                    <Box component={motion.div} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} sx={{ position: 'fixed', inset: 0, zIndex: 1000, bgcolor: '#000', p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
                            <Typography variant="h5" sx={{ fontWeight: 900 }}>WAREHOUSE_FLOOR</Typography>
                            <IconButton onClick={() => setIsPickerOpen(false)} sx={{ color: 'white' }}><X /></IconButton>
                        </Box>
                        <Box sx={{ overflowY: 'auto', height: '70vh' }}>
                            {props.floorItems.map((item: any) => {
                                const isStaged = props.draft.shipmentIds.some((s: any) => s._id === item.id);
                                return (
                                    <Paper key={item.id} onClick={() => !isStaged && props.handleAddItem(item.id)} sx={{ p: 2, mb: 2, borderRadius: '16px', opacity: isStaged ? 0.3 : 1, display: 'flex', justifyContent: 'space-between' }}>
                                        <Box>
                                            <Typography sx={{ fontWeight: 900 }}>{item.tracking}</Typography>
                                            <Typography variant="caption">{item.weight}kg</Typography>
                                        </Box>
                                        {isStaged ? <CheckCircle2 color="#10b981" /> : <Plus color="#0052FF" />}
                                    </Paper>
                                );
                            })}
                        </Box>
                        <Button fullWidth variant="contained" onClick={() => setIsPickerOpen(false)} sx={{ mt: 2, py: 2, borderRadius: '16px' }}>Return to Builder</Button>
                    </Box>
                )}
            </AnimatePresence>
        </Box>
    );
};
