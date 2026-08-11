import React from 'react';
import { Box, Typography, Paper, Avatar, Button, Chip, Grid, IconButton } from '@mui/material';
import { UserPlus, Key, History, ShieldOff, MapPin, Plus } from 'lucide-react';


export const StaffManagerMobile = (props: any) => {
    return (
        <Box sx={{ p: 2, pb: 15, display: 'flex', flexDirection: 'column', gap: 3 }}>


            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>PERSONNEL</Typography>
                <Button
                    variant="contained"
                    startIcon={<Plus size={18} />}
                    onClick={props.openHire}
                    sx={{ borderRadius: '12px', fontWeight: 900, px: 3 }}
                >
                    Hire
                </Button>
            </Box>


            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {props.staff.map((member: any) => (
                    <Paper key={member.id} sx={{ p: 2.5, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                            <Avatar sx={{ bgcolor: member.isSuspended ? '#333' : 'primary.main', fontWeight: 900 }}>{member.displayName.charAt(0)}</Avatar>
                            <Box>
                                <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>{member.displayName}</Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{member.email}</Typography>
                            </Box>
                            <Chip label={member.isSuspended ? 'OFF' : 'ON'} size="small" color={member.isSuspended ? "error" : "success"} sx={{ ml: 'auto', fontWeight: 900, height: 18, fontSize: '0.5rem' }} />
                        </Box>


                        <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '12px', mb: 2 }}>
                            <Typography variant="caption" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <MapPin size={10} /> CUSTODY: {member.assignedLocations?.[0]?.name || 'N/A'}
                            </Typography>
                        </Box>


                        {/* STACKED MOBILE ACTIONS */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
                            <ActionButton
                                icon={<Key size={14} />}
                                label="Keys"
                                color="#0052FF"
                                onClick={() => props.openKeysModal(member)} // 👈 DIRECT CALL
                            />
                            <ActionButton
                                icon={<History size={14} />}
                                label="Logs"
                                color="#fff"
                                onClick={() => props.openLogsModal(member._id || member.id)} // 👈 DIRECT CALL
                            />
                            <ActionButton
                                icon={<ShieldOff size={14} />}
                                label="Kill"
                                color="#FF3B30"
                                onClick={() => props.handleKill(member._id || member.id, member.displayName)} // 👈 DIRECT CALL
                            />
                        </Box>
                    </Paper>
                ))}
            </Box>
        </Box>
    );
};


const ActionButton = ({ icon, label, color, onClick }: any) => (
    <Button
        fullWidth
        variant="outlined"
        onClick={(e) => {
            e.stopPropagation(); // Prevents click bubbling
            onClick();
        }}
        sx={{
            borderColor: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            flexDirection: 'column',
            py: 1.5,
            gap: 0.5,
            color: color,
            bgcolor: 'rgba(255,255,255,0.01)',
            '&:active': { transform: 'scale(0.95)', bgcolor: 'rgba(255,255,255,0.05)' }
        }}
    >
        {icon}
        <Typography sx={{ fontSize: '0.5rem', fontWeight: 900, color: 'inherit' }}>
            {label.toUpperCase()}
        </Typography>
    </Button>
);
