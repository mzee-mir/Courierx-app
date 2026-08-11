import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Grid,
  LinearProgress, IconButton, Alert, alpha,
  Chip
} from '@mui/material';
import {
  Activity, Lock, AlertCircle, Package,
  Ship, CheckCircle2, History, Target,
  RefreshCcw, User, Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import api from '../api/axios';
import { useFloorActivity } from '../hooks/useFloorActivity';


// --- CONFIG: STATUS THEMEING ---
const ORG_STATUS_STYLE = {
  ACTIVE: { color: '#10b981', bg: 'rgba(16,185,129,0.05)', icon: <Activity size={18} /> },
  LIMITED: { color: '#f59e0b', bg: 'rgba(245,158,11,0.05)', icon: <AlertCircle size={18} /> },
  SUSPENDED: { color: '#ef4444', bg: 'rgba(239,68,68,0.05)', icon: <Lock size={18} /> }
};


export const Dashboard = () => {
  const { activities } = useFloorActivity();

  const { data: response, isLoading, refetch } = useQuery({
    queryKey: ['dashboardBriefing'],
    queryFn: async () => {
      const res = await api.get('/partner/dashboard/pulse');
      return res.data.data;
    },
    refetchInterval: 60000
  });


  // --- DEFENSIVE DEFAULTS ---
  const {
    org = { name: 'Terminal Offline', status: 'SUSPENDED', locationCount: 0, dailyIntakeTarget: 100 },
    actionRequired = [],
    blocked = [],
    stats = { atLocations: 0, inTransit: 0, completed24h: 0, intakeToday: 0 }
  } = response || {};


  const orgStyle = ORG_STATUS_STYLE[org.status as keyof typeof ORG_STATUS_STYLE] || ORG_STATUS_STYLE.SUSPENDED;
  const intakeTarget = org?.dailyIntakeTarget || 100;
  const intakeToday = stats?.intakeToday || 0;


  // Progress Calculation
  const progressValue = (intakeToday / intakeTarget) * 100;
  const intakeProgress = isNaN(progressValue) ? 0 : Math.min(progressValue, 100);
  if (isLoading) return <Box sx={{ p: 4, fontFamily: 'monospace', opacity: 0.5 }}>RESYNCING_NODE_PULSE...</Box>;


  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3, pb: 12 }}>

      {/* A. GLOBAL AUTHORITY BANNER */}
      <Box sx={{
        bgcolor: orgStyle.bg, border: `1px solid ${orgStyle.color}33`,
        p: 2, borderRadius: '16px', display: 'flex', alignItems: 'center', gap: 2
      }}>
        <Box sx={{ color: orgStyle.color }}>{orgStyle.icon}</Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 900, color: 'white' }}>{org.name}</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: orgStyle.color, display: 'block', fontSize: '0.65rem' }}>
            {org.status} // {org.locationCount} NODES_AUTHORIZED
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => refetch()} sx={{ color: 'rgba(255,255,255,0.2)' }}>
          <RefreshCcw size={16} />
        </IconButton>
      </Box>


      {/* B. SHIFT PROGRESS GAUGE */}
      <Paper elevation={0} sx={{ p: 4, borderRadius: '32px', bgcolor: '#000', border: '1px solid rgba(255,255,255,0.05)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900, letterSpacing: '0.1em' }}>SHIFT_QUOTA_INTEGRITY</Typography>
            <Typography variant="h3" sx={{ fontWeight: 900, fontFamily: 'monospace' }}>
              {intakeToday}<span style={{ color: '#222' }}> / {intakeTarget}</span>
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.main' }}>
              {intakeProgress.toFixed(0)}%
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>COMPLETE</Typography>
          </Box>
        </Box>
        <Box sx={{ height: 10, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 5, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${intakeProgress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ height: '100%', backgroundColor: '#0052FF', boxShadow: '0 0 15px rgba(0,82,255,0.5)' }}
          />
        </Box>
      </Paper>


      <Grid container spacing={2}>
        {/* C. QUICK STATS */}
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="ON_FLOOR" value={stats.atLocations} icon={<Package size={14} />} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="IN_TRANSIT" value={stats.inTransit} icon={<Ship size={14} />} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="READY_HANDOFF" value={actionRequired.filter((s: any) => s.actionType === 'HANDOFF').length} icon={<CheckCircle2 size={14} />} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="DONE_24H" value={stats.completed24h} icon={<History size={14} />} /></Grid>


        {/* D. LIVE ACTIVITY FEED (WITH BEEP) */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={0} sx={{
            p: 3, borderRadius: '32px', bgcolor: 'rgba(255,255,255,0.01)',
            border: '1px solid rgba(255,255,255,0.05)', height: '480px', display: 'flex', flexDirection: 'column'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: '0.2em' }}>
                LIVE_TERMINAL_FEED
              </Typography>
              <Chip label="SOCKET_ACTIVE" size="small" sx={{ height: 16, fontSize: '0.5rem', fontWeight: 900, bgcolor: 'rgba(0,82,255,0.1)', color: 'primary.main' }} />
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }} className="scrollbar-hide">
              <AnimatePresence initial={false}>
                {activities.length === 0 ? (
                  <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, fontStyle: 'Italic' }}>LISTENING_FOR_EVENTS...</Typography>
                  </Box>
                ) : activities.map((log, i) => (
                  <motion.div
                    key={log.timestamp + i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-3"
                  >
                    <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '16px', borderLeft: '3px solid #0052FF' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 900, color: 'white' }}>
                          {log.trackingId} // <span style={{ color: '#666' }}>{log.customerName}</span>
                        </Typography>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'text.secondary' }}>
                          {format(new Date(log.timestamp), 'HH:mm:ss')}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.6rem', color: 'primary.main', fontWeight: 800, textTransform: 'uppercase' }}>
                        {log.status.replace(/_/g, ' ')} <span style={{ color: '#444' }}>| OP: {log.staffName}</span>
                      </Typography>
                    </Box>
                  </motion.div>
                ))}
              </AnimatePresence>
            </Box>
          </Paper>
        </Grid>


        {/* E. BLOCKED INVENTORY LIST */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={0} sx={{
            p: 3, borderRadius: '32px', bgcolor: 'rgba(255,59,48,0.02)',
            border: '1px solid rgba(255,59,48,0.1)', height: '480px', display: 'flex', flexDirection: 'column'
          }}>
            <Typography variant="caption" sx={{ fontWeight: 900, color: 'error.main', mb: 3, letterSpacing: '0.2em' }}>
              BLOCKED_INVENTORY
            </Typography>

            <Box sx={{ spaceY: 2 }}>
              {blocked.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 10, opacity: 0.2 }}>
                  <CheckCircle2 size={40} style={{ margin: '0 auto 12px' }} />
                  <Typography variant="caption" sx={{ fontWeight: 900 }}>ALL_CLEAR</Typography>
                </Box>
              ) : blocked.map((s: any) => (
                <Box key={s.id} sx={{ p: 2, bgcolor: 'rgba(255,59,48,0.05)', borderRadius: '12px', border: '1px solid rgba(255,59,48,0.1)' }}>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 800, color: 'error.main' }}>
                    {s.externalTrackingNumber}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,59,48,0.6)', fontWeight: 700 }}>
                    LOCK_REASON: {s.exceptionType}
                  </Typography>
                </Box>
              ))}
            </Box>


            <Box sx={{ mt: 'auto', p: 2, bgcolor: 'rgba(255,59,48,0.1)', borderRadius: '16px', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: 'error.main' }}>
                ACTION_REQUIRED: CONTACT COURIERX ADMIN
              </Typography>
            </Box>
          </Paper>
        </Grid>


      </Grid>
    </Box>
  );
};


// --- SUB-COMPONENT: TACTICAL STAT CARD ---
const StatCard = ({ label, value, icon }: { label: string, value: number, icon: any }) => (
  <Paper elevation={0} sx={{
    p: 2, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)'
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'text.secondary' }}>
      {icon}
      <Typography sx={{ fontSize: '0.6rem', fontWeight: 900 }}>{label}</Typography>
    </Box>
    <Typography variant="h5" sx={{ fontWeight: 900, color: 'white' }}>{value}</Typography>
  </Paper>
);
