import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Button, Chip,
  Alert, AlertTitle, CircularProgress, IconButton, Divider
} from '@mui/material';
import {
  History, ChevronLeft, Plane, Ship,
  HardDrive, ShieldCheck, CheckCircle2,
  MapPin, ArrowRight, PackageOpen, Search,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import api from '../../api/axios';
import { useAuthStore } from '../../store/useAuthStore';


interface ManifestDesktopProps {
  auth: any;
  executeTransition: (code: string) => void;
  isTransitioning: boolean;
}


export const ManifestDesktop = ({ auth, executeTransition, isTransitioning }: ManifestDesktopProps) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { id } = useParams();


  // --- 🔒 TACTICAL AUTHORITY LOGIC ---
  const nodeContext = useMemo(() => {
    if (!auth || !user) return { canAction: false, isOrigin: false, isDest: false, label: 'GUEST' };


    const userLocations = user.assignedLocations.map(l => l.toString());
    const originId = auth.manifest.originHub._id || auth.manifest.originHub;
    const destId = auth.manifest.destinationHub._id || auth.manifest.destinationHub;


    const isOriginStaff = userLocations.includes(originId.toString());
    const isDestStaff = userLocations.includes(destId.toString());
    const isSuper = user.roles.includes('super_admin' as any);


    let canAction = false;
    const status = auth.manifest.status;


    if ((isOriginStaff || isSuper) && status === 'CONSOLIDATED') canAction = true;
    if ((isDestStaff || isSuper) && (status === 'DEPARTED' || status === 'ARRIVED')) canAction = true;


    return { canAction, isOrigin: isOriginStaff, isDest: isDestStaff, isSuper, hubName: isOriginStaff ? 'ORIGIN_NODE' : 'DESTINATION_NODE' };
  }, [auth, user]);


  // Note: Loading and Error states are handled by the parent ManifestControl.tsx
  if (!auth) return null;


  const { manifest, allowed = [], logs = [], calculatedTotalWeight = 0 } = auth;
  const currentAction = allowed[0];


  return (
    <Box sx={{ p: { xs: 2, md: 4 }, pb: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>


      {/* A. HEADER & BREADCRUMBS */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton onClick={() => navigate('/manifests/directory')} sx={{ color: 'text.secondary' }}>
          <ChevronLeft size={20} />
        </IconButton>
        <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', letterSpacing: '0.15em' }}>
          MANIFEST_LEAD / {nodeContext.hubName}
        </Typography>
      </Box>


      {/* B. TACTICAL TRANSIT VISUALIZER */}
      <Paper elevation={0} sx={{
        p: { xs: 2, md: 4 },
        borderRadius: '32px',
        bgcolor: 'rgba(255,255,255,0.01)',
        border: '1px solid rgba(255,255,255,0.05)',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Ambient Background Gradient for the lane */}
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(0,82,255,0.03) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />


        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <HubMarker label="ORIGIN" city={manifest.originHub.name} active={true} color="#0052FF" />


          <Box sx={{ flex: 1, mx: 6, position: 'relative' }}>
            {/* The Flight Path */}
            <Box sx={{ height: '2px', width: { xs: '2px', md: '100%' }, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '1px' }} />


            {/* The Pulsing Indicator */}
            <AnimatePresence>
              {manifest.status === 'DEPARTED' && (
                <motion.div
                  initial={{ left: '0%', opacity: 0 }}
                  animate={{ left: ['0%', '100%'], opacity: [0, 1, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  style={{ position: 'absolute', top: -12, color: '#0052FF', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  {manifest.shippingMode === 'AIR' ? <Plane size={24} /> : <Ship size={24} />}
                  <Typography sx={{ fontSize: '0.5rem', fontWeight: 900, mt: 0.5 }}>IN_TRANSIT</Typography>
                </motion.div>
              )}
              {(manifest.status === 'ARRIVED' || manifest.status === 'DISMANTLED') && (
                <Box sx={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '2px',
                  bgcolor: '#10b981', boxShadow: '0 0 15px rgba(16,185,129,0.4)'
                }} />
              )}
            </AnimatePresence>
          </Box>


          <HubMarker
            label="DESTINATION"
            city={manifest.destinationHub.name}
            active={manifest.status === 'ARRIVED' || manifest.status === 'DISMANTLED'}
            color="#10b981"
          />
        </Box>
      </Paper>


      {/* C. IDENTITY SECTION */}
      <Paper elevation={0} sx={{ p: 4, borderRadius: '32px', bgcolor: '#000', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900, letterSpacing: '0.1em' }}>ASSIGNED_BATCH_ID</Typography>
            <Typography variant="h3" sx={{ fontFamily: 'monospace', fontWeight: 900, letterSpacing: '-0.04em' }}>{manifest.manifestCode}</Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Chip label={manifest.status} size="small" color="primary" sx={{ fontWeight: 900, borderRadius: '6px', height: 20, fontSize: '0.6rem' }} />
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.disabled' }}>MODE: {manifest.shippingMode}</Typography>
            </Box>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900 }}>TOTAL_NET_WEIGHT</Typography>
            <Typography variant="h3" sx={{ fontWeight: 900, color: 'white' }}>
              {isNaN(Number(calculatedTotalWeight))
                ? '0.0'
                : Number(calculatedTotalWeight).toFixed(1)}
              <span style={{ fontSize: '1.2rem', color: '#444', marginLeft: '4px' }}>kg</span>
            </Typography>
          </Box>
        </Box>
      </Paper>


      {/* D. AUTHORITY-MASKED ACTION PANEL */}
      <Box>
        {nodeContext.canAction && currentAction ? (
          <Paper elevation={0} sx={{
            p: 4, borderRadius: '40px', bgcolor: 'primary.main', color: 'white',
            boxShadow: '0 20px 50px rgba(0,82,255,0.3)', textAlign: 'center'
          }}>
            <Navigation size={48} style={{ marginBottom: '16px', opacity: 0.8 }} />
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 1, letterSpacing: '-0.02em' }}>{currentAction.label}</Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 4, opacity: 0.8, px: 4 }}>
              Authorize physical custody transfer for {manifest.shipmentIds.length} items. This action is immutable.
            </Typography>
            <Button
              fullWidth variant="contained" size="large"
              disabled={isTransitioning} // 👈 Use prop instead of transitionMutation.isPending
              onClick={() => {
                if (window.confirm(`SECURITY PROTOCOL: Execute transition to ${currentAction.code}?`)) {
                  executeTransition(currentAction.code); // 👈 Use prop
                }
              }}
              sx={{ py: 2.5, borderRadius: '20px', bgcolor: 'white', color: 'primary.main', fontWeight: 900, '&:hover': { bgcolor: '#f0f0f0' } }}
            >
              {isTransitioning ? <CircularProgress size={24} /> : 'Authorize Transaction'}
            </Button>
          </Paper>) : manifest.status === 'DEPARTED' && nodeContext.isOrigin ? (
            /* VIEW: Custody Released (For China staff once items are in air) */
            <Alert icon={<CheckCircle2 />} severity="success" sx={{ bgcolor: 'rgba(16,185,129,0.05)', color: 'white', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '24px', p: 3 }}>
              <AlertTitle sx={{ fontWeight: 900 }}>PHYSICAL_CUSTODY_RELEASED</AlertTitle>
              This batch has cleared your node. Responsibility has been transferred to the carrier and the Somalia destination hub.
            </Alert>
          ) : (manifest.status === 'ARRIVED' || manifest.status === 'DISMANTLED') && nodeContext.isDest ? (
            /* ACTION: Unseal (For Somalia staff once arrived) */
            <Button
              fullWidth variant="contained" color="success" size="large"
              startIcon={<PackageOpen />}
              onClick={() => navigate(`/manifests/unseal/${id}`)}
              sx={{ py: 3, borderRadius: '24px', fontWeight: 900, fontSize: '1rem', boxShadow: '0 10px 30px rgba(16,185,129,0.2)' }}
            >
              Enter Unseal Console & Verify Items
            </Button>
          ) : (
          /* VIEW: Read-Only */
          <Alert icon={<ShieldCheck className="text-gray-500" />} sx={{ bgcolor: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px' }}>
            <AlertTitle sx={{ fontWeight: 900, fontSize: '0.75rem' }}>READ_ONLY_LEDGER</AlertTitle>
            You do not have administrative authority over this batch at its current location ({manifest.status}).
          </Alert>
        )}
      </Box>


      {/* E. INTERACTIVE INVENTORY LEDGER */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', ml: 1, tracking: '0.1em' }}>
          BATCH_CONTENTS ({manifest.shipmentIds.length} ITEMS)
        </Typography>
        <Paper elevation={0} sx={{ mt: 1, bgcolor: 'transparent', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', overflow: 'hidden' }}>
          {manifest.shipmentIds.map((s: any) => (
            <Box
              key={s._id || s.id}
              onClick={() => navigate(`/shipments/${s._id || s.id}`)}
              sx={{
                p: 2.5, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer',
                transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(255,255,255,0.02)', pl: 4 }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Search size={14} className="text-blue-500" />
                <Box>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 800, color: 'white' }}>
                    {s.externalTrackingNumber}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{s.status.replace(/_/g, ' ')}</Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontWeight: 900, fontSize: '0.85rem' }}>{s.intake_weight}kg</Typography>
                {s.isFlagged && <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 900, fontSize: '0.5rem' }}>!! EXCEPTION !!</Typography>}
              </Box>
            </Box>
          ))}
        </Paper>
      </Box>


      {/* F. FORENSIC EVENT HISTORY */}
      <Box sx={{ mt: 4, px: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
          <History size={16} /> BATCH_EVENT_HISTORY
        </Typography>


        <Box sx={{ borderLeft: '1px solid rgba(255,255,255,0.05)', ml: 1, pl: 3, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {logs.length === 0 && <Typography variant="caption" sx={{ opacity: 0.3 }}>LEDGER_INITIALIZING...</Typography>}
          {logs.map((log: any) => (
            <Box key={log._id}>
              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>
                {log.action}
              </Typography>
              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'text.secondary' }}>
                {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')} // BY: {log.adminId?.displayName || 'SYSTEM'}
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', mt: 0.5, fontStyle: 'italic' }}>
                &gt; {log.details}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>


      <Box sx={{ mt: 6, opacity: 0.2, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 900 }}>
          <HardDrive size={10} style={{ display: 'inline', marginRight: '4px' }} />
          IMMUTABLE_BATCH_RECORDS // V2.4-PRODUCTION
        </Typography>
      </Box>
    </Box>
  );
};


// --- INTERNAL HELPERS ---


const HubMarker = ({ label, city, active, color }: any) => (
  <Box sx={{ textAlign: 'center', transition: 'all 0.5s', opacity: active ? 1 : 0.2, transform: active ? 'scale(1)' : 'scale(0.9)' }}>
    <Typography variant="caption" sx={{ fontWeight: 900, color, display: 'block', letterSpacing: '0.1em' }}>{label}</Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, bgcolor: 'rgba(255,255,255,0.03)', p: 1, px: 2, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <MapPin size={14} color={color} />
      <Typography sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'white' }}>{city?.toUpperCase() || 'NODE_PENDING'}</Typography>
    </Box>
  </Box>
);
