// Period constants
export const PEAK_PERIODS = ['c2', 'c3'];
export const NON_PEAK_PERIODS = ['c1', 'c4', 'c5'];
export const ALL_PERIODS = ['c1', 'c2', 'c3', 'c4', 'c5'];  // Ordered from c1 to c5

export const ALLOCATION_TYPES = {
    ALLOCATION: 'Allocation',
    BANKING: 'Banking',
    LAPSE: 'Lapse'
};

export const isPeakPeriod = (period) => PEAK_PERIODS.includes(period);
export const isNonPeakPeriod = (period) => NON_PEAK_PERIODS.includes(period);

/**
 * Get display name for allocation type
 */
export const getTypeDisplayName = (type) => {
    switch (type?.toLowerCase()) {
        case 'banking':
            return 'Banking';
        case 'lapse':
            return 'Lapse';
        default:
            return 'Regular Allocation';
    }
};

/**
 * Returns a color code for different allocation types
 */
export const getAllocationTypeColor = (type) => {
    switch (type?.toLowerCase()) {
        case 'allocation':
            return '#2196f3'; // Blue
        case 'banking':
            return '#4caf50'; // Green
        case 'lapse':
            return '#f44336'; // Red
        default:
            return '#757575'; // Grey
    }
};

/**
 * Normalize allocated values to ensure all periods exist with default value 0
 */
export const normalizeAllocatedValues = (allocated = {}, type = 'ALLOCATION') => {
    return ALL_PERIODS.reduce((acc, period) => {
        // For banking type, allow negative values
        if (type === 'BANKING') {
            acc[period] = Number(allocated[period] || 0);
        } else {
            acc[period] = Math.max(0, Math.round(Number(allocated[period] || 0)));
        }
        return acc;
    }, {});
};

/**
 * Rounds all numeric values in an allocation object to integers
 */
export const roundAllocationValues = (allocation) => {
    if (!allocation?.allocated) return allocation;

    return {
        ...allocation,
        allocated: normalizeAllocatedValues(allocation.allocated, allocation.type)
    };
};

/**
 * Validates basic allocation requirements
 */
export const validateAllocation = (allocation) => {
    const errors = [];
    
    // Validate required fields
    const requiredFields = ['productionSiteId', 'siteName'];
    requiredFields.forEach(field => {
        if (!allocation[field]) {
            errors.push(`${field} is required`);
        }
    });

    // Validate allocation values
    if (allocation.allocated) {
        Object.entries(allocation.allocated).forEach(([period, value]) => {
            const numValue = Number(value);
            if (isNaN(numValue) || numValue < 0) {
                errors.push(`Invalid value for period ${period}`);
            }
        });
    }

    return {
        isValid: errors.length === 0,
        errors,
        allocation: roundAllocationValues(allocation)
    };
};

/**
 * Validates period rules for allocations
 */
export const validatePeriodRules = (allocation) => {
    const errors = [];
    if (!allocation?.allocated) {
        return { isValid: false, errors: ['No allocation data provided'] };
    }

    const roundedAllocation = roundAllocationValues(allocation);
    const { allocated } = roundedAllocation;

    // Check mixing of peak and non-peak periods
    const hasPeak = PEAK_PERIODS.some(p => Math.round(Number(allocated[p] || 0)) > 0);
    const hasNonPeak = NON_PEAK_PERIODS.some(p => Math.round(Number(allocated[p] || 0)) > 0);
    
    if (hasPeak && hasNonPeak) {
        errors.push('Cannot mix peak and non-peak period allocations');
    }

    // Check for negative values
    for (const period of ALL_PERIODS) {
        const value = Math.round(Number(allocated[period] || 0));
        if (value < 0) {
            errors.push(`Period ${period} cannot have negative value`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        allocation: roundedAllocation
    };
};

/**
 * Calculates total units for a given allocation or unit data
 */
export const calculateTotal = (data, periods = ALL_PERIODS) => {
    if (!data) return 0;
    return periods.reduce((sum, period) => 
        sum + Math.round(Number(data[period] || 0)), 0
    );
};

/**
 * Calculate available units by period type
 */
export const getAvailableUnits = (site) => {
    return ALL_PERIODS.reduce((acc, period) => {
        acc[period] = Math.round(Number(site[period] || 0));
        return acc;
    }, {});
};

/**
 * Update available units after allocation
 */
export const updateAvailableUnits = (availableUnits, allocated) => {
    if (!allocated) return;
    ALL_PERIODS.forEach(period => {
        availableUnits[period] = Math.round(availableUnits[period] || 0) - 
                                Math.round(allocated[period] || 0);
    });
};

/**
 * Create allocation based on production and consumption sites
 */
export const createAllocation = (productionSite, consumptionSite, availableUnits) => {
    if (!productionSite?.productionSiteId || !consumptionSite?.consumptionSiteId) {
        return null;
    }

    const allocation = {
        productionSiteId: productionSite.productionSiteId.toString(),
        consumptionSiteId: consumptionSite.consumptionSiteId.toString(),
        productionSite: productionSite.siteName,
        consumptionSite: consumptionSite.siteName,
        siteName: productionSite.siteName,
        type: 'Allocation',
        allocated: {}
    };

    let totalAllocated = 0;
    ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(period => {
        const available = Math.round(Number(availableUnits[period] || 0));
        const required = Math.round(Number(consumptionSite[period] || 0));
        
        if (available > 0 && required > 0) {
            const allocated = Math.min(available, required);
            if (allocated > 0) {
                allocation.allocated[period] = allocated;
                totalAllocated += allocated;
            }
        }
    });

    return totalAllocated > 0 ? { ...allocation, totalUnits: totalAllocated } : null;
};

/**
 * Format allocation data for display
 */
export const formatAllocationForDisplay = (allocation) => {
    if (!allocation) return null;

    return {
        ...allocation,
        allocated: normalizeAllocatedValues(allocation.allocated)
    };
};

/**
 * Formats a date string or timestamp into a localized date string
 */
export const formatDate = (date, options = {}) => {
    if (!date) return '';
    
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options
    };

    return new Date(date).toLocaleDateString(undefined, defaultOptions);
};

/**
 * Formats a month number (1-12) and year into the API format (MMYYYY)
 */
export const formatAllocationMonth = (month) => {
    const date = new Date();
    return `${String(month).padStart(2, '0')}${date.getFullYear()}`;
};

/**
 * Format month key for DynamoDB SK (MMYYYY format)
 */
export const formatSortKey = (month, year) => {
    return `${String(month).padStart(2, '0')}${year}`;
};

/**
 * Parse SK to get month and year
 */
export const parseSortKey = (sk) => {
    if (!sk || sk.length !== 6) {
        throw new Error('Invalid sort key format');
    }
    
    const month = parseInt(sk.substring(0, 2));
    const year = parseInt(sk.substring(2));
    
    if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
        throw new Error('Invalid sort key values');
    }
    
    return { month, year };
};

/**
 * Groups allocations by their type
 */
export const groupAllocationsByType = (allocations) => {
    if (!Array.isArray(allocations)) return {};

    return allocations.reduce((groups, allocation) => {
        const type = allocation.type || 'unknown';
        if (!groups[type]) {
            groups[type] = [];
        }
        groups[type].push(allocation);
        return groups;
    }, {});
};

/**
 * Sort allocations by date, newest first
 */
export const sortAllocationsByDate = (allocations) => {
    if (!Array.isArray(allocations)) return [];

    return [...allocations].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.date || 0);
        const dateB = new Date(b.createdAt || b.date || 0);
        return dateB - dateA;
    });
};

/**
 * Get available allocation periods
 */
export const getAllocationPeriods = () => ([
  { id: 'c1', label: 'C1', isPeak: false },
  { id: 'c2', label: 'C2', isPeak: true },
  { id: 'c3', label: 'C3', isPeak: true },
  { id: 'c4', label: 'C4', isPeak: false },
  { id: 'c5', label: 'C5', isPeak: false }
]);

/**
 * Validates banking balance
 */
export const validateBankingBalance = (currentBalance, previousBalance) => {
    const errors = [];

    if (!previousBalance) {
        return { isValid: true, errors: [] };
    }

    // Normalize both balances
    const current = normalizeAllocatedValues(currentBalance);
    const previous = normalizeAllocatedValues(previousBalance);

    // Calculate net balance for each period
    ALL_PERIODS.forEach(period => {
        const oldValue = Number(previous[period] || 0);
        const newValue = Number(current[period] || 0);
        const netBalance = newValue + oldValue;  // Add because banking values are stored as negatives
        
        if (netBalance < 0) {
            errors.push(`Net banking balance for period ${period} cannot be negative`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Gets all months in a financial year
 */
export const getFinancialYearMonths = (year) => {
    const months = [];
    // April to December of selected year
    for (let month = 4; month <= 12; month++) {
        months.push(`${month.toString().padStart(2, '0')}${year}`);
    }
    // January to March of next year
    for (let month = 1; month <= 3; month++) {
        months.push(`${month.toString().padStart(2, '0')}${year + 1}`);
    }
    return months;
};

/**
 * Gets financial year for a given month and year
 */
export const getFinancialYear = (month, year) => {
    return month >= 4 ? year : year - 1;
};

/**
 * Get available total units for a site
 */
export const getAvailableTotal = (site) => {
    if (!site) return 0;
    
    return ['c1', 'c2', 'c3', 'c4', 'c5'].reduce((sum, period) => {
        const value = Number(site[period] || 0);
        return sum + (isNaN(value) ? 0 : Math.round(value));
    }, 0);
};

/**
 * Update site units after allocation
 */
export const updateSiteUnits = (site, allocation) => {
    const updatedSite = { ...site };
    updatedSite.totalUnits = (Number(site.totalUnits) || 0) - (Number(allocation.totalUnits) || 0);
    return updatedSite;
};

/**
 * Calculate total allocation for the given periods
 */
export const calculateAllocationTotal = (allocation, periods = ALL_PERIODS) => {
    if (!allocation?.allocated) return 0;
    
    const normalized = normalizeAllocatedValues(allocation.allocated);
    return periods.reduce((sum, period) => sum + normalized[period], 0);
};

/**
 * Calculate allocation summary
 */
export const calculateAllocationSummary = (allocations) => {
    const summary = {
        total: 0,
        allocated: 0,
        banking: 0,
        lapse: 0
    };

    if (!Array.isArray(allocations)) return summary;

    allocations.forEach(allocation => {
        const total = calculateAllocationTotal(allocation);
        summary.total += total;

        switch (allocation.type?.toLowerCase()) {
            case 'banking':
                summary.banking += total;
                break;
            case 'lapse':
                summary.lapse += total;
                break;
            default:
                summary.allocated += total;
                break;
        }
    });

    return summary;
};

/**
 * Calculate net banking units (new banking - used banking)
 */
export const calculateNetBankingUnits = (newBanking, usedBanking) => {
    const result = {};
    ALL_PERIODS.forEach(period => {
        const newValue = Number(newBanking[period] || 0);
        const usedValue = Number(usedBanking[period] || 0);
        result[period] = newValue - usedValue;
    });
    return result;
};

/**
 * Validates banking data
 */
export const validateBankingData = (bankingData) => {
    const errors = [];

    if (!bankingData?.productionSiteId?.toString()) {
        errors.push('Invalid production site ID');
    }

    if (!bankingData?.siteName?.trim()) {
        errors.push('Site name is required');
    }

    if (bankingData?.allocated) {
        // For banking, just ensure values are valid numbers (can be negative)
        const normalized = normalizeAllocatedValues(bankingData.allocated, 'BANKING');
        Object.entries(normalized).forEach(([period, value]) => {
            if (isNaN(value)) {
                errors.push(`Invalid value for period ${period}`);
            }
        });

        // Update allocated values to normalized form
        bankingData.allocated = normalized;
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Check if any period has allocation
 */
export const hasAnyAllocation = (allocated) => {
    const normalized = normalizeAllocatedValues(allocated);
    return Object.values(normalized).some(value => value > 0);
};