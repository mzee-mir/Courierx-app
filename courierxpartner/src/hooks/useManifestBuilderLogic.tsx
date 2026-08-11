import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importService } from '../api/import.service';
import api from '../api/axios';
import { toast } from 'sonner';


export const useManifestBuilderLogic = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();


    // 1. Fetch the Manifest Draft
    const { data: draft, isLoading: loadingDraft } = useQuery({
        queryKey: ['manifestDraft', id],
        queryFn: () => api.get(`/partner/manifests/${id}`).then(res => res.data.data),
        enabled: !!id
    });


    // 2. Fetch Available Floor Items (Filtered by the draft's mode)
    const { data: floor, isLoading: loadingFloor } = useQuery({
        queryKey: ['floorInventory', draft?.shippingMode],
        queryFn: () => importService.getInventory({
            status: 'RECEIVED_AT_ORIGIN',
            transportMode: draft?.shippingMode
        }),
        enabled: !!draft?.shippingMode
    });


    // 3. Mutation: Update Draft (Add/Remove items)
    const syncMutation = useMutation({
        mutationFn: (newIds: string[]) => importService.updateDraft(id!, newIds),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manifestDraft', id] })
    });


    // 4. Mutation: Seal Manifest (The Point of No Return)
    const sealMutation = useMutation({
        mutationFn: () => importService.sealManifest(id!),
        onSuccess: () => {
            toast.success('MANIFEST_SEALED_AND_LOCKED');
            navigate(`/manifests/${id}`); // Move to read-only control page
        },
        onError: (err: any) => toast.error('SEAL_FAILED', { description: err.response?.data?.message })
    });


    // Logic Helpers
    const handleAddItem = (shipmentId: string) => {
        const currentIds = draft?.shipmentIds.map((s: any) => s._id || s.id) || [];
        if (currentIds.includes(shipmentId)) return;
        syncMutation.mutate([...currentIds, shipmentId]);
    };


    const handleRemoveItem = (shipmentId: string) => {
        const currentIds = draft?.shipmentIds.map((s: any) => s._id || s.id) || [];
        syncMutation.mutate(currentIds.filter((i: string) => i !== shipmentId));
    };


    const totals = useMemo(() => {
        return {
            count: draft?.shipmentIds?.length || 0,
            weight: draft?.shipmentIds?.reduce((acc: number, s: any) => acc + Number(s.intake_weight || 0), 0) || 0
        };
    }, [draft]);


    return {
        draft,
        floorItems: floor?.data || [],
        isLoading: loadingDraft || loadingFloor,
        totals,
        handleAddItem,
        handleRemoveItem,
        sealManifest: sealMutation.mutate,
        isSealing: sealMutation.isPending,
        isSyncing: syncMutation.isPending
    };
};
