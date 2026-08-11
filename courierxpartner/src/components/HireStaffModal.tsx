import React, { useState } from 'react';
import { Box, Typography, Modal, TextField, Button, Chip, CircularProgress, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { staffService } from '../api/staff.service';
import { toast } from 'sonner';
import { PERMISSION_GROUPS } from '../pages/settings/staffManger'; // Adjust import path


export const HireStaffModal = ({ isOpen, onClose, locations }: any) => {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        displayName: '', email: '', password: '',
        assignedLocations: [] as string[], permissions: ['PARTNER_READ']
    });


    const createMutation = useMutation({
        mutationFn: (payload: any) => staffService.createWorker(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partnerStaff'] });
            toast.success('PERSONNEL_ONBOARDED');
            onClose();
            setForm({ displayName: '', email: '', password: '', assignedLocations: [], permissions: ['PARTNER_READ'] });
        }
    });


    return (
        <Modal open={isOpen} onClose={onClose}>
            <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '95%', maxWidth: '500px', bgcolor: '#000', borderRadius: '40px', p: 5, border: '1px solid rgba(255,255,255,0.1)', outline: 'none', maxHeight: '90vh', overflowY: 'auto' }}>
                <Typography variant="h5" sx={{ fontWeight: 900, mb: 4 }}>HIRE_NEW_OPERATIVE</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TextField label="Full Name" fullWidth value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} />
                    <TextField label="Email" fullWidth value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    <TextField label="Access Key" type="password" fullWidth value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />


                    <Box>
                        <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main' }}>ZONE_ASSIGNMENT</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                            {locations?.map((loc: any) => (
                                <Chip key={loc.id} label={loc.name}
                                    onClick={() => setForm({ ...form, assignedLocations: form.assignedLocations.includes(loc.id) ? form.assignedLocations.filter(i => i !== loc.id) : [...form.assignedLocations, loc.id] })}
                                    sx={{ bgcolor: form.assignedLocations.includes(loc.id) ? 'primary.main' : 'rgba(255,255,255,0.05)', color: 'white' }}
                                />
                            ))}
                        </Box>
                    </Box>


                    <Button fullWidth variant="contained" size="large" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.email}>
                        {createMutation.isPending ? <CircularProgress size={24} /> : 'Authorize and Deploy'}
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};
