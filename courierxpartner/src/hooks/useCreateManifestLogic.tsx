import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importService } from '../api/import.service';
import api from '../api/axios';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'sonner';


export const useCreateManifestLogic = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();


    const [mode, setMode] = useState<'AIR' | 'SEA'>('AIR');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [destHubId, setDestHubId] = useState('');
    const [manifestCode, setManifestCode] = useState(`MAN-${Math.floor(100000 + Math.random() * 900000)}`);


    // 1. Fetch "Floor" Inventory (Filtered by mode)
    const { data: floor, isLoading: loadingFloor } = useQuery({
        queryKey: ['floorInventory', mode],
        queryFn: () => importService.getInventory({ status: 'RECEIVED_AT_ORIGIN', transportMode: mode }),
    });


    // 2. Fetch Somali Hubs (Gateways)
    const { data: locations } = useQuery({
        queryKey: ['myLocations'],
        queryFn: () => api.get('/partner/my-locations').then(res => res.data.locations)
    });


    const somaliGateways = useMemo(() => {
        return locations?.filter((l: any) => l.country === 'SO') || [];
    }, [locations]);


    // Default to Mogadishu if available
    useEffect(() => {
        if (somaliGateways.length > 0 && !destHubId) {
            const mgq = somaliGateways.find((b: any) => b.city.toUpperCase() === 'MOGADISHU');
            if (mgq) setDestHubId(mgq.id);
        }
    }, [somaliGateways, destHubId]);


    // 3. Math: Calculate Totals
    const totals = useMemo(() => {
        const selectedItems = floor?.data?.filter((s: any) => selectedIds.includes(s.id)) || [];
        return {
            count: selectedItems.length,
            weight: selectedItems.reduce((acc: number, s: any) => acc + (Number(s.weight) || 0), 0)
        };
    }, [selectedIds, floor]);


    // 4. Mutation: Seal
    const consolidateMutation = useMutation({
        mutationFn: (payload: any) => importService.consolidateManifest(payload),
        onSuccess: () => {
            toast.success('MANIFEST_SEALED');
            queryClient.invalidateQueries({ queryKey: ['floorInventory'] });
            queryClient.invalidateQueries({ queryKey: ['manifestsList'] });
            setSelectedIds([]);
        },
        onError: (err: any) => toast.error('SEAL_FAILED', { description: err.response?.data?.message })
    });


    const handleSeal = () => {
        if (selectedIds.length === 0 || !destHubId) return;
        consolidateMutation.mutate({
            manifestCode,
            originHub: user?.assignedLocations?.[0],
            destinationHub: destHubId,
            shippingMode: mode,
            shipmentIds: selectedIds,
            metadata: { estimatedArrival: new Date(Date.now() + 7 * 86400000).toISOString() }
        });
    };


    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };


    return {
        floorItems: floor?.data || [],
        somaliGateways,
        isLoading: loadingFloor,
        mode, setMode,
        selectedIds, toggleSelect,
        destHubId, setDestHubId,
        manifestCode, setManifestCode,
        totals,
        handleSeal,
        isSealing: consolidateMutation.isPending
    };
};
