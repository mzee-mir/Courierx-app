import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Modal, Button,
    IconButton, CircularProgress, Paper, Divider
} from '@mui/material';
import { X, ShieldCheck, Key, ShieldAlert, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


interface Props {
    isOpen: boolean;
    onClose: () => void;
    worker: any;
    onUpdate: (permissions: string[]) => void;
    isLoading: boolean;
}export const PERMISSION_GROUPS = [
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


export const PermissionEditModal = ({ isOpen, onClose, worker, onUpdate, isLoading }: Props) => {
    // Local state to track changes before committing
    const [tempPermissions, setTempPermissions] = useState<string[]>([]);


    // Sync temp state when modal opens or worker changes
    useEffect(() => {
        if (worker) {
            setTempPermissions(worker.permissions || []);
        }
    }, [worker, isOpen]);


    const handleToggle = (id: string) => {
        setTempPermissions(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };


    if (!worker) return null;


    return (
        <Modal open={isOpen} onClose={onClose} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box
                component={motion.div}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                sx={{
                    width: '95%', maxWidth: '480px', bgcolor: '#050505', borderRadius: '40px',
                    border: '1px solid rgba(0,82,255,0.2)', overflow: 'hidden', outline: 'none',
                    boxShadow: '0 50px 100px rgba(0,0,0,0.8)'
                }}
            >
                {/* HEADER */}
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Key size={18} className="text-blue-500" /> AUTHORITY_RECONFIGURATION
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                            OPERATIVE: <span style={{ color: 'white' }}>{worker.displayName.toUpperCase()}</span>
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose} sx={{ color: 'white' }}><X /></IconButton>
                </Box>


                {/* PERMISSION LIST */}
                <Box sx={{ p: 3, maxHeight: '500px', overflowY: 'auto' }} className="scrollbar-hide">
                    {PERMISSION_GROUPS.map((group) => (
                        <Box key={group.label} sx={{ mb: 4 }}>
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: 'primary.main', mb: 2, letterSpacing: '0.2em' }}>
                                {group.label}
                            </Typography>


                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {group.items.map((perm) => {
                                    const isActive = tempPermissions.includes(perm.id);
                                    return (
                                        <Paper
                                            key={perm.id}
                                            onClick={() => handleToggle(perm.id)}
                                            elevation={0}
                                            sx={{
                                                p: 2, borderRadius: '16px', cursor: 'pointer',
                                                bgcolor: isActive ? 'rgba(0,82,255,0.08)' : 'rgba(255,255,255,0.01)',
                                                border: '1px solid',
                                                borderColor: isActive ? 'primary.main' : 'rgba(255,255,255,0.05)',
                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                '&:hover': { bgcolor: isActive ? 'rgba(0,82,255,0.12)' : 'rgba(255,255,255,0.03)' }
                                            }}
                                        >
                                            <Box>
                                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: isActive ? 'white' : 'rgba(255,255,255,0.4)' }}>
                                                    {perm.id}
                                                </Typography>
                                                <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', mt: 0.5 }}>
                                                    {perm.desc}
                                                </Typography>
                                            </Box>
                                            {isActive ? (
                                                <ShieldCheck size={20} className="text-blue-500" />
                                            ) : (
                                                <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.05)' }} />
                                            )}
                                        </Paper>
                                    );
                                })}
                            </Box>
                        </Box>
                    ))}
                </Box>


                {/* ACTION BUTTON */}
                <Box sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={isLoading}
                        onClick={() => onUpdate(tempPermissions)}
                        sx={{
                            py: 2, borderRadius: '16px', fontWeight: 900,
                            background: 'linear-gradient(90deg, #0052FF 0%, #003db3 100%)',
                            boxShadow: '0 10px 30px rgba(0,82,255,0.3)'
                        }}
                    >
                        {isLoading ? <CircularProgress size={24} color="inherit" /> : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                UPDATE_KEYCHAIN <Zap size={18} />
                            </Box>
                        )}
                    </Button>
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 2, color: 'text.secondary', fontWeight: 700 }}>
                        Changes will be enforced on the operative's next dashboard interaction.
                    </Typography>
                </Box>
            </Box>
        </Modal>
    );
};
