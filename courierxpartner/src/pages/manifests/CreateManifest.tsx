import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Button, Checkbox,
  CircularProgress, Divider, TextField, FormControl,
  InputLabel, Select, MenuItem, Stack
} from '@mui/material';
import { Plane, Ship, X, ChevronRight, MapPin, HardDrive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { importService } from '../../api/import.service';
import api from '../../api/axios';
import { useAuthStore } from '../../store/useAuthStore';
import { toast } from 'sonner';


export const CreateManifestDesktop = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();


  // --- UI STATE ---
  const [mode, setMode] = useState<'AIR' | 'SEA'>('AIR');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manifestDestId, setManifestDestId] = useState(''); // 👈 Dynamic Gateway Selection
  const [manifestCode, setManifestCode] = useState(`MAN-${Math.floor(100000 + Math.random() * 900000)}`);


  // 1. DATA: Fetch "Floor" Inventory (Filtered by mode)
  const { data: floor, isLoading: loadingFloor } = useQuery({
    queryKey: ['floorInventory', mode],
    queryFn: () => importService.getInventory({ status: 'RECEIVED_AT_ORIGIN', transportMode: mode }),
  });


  // 2. DATA: Fetch Somali Hubs (Gateways)
  const { data: locations } = useQuery({
    queryKey: ['myLocations'],
    queryFn: () => api.get('/partner/my-locations').then(res => res.data.locations)
  });


  const somaliGateways = useMemo(() => {
    return locations?.filter((l: any) => l.country === 'SO') || [];
  }, [locations]);


  // Default to Mogadishu if available in the list
  useEffect(() => {
    if (somaliGateways.length > 0 && !manifestDestId) {
      const mgq = somaliGateways.find((b: any) => b.city.toUpperCase() === 'MOGADISHU');
      if (mgq) setManifestDestId(mgq.id);
    }
  }, [somaliGateways, manifestDestId]);


  // 3. LOGIC: Numeric Safe Weight Calculation
  const totals = useMemo(() => {
    const selectedItems = floor?.data?.filter((s: any) => selectedIds.includes(s.id)) || [];
    return {
      count: selectedItems.length,
      weight: selectedItems.reduce((acc: number, s: any) => {
        const itemWeight = Number(s.weight) || 0; // 👈 Prevent NaNkg
        return acc + itemWeight;
      }, 0)
    };
  }, [selectedIds, floor]);


  // 4. MUTATION: Trigger Batch Transaction
  const consolidateMutation = useMutation({
    mutationFn: (payload: any) => importService.consolidateManifest(payload),
    onSuccess: () => {
      toast.success('MANIFEST_CREATED', { description: 'Batch inventory now locked and ready for transport.' });
      queryClient.invalidateQueries({ queryKey: ['floorInventory'] });
      queryClient.invalidateQueries({ queryKey: ['manifestsList'] });
      setSelectedIds([]);
      setManifestCode(`MAN-${Math.floor(100000 + Math.random() * 900000)}`);
    },
    onError: (err: any) => toast.error('ERROR', { description: err.response?.data?.message || 'Check connection.' })
  });


  const handleSealAction = () => {
    if (selectedIds.length === 0) return;
    if (!manifestDestId) {
      toast.error("VALIDATION_ERROR", { description: "Please select a Somali Gateway Hub." });
      return;
    }


    const payload = {
      manifestCode,
      originHub: user?.assignedLocations?.[0],
      destinationHub: manifestDestId, // 👈 Use dynamic selection
      shippingMode: mode,
      shipmentIds: selectedIds,
      metadata: {
        estimatedArrival: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    };


    consolidateMutation.mutate(payload);
  };


  if (loadingFloor) return (
    <Box sx={{ p: 10, textAlign: 'center' }}>
      <CircularProgress size={24} />
      <Typography variant="caption" sx={{ display: 'block', mt: 2, fontFamily: 'monospace' }}>SYNCING_FLOOR_DATA...</Typography>
    </Box>
  );


  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3, pb: 15 }}>


      {/* HEADER & MODE SWITCHER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, fontStyle: 'italic' }}>BATCH_<span style={{ color: '#0052FF' }}>BUILDER</span></Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>CONSOLIDATING: {mode} FREIGHT</Typography>
        </Box>
        <Box sx={{ display: 'flex', bgcolor: 'rgba(255,255,255,0.02)', p: 0.5, borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Button size="small" onClick={() => { setMode('AIR'); setSelectedIds([]); }} sx={{ color: mode === 'AIR' ? '#0052FF' : '#555', fontWeight: 900, gap: 1 }}><Plane size={14} /> AIR</Button>
          <Button size="small" onClick={() => { setMode('SEA'); setSelectedIds([]); }} sx={{ color: mode === 'SEA' ? '#0052FF' : '#555', fontWeight: 900, gap: 1 }}><Ship size={14} /> SEA</Button>
        </Box>
      </Box>


      {/* METADATA FORM: CODE & DESTINATION */}
      <Paper sx={{ p: 3, borderRadius: '24px', border: '1px solid rgba(0,82,255,0.2)', bgcolor: 'rgba(0,82,255,0.02)', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', tracking: '0.1em' }}>ASSIGNED_MANIFEST_CODE</Typography>
          <TextField
            fullWidth variant="standard" value={manifestCode}
            onChange={(e) => setManifestCode(e.target.value)}
            slotProps={{ input: { sx: { fontWeight: 900, fontSize: '1.5rem', fontFamily: 'monospace' }, disableUnderline: true } }}
          />
        </Box>


        <Divider sx={{ opacity: 0.1 }} />


        <Box>
          <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', mb: 1.5, display: 'block' }}>MANIFEST_GATEWAY_TERMINAL (SOMALIA)</Typography>
          <FormControl fullWidth variant="filled">
            <Select
              value={manifestDestId}
              onChange={(e) => setManifestDestId(e.target.value)}
              sx={{ borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {somaliGateways.map((loc: any) => (
                <MenuItem key={loc.id} value={loc.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <MapPin size={16} color="#0052FF" />
                    <Typography sx={{ fontWeight: 800 }}>{loc.city} ({loc.name})</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>


      {/* SHIPMENT SELECTOR */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', ml: 1 }}>
          FLOOR_AVAILABILITY ({floor?.data?.length || 0} ITEMS)
        </Typography>


        {floor?.data?.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center', opacity: 0.2 }}>
            <Typography variant="button" sx={{ fontWeight: 900 }}>EMPTY_FLOOR_FOR_{mode}_MODE</Typography>
          </Box>
        ) : floor?.data?.map((item: any) => (
          <Paper
            key={item.id}
            onClick={() => setSelectedIds(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id])}
            sx={{
              p: 2, mb: 1, borderRadius: '16px', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer',
              bgcolor: selectedIds.includes(item.id) ? 'rgba(0,82,255,0.05)' : 'rgba(255,255,255,0.01)',
              borderColor: selectedIds.includes(item.id) ? 'primary.main' : 'rgba(255,255,255,0.05)',
              border: '1px solid', transition: 'all 0.1s ease'
            }}
          >
            <Checkbox checked={selectedIds.includes(item.id)} sx={{ color: 'rgba(255,255,255,0.1)' }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.85rem' }}>{item.tracking}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{item.description}</Typography>
            </Box>
            <Typography sx={{ fontWeight: 900, fontSize: '0.85rem' }}>{item.weight}kg</Typography>
          </Paper>
        ))}
      </Box>


      {/* THE SEAL BUTTON (FLOATING BAR) */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <Box
            component={motion.div}
            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
            sx={{ position: 'fixed', bottom: 100, left: 16, right: 16, zIndex: 100 }}
          >
            <Paper sx={{
              p: 2.5, borderRadius: '24px', bgcolor: 'primary.main', color: 'white',
              boxShadow: '0 20px 40px rgba(0,82,255,0.4)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <Box sx={{ pl: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  {Number(totals.weight).toFixed(1)}kg
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, opacity: 0.8 }}>SUMMED_BATCH_WEIGHT</Typography>
              </Box>
              <Button
                variant="contained" size="large" onClick={handleSealAction}
                disabled={consolidateMutation.isPending || !manifestDestId}
                sx={{ bgcolor: 'white', color: 'black', borderRadius: '12px', fontWeight: 900, px: 6, '&:hover': { bgcolor: '#ddd' } }}
              >
                {consolidateMutation.isPending ? <CircularProgress size={24} color="inherit" /> : 'Seal Manifest'}
              </Button>
            </Paper>
          </Box>
        )}
      </AnimatePresence>


      <Box sx={{ mt: 5, textAlign: 'center', opacity: 0.2 }}>
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, fontFamily: 'monospace' }}>
          <HardDrive size={10} className="inline mr-1" /> TRANSACTIONAL_IDEMPOTENCY_LOCKED
        </Typography>
      </Box>


    </Box>
  );
};
