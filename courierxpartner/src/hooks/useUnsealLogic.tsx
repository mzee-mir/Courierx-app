import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importService } from '../api/import.service';
import api from '../api/axios';
import { toast } from 'sonner';


export const useUnsealLogic = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();


    const [activeItem, setActiveItem] = useState<any>(null);
    const [weight, setWeight] = useState('');
    const [evidenceRefs, setEvidenceRefs] = useState<string[]>([]);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    // 1. Fetch Manifest Details (Populates the checklist)
    const { data: auth, isLoading, isError } = useQuery({
        queryKey: ['manifestAuthority', id],
        queryFn: () => api.get(`/partner/manifests/${id}/authority`).then(res => res.data.data)
    });


    // 2. Mutation: Verify Individual Item
    const verifyMutation = useMutation({
        mutationFn: (payload: any) => importService.verifyUnsealItem(id!, payload),
        onSuccess: () => {
            toast.success('ITEM_VERIFIED');
            setActiveItem(null);
            setWeight('');
            setEvidenceRefs([]);
            queryClient.invalidateQueries({ queryKey: ['manifestAuthority', id] });
        },
        onError: (err: any) => toast.error('VERIFICATION_FAILED', { description: err.response?.data?.message })
    });


    const closeVerification = () => {
        setActiveItem(null);
        setWeight('');
        setEvidenceRefs([]);
    };


    // 3. Mutation: Finalize Unsealing
    const finalizeMutation = useMutation({
        mutationFn: (notes: string) => importService.finalizeUnsealing(id!, notes),
        onSuccess: () => {
            toast.success('MANIFEST_DISMANTLED');
            navigate('/manifests/directory');
        }
    });


    const progress = auth ? {
        verified: auth.manifest.shipmentIds.filter((s: any) => s.status === 'READY_FOR_LOCAL_HANDOFF').length,
        total: auth.manifest.shipmentIds.length
    } : { verified: 0, total: 0 };


    return {
        manifestId: id,
        manifest: auth?.manifest,
        progress,
        activeItem, setActiveItem,
        weight, setWeight,
        evidenceRefs, setEvidenceRefs,
        isFinalizing, setIsFinalizing,
        isLoading,
        executeVerify: verifyMutation.mutate,
        isVerifying: verifyMutation.isPending,
        executeFinalize: finalizeMutation.mutate,
        isFinalizingPending: finalizeMutation.isPending
    };
};
