import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { importService } from '../api/import.service';


export const useInventoryLogic = () => {
    const [search, setSearch] = useState('');
    const [mode, setMode] = useState<'AIR' | 'SEA' | ''>('');
    const [page, setPage] = useState(1);


    const { data: response, isLoading, isError, refetch } = useQuery({
        queryKey: ['inventory', search, mode, page],
        queryFn: () => importService.getInventory({
            search,
            transportMode: mode,
            status: 'RECEIVED_AT_ORIGIN',
            page
        }),
    });


    return {
        items: response?.data || [],
        pagination: response?.pagination,
        isLoading,
        isError,
        filters: { search, mode, page },
        setSearch,
        setMode,
        setPage,
        refetch
    };
};
