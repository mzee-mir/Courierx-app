import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { toast } from 'sonner';
import { useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';


export const useManifestLogic = () => {
    const { id } = useParams();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();


    const { data: auth, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['manifestAuthority', id],
        queryFn: async () => {
            const res = await api.get(`/partner/manifests/${id}/authority`);
            return res.data.data;
        },
        retry: false // Don't keep trying if it's a 404 or 403
    });


    const transitionMutation = useMutation({
        mutationFn: (actionCode: string) => api.patch(`/partner/manifests/${id}/transition`, { actionCode }),
        onSuccess: () => {
            toast.success('STATE_UPDATED');
            queryClient.invalidateQueries({ queryKey: ['manifestAuthority', id] });
        },
        onError: (err: any) => {
            const msg = err.response?.data?.message || "TRANSITION_DENIED";
            toast.error('AUTHORITY_VIOLATION', { description: msg });
        }
    });


    const canAction = useMemo(() => {
        if (!auth || !user) return false;
        const userLocations = user.assignedLocations.map(l => l.toString());
        const status = auth.manifest.status;


        // Resolve IDs safely whether they are populated objects or strings
        const originId = (auth.manifest.originHub._id || auth.manifest.originHub).toString();
        const destId = (auth.manifest.destinationHub._id || auth.manifest.destinationHub).toString();


        const isSuper = user.roles.includes('super_admin');
        const isAtOrigin = userLocations.includes(originId);
        const isAtDest = userLocations.includes(destId);


        // 1. If Manifest is in China, only China staff can Depart
        if (status === 'CONSOLIDATED' && (isAtOrigin || isSuper)) return true;


        // 2. If Manifest is In-Transit, only Somalia staff can Arrive
        if (status === 'DEPARTED' && (isAtDest || isSuper)) return true;


        // 3. If Manifest has Arrived, only Somalia staff can Dismantle
        if (status === 'ARRIVED' && (isAtDest || isSuper)) return true;


        return false;
    }, [auth, user]);


    return {
        manifestId: id,
        auth,
        isLoading,
        isError,
        canAction,
        error: error as any, // 👈 Return the actual error object
        refetch,
        executeTransition: transitionMutation.mutate,
        isTransitioning: transitionMutation.isPending
    };
};
