import { useState, useEffect, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import allocationApi from '../services/allocationApi';

const POLLING_INTERVAL = 30000; // 30 seconds

export const useAllocationState = (initialMonth) => {
    const [allocations, setAllocations] = useState({
        allocations: [],
        banking: [],
        lapse: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(initialMonth);
    const { enqueueSnackbar } = useSnackbar();

    const showNotification = useCallback((message, type, entity) => {
        enqueueSnackbar(message, {
            variant: type,
            anchorOrigin: {
                vertical: 'top',
                horizontal: 'right'
            }
        });
    }, [enqueueSnackbar]);

    const fetchAllocations = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await allocationApi.fetchAll(selectedMonth);
            setAllocations(response);
        } catch (error) {
            console.error('Error fetching allocations:', error);
            showNotification('Failed to load allocations', 'error', 'allocation');
        } finally {
            setIsLoading(false);
        }
    }, [selectedMonth, showNotification]);

    const updateAllocation = useCallback((type, updatedItem) => {
        setAllocations(prev => ({
            ...prev,
            [type]: prev[type].map(item => 
                item.id === updatedItem.id ? updatedItem : item
            )
        }));
    }, []);

    const addAllocation = useCallback((type, newItem) => {
        setAllocations(prev => ({
            ...prev,
            [type]: [...prev[type], newItem]
        }));
    }, []);

    const removeAllocation = useCallback((type, id) => {
        setAllocations(prev => ({
            ...prev,
            [type]: prev[type].filter(item => item.id !== id)
        }));
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchAllocations();
    }, [fetchAllocations]);

    // Polling for updates
    useEffect(() => {
        const pollTimer = setInterval(fetchAllocations, POLLING_INTERVAL);
        return () => clearInterval(pollTimer);
    }, [fetchAllocations]);

    return {
        allocations,
        isLoading,
        selectedMonth,
        setSelectedMonth,
        fetchAllocations,
        updateAllocation,
        addAllocation,
        removeAllocation
    };
};

export default useAllocationState;