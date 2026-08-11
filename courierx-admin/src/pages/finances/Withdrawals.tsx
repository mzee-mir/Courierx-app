import { useQuery, useMutation, useQueryClient } from 'react-query';
import { financeService } from '../../api/finance.service';
import { Banknote, Copy, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionGuard } from '../../components/auth/PermissionGuard';
import { Permission } from '../../config/permissions';
import { useSudo } from '../../store/SudoContext';

export const Withdrawals = () => {
  const queryClient = useQueryClient();

  const { data: withdrawals, isLoading } = useQuery('withdrawals', financeService.getWithdrawals);
  const { requireSudo } = useSudo(); // Using our Step-up Auth hook

  const payoutMutation = useMutation(financeService.processPayout, {
    onSuccess: () => {
      queryClient.invalidateQueries('withdrawals');
      toast.success('Payout marked as completed');
    }
  });

  const handleConfirmPaid = (id: string, amount: number, phone: string) => {
    requireSudo(() => {
      // This ONLY runs if the Admin successfully re-enters their password
      payoutMutation.mutate(id);
      toast.success(`Funds released to ${phone}`);
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.info('Phone number copied to clipboard');
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-brand" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Driver Payouts</h1>
        <div className="bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-sm font-bold flex items-center gap-2">
          <Banknote size={16} /> Pending Payouts: {withdrawals?.length || 0}
        </div>
      </div>

      <div className="grid gap-4">
        {withdrawals?.map((tx: any) => (
          <div key={tx._id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 font-bold">
                {tx.userId?.displayName?.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-gray-900">{tx.userId?.displayName}</p>
                <div className="flex items-center gap-2 group">
                  <p className="text-sm text-gray-500">{tx.userId?.phoneNumber}</p>
                  <button 
                    onClick={() => copyToClipboard(tx.userId?.phoneNumber)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            </div>

            <div className="text-center md:text-left px-8 border-x border-gray-50">
                <p className="text-xs font-bold text-gray-400 uppercase">Token Amount</p>
                <p className="text-2xl font-black text-brand">{tx.amount} CXC</p>
            </div>
            <PermissionGuard permission={Permission.PROCESS_WITHDRAWALS}>
              <button 
              onClick={() => handleConfirmPaid(tx.id, tx.amount, tx.userId.phoneNumber)}
              className="w-full md:w-auto bg-gray-900 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all"
            >
              <CheckCircle2 size={18} /> Confirm Payout
            </button>
            </PermissionGuard>
            
          </div>
        ))}

        {withdrawals?.length === 0 && (
          <div className="p-20 text-center bg-white rounded-2xl border border-dashed text-gray-400">
            <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
            <p>All driver payouts are up to date.</p>
          </div>
        )}
      </div>
    </div>
  );
};