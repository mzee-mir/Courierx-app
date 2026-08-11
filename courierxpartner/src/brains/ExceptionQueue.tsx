import React from 'react';
import { useMediaQuery, useTheme, Box, CircularProgress, Typography } from '@mui/material';
import { ExceptionMobile } from '../pages/view/ExceptionMobile';
import { ExceptionQueueDesktop } from '../pages/ExceptionQueue';
import { useExceptionLogic } from '../hooks/useExceptionLogic';


export const ExceptionQueue = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = useExceptionLogic();


    if (logic.isLoading) return (
        <Box sx={{ p: 10, textAlign: 'center' }}>
            <CircularProgress color="error" />
            <Typography variant="caption" sx={{ display: 'block', mt: 2, fontWeight: 900 }}>
                SCANNING_FOR_INTEGRITY_ERRORS...
            </Typography>
        </Box>
    );


    return isMobile ? <ExceptionMobile {...logic} /> : <ExceptionQueueDesktop />;
};
