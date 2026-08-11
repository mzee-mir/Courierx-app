import React from 'react';
import { Box, Typography, Paper, Chip, Button, IconButton, Divider, Grid } from '@mui/material';
import {
    ChevronLeft, Fingerprint, History, MapPin,
    Package, Printer, ShieldCheck, Search,
    ShieldAlert
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { WeightKeypad } from '../../components/ui/WeightKeypad';
import { PhotoUploader } from '../../components/ui/PhotoUploader';
import { ThermalLabel } from '../../components/ui/ThermalLabel';


export const ShipmentConsoleMobile = (props: any) => {
    const navigate = useNavigate();
    const { auth, weight, setWeight, handleExecute, isLocked, setEvidenceRefs } = props;
    const { shipment, metadata, physicalControlName, allowed, activity, lockReason } = auth;


    // Identify the primary action
    const currentAction = allowed[0];


    // 🔒 Security Check: Is this a "Loose" item or part of a batch?
    const isFrozen = shipment.isFlagged;
    const isBatched = !!shipment.manifestId && shipment.status === 'CONSOLIDATED';


    return (
        <Box sx={{ p: 2, pb: 15, display: 'flex', flexDirection: 'column', gap: 3 }}>


            {/* 1. TACTICAL HEADER */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton onClick={() => navigate(-1)} sx={{ color: 'text.secondary' }}>
                    <ChevronLeft size={20} />
                </IconButton>
                <Typography variant="caption" sx={{ fontWeight: 900, letterSpacing: '0.1em' }}>
                    CONSOLE / {shipment.status}
                </Typography>
            </Box>


            {/* 2. IDENTITY & SPECS CARD */}
            <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2.5 }}>
                    <Box>
                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Fingerprint size={12} /> REF_ID
                        </Typography>
                        <Typography variant="h5" sx={{ fontFamily: 'monospace', fontWeight: 900 }}>
                            {shipment.externalTrackingNumber}
                        </Typography>
                    </Box>
                    <Chip label={shipment.transportMode} size="small" sx={{ fontWeight: 900, height: 20 }} />
                </Box>


                {/* METADATA GRID */}
                <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}><MetaItem label="CATEGORY" value={metadata.description} /></Grid>
                    <Grid size={{ xs: 6 }}><MetaItem label="INTAKE_WT" value={`${metadata.weight}kg`} /></Grid>
                    <Grid size={{ xs: 6 }}><MetaItem label="DESTINATION" value={metadata.destination} /></Grid>
                    <Grid size={{ xs: 6 }}><MetaItem label="HUB" value={physicalControlName} /></Grid>
                </Grid>


                <Divider sx={{ my: 2, opacity: 0.05 }} />


                {/* REPRINT UTILITY */}
                <Button
                    fullWidth
                    startIcon={<Printer size={18} />}
                    onClick={() => window.print()}
                    sx={{ color: 'primary.main', fontWeight: 900, fontSize: '0.7rem', justifyContent: 'flex-start' }}
                >
                    Reprint CourierX Label
                </Button>
            </Paper>


            {/*  FORENSIC EVIDENCE GALLERY (NEW) --- */}
            {shipment.hasPhotos && shipment.intakePhotos?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', ml: 1, letterSpacing: '0.1em' }}>
                        FILED_EVIDENCE_LOGS ({shipment.intakePhotos.length})
                    </Typography>


                    <Box sx={{ display: 'flex', gap: 1.5, mt: 1, overflowX: 'auto', pb: 1, px: 0.5 }} className="scrollbar-hide">
                        {shipment.intakePhotos.map((photo: any, index: number) => (
                            <Paper
                                key={index}
                                elevation={0}
                                onClick={() => window.open(photo.url, '_blank')}
                                sx={{
                                    minWidth: '160px',
                                    height: '160px',
                                    borderRadius: '20px',
                                    overflow: 'hidden',
                                    border: '2px solid rgba(255,255,255,0.05)',
                                    bgcolor: '#000',
                                    position: 'relative'
                                }}
                            >
                                <img
                                    src={photo.url}
                                    alt="Forensic Evidence"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 1, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                                    <Typography sx={{ fontSize: '0.5rem', color: 'white', fontWeight: 900 }}>
                                        {format(new Date(photo.uploadedAt), 'MMM dd, HH:mm')}
                                    </Typography>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                </Box>
            )}


            {/* 3. DYNAMIC ACTION PANEL (Security Aware) */}
            <Paper sx={{
                p: 4, borderRadius: '32px', bgcolor: '#000', border: '1px solid',
                borderColor: currentAction && !isBatched ? 'primary.main' : 'rgba(255,255,255,0.05)'
            }}>
                {/* If the item is in a manifest, block individual actions */}
                {isFrozen ? (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                        <ShieldAlert size={48} color="#FF3B30" style={{ marginBottom: '16px', filter: 'drop-shadow(0 0 10px rgba(255,59,48,0.3))' }} />
                        <Typography variant="h6" sx={{ fontWeight: 900, color: '#FF3B30', mb: 1 }}>SHIPMENT_FROZEN</Typography>
                        <Typography variant="caption" sx={{ display: 'block', color: 'white', fontWeight: 700, mb: 2 }}>
                            REASON: {shipment.exceptionType?.replace(/_/g, ' ')}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', opacity: 0.6, px: 2 }}>
                            Security integrity check failed. This shipment requires managerial intervention in the "Exceptions" tab before it can be released.
                        </Typography>
                    </Box>
                ) : isBatched ? (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Package size={48} color="#0052FF" style={{ marginBottom: '16px', opacity: 0.3 }} />
                        <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>BATCH_LOCK_ACTIVE</Typography>
                        <Typography variant="caption" sx={{ display: 'block', opacity: 0.6 }}>
                            This item is locked inside Manifest {shipment.manifestId.slice(-6)}.
                            Individual transitions are disabled.
                        </Typography>
                    </Box>
                ) : currentAction ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, textAlign: 'center' }}>{currentAction.label}</Typography>


                        {currentAction.requires.includes('arrivalWeight') && (
                            <WeightKeypad label="VERIFY_KG" value={weight} onChange={setWeight} onConfirm={() => { }} />
                        )}


                        {currentAction.requires.includes('photos') && (
                            <PhotoUploader shipmentId={shipment.id} onUploadComplete={setEvidenceRefs} maxPhotos={1} />
                        )}


                        <Button
                            fullWidth variant="contained" size="large"
                            disabled={isLocked || (currentAction.requires.includes('arrivalWeight') && !weight)}
                            onClick={() => handleExecute(currentAction.code, currentAction.requires)}
                            sx={{ py: 2, borderRadius: '16px', fontWeight: 900 }}
                        >
                            Authorize Transaction
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ textAlign: 'center', py: 2, opacity: 0.2 }}>
                        <ShieldCheck size={48} style={{ margin: '0 auto 16px' }} />
                        <Typography variant="button" sx={{ fontWeight: 900 }}>{lockReason || 'READ_ONLY_ACCESS'}</Typography>
                    </Box>
                )}
            </Paper>


            {/* 4. FORENSIC AUDIT LEDGER */}
            <Box sx={{ px: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <History size={16} /> IMMUTABLE_AUDIT_LEDGER
                </Typography>
                <Box sx={{ borderLeft: '1px solid rgba(255,255,255,0.05)', ml: 1, pl: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {activity.map((log: any) => (
                        <Box key={log._id}>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>{log.newStatus}</Typography>
                            <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                                {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                            </Typography>
                            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', mt: 0.5, fontStyle: 'italic' }}>&gt; {log.notes}</Typography>
                        </Box>
                    ))}
                </Box>
            </Box>


            {/* HIDDEN PRINT COMPONENT */}
            <ThermalLabel data={{
                trackingId: shipment.externalTrackingNumber,
                weight: shipment.intake_weight,
                mode: shipment.transportMode,
                destination: shipment.dropoffLandmark,
                category: shipment.itemDescription,
                cxCode: metadata?.packageCode || shipment.packageCode || "N/A",
                phone: metadata?.customerPhone || "NO_PHONE",
                cbm: shipment.calculatedCBM?.toString() || "0.000",
                dims: shipment.dimensions ? {
                    l: String(shipment.dimensions.length || '0'),
                    w: String(shipment.dimensions.width || '0'),
                    h: String(shipment.dimensions.height || '0')
                } : null
            }} />
        </Box>
    );
};


// Internal Helper
const MetaItem = ({ label, value }: any) => (
    <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, fontSize: '0.55rem', display: 'block' }}>{label}</Typography>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'white' }}>{value || '---'}</Typography>
    </Box>
);
