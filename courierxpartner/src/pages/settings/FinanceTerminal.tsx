// 1 file: FinanceTerminalDesktop.tsx
import { Box, Typography, Paper, Grid, Button, CircularProgress } from '@mui/material';
import { Wallet, Clock, History, Landmark } from 'lucide-react';
import { format } from 'date-fns';
import React from 'react';

// Define the interface matching return type of useFinanceLogic
interface FinanceTerminalDesktopProps {
    summary: {
        availableBalance: number;
        pendingBalance: number;
        pendingCount: number;
        history: Array<any>;
    };
    isLoading: boolean;
    isError: boolean;
    handleWithdrawalRequest: (amount: number) => void;
    isProcessing: boolean;
    refetch: () => void;
}

export const FinanceTerminalDesktop: React.FC<FinanceTerminalDesktopProps> = ({
    summary,
    isLoading,
    handleWithdrawalRequest,
    isProcessing
}) => {

    const onWithdrawClick = () => {
        // Triggers the step-up auth with available balance or custom modal/input
        handleWithdrawalRequest(summary.availableBalance);
    };

    if (isLoading) return <Box sx={{ p: 10, textAlign: 'center' }}><CircularProgress /></Box>;

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 4, pb: 10 }}>
            {/* HEADER */}
            <Box>
                <Typography variant="h4" sx={{ fontWeight: 900, fontStyle: 'italic' }}>
                    FINANCE_<span style={{ color: '#0052FF' }}>TERMINAL</span>
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                    REAL-TIME SETTLEMENT LEDGER
                </Typography>
            </Box>

            {/* BALANCE CARDS */}
            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 4, borderRadius: '32px', bgcolor: 'primary.main', color: 'white', position: 'relative', overflow: 'hidden' }}>
                        <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.8 }}>WITHDRAWABLE_BALANCE</Typography>
                        <Typography variant="h2" sx={{ fontWeight: 900, mb: 2 }}>
                            ${summary.availableBalance.toFixed(2)}
                        </Typography>
                        <Button
                            onClick={onWithdrawClick}
                            disabled={isProcessing}
                            variant="contained"
                            sx={{ bgcolor: 'white', color: 'black', fontWeight: 900, borderRadius: '12px', px: 4, '&:hover': { bgcolor: '#eee' } }}
                            startIcon={<Landmark size={18} />}
                        >
                            {isProcessing ? 'Processing...' : 'Withdraw Funds'}
                        </Button>
                        <Wallet size={120} style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.1 }} />
                    </Paper>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 4, borderRadius: '32px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900 }}>ESCROW_PENDING (IN_TRANSIT)</Typography>
                        <Typography variant="h2" sx={{ fontWeight: 900, color: 'text.secondary', mb: 1 }}>
                            ${summary.pendingBalance.toFixed(2)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Clock size={14} className="text-amber-500" />
                            <Typography variant="caption" sx={{ fontWeight: 800 }}>Linked to {summary.pendingCount} active shipments</Typography>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* TRANSACTION LEDGER */}
            <Box>
                <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', ml: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <History size={16} /> TRANSACTION_HISTORY
                </Typography>
                <Paper sx={{ mt: 2, bgcolor: '#050505', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    {summary.history.length === 0 ? (
                        <Box sx={{ p: 6, textAlign: 'center', opacity: 0.2 }}>NO_TRANSACTIONS_FOUND</Box>
                    ) : (
                        summary.history.map((tx: any) => (
                            <Box key={tx._id} sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <Box>
                                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 900, color: 'white' }}>{tx.description}</Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{format(new Date(tx.createdAt), 'MMM dd, yyyy HH:mm')}</Typography>
                                </Box>
                                <Typography sx={{
                                    fontWeight: 900,
                                    color: tx.creditAccount.toString().includes('6978656c') ? '#10b981' : '#ef4444'
                                }}>
                                    {tx.creditAccount.toString().includes('6978656c') ? '+' : '-'}${tx.amount.toFixed(2)}
                                </Typography>
                            </Box>
                        ))
                    )}
                </Paper>
            </Box>
        </Box>
    );
};