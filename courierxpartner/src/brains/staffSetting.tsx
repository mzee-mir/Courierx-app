import React from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import { StaffSettingsMobile } from '../pages/view/staffSettingMobile';
import { StaffSettingsDesktop } from '../pages/settings/staffSettings';
import { useStaffSettingsLogic } from '../hooks/useStaffSettingsLogic';


export const StaffSettings = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const logic = useStaffSettingsLogic();


    return isMobile ? <StaffSettingsMobile {...logic} /> : <StaffSettingsDesktop {...logic} />;
};
