import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Avatar, IconButton, Grid, Paper, Button } from '@mui/material';
import {
  LogOut, Wifi, MapPin, Grid as GridIcon,
  X, ChevronRight, LayoutDashboard, Scan,
  Package, Truck, Landmark, ShieldAlert,
  UserCog, Building2, Users, History, ClipboardList
} from 'lucide-react';
import { MOBILE_CORE_NAV, MOBILE_SECONDARY_NAV } from '../config/partnerNavigation';
import { useAuthStore } from '../store/useAuthStore';
import { HeaderSearch } from '../components/HeaderSearch';
import { motion, AnimatePresence } from 'framer-motion';
import { PermissionGuard } from '../auth/PermissionGuard';


export const MobilePartnerLayout = () => {
  const { user, logout } = useAuthStore();
  const [isHubOpen, setIsHubOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();


  const toggleHub = () => setIsHubOpen(!isHubOpen);


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', bgcolor: '#000', overflow: 'hidden' }}>


      {/* 1. TACTICAL HEADER */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid rgba(255,255,255,0.05)', bgcolor: '#000', zIndex: 10 }}>
        <Avatar
          src={user?.imageUrl}
          onClick={() => navigate('/my-settings')}
          sx={{ bgcolor: 'primary.main', borderRadius: '8px', width: 34, height: 34, fontSize: '0.8rem', fontWeight: 900 }}
        >
          {user?.displayName.charAt(0)}
        </Avatar>
        <Box sx={{ flex: 1 }}><HeaderSearch /></Box>
        <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>
          <Wifi size={16} className="animate-pulse" />
        </Box>
      </Box>


      {/* 2. MAIN CONTENT AREA */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 0, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </Box>


      {/* 3. THE TACTICAL HUB OVERLAY (Slide Up) */}
      <AnimatePresence>
        {isHubOpen && (
          <Box
            component={motion.div}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            sx={{
              position: 'fixed', inset: 0, zIndex: 100,
              bgcolor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(15px)',
              p: 4, display: 'flex', flexDirection: 'column'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 900, fontStyle: 'italic' }}>TERMINAL_<span style={{ color: '#0052FF' }}>HUB</span></Typography>
              <IconButton onClick={toggleHub} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.05)' }}><X /></IconButton>
            </Box>


            <Grid container spacing={2}>
              {MOBILE_SECONDARY_NAV.map((item) => (
                <PermissionGuard key={item.name} permission={(item as any).requiredPermission}>
                  <Grid size={{ xs: 6 }} key={item.name}>
                    <Paper
                      onClick={() => { navigate(item.href); toggleHub(); }}
                      sx={{
                        p: 2.5, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1
                      }}
                    >
                      <item.icon size={24} color="#0052FF" />
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 900 }}>{item.name.toUpperCase()}</Typography>
                    </Paper>
                  </Grid>
                </PermissionGuard>
              ))}
            </Grid>


            <Button
              fullWidth variant="outlined" color="error"
              startIcon={<LogOut />}
              onClick={logout}
              sx={{ mt: 'auto', py: 2, borderRadius: '16px', fontWeight: 900 }}
            >
              TERMINATE_SESSION
            </Button>
          </Box>
        )}
      </AnimatePresence>


      {/* 4. THE 5-BUTTON CORE DOCK */}
      <Box sx={{
        p: 1.5, pb: 4, bgcolor: '#000',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        {MOBILE_CORE_NAV.slice(0, 2).map((item) => (
          <PermissionGuard key={item.name} permission={(item as any).requiredPermission}>
            <NavButton key={item.name} item={item} active={location.pathname === item.href} />
          </PermissionGuard>
        ))}


        {/* THE CENTER HUB TRIGGER */}
        <Box
          component={motion.div}
          whileTap={{ scale: 0.9 }}
          onClick={toggleHub}
          sx={{
            width: 56, height: 56, bgcolor: isHubOpen ? 'white' : 'primary.main',
            borderRadius: '18px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: isHubOpen ? 'black' : 'white',
            boxShadow: '0 0 20px rgba(0,82,255,0.4)', mt: -4, border: '4px solid #000'
          }}
        >
          {isHubOpen ? <X size={28} /> : <GridIcon size={28} />}
        </Box>


        {MOBILE_CORE_NAV.slice(2, 4).map((item) => (
          <PermissionGuard key={item.name} permission={(item as any).requiredPermission}>
            <NavButton key={item.name} item={item} active={location.pathname === item.href} />
          </PermissionGuard>
        ))}
      </Box>
    </Box>
  );
};


// --- SUB-COMPONENT: DOCK BUTTON ---
const NavButton = ({ item, active }: any) => {
  const navigate = useNavigate();
  return (
    <Box
      onClick={() => navigate(item.href)}
      component={motion.div}
      whileTap={{ scale: 0.9 }}
      sx={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 0.5,
        color: active ? 'primary.main' : 'rgba(255,255,255,0.2)',
        transition: 'color 0.2s'
      }}
    >
      <item.icon size={22} strokeWidth={active ? 3 : 2} />
      <Typography sx={{ fontSize: '0.55rem', fontWeight: 900 }}>{item.name.toUpperCase()}</Typography>
    </Box>
  );
};
