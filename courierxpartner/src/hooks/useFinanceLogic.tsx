import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeService } from '../api/finance.service';
import { useSudo } from '../store/SudoContext';
import { toast } from 'sonner';


export const useFinanceLogic = () => {
    const queryClient = useQueryClient();
    const { requireSudo } = useSudo();


    // 1. Fetch Financial Snapshot
    const { data: summary, isLoading, isError, refetch } = useQuery({
        queryKey: ['partnerFinance'],
        queryFn: financeService.getSummary,
        refetchInterval: 60000 // Refresh every minute
    });


    // 2. Secure Withdrawal Mutation
    const withdrawMutation = useMutation({
        mutationFn: (amount: number) => financeService.requestWithdrawal(amount, 'EVC_PLUS'),
        onSuccess: () => {
            toast.success('WITHDRAWAL_REQUEST_FILED', {
                description: 'CourierX Finance Team will verify the transfer shortly.'
            });
            queryClient.invalidateQueries({ queryKey: ['partnerFinance'] });
        },
        onError: (err: any) => toast.error('WITHDRAWAL_FAILED', {
            description: err.response?.data?.message
        })
    });


    const handleWithdrawalRequest = (amount: number) => {
        if (amount <= 0) return toast.error("Invalid Amount");


        // 🔒 Mandatory Step-Up Authentication
        requireSudo(() => {
            withdrawMutation.mutate(amount);
        }, "AUTHORIZE_FUNDS_TRANSFER");
    };


    return {
        summary: summary || { availableBalance: 0, pendingBalance: 0, history: [], pendingCount: 0 },
        isLoading,
        isError,
        handleWithdrawalRequest,
        isProcessing: withdrawMutation.isPending,
        refetch
    };
};
