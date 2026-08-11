import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Paper, Grid, Button, Chip, Divider, CircularProgress, Alert } from '@mui/material';
import { AlertTriangle, ShieldAlert, CheckCircle, XCircle, ArrowRight, Camera } from 'lucide-react';
import { importService } from '../api/import.service';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';


export const ExceptionQueueDesktop = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();


    const { data: blocked, isLoading } = useQuery({
        queryKey: ['blockedInventory'],
        queryFn: importService.getBlockedInventory
    });


    const resolveMutation = useMutation({
        mutationFn: ({ id, action }: any) => importService.resolveException(id, {
            resolutionAction: action,
            notes: "Manager manual override."
        }),
        onSuccess: () => {
            toast.success('EXCEPTION_RESOLVED');
            queryClient.invalidateQueries({ queryKey: ['blockedInventory'] });
        }
    });


    if (isLoading) return <Box sx={{ p: 10, textAlign: 'center' }}><CircularProgress color="error" /></Box>;


    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 4, pb: 10 }}>
            {/* HEADER */}
            <Box>
                <Typography variant="h4" sx={{ fontWeight: 900, fontStyle: 'italic', color: '#FF3B30' }}>
                    EXCEPTION_<span style={{ color: 'white' }}>COMMAND_CENTER</span>
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                    {blocked?.length || 0} SHIPMENTS_REQUIRING_INTERVENTION
                </Typography>
            </Box>


            {blocked?.length === 0 && (
                <Alert severity="success" sx={{ borderRadius: '16px', bgcolor: 'rgba(16,185,129,0.05)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <Typography sx={{ fontWeight: 900 }}>ALL_SYSTEMS_NOMINAL: No blocked inventory detected.</Typography>
                </Alert>
            )}


            <Grid container spacing={2}>
                {blocked?.map((item: any) => {
                    const weightDelta = Math.abs((Number(item.intake_weight) || 0) - (Number(item.arrival_weight) || 0)).toFixed(2);


                    return (
                        <Grid size={{ xs: 12 }} key={item._id}>
                            <Paper sx={{
                                p: 3, borderRadius: '24px', bgcolor: 'rgba(255,59,48,0.02)',
                                border: '1px solid rgba(255,59,48,0.15)',
                                position: 'relative', overflow: 'hidden'
                            }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                                    <Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            <ShieldAlert size={18} color="#FF3B30" />
                                            <Typography sx={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1rem' }}>
                                                {item.externalTrackingNumber} // {item.packageCode || 'N/A'}
                                            </Typography>
                                        </Box>
                                        <Chip label={item.exceptionType} color="error" size="small" sx={{ fontWeight: 900, fontSize: '0.6rem' }} />
                                    </Box>


                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>STATUS</Typography>
                                        <Typography sx={{ fontWeight: 900, fontSize: '0.8rem' }}>{item.status}</Typography>
                                    </Box>
                                </Box>


                                <Grid container spacing={3} sx={{ mb: 3 }}>
                                    <Grid size={{ xs: 4 }}>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>INTAKE_WEIGHT</Typography>
                                        <Typography sx={{ fontWeight: 900 }}>{item.intake_weight}kg</Typography>
                                    </Grid>
                                    <Grid size={{ xs: 4 }}>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>ARRIVAL_WEIGHT</Typography>
                                        <Typography sx={{ fontWeight: 900, color: '#FF3B30' }}>{item.arrival_weight || '??'}kg</Typography>
                                    </Grid>
                                    <Grid size={{ xs: 4 }}>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>VARIANCE</Typography>
                                        <Typography sx={{ fontWeight: 900, color: '#FF3B30' }}>{weightDelta}kg</Typography>
                                    </Grid>
                                </Grid>


                                <Divider sx={{ mb: 3, borderColor: 'rgba(255,59,48,0.1)' }} />


                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button
                                        fullWidth variant="contained" color="success"
                                        startIcon={<CheckCircle size={18} />}
                                        onClick={() => resolveMutation.mutate({ id: item._id, action: 'RELEASE' })}
                                        sx={{ borderRadius: '12px', fontWeight: 900 }}
                                    >
                                        Force Release
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<Camera size={18} />}
                                        onClick={() => navigate(`/shipments/${item._id}`)}
                                        sx={{ borderRadius: '12px', fontWeight: 900, color: 'white', borderColor: 'rgba(255,255,255,0.1)' }}
                                    >
                                        View Evidence
                                    </Button>
                                    <Button
                                        variant="contained" color="error"
                                        startIcon={<XCircle size={18} />}
                                        onClick={() => resolveMutation.mutate({ id: item._id, action: 'CANCEL' })}
                                        sx={{ borderRadius: '12px', fontWeight: 900 }}
                                    >
                                        Void
                                    </Button>
                                </Box>
                            </Paper>
                        </Grid>
                    );
                })}
            </Grid>
        </Box>
    );
};
