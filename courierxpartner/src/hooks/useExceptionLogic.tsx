import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importService } from '../api/import.service';
import { useSudo } from '../store/SudoContext';
import { toast } from 'sonner';


export const useExceptionLogic = () => {
    const queryClient = useQueryClient();
    const { requireSudo } = useSudo();


    // 1. Fetch only flagged/blocked inventory
    const { data: blocked, isLoading, isError, refetch } = useQuery({
        queryKey: ['blockedInventory'],
        queryFn: importService.getBlockedInventory
    });


    // 2. Hardened Resolution Mutation
    const resolveMutation = useMutation({
        mutationFn: ({ id, action, notes }: any) =>
            importService.resolveException(id, { resolutionAction: action, notes }),
        onSuccess: () => {
            toast.success('EXCEPTION_RESOLVED');
            queryClient.invalidateQueries({ queryKey: ['blockedInventory'] });
            queryClient.invalidateQueries({ queryKey: ['handoffQueue'] });
        },
        onError: (err: any) => toast.error('OVERRIDE_REJECTED', {
            description: err.response?.data?.message
        })
    });


    const handleResolve = (id: string, action: string) => {
        // 🔒 Mandatory Sudo for unfreezing inventory
        requireSudo(() => {
            const notes = prompt("Enter Forensic Resolution Note:");
            if (!notes) return;
            resolveMutation.mutate({ id, action, notes });
        }, `RESOLVE_EXCEPTION: ${action}`);
    };


    return {
        blocked: blocked || [],
        isLoading,
        isError,
        handleResolve,
        isProcessing: resolveMutation.isPending,
        refetch
    };
};
