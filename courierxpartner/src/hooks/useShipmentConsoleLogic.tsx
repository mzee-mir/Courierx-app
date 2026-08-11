import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../api/axios';


export const useShipmentConsoleLogic = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();


    const [weight, setWeight] = useState('');
    const [selectedManifestId, setSelectedManifestId] = useState('');
    const [evidenceRefs, setEvidenceRefs] = useState<string[]>([]);
    const [isLocked, setIsLocked] = useState(false);


    // 1. Fetch Shipment Authority & Metadata
    const { data: auth, isLoading, isError } = useQuery({
        queryKey: ['shipmentAuthority', id],
        queryFn: async () => {
            const res = await api.get(`/partner/shipments/${id}/authority`);
            return res.data.data;
        },
        staleTime: 0,
    });


    // 2. Hardened Transition Mutation
    const transitionMutation = useMutation({
        mutationFn: (payload: any) => api.patch(`/partner/shipments/${id}/transition`, payload),
        onSuccess: () => {
            toast.success('TRANSACTION_COMMITTED');
            navigate('/inventory');
        },
        onError: (err: any) => {
            toast.error('REJECTED', { description: err.response?.data?.message });
            setIsLocked(false);
        }
    });


    const handleExecute = (actionCode: string, requires: string[]) => {
        if (isLocked) return;


        // Validation logic
        if (actionCode === 'CONSOLIDATE_ITEM' && !selectedManifestId) {
            return toast.error('INPUT_REQUIRED', { description: 'Select a target manifest.' });
        }
        if (requires.includes('arrivalWeight') && !weight) {
            return toast.error('INPUT_REQUIRED', { description: 'Weight entry mandatory.' });
        }


        setIsLocked(true);
        transitionMutation.mutate({
            actionCode,
            manifestId: selectedManifestId,
            weight: parseFloat(weight),
            evidenceIds: evidenceRefs
        });
    };


    return {
        id,
        auth,
        isLoading,
        isError,
        weight, setWeight,
        selectedManifestId, setSelectedManifestId,
        evidenceRefs, setEvidenceRefs,
        isLocked,
        handleExecute,
        isProcessing: transitionMutation.isPending
    };
};
