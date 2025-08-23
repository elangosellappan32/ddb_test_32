/**
 * Validates production data to prevent duplicates
 * @param {Object} newData - The new data to be validated
 * @param {Array} existingData - Array of existing data to check against
 * @returns {Object} Validation result with isValid boolean and optional error message
 */
export const validateProductionData = (newData, existingData) => {
  if (!existingData || !Array.isArray(existingData)) {
    return { isValid: true };
  }

  // Check if data exists for this SK (date) and same type
  const duplicateEntry = existingData.find(item => 
    item.sk === newData.sk && 
    item.productionSiteId === newData.productionSiteId &&
    item.dataType === newData.dataType
  );

  if (duplicateEntry) {
    return {
      isValid: false,
      message: 'A record already exists for this date and site.'
    };
  }

  return { isValid: true };
};

/**
 * Validates that all required fields are present and have valid values
 * @param {Object} data - The data to validate
 * @param {string} type - The type of data ('unit' or 'charge')
 * @returns {Object} Validation result with isValid boolean and optional error message
 */
export const validateProductionFields = (data, type) => {
  if (!data.sk || data.sk.length !== 6) {
    return { isValid: false, message: 'Invalid date format' };
  }

  if (type === 'unit') {
    const requiredFields = ['c1', 'c2', 'c3', 'c4', 'c5'];
    for (const field of requiredFields) {
      const value = parseFloat(data[field]);
      if (isNaN(value) || value < 0) {
        return { 
          isValid: false, 
          message: `Invalid value for ${field}. Must be a non-negative number.` 
        };
      }
    }
  } else {
    // For charge data, validate all c001-c011 fields
    for (let i = 1; i <= 11; i++) {
      const field = `c${i.toString().padStart(3, '0')}`;
      const value = parseFloat(data[field]);
      if (isNaN(value) || value < 0) {
        return { 
          isValid: false, 
          message: `Invalid value for ${field}. Must be a non-negative number.` 
        };
      }
    }
  }

  return { isValid: true };
};
