import React from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import { useIntakeLogic } from '../hooks/useIntakeLogic';
import { IntakeMobile } from '../pages/view/IntakeScanMobile';
import { IntakeScannerDesktop } from '../pages/shipments/IntakeScanner';


export const IntakeScanner = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = useIntakeLogic();


    return isMobile ? <IntakeMobile {...logic} /> : <IntakeScannerDesktop />;
};
