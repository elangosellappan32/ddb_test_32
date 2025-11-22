/**
 * Local Storage Utility for Allocation Percentages
 * This utility manages allocation percentage data locally without database persistence
 */

const LOCAL_STORAGE_KEY = 'allocationPercentages';

/**
 * Load allocation percentages from localStorage
 * @returns {Object} - Object containing allocation percentages keyed by generator-shareholder pairs
 */
export const loadAllocationPercentages = () => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Error loading allocation percentages from localStorage:', error);
    return {};
  }
};

/**
 * Save allocation percentages to localStorage
 * @param {Object} allocations - Object containing allocation percentages
 */
export const saveAllocationPercentages = (allocations) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allocations));
    console.log('Allocation percentages saved to localStorage:', allocations);
  } catch (error) {
    console.error('Error saving allocation percentages to localStorage:', error);
  }
};

/**
 * Update a single allocation percentage
 * @param {string} generatorCompanyId - Generator company ID
 * @param {string} shareholderCompanyId - Shareholder company ID  
 * @param {number} percentage - Allocation percentage (0-100)
 * @returns {boolean} - Success status
 */
export const updateAllocationPercentage = (generatorCompanyId, shareholderCompanyId, percentage) => {
  try {
    // Validate inputs
    if (!generatorCompanyId || !shareholderCompanyId) {
      console.error('Missing generator or shareholder company ID');
      return false;
    }

    if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
      console.error('Invalid percentage value. Must be between 0 and 100');
      return false;
    }

    const key = `${generatorCompanyId}-${shareholderCompanyId}`;
    const currentAllocations = loadAllocationPercentages();
    
    currentAllocations[key] = percentage;
    saveAllocationPercentages(currentAllocations);
    
    console.log(`Updated allocation percentage for ${key}: ${percentage}%`);
    return true;
  } catch (error) {
    console.error('Error updating allocation percentage:', error);
    return false;
  }
};

/**
 * Get allocation percentage for a specific generator-shareholder pair
 * @param {string} generatorCompanyId - Generator company ID
 * @param {string} shareholderCompanyId - Shareholder company ID
 * @returns {number} - Allocation percentage (0 if not found)
 */
export const getAllocationPercentage = (generatorCompanyId, shareholderCompanyId) => {
  try {
    if (!generatorCompanyId || !shareholderCompanyId) {
      return 0;
    }

    const key = `${generatorCompanyId}-${shareholderCompanyId}`;
    const allocations = loadAllocationPercentages();
    return parseFloat(allocations[key]) || 0;
  } catch (error) {
    console.error('Error getting allocation percentage:', error);
    return 0;
  }
};

/**
 * Get all allocation percentages for a generator company
 * @param {string} generatorCompanyId - Generator company ID
 * @returns {Object} - Object with shareholder IDs as keys and percentages as values
 */
export const getGeneratorAllocations = (generatorCompanyId) => {
  try {
    if (!generatorCompanyId) {
      return {};
    }

    const allAllocations = loadAllocationPercentages();
    const generatorAllocations = {};

    Object.entries(allAllocations).forEach(([key, percentage]) => {
      const [genId, shareId] = key.split('-');
      if (genId === generatorCompanyId) {
        generatorAllocations[shareId] = percentage;
      }
    });

    return generatorAllocations;
  } catch (error) {
    console.error('Error getting generator allocations:', error);
    return {};
  }
};

/**
 * Merge server allocation data with local allocations
 * Server data is used as fallback for missing local data
 * @param {Array} serverAllocations - Array of server allocation objects
 * @returns {Object} - Merged allocation data
 */
export const mergeWithServerData = (serverAllocations = []) => {
  try {
    const localAllocations = loadAllocationPercentages();
    const merged = { ...localAllocations };

    // Add server data for any missing local entries
    serverAllocations.forEach(alloc => {
      const key = `${alloc.generatorCompanyId}-${alloc.shareholderCompanyId}`;
      if (localAllocations[key] === undefined) {
        merged[key] = parseFloat(alloc.allocationPercentage) || 0;
      }
    });

    return merged;
  } catch (error) {
    console.error('Error merging with server data:', error);
    return loadAllocationPercentages();
  }
};

/**
 * Clear all allocation percentages from localStorage
 */
export const clearAllocationPercentages = () => {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    console.log('Allocation percentages cleared from localStorage');
  } catch (error) {
    console.error('Error clearing allocation percentages:', error);
  }
};

/**
 * Convert local allocation data to the format expected by the allocation calculator
 * @param {Object} localAllocations - Local allocation data
 * @returns {Array} - Array in captive data format
 */
export const convertToCaptiveDataFormat = (localAllocations = {}) => {
  const captiveData = [];

  Object.entries(localAllocations).forEach(([key, percentage]) => {
    const [generatorCompanyId, shareholderCompanyId] = key.split('-');
    
    if (percentage > 0) {
      captiveData.push({
        generatorCompanyId,
        shareholderCompanyId,
        allocationPercentage: percentage,
        allocationStatus: 'active',
        // These fields will be filled in by the calling code if needed
        generatorCompanyName: `Generator ${generatorCompanyId}`,
        shareholderCompanyName: `Shareholder ${shareholderCompanyId}`
      });
    }
  });

  return captiveData;
};
