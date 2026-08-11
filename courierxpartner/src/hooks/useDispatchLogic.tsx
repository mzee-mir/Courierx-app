import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importService } from '../api/import.service';
import { toast } from 'sonner';


export const useDispatchLogic = () => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');


    // 1. Fetch items waiting for handoff
    const { data: queue, isLoading } = useQuery({
        queryKey: ['handoffQueue'],
        queryFn: importService.getHandoffQueue
    });


    // 2. Filter logic
    const filteredQueue = useMemo(() => {
        return queue?.filter((item: any) =>
            item.externalTrackingNumber.toLowerCase().includes(search.toLowerCase())
        ) || [];
    }, [queue, search]);


    // 3. Mutation to release one item
    const releaseMutation = useMutation({
        mutationFn: (id: string) => importService.executeHandoff(id),
        onSuccess: (data) => {
            toast.success('HANDOFF_COMPLETE', { description: `Order: ${data.localOrderId.slice(-6)}` });
            queryClient.invalidateQueries({ queryKey: ['handoffQueue'] });
        },
        onError: (err: any) => toast.error('HANDOFF_FAILED', { description: err.response?.data?.message })
    });


    return {
        queue: filteredQueue,
        totalCount: queue?.length || 0,
        search,
        setSearch,
        isLoading,
        executeHandoff: releaseMutation.mutate,
        isProcessing: releaseMutation.isPending
    };
};
