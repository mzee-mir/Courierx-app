import { useQuery, useMutation, useQueryClient } from 'react-query';
import { financeService } from '../../api/finance.service';
import { Check, Wallet, Search, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PermissionGuard } from '../../components/auth/PermissionGuard';
import { Permission } from '../../config/permissions';

export const PendingDeposits = () => {
  const queryClient = useQueryClient();

  const { data: deposits, isLoading } = useQuery('pendingDeposits', financeService.getPending);

  const confirmMutation = useMutation(financeService.confirm, {
    onSuccess: () => {
      queryClient.invalidateQueries('pendingDeposits');
      toast.success('Funds have been credited to user wallet');
    },
    onError: () => toast.error('Failed to confirm deposit')
  });

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-brand" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">EVC+ Deposit Requests</h1>
        <div className="bg-green-100 text-green-700 px-4 py-1 rounded-full text-sm font-bold flex items-center gap-2">
          <Wallet size={16} /> Total Pending: {deposits?.length || 0}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Phone (EVC+)</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Reference ID</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Time</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {deposits?.map((tx: any) => (
              <tr key={tx._id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-bold text-gray-900">{tx.userId?.displayName}</p>
                  <p className="text-xs text-gray-400">ID: {tx.userId?._id.slice(-6)}</p>
                </td>
                <td className="px-6 py-4 font-mono text-sm text-gray-600">
                  {tx.userId?.phoneNumber}
                </td>
                <td className="px-6 py-4">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-mono text-xs font-bold">
                    {tx.externalReference}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-lg font-bold text-green-600">${tx.amount.toFixed(2)}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                {format(new Date(tx.createdAt), 'MMM d, h:mm a')}
                </td>
                <td className="px-6 py-4 text-right">
                  <PermissionGuard permission={Permission.CONFIRM_DEPOSITS}>
                    <button 
                    onClick={() => {
                      if(window.confirm(`Confirm receipt of $${tx.amount} from ${tx.userId?.displayName}?`)) {
                        confirmMutation.mutate(tx._id);
                      }
                    }}
                    className="bg-brand text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 ml-auto"
                    >
                      <Check size={16} /> Confirm Receipt
                    </button>
                  </PermissionGuard>
                  
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {deposits?.length === 0 && (
          <div className="p-20 text-center text-gray-400">
            <Search size={48} className="mx-auto mb-4 opacity-20" />
            <p>No pending deposit requests found.</p>
          </div>
        )}
      </div>
    </div>
  );
};