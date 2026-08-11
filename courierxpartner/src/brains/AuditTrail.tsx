import React from 'react';
import { useMediaQuery, useTheme, Box, CircularProgress, Typography } from '@mui/material';
import { InventoryMobile } from '../pages/view/AuditTrailMobile';
import { AuditTrailDesktop } from '../pages/History';
import { useAuditTrailLogic } from '../hooks/useAuditTrailLogic';


export const AuditTrail = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = useAuditTrailLogic();


    if (logic.isLoading && logic.logs.length === 0) return (
        <Box sx={{ p: 10, textAlign: 'center' }}>
            <CircularProgress size={30} thickness={5} />
            <Typography variant="caption" sx={{ display: 'block', mt: 2, fontWeight: 900, fontFamily: 'monospace' }}>
                DECRYPTING_NODE_LOGS...
            </Typography>
        </Box>
    );


    return isMobile ? <InventoryMobile {...logic} /> : <AuditTrailDesktop />;
};
