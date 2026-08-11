import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Button, Grid,
  Avatar, Chip, IconButton, Modal, CircularProgress,
  TextField, InputAdornment, Divider,
  FormControlLabel, Checkbox, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {
  UserPlus, ShieldCheck, ShieldOff,
  History, MapPin, X, Loader2, Mail,
  Key, User as UserIcon, Fingerprint, Zap, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';


import { staffService } from '../../api/staff.service';
import { importService } from '../../api/import.service';
import { userService } from '../../api/user.service';
import { useSudo } from '../../store/SudoContext';
import { SudoChallengeModal } from '../../components/SudoChallengeModal';


// --- CONFIG: PERMISSION HIERARCHY ---
export const PERMISSION_GROUPS = [
  {
    label: '01_FLOOR_OPERATIONS',
    items: [
      { id: 'PARTNER_READ', desc: 'Read access to all data' },
      { id: 'PARTNER_WRITE', desc: 'Authorize intake and state transitions' },
      { id: 'PARTNER_CORRECT_WEIGHT', desc: 'Override weight values after intake' },
      { id: 'PARTNER_FINANCE', desc: 'Authorize financial transactions' },
    ]
  },
  {
    label: '02_FINANCIAL_LOGISTICS',
    items: [
      { id: 'PARTNER_MANAGE_RATES', desc: 'Modify shipping rates and quotas' },
    ]
  },
  {
    label: '03_GOVERNANCE_&_PRIVACY',
    items: [


      { id: 'PARTNER_VIEW_PII', desc: 'Access customer phone numbers' },
      { id: 'MANAGE_STAFF', desc: 'Create and edit other staff accounts' },
      { id: 'SYSTEM_CONFIG', desc: 'Manage system settings' },
      { id: 'VIEW_AUDIT_LOGS', desc: 'Access forensic node history' },
    ]
  }
];


export const StaffManagerDesktop = () => {
  const queryClient = useQueryClient();
  const { requireSudo } = useSudo();


  // --- UI STATE ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [targetWorker, setTargetWorker] = useState<any>(null);
  const [sudoConfig, setSudoConfig] = useState({ isOpen: false, action: '', targetId: '', name: '' });


  // --- FORM STATES ---
  const [newWorker, setNewWorker] = useState({
    displayName: '',
    email: '',
    password: '',
    assignedLocations: [] as string[],
    permissions: ['PARTNER_READ'] as string[]
  });
  const [tempPermissions, setTempPermissions] = useState<string[]>([]);


  // --- DATA FETCHING ---
  const { data: staff, isLoading: loadingStaff } = useQuery({
    queryKey: ['partnerStaff'],
    queryFn: staffService.getOrgStaff
  });


  const { data: locations } = useQuery({
    queryKey: ['myLocations'],
    queryFn: () => importService.getLocations()
  });


  // --- MUTATIONS ---
  const createMutation = useMutation({
    mutationFn: (payload: any) => staffService.createWorker(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partnerStaff'] });
      toast.success('PERSONNEL_ONBOARDED');
      setIsAddModalOpen(false);
      setNewWorker({ displayName: '', email: '', password: '', assignedLocations: [], permissions: ['PARTNER_READ'] });
    },
    onError: (err: any) => toast.error('HIRE_FAILED', { description: err.response?.data?.message })
  });


  const permMutation = useMutation({
    mutationFn: (newPerms: string[]) => staffService.updatePermissions(targetWorker.id || targetWorker._id, newPerms),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partnerStaff'] });
      toast.success('KEYCHAIN_UPDATED');
      setIsPermModalOpen(false);
    }
  });


  const terminateMutation = useMutation({
    mutationFn: (id: string) => userService.terminateSessions(id),
    onSuccess: () => {
      toast.success('SESSION_TERMINATED');
      setSudoConfig({ ...sudoConfig, isOpen: false });
    }
  });


  // --- HANDLERS ---
  const handleToggleLocation = (locId: string) => {
    setNewWorker(prev => ({
      ...prev,
      assignedLocations: prev.assignedLocations.includes(locId)
        ? prev.assignedLocations.filter(id => id !== locId)
        : [...prev.assignedLocations, locId]
    }));
  };


  const handleTogglePermHire = (permId: string) => {
    setNewWorker(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };


  const onSudoSuccess = () => {
    if (sudoConfig.action === 'TERMINATE') terminateMutation.mutate(sudoConfig.targetId);
  };


  if (loadingStaff) return <Box sx={{ p: 10, textAlign: 'center' }}><Loader2 className="animate-spin mx-auto text-brand" /></Box>;


  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 4, pb: 10 }}>


      {/* 1. TACTICAL HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.05em' }}>
            STAFF_<span style={{ color: '#0052FF' }}>RESOURCES</span>
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
            GOVERNING {staff?.length || 0} ACTIVE_OPERATIVES
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => setIsAddModalOpen(true)}
          startIcon={<UserPlus size={18} />}
          sx={{ borderRadius: '14px', fontWeight: 900, bgcolor: 'white', color: 'black', '&:hover': { bgcolor: '#eee' } }}
        >
          Hire Operative
        </Button>
      </Box>


      {/* 2. STAFF GRID */}
      <Grid container spacing={2}>
        {staff?.map((member: any) => (
          <Grid size={{ xs: 12, md: 6 }} key={member.id || member._id}>
            <Paper elevation={0} sx={{
              p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)',
              border: '1px solid', borderColor: member.isSuspended ? 'error.main' : 'rgba(255,255,255,0.05)'
            }}>
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Avatar sx={{ bgcolor: member.isSuspended ? '#333' : 'primary.main', fontWeight: 900, borderRadius: '10px' }}>
                  {member.displayName.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 800 }}>{member.displayName}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{member.email}</Typography>
                </Box>
                <Chip
                  label={member.isSuspended ? 'OFFLINE' : 'ACTIVE'}
                  size="small"
                  sx={{ fontSize: '0.6rem', fontWeight: 900, bgcolor: member.isSuspended ? 'error.main' : 'rgba(16,185,129,0.1)', color: member.isSuspended ? 'white' : '#10b981' }}
                />
              </Box>


              {/* LOCATIONS LIST */}
              <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '12px', mb: 3, border: '1px solid rgba(255,255,255,0.03)' }}>
                <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  <MapPin size={10} /> CUSTODY_AUTHORITY
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {member.assignedLocations?.map((loc: any) => (
                    <span key={loc._id || loc.id} className="text-[10px] font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/5 uppercase">
                      {loc.name}
                    </span>
                  )) || <Typography variant="caption" sx={{ opacity: 0.3 }}>NO_LOCATIONS</Typography>}
                </Box>
              </Box>


              {/* ACTION BUTTONS */}
              <Grid container spacing={1}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Button fullWidth variant="outlined" startIcon={<Key size={14} />}
                    onClick={() => { setTargetWorker(member); setTempPermissions(member.permissions || []); setIsPermModalOpen(true); }}
                    sx={{ borderRadius: '10px', fontSize: '0.6rem', fontWeight: 900, color: 'primary.main' }}>Keys</Button>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Button fullWidth variant="outlined" startIcon={<History size={14} />} onClick={() => setSelectedStaffId(member.id || member._id)}
                    sx={{ borderRadius: '10px', fontSize: '0.6rem', fontWeight: 900, color: 'white' }}>Logs</Button>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Button fullWidth variant="contained" color="error" startIcon={<ShieldOff size={14} />}
                    onClick={() => setSudoConfig({ isOpen: true, action: 'TERMINATE', targetId: member.id || member._id, name: member.displayName })}
                    sx={{ borderRadius: '10px', fontSize: '0.6rem', fontWeight: 900 }}>Kill</Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        ))}
      </Grid>


      {/* --- MODAL: HIRE WORKER --- */}
      <Modal open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '95%', maxWidth: '500px', bgcolor: '#000', borderRadius: '40px', p: 5, border: '1px solid rgba(255,255,255,0.1)', outline: 'none', maxHeight: '90vh', overflowY: 'auto' }}>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 4 }}>HIRE_NEW_OPERATIVE</Typography>


          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField fullWidth label="Full Name" value={newWorker.displayName} onChange={(e) => setNewWorker({ ...newWorker, displayName: e.target.value })} />
            <TextField fullWidth label="Corporate Email" value={newWorker.email} onChange={(e) => setNewWorker({ ...newWorker, email: e.target.value })} />
            <TextField fullWidth label="Initial Access Key" type="password" value={newWorker.password} onChange={(e) => setNewWorker({ ...newWorker, password: e.target.value })} />


            <Box>
              <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main' }}>ZONE_ASSIGNMENT</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {locations?.map((loc: any) => (
                  <Chip key={loc._id || loc.id} label={loc.name} onClick={() => handleToggleLocation(loc._id || loc.id)}
                    sx={{ borderRadius: '10px', fontWeight: 900, bgcolor: newWorker.assignedLocations.includes(loc._id || loc.id) ? 'primary.main' : 'rgba(255,255,255,0.05)', color: 'white' }} />
                ))}
              </Box>
            </Box>


            {/* PERMISSION CHECKLIST FOR HIRE */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main' }}>INITIAL_KEYCHAIN</Typography>
              {PERMISSION_GROUPS.map(group => (
                <Box key={group.label} sx={{ mt: 1.5 }}>
                  <Typography sx={{ fontSize: '0.55rem', fontWeight: 900, opacity: 0.5, mb: 1 }}>{group.label}</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {group.items.map(perm => (
                      <FormControlLabel key={perm.id} control={<Checkbox size="small" checked={newWorker.permissions.includes(perm.id)} onChange={() => handleTogglePermHire(perm.id)} />}
                        label={<Typography sx={{ fontSize: '0.7rem', fontWeight: 700 }}>{perm.id}</Typography>} />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>


            <Button fullWidth variant="contained" size="large" onClick={() => createMutation.mutate(newWorker)}
              disabled={createMutation.isPending || !newWorker.email || newWorker.assignedLocations.length === 0}
              sx={{ mt: 2, py: 2, borderRadius: '20px', fontWeight: 900 }}>
              {createMutation.isPending ? <CircularProgress size={24} /> : 'Authorize and Deploy'}
            </Button>
          </Box>
        </Box>
      </Modal>


      {/* --- MODAL: EDIT PERMISSIONS --- */}
      <Modal open={isPermModalOpen} onClose={() => setIsPermModalOpen(false)}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '95%', maxWidth: '450px', bgcolor: '#050505', borderRadius: '40px', p: 4, border: '1px solid #0052FF33', outline: 'none' }}>
          <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>EDIT_AUTHORITY</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 3 }}>OPERATIVE: {targetWorker?.displayName?.toUpperCase()}</Typography>


          <Box sx={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {PERMISSION_GROUPS.map((group) => (
              <Box key={group.label}>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: 'primary.main', mb: 1, letterSpacing: '0.1em' }}>{group.label}</Typography>
                {group.items.map((perm) => {
                  const isActive = tempPermissions.includes(perm.id);
                  return (
                    <Paper key={perm.id} onClick={() => setTempPermissions(prev => isActive ? prev.filter(p => p !== perm.id) : [...prev, perm.id])}
                      elevation={0} sx={{ p: 1.5, mb: 1, borderRadius: '12px', cursor: 'pointer', border: '1px solid', borderColor: isActive ? 'primary.main' : 'transparent', bgcolor: isActive ? 'rgba(0,82,255,0.05)' : 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box><Typography sx={{ fontSize: '0.7rem', fontWeight: 800 }}>{perm.id}</Typography><Typography sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>{perm.desc}</Typography></Box>
                      {isActive && <ShieldCheck size={16} color="#0052FF" />}
                    </Paper>
                  );
                })}
              </Box>
            ))}
          </Box>
          <Button fullWidth variant="contained" onClick={() => permMutation.mutate(tempPermissions)} disabled={permMutation.isPending} sx={{ mt: 3, py: 2, borderRadius: '16px', fontWeight: 900 }}>
            {permMutation.isPending ? <CircularProgress size={20} /> : 'Update Keychain'}
          </Button>
        </Box>
      </Modal>


      {/* --- MODAL: ACCESS LOGS --- */}
      <Modal open={!!selectedStaffId} onClose={() => setSelectedStaffId(null)}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '95%', maxWidth: '400px', bgcolor: '#0A0A0A', borderRadius: '32px', p: 4, border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}>
          <Typography variant="h6" sx={{ fontWeight: 900, mb: 4 }}>ACCESS_LOGS</Typography>
          <LoginHistoryFeed staffId={selectedStaffId!} />
        </Box>
      </Modal>


      <SudoChallengeModal isOpen={sudoConfig.isOpen} onClose={() => setSudoConfig({ ...sudoConfig, isOpen: false })} onSuccess={onSudoSuccess} actionName={`REVOKE_SESSION: ${sudoConfig.name}`} />
    </Box>
  );
};


const LoginHistoryFeed = ({ staffId }: { staffId: string }) => {
  const { data: logs, isLoading } = useQuery({ queryKey: ['staffHistory', staffId], queryFn: () => staffService.getLoginHistory(staffId), enabled: !!staffId });
  if (isLoading) return <CircularProgress size={20} sx={{ display: 'block', mx: 'auto' }} />;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: '400px', overflowY: 'auto' }}>
      {logs?.length === 0 ? <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center' }}>NO_HISTORICAL_LOGS</Typography>
        : logs?.map((log: any) => (
          <Box key={log._id} sx={{ p: 2, borderLeft: '3px solid #0052FF', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>IP: {log.ipAddress}</Typography>
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', mt: 0.5, display: 'block' }}>{log.details}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{format(new Date(log.createdAt), 'MMM dd, yyyy @ HH:mm:ss')}</Typography>
          </Box>
        ))}
    </Box>
  );
};
