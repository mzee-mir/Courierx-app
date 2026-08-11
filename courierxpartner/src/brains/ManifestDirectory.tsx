import React from 'react';
import { useMediaQuery, useTheme, Box, CircularProgress, Typography } from '@mui/material';
import { ManifestDirectoryMobile } from '../pages/view/manifestDirectoryMobile';
import { ManifestDirectoryDesktop } from '../pages/manifests/ManifestDirectory';
import { useManifestDirectoryLogic } from '../hooks/useManifestDirectoryLogic';




export const ManifestDirectory = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = useManifestDirectoryLogic();


    if (logic.isLoading) return (
        <Box sx={{ p: 10, textAlign: 'center' }}>
            <CircularProgress size={30} thickness={5} />
            <Typography variant="caption" sx={{ display: 'block', mt: 2, fontFamily: 'monospace' }}>
                SYNCHRONIZING_MANIFEST_LEDGER...
            </Typography>
        </Box>
    );


    return isMobile ? <ManifestDirectoryMobile {...logic} /> : <ManifestDirectoryDesktop />;
};
