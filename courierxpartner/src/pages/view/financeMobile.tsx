import React from 'react';
import { Box, Typography, Paper, Button, Grid, Divider } from '@mui/material';
import { Wallet, Landmark, Clock, History, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';


export const FinanceMobile = ({ summary, handleWithdrawalRequest, isProcessing }: any) => {
    return (
        <Box sx={{ p: 2, pb: 15, display: 'flex', flexDirection: 'column', gap: 3 }}>


            <Typography variant="h5" sx={{ fontWeight: 900, fontStyle: 'italic' }}>FINANCE_HUB</Typography>


            {/* 1. PRIMARY WALLET CARD */}
            <Paper sx={{
                p: 3, borderRadius: '28px', bgcolor: 'primary.main', color: 'white',
                boxShadow: '0 15px 35px rgba(0,82,255,0.3)', position: 'relative', overflow: 'hidden'
            }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 900, opacity: 0.8, letterSpacing: '0.1em' }}>AVAILABLE_FOR_PAYOUT</Typography>
                <Typography variant="h3" sx={{ fontWeight: 900, my: 1 }}>${summary.availableBalance.toFixed(2)}</Typography>


                <Button
                    fullWidth
                    onClick={() => handleWithdrawalRequest(summary.availableBalance)}
                    disabled={summary.availableBalance <= 0 || isProcessing}
                    variant="contained"
                    sx={{ bgcolor: 'white', color: 'black', fontWeight: 900, borderRadius: '12px', mt: 2, '&:hover': { bgcolor: '#eee' } }}
                    startIcon={<Landmark size={18} />}
                >
                    Withdraw to EVC+
                </Button>
                <Wallet size={100} style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.1 }} />
            </Paper>


            {/* 2. PENDING SETTLEMENTS */}
            <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Clock size={16} className="text-amber-500" />
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 900 }}>ESCROW_PENDING</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 900 }}>${summary.pendingBalance.toFixed(2)}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                    Processing {summary.pendingCount} active shipments
                </Typography>
            </Paper>


            {/* 3. RECENT ACTIVITY LIST */}
            <Box>
                <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', ml: 1, mb: 1, display: 'block' }}>RECENT_TRANSACTIONS</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {summary.history.map((tx: any) => (
                        <Paper key={tx._id} sx={{ p: 2, borderRadius: '16px', bgcolor: '#0A0A0A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 800 }}>{tx.description}</Typography>
                                <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{format(new Date(tx.createdAt), 'MMM dd, HH:mm')}</Typography>
                            </Box>
                            <Typography sx={{ fontWeight: 900, color: tx.creditAccount.includes('6978') ? '#10b981' : '#ef4444' }}>
                                ${tx.amount.toFixed(2)}
                            </Typography>
                        </Paper>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};