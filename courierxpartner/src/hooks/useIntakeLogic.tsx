import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importService } from '../api/import.service';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'sonner';


export const useIntakeLogic = () => {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();


    // --- STATE ---
    const [trackingId, setTrackingId] = useState<string | null>(null);
    const [weight, setWeight] = useState('');
    const [mode, setMode] = useState<'AIR' | 'SEA'>('AIR');
    const [dims, setDims] = useState({ l: '', w: '', h: '' });
    const [destBranchId, setDestBranchId] = useState('');
    const [printData, setPrintData] = useState<any>(null);
    const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);


    // --- MUTATION ---
    const intakeMutation = useMutation({
        mutationFn: (payload: any) => importService.scanIntake(payload),
        onSuccess: (result, variables) => {
            toast.success('INTAKE_COMMITTED');


            // Prepare data for the Thermal Label
            setPrintData({
                cxCode: result.cxCode,
                phone: result.customerPhone,
                trackingId: variables.trackingNumber,
                weight: variables.weight,
                mode: variables.mode,
                cbm: result.calculatedCBM,
                dims: variables.dimensions,
                destination: "RESOLVING...", // Will be handled in UI
                category: "PARCEL"
            });


            // Trigger standard print
            setTimeout(() => {
                window.print();
                resetFlow();
            }, 500);
        },
        onError: (err: any) => {
            if (err.response?.data?.mode === 'QUICK_CREATE_REQUIRED') {
                setIsQuickCreateOpen(true);
            } else {
                toast.error('SYSTEM_REJECTED', { description: err.response?.data?.message });
            }
        }
    });


    const resetFlow = () => {
        setTrackingId(null);
        setWeight('');
        setDims({ l: '', w: '', h: '' });
    };


    const handleIntakeSubmit = () => {
        const currentLocationId = user?.assignedLocations?.[0];
        intakeMutation.mutate({
            trackingNumber: trackingId!,
            weight: parseFloat(weight),
            mode,
            locationId: currentLocationId,
            destinationBranchId: destBranchId,
            binLocation: "GZ_RECEIVING_DOCK",
            dimensions: mode === 'SEA' ? {
                l: Number(dims.l),
                w: Number(dims.w),
                h: Number(dims.h)
            } : undefined
        });
    };


    return {
        trackingId, setTrackingId,
        weight, setWeight,
        mode, setMode,
        dims, setDims,
        destBranchId, setDestBranchId,
        printData, setPrintData,
        isQuickCreateOpen, setIsQuickCreateOpen,
        isProcessing: intakeMutation.isPending,
        handleIntakeSubmit,
        resetFlow
    };
};
