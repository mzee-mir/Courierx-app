import React, { useEffect, useCallback } from 'react';
import { useMediaQuery, useTheme, Box } from '@mui/material';
import { Navigate, useLocation } from 'react-router-dom';
import { jwtDecode } from "jwt-decode";
import { useAuthStore } from '../store/useAuthStore';
import { MobilePartnerLayout } from './mobilePartnerLayout';
import { DesktopPartnerLayout } from './desktopPartnerLayout';
import { toast } from 'sonner';


export const PartnerLayout = () => {
  const { user, token, logout } = useAuthStore();
  const theme = useTheme();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));


  // --- 🔒 THE "INSTANT EJECT" LOGIC ---
  const checkTokenExpiry = useCallback(() => {
    if (!token) return;


    try {
      const decoded: any = jwtDecode(token);
      const currentTime = Date.now() / 1000; // Convert ms to seconds


      if (decoded.exp < currentTime) {
        console.warn("SECURITY_LOG: Token expired. Commencing auto-eject.");
        toast.error('SESSION_EXPIRED', { description: 'For your security, please log in again.' });
        logout(); // This clears localStorage and redirects via the 'if (!token)' check below
      }
    } catch (error) {
      console.error("Invalid token format detected.");
      logout();
    }
  }, [token, logout]);


  useEffect(() => {
    // 1. Run check on initial mount (when user first opens the app)
    checkTokenExpiry();


    // 2. ⚡️ THE SLEEP-MODE FIX: Listen for "Focus" events
    // This triggers the moment you open your laptop or switch back to this tab
    window.addEventListener('focus', checkTokenExpiry);


    // 3. Optional: Listen for "Visibility Change" (when you switch browser tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkTokenExpiry();
    });


    return () => {
      window.removeEventListener('focus', checkTokenExpiry);
      document.removeEventListener('visibilitychange', checkTokenExpiry);
    };
  }, [checkTokenExpiry]);


  // --- AUTH GUARD ---
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }


  return (
    <Box sx={{ height: '100dvh', width: '100vw', overflow: 'hidden', bgcolor: '#000' }}>
      {isMobile ? <MobilePartnerLayout /> : <DesktopPartnerLayout />}
    </Box>
  );
};