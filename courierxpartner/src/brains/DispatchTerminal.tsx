import React from 'react';
import { useMediaQuery, useTheme, Box, CircularProgress } from '@mui/material';


import { DispatchTerminalDesktop } from '../pages/shipments/dispatchTerminal';
import { DispatchMobile } from '../pages/view/DispatchMobile';
import { useDispatchLogic } from '../hooks/useDispatchLogic';


export const DispatchTerminal = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = useDispatchLogic();


    if (logic.isLoading && logic.queue.length === 0) {
        return (
            <Box sx={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }


    return isMobile ? <DispatchMobile {...logic} /> : <DispatchTerminalDesktop {...logic} />;
};