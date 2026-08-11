import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, TextField, Button, Grid,
  Alert, InputAdornment, Divider, Chip, Modal,
  IconButton, MenuItem, Select, FormControl, InputLabel, CircularProgress
} from '@mui/material';
import {
  Save, Info, Target, ShieldCheck, Truck,
  MapPin, Plus, X, Globe, Building2, Edit3, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/axios';
import { PermissionGuard } from '../../auth/PermissionGuard';
import { Permission } from '../../config/permissions';


export const TerminalSettings = () => {
  const queryClient = useQueryClient();
  const [rates, setRates] = useState({ air: 0, sea: 0 });
  const [target, setTarget] = useState(100);
  const [domesticRate, setDomesticRate] = useState(1.0);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);


  const [newBranch, setNewBranch] = useState({
    name: '', type: 'TRANSIT_HUB', city: '', address: '', country: 'SO'
  });


  const { data: economics, isLoading: loadingEconomics } = useQuery({
    queryKey: ['terminalEconomics'],
    queryFn: () => api.get('/partner/settings/active-rates').then(res => res.data.data)
  });


  const { data: locations } = useQuery({
    queryKey: ['myLocations'],
    queryFn: () => api.get('/partner/my-locations').then(res => res.data.locations)
  });


  useEffect(() => {
    if (economics?.card) {
      setRates({ air: economics.card.airRate, sea: economics.card.seaRate });
      setTarget(economics.org?.dailyIntakeTarget || 100);
      setDomesticRate(economics.org?.domesticConfig?.ratePerKg || 1.0);
    }
  }, [economics]);


  const updateSettingsMutation = useMutation({
    mutationFn: (payload: any) => api.patch('/partner/settings/rates', payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['terminalEconomics'] }); toast.success('CONFIG_UPDATED'); }
  });


  const branchMutation = useMutation({
    mutationFn: (payload: any) => editingId
      ? api.patch(`/partner/settings/locations/${editingId}`, payload)
      : api.post('/partner/settings/locations', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLocations'] });
      toast.success(editingId ? 'NODE_UPDATED' : 'BRANCH_AUTHORIZED');
      handleCloseModal();
    }
  });


  const deleteBranchMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/partner/settings/locations/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['myLocations'] }); toast.success('NODE_DELETED'); },
    onError: (err: any) => toast.error('DELETE_FAILED', { description: err.response?.data?.message })
  });


  const handleOpenEdit = (loc: any) => {
    setEditingId(loc.id);
    setNewBranch({ name: loc.name, type: loc.type, city: loc.city, address: loc.address, country: loc.country });
    setIsBranchModalOpen(true);
  };


  const handleCloseModal = () => {
    setIsBranchModalOpen(false);
    setEditingId(null);
    setNewBranch({ name: '', type: 'TRANSIT_HUB', city: '', address: '', country: 'SO' });
  };


  const handleGlobalSave = () => {
    const reason = prompt("Enter reasoning for change:");
    if (reason) updateSettingsMutation.mutate({ airRate: rates.air, seaRate: rates.sea, dailyIntakeTarget: target, domesticRatePerKg: domesticRate, reason });
  };


  if (loadingEconomics) return <Box sx={{ p: 10, textAlign: 'center' }}>SYNCING...</Box>;


  return (
    <PermissionGuard permission={Permission.PARTNER_MANAGE_RATES}>
      <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 5, pb: 15 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, fontStyle: 'italic' }}>TERMINAL_<span style={{ color: '#0052FF' }}>ECONOMICS</span></Typography>


        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 4, borderRadius: '32px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}><Target className="text-amber-500" /><Typography variant="h6" sx={{ fontWeight: 900 }}>Quota</Typography></Box>
              <TextField fullWidth type="number" value={target} onChange={(e) => setTarget(parseInt(e.target.value) || 0)} />
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: 4, borderRadius: '32px', bgcolor: 'rgba(0,82,255,0.03)', border: '1px solid #0052FF44' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}><Truck color="#0052FF" /><Typography variant="h6" sx={{ fontWeight: 900 }}>Domestic Forwarding</Typography></Box>
              <TextField type="number" label="Surcharge $/kg" value={domesticRate} onChange={(e) => setDomesticRate(parseFloat(e.target.value) || 0)} />
            </Paper>
          </Grid>
        </Grid>


        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}><RateInputCard label="AIR" partnerRate={rates.air} setRate={(v: any) => setRates({ ...rates, air: v })} total={rates.air + economics.systemAddOn} addOn={economics.systemAddOn} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><RateInputCard label="SEA" partnerRate={rates.sea} setRate={(v: any) => setRates({ ...rates, sea: v })} total={rates.sea + economics.systemAddOn} addOn={economics.systemAddOn} /></Grid>
        </Grid>


        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="caption" sx={{ fontWeight: 900 }}>PHYSICAL_NODES</Typography>
            <Button variant="outlined" startIcon={<Plus />} onClick={() => setIsBranchModalOpen(true)}>Add Branch</Button>
          </Box>
          <Grid container spacing={2}>
            {locations?.map((loc: any) => (
              <Grid size={{ xs: 12, md: 4 }} key={loc.id}>
                <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                  <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                    <IconButton size="small" onClick={() => handleOpenEdit(loc)}><Edit3 size={14} /></IconButton>
                    <IconButton size="small" color="error" onClick={() => window.confirm('Delete node?') && deleteBranchMutation.mutate(loc.id)}><Trash2 size={14} /></IconButton>
                  </Box>
                  <Typography sx={{ fontWeight: 900 }}>{loc.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{loc.city}, {loc.country} ({loc.type})</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>


        <Button variant="contained" size="large" onClick={handleGlobalSave} sx={{ py: 2, borderRadius: '20px', fontWeight: 900 }}>Authorize Changes</Button>


        <Modal open={isBranchModalOpen} onClose={handleCloseModal}>
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bgcolor: '#000', p: 5, borderRadius: '40px', width: '450px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 3 }}>{editingId ? 'EDIT_NODE' : 'REGISTER_NODE'}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label="Name" fullWidth value={newBranch.name} onChange={e => setNewBranch({ ...newBranch, name: e.target.value })} />
              <Select value={newBranch.type} onChange={e => setNewBranch({ ...newBranch, type: e.target.value as any })}>
                <MenuItem value="WAREHOUSE">Warehouse</MenuItem><MenuItem value="TRANSIT_HUB">Transit Hub</MenuItem><MenuItem value="PORT">Port</MenuItem>
              </Select>
              <TextField label="City" fullWidth value={newBranch.city} onChange={e => setNewBranch({ ...newBranch, city: e.target.value })} />
              <TextField label="Address" multiline rows={2} fullWidth value={newBranch.address} onChange={e => setNewBranch({ ...newBranch, address: e.target.value })} />
              <Button fullWidth variant="contained" onClick={() => branchMutation.mutate(newBranch)} disabled={branchMutation.isPending}>
                {branchMutation.isPending ? <CircularProgress size={24} /> : 'Save Node'}
              </Button>
            </Box>
          </Box>
        </Modal>
      </Box>
    </PermissionGuard>
  );
};


const RateInputCard = ({ label, partnerRate, setRate, total, addOn }: any) => (
  <Paper sx={{ p: 4, borderRadius: '32px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
    <Typography variant="caption" sx={{ fontWeight: 900 }}>{label}_LANE</Typography>
    <TextField fullWidth type="number" value={partnerRate} onChange={(e) => setRate(parseFloat(e.target.value) || 0)} sx={{ mt: 2 }} />
    <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,82,255,0.05)', borderRadius: '12px' }}>
      <Typography variant="caption">Final Price: ${total.toFixed(2)} (Inc. ${addOn} fee)</Typography>
    </Box>
  </Paper>
);