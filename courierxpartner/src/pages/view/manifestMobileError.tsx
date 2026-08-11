import React from 'react';
import { Box, Typography, Button, Paper, Divider } from '@mui/material';
import { AlertTriangle, RefreshCcw, ChevronLeft, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


export const ManifestMobileError = ({ error, refetch }: any) => {
    const navigate = useNavigate();


    // Extract error message from your Backend's Hardened Error structure
    const errorMessage = error?.response?.data?.message || "COMMUNICATION_LINK_FAILURE";
    const errorCode = error?.response?.data?.error || "NODE_UNREACHABLE";
    const traceId = error?.response?.data?.traceId || "N/A";


    return (
        <Box sx={{ p: 3, height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#000', justifyContent: 'center', textAlign: 'center' }}>


            <Box sx={{ mb: 4 }}>
                <Box sx={{
                    width: 80, height: 80, bgcolor: 'rgba(255,59,48,0.1)',
                    borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', mx: 'auto', mb: 2, border: '2px solid #FF3B30'
                }}>
                    <ShieldAlert size={40} color="#FF3B30" />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: 'white', mb: 1 }}>
                    DATA_SYNC_ERROR
                </Typography>
                <Typography variant="caption" sx={{ color: '#FF3B30', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                    CODE: {errorCode}
                </Typography>
            </Box>


            <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', mb: 4 }}>
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', fontWeight: 700, mb: 2 }}>
                    {errorMessage}
                </Typography>
                <Divider sx={{ mb: 2, opacity: 0.05 }} />
                <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', display: 'block' }}>
                    TRACE_ID: {traceId}
                </Typography>
            </Paper>


            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                    fullWidth variant="contained"
                    onClick={() => refetch()}
                    startIcon={<RefreshCcw size={18} />}
                    sx={{ py: 2, borderRadius: '16px', fontWeight: 900, bgcolor: 'white', color: 'black' }}
                >
                    Retry Node Sync
                </Button>
                <Button
                    fullWidth variant="text"
                    onClick={() => navigate('/manifests/directory')}
                    startIcon={<ChevronLeft size={18} />}
                    sx={{ color: 'text.secondary', fontWeight: 800 }}
                >
                    Return to Directory
                </Button>
            </Box>


            <Box sx={{ mt: 'auto', opacity: 0.2 }}>
                <Typography sx={{ fontSize: '0.5rem', fontWeight: 900, fontFamily: 'monospace' }}>
                    COURIERX_TACTICAL_TERMINAL_v4.0
                </Typography>
            </Box>
        </Box>
    );
};
