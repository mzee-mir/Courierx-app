import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Box, Typography, Avatar, Button } from '@mui/material';
import { LogOut, ShieldAlert, Activity, Settings } from 'lucide-react';
import { PARTNER_NAV_ITEMS, PARTNER_OWNER_ITEMS } from '../config/partnerNavigation';
import { useAuthStore } from '../store/useAuthStore';
import { HeaderSearch } from '../components/HeaderSearch';
import { PermissionGuard } from '../auth/PermissionGuard';


export const DesktopPartnerLayout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();


  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100vw', bgcolor: '#050505', overflow: 'hidden' }}>


      {/* 1. SIDEBAR (Tactical & Scrollable) */}
      <Box sx={{
        width: 380,
        height: '100vh',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        p: 4,
        flexShrink: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        // Industrial Scrollbar Styling
        '&::-webkit-scrollbar': { width: '4px' },
        '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '10px' },
        '&:hover::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,0.1)' }
      }}>


        {/* LOGO SECTION */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 8, flexShrink: 0 }}>
          <Box sx={{ p: 1, bgcolor: 'primary.main', borderRadius: '14px', boxShadow: '0 8px 20px rgba(0,82,255,0.3)' }}>
            <ShieldAlert size={24} color="white" />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: 'white', tracking: '-0.04em' }}>
            PARTNER<span style={{ color: '#0052FF' }}>PORTAL</span>
          </Typography>
        </Box>


        {/* NAVIGATION ITEMS */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'rgba(220, 24, 24, 0.88)', fontWeight: 900, px: 2, mb: 1, letterSpacing: '0.2em' }}>
            OPERATIONS_FLOOR
          </Typography>


          {PARTNER_NAV_ITEMS.map((item) => (
            <PermissionGuard key={item.name} permission={(item as any).requiredPermission}>
              <NavLink to={item.href} style={{ textDecoration: 'none' }}>
                {({ isActive }) => (
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.5, borderRadius: '16px',
                    bgcolor: isActive ? 'rgba(0,82,255,0.1)' : 'transparent',
                    color: isActive ? 'primary.main' : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.2s', border: '1px solid',
                    borderColor: isActive ? 'rgba(0,82,255,0.1)' : 'transparent'
                  }}>
                    <item.icon size={20} strokeWidth={isActive ? 3 : 2} />
                    <Typography variant="body2" sx={{ fontWeight: isActive ? 800 : 500 }}>{item.name}</Typography>
                  </Box>
                )}
              </NavLink>
            </PermissionGuard>
          ))}


          {user?.roles.includes('partner_owner' as any) && (
            <>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontWeight: 900, px: 2, mt: 6, mb: 1, letterSpacing: '0.2em' }}>
                TERMINAL_GOVERNANCE
              </Typography>
              {PARTNER_OWNER_ITEMS.map((item) => (
                <PermissionGuard key={item.name} permission={(item as any).requiredPermission}>
                  <NavLink to={item.href} style={{ textDecoration: 'none' }}>
                    {({ isActive }) => (
                      <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.5, borderRadius: '16px',
                        color: isActive ? 'white' : 'rgba(255,255,255,0.4)',
                        bgcolor: isActive ? 'rgba(255,255,255,0.03)' : 'transparent'
                      }}>
                        <item.icon size={20} strokeWidth={2} />
                        <Typography variant="body2" sx={{ fontWeight: isActive ? 800 : 500 }}>{item.name}</Typography>
                      </Box>
                    )}
                  </NavLink>
                </PermissionGuard>
              ))}
            </>
          )}
        </Box>


        {/* FOOTER: LOGOUT */}
        <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <Button
            onClick={logout}
            startIcon={<LogOut size={16} />}
            sx={{
              color: 'rgba(255,255,255,0.3)',
              justifyContent: 'flex-start',
              px: 2,
              fontSize: '0.7rem',
              fontWeight: 900,
              '&:hover': { color: 'error.main' }
            }}
          >
            TERMINATE_SESSION
          </Button>
        </Box>
      </Box>


      {/* 2. HEADER & CANVAS SECTION */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>


        {/* TACTICAL HEADER */}
        <Box sx={{
          p: 3, px: 6, display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)',
          bgcolor: '#050505'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {/* HUB STATUS INDICATOR */}
            <Box sx={{
              px: 2, py: 1, bgcolor: 'rgba(255,255,255,0.01)', borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)', display: 'flex',
              alignItems: 'center', gap: 1.5
            }}>
              <Activity size={14} className="text-green-500" />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>
                SECURE_NODE: ACTIVE
              </Typography>
            </Box>


            {/* SEARCH COMPONENT */}
            <Box sx={{ width: '350px' }}>
              <HeaderSearch />
            </Box>
          </Box>


          {/* USER PROFILE SHORTCUT (NEW) */}
          <Box
            onClick={() => navigate('/my-settings')}
            sx={{
              display: 'flex', alignItems: 'center', gap: 2,
              cursor: 'pointer', p: 1, borderRadius: '16px',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' }
            }}
          >
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                {user?.displayName}
              </Typography>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.6rem' }}>
                {user?.roles[0].replace('_', ' ')}
              </Typography>
            </Box>


            <Avatar
              src={user?.imageUrl}
              sx={{
                bgcolor: 'primary.main',
                fontWeight: 900,
                borderRadius: '12px',
                width: 80,
                height: 80,
                border: '2px solid rgba(255,255,255,0.1)'
              }}
            >
              {user?.displayName.charAt(0)}
            </Avatar>
          </Box>
        </Box>


        {/* MAIN PAGE CONTENT */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
