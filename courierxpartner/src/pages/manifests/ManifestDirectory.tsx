import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Chip, Button, Grid, CircularProgress } from '@mui/material'; // 👈 FIX: Use Grid2
import { ClipboardList, Plus, Plane, Ship } from 'lucide-react';
import { format } from 'date-fns';
import { importService } from '../../api/import.service';


export const ManifestDirectoryDesktop = () => {
  const navigate = useNavigate();


  const { data: manifests, isLoading, isError } = useQuery({
    queryKey: ['manifestsList'],
    queryFn: importService.getManifestsDirectory
  });


  if (isLoading) return <Box sx={{ p: 10, textAlign: 'center' }}><CircularProgress size={24} color="primary" /></Box>;
  if (isError) return <Box sx={{ p: 4, color: 'error.main' }}>Failed to synchronize manifest ledger.</Box>;


  return (
    <Box sx={{ p: { xs: 2, md: 4 }, pb: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.05em' }}>
            MANIFEST_<span style={{ color: '#0052FF' }}>LEDGER</span>
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
            BATCH_CONSOLIDATION_TRACKER
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => navigate('/inventory')}
          startIcon={<Plus size={18} />}
          sx={{ borderRadius: '14px', fontWeight: 900, background: 'white', color: 'black', '&:hover': { bgcolor: '#eee' } }}
        >
          New Batch
        </Button>
      </Box>


      {/* ACTIVE CARDS */}
      <Grid container spacing={2}>
        {!manifests || manifests.length === 0 ? (
          <Box sx={{ p: 10, width: '100%', textAlign: 'center', opacity: 0.2 }}>
            <ClipboardList size={48} style={{ margin: '0 auto 16px' }} />
            <Typography variant="button" sx={{ fontWeight: 900 }}>NO_ACTIVE_MANIFESTS</Typography>
          </Box>
        ) : manifests.map((m: any) => (
          /* 👈 FIX: Size={6} for MUI v7 Desktop columns */
          <Grid size={{ xs: 12, md: 6 }} key={m.id}>
            <Paper
              onClick={() => {
                const manifestId = m.id || m._id;
                if (!manifestId) {
                  console.error("MANIFEST_ID_MISSING", m);
                  return;
                }
                navigate(`/manifests/${manifestId}`);
              }}
              elevation={0}
              sx={{
                p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer', transition: 'all 0.2s ease',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: '#0052FF' }
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ p: 1, bgcolor: 'rgba(0,82,255,0.1)', borderRadius: '8px', color: '#0052FF' }}>
                    {m.shippingMode === 'AIR' ? <Plane size={18} /> : <Ship size={18} />}
                  </Box>
                  <Typography sx={{ fontFamily: 'monospace', fontWeight: 900 }}>{m.manifestCode}</Typography>
                </Box>
                <Chip
                  label={m.status}
                  size="small"
                  sx={{ fontSize: '0.6rem', fontWeight: 900, bgcolor: 'rgba(255,255,255,0.1)' }}
                />
              </Box>


              <Box sx={{ display: 'flex', gap: 3 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>UNITS</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{m.shipmentIds?.length || 0} PCS</Typography>
                </Box>
                <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, display: 'block' }}>UPDATED</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    {/* 👈 FIX: Ensure updatedAt exists before formatting */}
                    {m.updatedAt ? format(new Date(m.updatedAt), 'MMM dd, HH:mm') : 'NO_DATE'}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
