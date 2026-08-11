import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Paper, CircularProgress, TextField, InputAdornment, Grid } from '@mui/material';
import { Search, Calendar, Activity, X } from 'lucide-react';
import { format } from 'date-fns';
import { staffService } from '../api/staff.service';


export const AuditTrailDesktop = () => {
    // --- FILTER STATE ---
    const [filters, setFilters] = useState({
        search: '',
        start: '',
        end: ''
    });


    const { data: logs, isLoading } = useQuery({
        queryKey: ['orgAuditTrail', filters], // 👈 Re-fetch when filters change
        queryFn: () => staffService.getOrgAuditTrail(filters),
    });


    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3, pb: 10 }}>
            {/* HEADER */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 900, fontStyle: 'italic' }}>
                        AUDIT_<span style={{ color: '#0052FF' }}>TRAIL</span>
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                        FORENSIC_NODE_HISTORY
                    </Typography>
                </Box>
            </Box>


            {/* TACTICAL FILTER BAR */}
            <Paper elevation={0} sx={{
                p: 2, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)'
            }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="SEARCH_TRACK_ID..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value.toUpperCase() })}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment>,
                                sx: { fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 900 }
                            }}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                        <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="START_DATE"
                            InputLabelProps={{ shrink: true }}
                            value={filters.start}
                            onChange={(e) => setFilters({ ...filters, start: e.target.value })}
                            sx={dateInputStyle}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                        <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="END_DATE"
                            InputLabelProps={{ shrink: true }}
                            value={filters.end}
                            onChange={(e) => setFilters({ ...filters, end: e.target.value })}
                            sx={dateInputStyle}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 2 }}>
                        <Typography
                            onClick={() => setFilters({ search: '', start: '', end: '' })}
                            sx={{
                                cursor: 'pointer', color: 'error.main', fontSize: '0.6rem',
                                fontWeight: 900, textAlign: 'center', '&:hover': { opacity: 0.8 }
                            }}
                        >
                            RESET_FILTERS
                        </Typography>
                    </Grid>
                </Grid>
            </Paper>


            {/* LOG FEED */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {isLoading ? (
                    <Box sx={{ textAlign: 'center', py: 10 }}><CircularProgress size={24} /></Box>
                ) : logs?.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 10, opacity: 0.2 }}>
                        <Activity size={48} style={{ margin: '0 auto 16px' }} />
                        <Typography variant="button" sx={{ fontWeight: 900 }}>NO_LOGS_FOUND_FOR_CRITERIA</Typography>
                    </Box>
                ) : logs?.map((log: any) => (
                    <Paper key={log._id} sx={{
                        p: 2.5, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 2
                    }}>
                        <Box sx={{ p: 1, bgcolor: 'rgba(0,82,255,0.1)', borderRadius: '10px', height: 'fit-content' }}>
                            <Activity size={18} className="text-[#0052FF]" />
                        </Box>


                        <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: 'white' }}>
                                    {log.newStatus.replace(/_/g, ' ')}
                                </Typography>
                                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'text.secondary' }}>
                                    {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                                </Typography>
                            </Box>


                            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, display: 'block', mb: 0.5, fontSize: '0.6rem' }}>
                                REF: {log.importRequestId?.externalTrackingNumber || 'SYSTEM_ACTION'}
                            </Typography>


                            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', fontFamily: 'monospace' }}>
                                &gt; {log.notes}
                            </Typography>
                        </Box>
                    </Paper>
                ))}
            </Box>
        </Box>
    );
};


const dateInputStyle = {
    '& .MuiInputBase-input': { fontSize: '0.7rem', fontWeight: 800 },
    '& .MuiInputLabel-root': { fontSize: '0.6rem', fontWeight: 900, color: 'text.secondary' }
};
