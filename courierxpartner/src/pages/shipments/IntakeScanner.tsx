import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Button,
  CircularProgress, IconButton, TextField,
  FormControl, Select, MenuItem, InputLabel, Divider, alpha,
  Grid
} from '@mui/material';
import {
  X, Plane, Ship, MapPin, Keyboard,
  Camera, Info, CheckCircle2,
  Scan, Zap, Activity, ShieldCheck, CornerDownRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';


import { TacticalScanner } from '../../components/scanner/TacticalScanner';
import { WeightKeypad } from '../../components/ui/WeightKeypad';
import { ThermalLabel } from '../../components/ui/ThermalLabel';
import { QuickCreateModal } from '../../components/QuickCreateModal';
import { importService } from '../../api/import.service';
import api from '../../api/axios';
import { useAuthStore } from '../../store/useAuthStore';






export const IntakeScannerDesktop = () => {
  const { user } = useAuthStore();


  // --- CORE STATE ---
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [mode, setMode] = useState<'AIR' | 'SEA'>('AIR');
  const [isProcessing, setIsProcessing] = useState(false);


  // --- FALLBACKS & METADATA ---
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [dims, setDims] = useState({ l: '', w: '', h: '' });
  const [destBranchId, setDestBranchId] = useState('');
  const [printData, setPrintData] = useState<any>(null);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);


  const { data: locations } = useQuery({
    queryKey: ['myLocations'],
    queryFn: () => api.get('/partner/my-locations').then(res => res.data.locations)
  });


  const somaliBranches = useMemo(() => {
    return locations?.filter((l: any) => l.country === 'SO') || [];
  }, [locations]);


  useEffect(() => {
    if (somaliBranches.length > 0 && !destBranchId) {
      const mgq = somaliBranches.find((b: any) => b.city.toUpperCase() === 'MOGADISHU');
      if (mgq) setDestBranchId(mgq.id);
    }
  }, [somaliBranches, destBranchId]);


  const handleScan = (code: string) => {
    if (isProcessing) return;
    setTrackingId(code.trim().toUpperCase());
    if (window.navigator.vibrate) window.navigator.vibrate(100);
  };


  const handleIntakeSubmit = async () => {
    setIsProcessing(true);
    const currentLocationId = user?.assignedLocations?.[0];


    try {
      const payload = {
        trackingNumber: trackingId!,
        weight: parseFloat(weight),
        binLocation: "HUB_AUTO",
        mode: mode,
        locationId: currentLocationId,
        destinationBranchId: destBranchId,
        dimensions: mode === 'SEA' ? {
          l: Number(dims.l),
          w: Number(dims.w),
          h: Number(dims.h)
        } : undefined
      };


      const result = await importService.scanIntake(payload);


      if (result.success) {
        toast.success('INTAKE_COMMITTED');
        setPrintData({
          cxCode: result.cxCode,
          phone: result.customerPhone,
          trackingId: trackingId,
          weight: weight,
          mode: mode,
          cbm: result.calculatedCBM,
          dims: mode === 'SEA' ? dims : null,
          destination: somaliBranches.find(b => b.id === destBranchId)?.city || "SOMALIA",
          category: "PARCEL"
        });


        setTimeout(() => {
          window.print();
          resetFlow();
        }, 500);


      } else if (result.mode === 'QUICK_CREATE_REQUIRED') {
        setIsQuickCreateOpen(true);
      }
    } catch (error: any) {
      toast.error('SYSTEM_REJECTED', { description: error.response?.data?.message });
    } finally {
      setIsProcessing(false);
    }
  };


  const resetFlow = () => {
    setTrackingId(null);
    setWeight('');
    setDims({ l: '', w: '', h: '' });
    setIsProcessing(false);
    setManualInput('');
    setIsManualEntry(false);
  };


  return (
    <Box sx={{ p: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column', gap: 4, pb: 15 }}>


      {/* --- TACTICAL HEADER --- */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.05em' }}>
            INTAKE_<span style={{ color: '#0052FF' }}>SCANNER</span>
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5, bgcolor: 'rgba(16,185,129,0.1)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Box sx={{ width: 6, height: 6, bgcolor: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>NODE_ONLINE</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>ID: {user?.assignedLocations?.[0]?.slice(-6).toUpperCase() || 'EXTERNAL'}</Typography>
          </Box>
        </Box>
      </Box>


      <AnimatePresence mode="wait">
        {!trackingId ? (
          /* --- PHASE 1: IDENTIFICATION --- */
          <Box component={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>


            {isManualEntry ? (
              <Paper sx={instrumentCardStyles}>
                <Typography variant="caption" sx={sectionLabelStyles}>MANUAL_OVERRIDE_INPUT</Typography>
                <TextField
                  fullWidth autoFocus placeholder="TYPE_TRACKING_ID..."
                  value={manualInput} onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                  sx={tacticalInputStyles}
                />
                <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                  <Button fullWidth variant="outlined" onClick={() => setIsManualEntry(false)} startIcon={<Camera size={18} />} sx={{ borderRadius: '14px', fontWeight: 900 }}>Camera</Button>
                  <Button fullWidth variant="contained" disabled={manualInput.length < 4} onClick={() => handleScan(manualInput)} sx={primaryActionStyles}>Identify Item</Button>
                </Box>
              </Paper>
            ) : (
              <Box sx={{ position: 'relative' }}>
                {/* HUD Overlay for Scanner */}
                <Box sx={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', border: '2px solid transparent', borderRadius: '32px', overflow: 'hidden' }}>
                  <Box sx={{ position: 'absolute', top: 20, left: 20, width: 40, height: 40, borderLeft: '4px solid #0052FF', borderTop: '4px solid #0052FF' }} />
                  <Box sx={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRight: '4px solid #0052FF', borderTop: '4px solid #0052FF' }} />
                  <Box sx={{ position: 'absolute', bottom: 20, left: 20, width: 40, height: 40, borderLeft: '4px solid #0052FF', borderBottom: '4px solid #0052FF' }} />
                  <Box sx={{ position: 'absolute', bottom: 20, right: 20, width: 40, height: 40, borderRight: '4px solid #0052FF', borderBottom: '4px solid #0052FF' }} />
                </Box>


                <TacticalScanner onScanSuccess={handleScan} isPaused={!!trackingId} />


                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button
                    startIcon={<Keyboard size={16} />}
                    onClick={() => setIsManualEntry(true)}
                    sx={{ color: 'text.secondary', fontWeight: 800, textTransform: 'none', fontSize: '0.75rem', '&:hover': { color: 'primary.main' } }}
                  >
                    Use Manual Keyboard Input
                  </Button>
                </Box>
              </Box>
            )}


            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Info size={18} className="text-blue-500" />
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.8rem' }}>
                Align the vendor barcode within the frame. Identification is automatic.
              </Typography>
            </Box>
          </Box>
        ) : (
          /* --- PHASE 2: LOGISTICS SPECS --- */
          <Box component={motion.div} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>


            {/* ACTIVE SESSION CARD */}
            <Paper sx={{ p: 4, borderRadius: '32px', bgcolor: 'primary.main', color: 'white', position: 'relative', boxShadow: '0 20px 40px rgba(0,82,255,0.2)' }}>
              <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.7, letterSpacing: '0.1em' }}>RESOLVED_IDENTIFIER</Typography>
              <Typography variant="h4" sx={{ fontFamily: 'monospace', fontWeight: 900 }}>{trackingId}</Typography>
              <IconButton onClick={resetFlow} sx={{ position: 'absolute', top: 15, right: 15, color: 'white', bgcolor: 'rgba(0,0,0,0.2)', '&:hover': { bgcolor: 'rgba(0,0,0,0.4)' } }}>
                <X size={20} />
              </IconButton>
            </Paper>


            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={instrumentCardStyles}>
                  <Typography variant="caption" sx={sectionLabelStyles}>01_ROUTING_DESTINATION</Typography>
                  <FormControl fullWidth variant="filled">
                    <Select value={destBranchId} onChange={(e) => setDestBranchId(e.target.value)} sx={{ borderRadius: '16px', fontWeight: 800 }}>
                      {somaliBranches.map((branch: any) => (
                        <MenuItem key={branch.id} value={branch.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <MapPin size={16} color="#0052FF" />
                            <Typography sx={{ fontWeight: 800 }}>{branch.city.toUpperCase()}</Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Paper>
              </Grid>


              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={instrumentCardStyles}>
                  <Typography variant="caption" sx={sectionLabelStyles}>02_LOGISTICS_MODE</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <ModeButton active={mode === 'AIR'} icon={<Plane />} label="AIR" onClick={() => setMode('AIR')} />
                    <ModeButton active={mode === 'SEA'} icon={<Ship />} label="SEA" onClick={() => setMode('SEA')} />
                  </Box>
                </Paper>
              </Grid>


              {mode === 'SEA' && (
                <Grid size={{ xs: 12 }}>
                  <Paper sx={{ ...instrumentCardStyles, border: '1px solid #0052FF44', bgcolor: 'rgba(0,82,255,0.02)' }}>
                    <Typography variant="caption" sx={sectionLabelStyles}>03_VOLUME_METRICS (CM)</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
                      <TextField label="LENGTH" type="number" value={dims.l} onChange={e => setDims({ ...dims, l: e.target.value })} sx={tacticalInputStyles} />
                      <TextField label="WIDTH" type="number" value={dims.w} onChange={e => setDims({ ...dims, w: e.target.value })} sx={tacticalInputStyles} />
                      <TextField label="HEIGHT" type="number" value={dims.h} onChange={e => setDims({ ...dims, h: e.target.value })} sx={tacticalInputStyles} />
                    </Box>
                  </Paper>
                </Grid>
              )}


              <Grid size={{ xs: 12 }}>
                <Paper sx={instrumentCardStyles}>
                  <Typography variant="caption" sx={sectionLabelStyles}>04_WEIGHT_CALIBRATION</Typography>
                  <WeightKeypad label="PHYSICAL_KG" value={weight} onChange={setWeight} onConfirm={handleIntakeSubmit} />
                </Paper>
              </Grid>
            </Grid>


            <Button
              fullWidth size="large" variant="contained"
              disabled={!weight || isProcessing}
              onClick={handleIntakeSubmit}
              sx={{ ...primaryActionStyles, py: 3 }}
            >
              {isProcessing ? <CircularProgress size={24} color="inherit" /> : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  AUTHORIZE INTAKE & PRINT <Zap size={20} />
                </Box>
              )}
            </Button>
          </Box>
        )}
      </AnimatePresence>


      <QuickCreateModal
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        onSuccess={(data: any) => {
          setPrintData({ ...data, trackingId: trackingId, weight, mode, destination: "SOMALIA" });
          setTimeout(() => { window.print(); resetFlow(); }, 500);
        }}
        trackingNumber={trackingId}
        locationId={user?.assignedLocations?.[0]}
      />


      <ThermalLabel data={printData} />
    </Box>
  );
};


// --- STYLES & HELPERS ---


const instrumentCardStyles = {
  p: 3, borderRadius: '24px', bgcolor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.05)'
};


const sectionLabelStyles = {
  fontWeight: 900, color: 'primary.main', mb: 2, display: 'block', letterSpacing: '0.15em', fontSize: '0.6rem'
};


const tacticalInputStyles = {
  '& .MuiFilledInput-root': {
    borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
    '&.Mui-focused': { border: '1px solid #0052FF' }
  }
};


const primaryActionStyles = {
  borderRadius: '20px', fontWeight: 900, fontSize: '1rem',
  background: 'linear-gradient(45deg, #0052FF 30%, #003db3 90%)',
  boxShadow: '0 10px 30px rgba(0,82,255,0.3)',
  '&:hover': { transform: 'scale(1.01)', background: 'linear-gradient(45deg, #0062FF 30%, #004db3 90%)' },
  transition: 'all 0.2s'
};


const ModeButton = ({ active, icon, label, onClick }: any) => (
  <Button
    onClick={onClick}
    fullWidth
    variant={active ? 'contained' : 'outlined'}
    sx={{
      height: '60px', borderRadius: '16px', gap: 1.5, fontWeight: 900,
      bgcolor: active ? 'primary.main' : 'transparent',
      borderColor: active ? 'primary.main' : 'rgba(255,255,255,0.1)',
      color: active ? 'white' : 'rgba(255,255,255,0.3)'
    }}
  >
    {icon} {label}
  </Button>
);
