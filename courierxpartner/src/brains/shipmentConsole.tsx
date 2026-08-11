import React from 'react';
import { useMediaQuery, useTheme, Box, CircularProgress, Typography } from '@mui/material';
import { ShipmentConsoleMobile } from '../pages/view/shipmentConsoleMobile';
import { ShipmentConsoleDesktop } from '../pages/shipments/ShipmentConsole';
import { useShipmentConsoleLogic } from '../hooks/useShipmentConsoleLogic';




export const ShipmentConsole = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = useShipmentConsoleLogic();


    if (logic.isLoading) return (
        <Box sx={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <CircularProgress thickness={6} />
            <Typography variant="caption" sx={{ fontWeight: 900, fontFamily: 'monospace', opacity: 0.5 }}>SYNCHRONIZING_CUSTODY_NODE...</Typography>
        </Box>
    );


    if (logic.isError) return <Typography color="error">Data Link Failure</Typography>;


    return isMobile ? <ShipmentConsoleMobile {...logic} /> : <ShipmentConsoleDesktop />;
};
