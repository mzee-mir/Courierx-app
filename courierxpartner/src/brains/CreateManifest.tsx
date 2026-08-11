import React from 'react';
import { useMediaQuery, useTheme, Box, CircularProgress } from '@mui/material';
import { CreateManifestMobile } from '../pages/view/createManifestMobile';
import { CreateManifestDesktop } from '../pages/manifests/CreateManifest';
import { useCreateManifestLogic } from '../hooks/useCreateManifestLogic';


export const CreateManifest = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = useCreateManifestLogic();


    if (logic.isLoading && logic.floorItems.length === 0) return <Box sx={{ p: 10, textAlign: 'center' }}><CircularProgress /></Box>;


    return isMobile ? <CreateManifestMobile {...logic} /> : <CreateManifestDesktop />;
};
