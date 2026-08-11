import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { staffService } from '../api/staff.service';


export const useAuditTrailLogic = () => {
    const [filters, setFilters] = useState({
        search: '',
        start: '',
        end: ''
    });


    const { data: logs, isLoading, isError, refetch } = useQuery({
        queryKey: ['orgAuditTrail', filters],
        queryFn: () => staffService.getOrgAuditTrail(filters),
    });


    const updateFilter = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };


    const resetFilters = () => {
        setFilters({ search: '', start: '', end: '' });
    };


    return {
        logs: logs || [],
        isLoading,
        isError,
        filters,
        updateFilter,
        resetFilters,
        refetch
    };
};
