import { toast } from 'sonner';
import api from './axios';

export const financeService = {
  getPending: async () => {
    const { data } = await api.get('/admin/finance/pending-deposits');
    return data.deposits;
  },
  confirm: async (id: string) => {
  const { data } = await api.post(`/admin/finance/confirm/${id}`);
  // data.traceId is provided by the hardened backend
  toast.success('Funds Released', { description: `Trace ID: ${data.traceId}` });
  return data;
  },

  getWithdrawals: async () => {
  const { data } = await api.get('/admin/finance/withdrawals');
  return data.withdrawals;
  },
  processPayout: async (id: string) => {
    const { data } = await api.post(`/admin/finance/withdrawals/${id}/complete`);
    return data;
  },
  getRevenueStats: async (params: any) => {
    const { data } = await api.get('/admin/finance/revenue-stats', { params });
    return data.data;
  },
  // --- LEDGER & AUDIT ---
  getLedger: async (params: { page?: number; limit?: number }) => {
    const { data } = await api.get('/admin/finance/ledger', { params });
    return data; // Returns { success, ledger: [], totals: { totalDebit, totalCredit } }
  },

  // --- REVENUE & LIQUIDITY ---
  getLiquidityStats: async () => {
    const { data } = await api.get('/admin/finance/liquidity');
    return data.stats; // { totalLiquidity, pendingOwed, netProfit }
  },

  // --- RECONCILIATION ---
  confirmDeposit: async (transactionId: string) => {
    // Note: Idempotency-Key is automatically handled by our Axios interceptor
    const { data } = await api.post(`/admin/finance/confirm-deposit/${transactionId}`);
    return data;
  },
};