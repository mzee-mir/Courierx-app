import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffService } from '../api/staff.service';
import { importService } from '../api/import.service';
import { userService } from '../api/user.service';
import { useSudo } from '../store/SudoContext';
import { toast } from 'sonner';


export const useStaffManagerLogic = () => {
    const queryClient = useQueryClient();
    const { requireSudo } = useSudo();


    // --- UI MODAL STATES ---
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isPermModalOpen, setIsPermModalOpen] = useState(false);
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
    const [targetWorker, setTargetWorker] = useState<any>(null);


    // --- DATA FETCHING ---
    const { data: staff, isLoading: loadingStaff } = useQuery({
        queryKey: ['partnerStaff'],
        queryFn: staffService.getOrgStaff
    });


    const { data: locations } = useQuery({
        queryKey: ['myLocations'],
        queryFn: () => importService.getLocations()
    });


    // --- MUTATIONS ---
    const hireMutation = useMutation({
        mutationFn: (payload: any) => staffService.createWorker(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partnerStaff'] });
            setIsAddModalOpen(false);
            toast.success('PERSONNEL_ONBOARDED');
        }
    });


    const permMutation = useMutation({
        mutationFn: (perms: string[]) => staffService.updatePermissions(targetWorker.id || targetWorker._id, perms),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partnerStaff'] });
            setIsPermModalOpen(false);
            toast.success('KEYCHAIN_UPDATED');
        }
    });


    const killMutation = useMutation({
        mutationFn: (id: string) => userService.terminateSessions(id),
        onSuccess: () => {
            toast.success('SESSION_TERMINATED');
            queryClient.invalidateQueries({ queryKey: ['partnerStaff'] });
        }
    });


    const handleKillSession = (id: string, name: string) => {
        requireSudo(() => killMutation.mutate(id), `REVOKE_STATION_ACCESS: ${name}`);
    };


    return {
        staff: staff || [],
        locations: locations || [],
        isLoading: loadingStaff,
        modals: {
            add: { isOpen: isAddModalOpen, set: setIsAddModalOpen },
            perm: { isOpen: isPermModalOpen, set: setIsPermModalOpen },
            logs: { id: selectedStaffId, set: setSelectedStaffId }
        },
        targetWorker, setTargetWorker,
        hireWorker: hireMutation.mutate,
        isHiring: hireMutation.isPending,
        updatePermissions: permMutation.mutate,
        isUpdatingPerms: permMutation.isPending,
        handleKillSession
    };
};
