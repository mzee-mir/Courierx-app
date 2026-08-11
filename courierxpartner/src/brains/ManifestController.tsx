import React from 'react';
import { useMediaQuery, useTheme, CircularProgress, Box } from '@mui/material';
import { useManifestLogic } from '../hooks/useManifestLogic';
import { ManifestMobile } from '../pages/view/manifestControlMobile';
import { ManifestDesktop } from '../pages/manifests/ManifestControl';
import { ManifestMobileError } from '../pages/view/manifestMobileError';




export const ManifestControl = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = useManifestLogic();


    if (logic.isLoading) return (
        <Box sx={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
        </Box>
    );


    if (logic.isError && isMobile) {
        return <ManifestMobileError error={logic.error} refetch={logic.refetch} />;
    }


    // Branch the UI based on screen size
    return isMobile ? <ManifestMobile {...logic} /> : <ManifestDesktop {...logic} />;
};
