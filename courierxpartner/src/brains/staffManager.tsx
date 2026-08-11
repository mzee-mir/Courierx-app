import React, { useState } from 'react';
import {
    useMediaQuery, useTheme, Box, Modal, Typography, TextField,
    Chip, FormControlLabel, Button, CircularProgress, Paper, Grid,
    IconButton, Checkbox, InputAdornment
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, X, User as UserIcon, Mail, Lock, Zap, ShieldOff, Key, History } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';


import { useSudo } from '../store/SudoContext';
import { staffService } from '../api/staff.service';
import { importService } from '../api/import.service';
import { userService } from '../api/user.service';


import { StaffManagerMobile } from '../pages/view/staffManagerMobile';
import { StaffManagerDesktop } from '../pages/settings/staffManger'; // Ensure this is just the UI now
import { SudoChallengeModal } from '../components/SudoChallengeModal';


// --- CONFIG: PERMISSIONS ---
export const PERMISSION_GROUPS = [
    {
        label: '01_FLOOR_OPERATIONS',
        items: [
            { id: 'PARTNER_READ', desc: 'Read access to all data' },
            { id: 'PARTNER_WRITE', desc: 'Authorize intake and state transitions' },
            { id: 'PARTNER_CORRECT_WEIGHT', desc: 'Override weight values' },
        ]
    },
    {
        label: '02_FINANCIAL_LOGISTICS',
        items: [
            { id: 'PARTNER_MANAGE_RATES', desc: 'Modify rates and quotas' },
        ]
    },
    {
        label: '03_GOVERNANCE_&_PRIVACY',
        items: [
            { id: 'PARTNER_VIEW_PII', desc: 'Access customer phone numbers' },
            { id: 'MANAGE_STAFF', desc: 'Manage other staff accounts' },
            { id: 'SYSTEM_CONFIG', desc: 'Manage system settings' },
            { id: 'VIEW_AUDIT_LOGS', desc: 'Access node history' },
        ]
    }
];


export const StaffManager = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const queryClient = useQueryClient();


    // --- SHARED STATE ---
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isPermModalOpen, setIsPermModalOpen] = useState(false);
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
    const [targetWorker, setTargetWorker] = useState<any>(null);
    const [sudoConfig, setSudoConfig] = useState({ isOpen: false, targetId: '', name: '' });
    const [tempPermissions, setTempPermissions] = useState<string[]>([]);
    const [newWorker, setNewWorker] = useState({ displayName: '', email: '', password: '', assignedLocations: [], permissions: ['PARTNER_READ'] });


    // --- DATA ---
    const { data: staff, isLoading } = useQuery({ queryKey: ['partnerStaff'], queryFn: staffService.getOrgStaff });
    const { data: locations } = useQuery({ queryKey: ['myLocations'], queryFn: () => importService.getLocations() });


    // --- MUTATIONS ---
    const hireMutation = useMutation({
        mutationFn: (payload: any) => staffService.createWorker(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partnerStaff'] });
            toast.success('PERSONNEL_ONBOARDED');
            setIsAddModalOpen(false);
        }
    });


    const permMutation = useMutation({
        mutationFn: (newPerms: string[]) => staffService.updatePermissions(targetWorker?._id || targetWorker?.id, newPerms),
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
            setSudoConfig({ isOpen: false, targetId: '', name: '' });
            queryClient.invalidateQueries({ queryKey: ['partnerStaff'] });
        }
    });


    // --- HANDLERS PASSED TO CHILDREN ---
    const logicProps = {
        staff: staff || [],
        locations: locations || [],
        isLoading,
        openHire: () => setIsAddModalOpen(true),
        openKeys: (worker: any) => {
            setTargetWorker(worker);
            setTempPermissions(worker.permissions || []);
            setIsPermModalOpen(true);
        },
        openLogs: (id: string) => setSelectedStaffId(id),
        killSession: (id: string, name: string) => setSudoConfig({ isOpen: true, targetId: id, name })
    };


    return (
        <Box>
            {isMobile ? <StaffManagerMobile {...logicProps} /> : <StaffManagerDesktop />}


            {/* --- ALL MODALS LIVE HERE IN THE PARENT --- */}


            {/* 1. HIRE MODAL */}
            <Modal open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
                <Box sx={modalStyles}>
                    <Typography variant="h5" sx={{ fontWeight: 900, mb: 3 }}>HIRE_NEW_OPERATIVE</Typography>
                    {/* ... your hire form fields ... */}
                    <Button fullWidth variant="contained" onClick={() => hireMutation.mutate(newWorker)}>Authorize</Button>
                </Box>
            </Modal>


            {/* 2. PERMISSIONS MODAL */}
            <Modal open={isPermModalOpen} onClose={() => setIsPermModalOpen(false)}>
                <Box sx={{ ...modalStyles, bgcolor: '#050505', border: '1px solid #0052FF33' }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>EDIT_AUTHORITY: {targetWorker?.displayName}</Typography>
                    <Box sx={{ my: 3, maxHeight: '400px', overflowY: 'auto' }}>
                        {/* Map through PERMISSION_GROUPS and use tempPermissions state */}
                        {/* (Copy your existing mapping logic here) */}
                    </Box>
                    <Button fullWidth variant="contained" onClick={() => permMutation.mutate(tempPermissions)}>Update Keychain</Button>
                </Box>
            </Modal>


            {/* 3. LOGS MODAL */}
            <Modal open={!!selectedStaffId} onClose={() => setSelectedStaffId(null)}>
                <Box sx={modalStyles}>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 3 }}>ACCESS_LOGS</Typography>
                    <LoginHistoryFeed staffId={selectedStaffId!} />
                </Box>
            </Modal>


            <SudoChallengeModal
                isOpen={sudoConfig.isOpen}
                onClose={() => setSudoConfig(p => ({ ...p, isOpen: false }))}
                onSuccess={() => terminateMutation.mutate(sudoConfig.targetId)}
                actionName={`REVOKE_SESSION: ${sudoConfig.name}`}
            />
        </Box>
    );
};


const modalStyles = { position: 'absolute' as const, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '95%', maxWidth: '500px', bgcolor: '#000', borderRadius: '40px', p: 5, border: '1px solid rgba(255,255,255,0.1)', outline: 'none' };


// --- SUB-COMPONENT: LOGIN LOGS ---
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
