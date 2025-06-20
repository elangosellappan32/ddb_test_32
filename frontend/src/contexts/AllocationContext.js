import React, { createContext, useContext } from 'react';
import useAllocation from '../hooks/useAllocation';

const AllocationContext = createContext(null);

export const useAllocationContext = () => {
    const context = useContext(AllocationContext);
    if (!context) {
        throw new Error('useAllocationContext must be used within an AllocationProvider');
    }
    return context;
};

export const AllocationProvider = ({ children, initialMonth }) => {
    const allocationState = useAllocation(initialMonth);

    return (
        <AllocationContext.Provider value={allocationState}>
            {children}
        </AllocationContext.Provider>
    );
};

export default AllocationContext;