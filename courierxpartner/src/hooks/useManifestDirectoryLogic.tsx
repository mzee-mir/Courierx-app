import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { importService } from '../api/import.service';


export const useManifestDirectoryLogic = () => {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');


    const { data: manifests, isLoading, isError, refetch } = useQuery({
        queryKey: ['manifestsList'],
        queryFn: importService.getManifestsDirectory
    });


    // Filter Logic: Filter by search code and status
    const filteredManifests = useMemo(() => {
        if (!manifests) return [];
        return manifests.filter((m: any) => {
            const matchesSearch = m.manifestCode.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [manifests, search, statusFilter]);


    return {
        manifests: filteredManifests,
        totalCount: manifests?.length || 0,
        isLoading,
        isError,
        filters: { search, statusFilter },
        setSearch,
        setStatusFilter,
        refetch
    };
};
