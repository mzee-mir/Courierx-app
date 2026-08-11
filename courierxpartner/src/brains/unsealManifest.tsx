import React from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import { UnsealMobile } from '../pages/view/unsealMobile';
import { UnsealManifestDesktop } from '../pages/manifests/UnsealManifest';
import { useUnsealLogic } from '../hooks/useUnsealLogic';




export const UnsealManifest = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = useUnsealLogic();


    if (logic.isLoading) return <div style={{ padding: '20px', color: '#444' }}>CALIBRATING_CHECKLIST...</div>;


    return isMobile ? <UnsealMobile {...logic} /> : <UnsealManifestDesktop />;
};
