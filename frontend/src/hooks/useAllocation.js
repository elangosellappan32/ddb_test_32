import { useState, useEffect, useCallback, useContext } from 'react';
import allocationApi from '../services/allocationapi';
import { useSnackbar } from 'notistack';
import { AuthContext } from '../context/AuthContext';

const POLLING_INTERVAL = 30000; // 30 seconds

const useAllocation = (initialMonth) => {
    const { user } = useContext(AuthContext);
    const [allocations, setAllocations] = useState({
        allocations: [],
        banking: [],
        lapse: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedType, setSelectedType] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState(initialMonth);
    const { enqueueSnackbar } = useSnackbar();

    const showNotification = useCallback((message, type = 'info') => {
        enqueueSnackbar(message, {
            variant: type,
            anchorOrigin: {
                vertical: 'top',
                horizontal: 'right'
            }
        });
    }, [enqueueSnackbar]);

    const fetchAllocations = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            if (!user || !user.companyId) {
                throw new Error('User not authenticated or company not found');
            }

            if (selectedType === 'all') {
                // Pass company ID to filter allocations
                const results = await allocationApi.fetchAll(selectedMonth, user.companyId);
                setAllocations(results);
            } else {
                // Pass company ID to filter by type
                const data = await allocationApi.fetchByType(selectedType, selectedMonth, user.companyId);
                setAllocations(prev => ({
                    ...prev,
                    [selectedType]: data
                }));
            }
        } catch (error) {
            const message = error.message || 'Failed to fetch allocations';
            setError(message);
            showNotification(message, 'error');
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedType, showNotification]);

    // Initial fetch
    useEffect(() => {
        fetchAllocations();
    }, [fetchAllocations]);

    // Polling for updates
    useEffect(() => {
        const pollTimer = setInterval(fetchAllocations, POLLING_INTERVAL);
        return () => clearInterval(pollTimer);
    }, [fetchAllocations]);

    const handleTypeChange = (type) => {
        setSelectedType(type);
    };

    const handleMonthChange = (month) => {
        setSelectedMonth(month);
    };

    const createAllocation = async (data, type = 'ALLOCATION') => {
        try {
            if (!user || !user.companyId) {
                throw new Error('User not authenticated or company not found');
            }
            
            setError(null);
            // Ensure the allocation is associated with the user's company
            const allocationData = {
                ...data,
                companyId: user.companyId
            };
            const result = await allocationApi.create(allocationData, type);
            showNotification(`${type} created successfully`, 'success');
            await fetchAllocations();
            return result;
        } catch (error) {
            const message = error.message || `Failed to create ${type}`;
            setError(message);
            showNotification(message, 'error');
            throw error;
        }
    };

    const updateAllocation = async (pk, sk, data, type = 'ALLOCATION') => {
        try {
            setError(null);
            const result = await allocationApi.update(pk, sk, data, type);
            showNotification(`${type} updated successfully`, 'success');
            await fetchAllocations();
            return result;
        } catch (error) {
            const message = error.message || `Failed to update ${type}`;
            setError(message);
            showNotification(message, 'error');
            throw error;
        }
    };

    const deleteAllocation = async (pk, sk, type = 'ALLOCATION') => {
        try {
            setError(null);
            await allocationApi.delete(pk, sk, type);
            showNotification(`${type} deleted successfully`, 'success');
            await fetchAllocations();
        } catch (error) {
            const message = error.message || `Failed to delete ${type}`;
            setError(message);
            showNotification(message, 'error');
            throw error;
        }
    };

    const batchCreate = async (allocations, type = 'ALLOCATION') => {
        try {
            setError(null);
            const result = await allocationApi.batchCreate(allocations, type);
            showNotification(`Batch ${type} creation successful`, 'success');
            await fetchAllocations();
            return result;
        } catch (error) {
            const message = error.message || `Failed to create ${type} batch`;
            setError(message);
            showNotification(message, 'error');
            throw error;
        }
    };

    return {
        allocations,
        loading,
        error,
        selectedType,
        selectedMonth,
        handleTypeChange,
        handleMonthChange,
        createAllocation,
        updateAllocation,
        deleteAllocation,
        batchCreate,
        refreshAllocations: fetchAllocations
    };
};

export default useAllocation;