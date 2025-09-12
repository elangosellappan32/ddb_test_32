/**
 * Processes allocation data for invoice generation
 * @param {Array} allocations - Array of allocation records
 * @returns {Array} Processed invoice data
 */
const processAllocations = (allocations) => {
  // Check if allocations is an array and not empty
  if (!Array.isArray(allocations) || allocations.length === 0) {
    console.warn('No allocation data provided or invalid format');
    return [];
  }

  // Group allocations by month and site
  const groupedAllocations = allocations.reduce((acc, allocation) => {
    const key = `${allocation.month}-${allocation.year}-${allocation.siteId}`;
    if (!acc[key]) {
      acc[key] = {
        month: allocation.month,
        year: allocation.year,
        siteId: allocation.siteId,
        siteName: allocation.siteName,
        totalUnits: 0,
        amount: 0,
        tax: 0,
        totalAmount: 0
      };
    }
    
    // Sum up the units and amounts
    acc[key].totalUnits += allocation.units || 0;
    acc[key].amount += allocation.amount || 0;
    acc[key].tax += allocation.tax || 0;
    acc[key].totalAmount += allocation.totalAmount || 0;
    
    return acc;
  }, {});

  // Convert the grouped object back to an array
  return Object.values(groupedAllocations);
};

module.exports = {
  processAllocations
};
