import React from 'react';
import { useMediaQuery, useTheme, Box, CircularProgress, Typography } from '@mui/material';
import { useManifestBuilderLogic } from '../hooks/useManifestBuilderLogic';
import { ManifestBuilderDesktop } from '../pages/manifests/ManifestBuilder';
import { ManifestBuilderMobile } from '../pages/view/manifestBuilderMobile';


export const ManifestBuilder = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = useManifestBuilderLogic();


    if (logic.isLoading && !logic.draft) return (
        <Box sx={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <CircularProgress thickness={6} />
            <Typography variant="caption" sx={{ fontWeight: 900, fontFamily: 'monospace', opacity: 0.5 }}>CALIBRATING_BUILDER_DRAFT...</Typography>
        </Box>
    );


    return isMobile ? <ManifestBuilderMobile {...logic} /> : <ManifestBuilderDesktop {...logic} />;
};
