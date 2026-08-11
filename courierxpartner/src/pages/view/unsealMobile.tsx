import React from 'react';
import { Box, Typography, Paper, LinearProgress, Button, Modal, TextField, IconButton, CircularProgress } from '@mui/material';
import { CheckCircle2, Scan, X, Package, ShieldAlert } from 'lucide-react';
import { WeightKeypad } from '../../components/ui/WeightKeypad';
import { PhotoUploader } from '../../components/ui/PhotoUploader';


export const UnsealMobile = (props: any) => {
    const { manifest, progress, activeItem, setActiveItem } = props;


    // Safety: If manifest data hasn't loaded yet, show a loader
    if (!manifest) return <Box sx={{ p: 4, textAlign: 'center' }}><Typography>LOADING_MANIFEST...</Typography></Box>;


    return (
        <Box sx={{ p: 2, pb: 20, display: 'flex', flexDirection: 'column', gap: 3 }}>


            {/* 1. PROGRESS GAUGE */}
            <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'primary.main', color: 'white' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 900 }}>UNSEALING_PROGRESS</Typography>
                    <Typography sx={{ fontWeight: 900 }}>{progress.verified}/{progress.total}</Typography>
                </Box>
                <LinearProgress variant="determinate" value={(progress.verified / progress.total) * 100} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }} />
            </Paper>


            {/* 2. TACTICAL CHECKLIST */}
            <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 900, ml: 1, color: 'text.secondary' }}>CONTAINER_CONTENTS</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                    {manifest.shipmentIds?.map((s: any) => {
                        const isDone = s.status === 'READY_FOR_LOCAL_HANDOFF';
                        return (
                            <Paper
                                key={s._id || s.id}
                                onClick={() => !isDone && setActiveItem(s)}
                                sx={{
                                    p: 2, borderRadius: '16px', display: 'flex', justifyContent: 'space-between',
                                    bgcolor: isDone ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                                    border: '1px solid', borderColor: isDone ? '#10b981' : 'rgba(255,255,255,0.05)',
                                    opacity: isDone ? 0.5 : 1
                                }}
                            >
                                <Typography sx={{ fontFamily: 'monospace', fontWeight: 900 }}>{s.externalTrackingNumber}</Typography>
                                {isDone ? <CheckCircle2 color="#10b981" size={18} /> : <Scan color="#666" size={18} />}
                            </Paper>
                        );
                    })}
                </Box>
            </Box>


            {/* 3. FINALIZE BUTTON */}
            <Box sx={{ position: 'fixed', bottom: 100, left: 16, right: 16 }}>
                <Button
                    fullWidth variant="contained" size="large"
                    onClick={() => props.setIsFinalizing(true)}
                    sx={{ py: 2, borderRadius: '20px', fontWeight: 900, bgcolor: 'white', color: 'black', '&:hover': { bgcolor: '#eee' } }}
                >
                    Finalize & Release
                </Button>
            </Box>


            {/* VERIFICATION MODAL */}
            <Modal open={!!activeItem} onClose={() => setActiveItem(null)}>
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#000', p: 3, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 900 }}>
                            VERIFY: {activeItem?.externalTrackingNumber || '...'}
                        </Typography>
                        <IconButton onClick={() => setActiveItem(null)} sx={{ color: 'white' }}><X /></IconButton>
                    </Box>


                    {/* Content is only accessible if activeItem exists */}
                    {activeItem && (
                        <>
                            <WeightKeypad label="ARRIVAL_WEIGHT" value={props.weight} onChange={props.setWeight} onConfirm={() => { }} />


                            <Box sx={{ mt: 3 }}>
                                <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', ml: 1 }}>EVIDENCE_PHOTO (IF_DAMAGED)</Typography>
                                <PhotoUploader
                                    shipmentId={activeItem._id || activeItem.id}
                                    onUploadComplete={props.setEvidenceRefs}
                                    maxPhotos={1}
                                />
                            </Box>


                            <Button
                                fullWidth
                                variant="contained"
                                disabled={props.isVerifying || !props.weight}
                                sx={{ mt: 'auto', mb: 4, py: 2.5, borderRadius: '20px', fontWeight: 900 }}
                                onClick={() => props.executeVerify({
                                    trackingNumber: activeItem?.externalTrackingNumber, // 👈 Safety added
                                    arrivalWeight: parseFloat(props.weight),
                                    photos: props.evidenceRefs
                                })}
                            >
                                {props.isVerifying ? <CircularProgress size={24} color="inherit" /> : 'Confirm Item Verification'}
                            </Button>
                        </>
                    )}
                </Box>
            </Modal>
        </Box>
    );
};
