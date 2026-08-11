import React from 'react';
import { useMediaQuery, useTheme, Box, CircularProgress } from '@mui/material';
import { useFinanceLogic } from '../hooks/useFinanceLogic';
import { FinanceMobile } from '../pages/view/financeMobile';
import { FinanceTerminalDesktop } from '../pages/settings/FinanceTerminal';


export const FinanceTerminal = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = useFinanceLogic();


    if (logic.isLoading) return (
        <Box sx={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
        </Box>
    );


    return isMobile ? <FinanceMobile {...logic} /> : <FinanceTerminalDesktop {...logic} />;
};