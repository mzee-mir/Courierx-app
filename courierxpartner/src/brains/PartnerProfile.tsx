import React from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import { PartnerProfileDesktop } from '../pages/settings/PartnerProfile';
import { PartnerProfileMobile } from '../pages/view/PartnerProfileMobile';
import { usePartnerProfileLogic } from '../hooks/usePartnerProfileLogic';


export const PartnerProfile = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = usePartnerProfileLogic();


    if (logic.isLoading) return <div style={{ padding: '40px', color: '#444' }}>LOADING_STOREFRONT...</div>;


    return isMobile ? <PartnerProfileMobile {...logic} /> : <PartnerProfileDesktop />;
};