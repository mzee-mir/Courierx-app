import React from 'react';
import { useMediaQuery, useTheme, Box, CircularProgress } from '@mui/material';
import { useInventoryLogic } from '../hooks/useInventoryLogic';
import { InventoryMobile } from '../pages/view/InventoryFloorMobile';
import { InventoryFloorDesktop } from '../pages/inventory/InventoryFloor';


export const InventoryFloor = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = useInventoryLogic();


    if (logic.isLoading && logic.items.length === 0) {
        return (
            <Box sx={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }


    return isMobile ? <InventoryMobile {...logic} /> : <InventoryFloorDesktop {...logic} />;
};