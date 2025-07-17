const AllocationDAL = require('../allocation/allocationDAL');
const logger = require('../utils/logger');
const ValidationError = require('../utils/errors').ValidationError;

const allocationDAL = new AllocationDAL();

const getGraphicalAllocationReport = async (req, res, next) => {
    try {
        const { startMonth, endMonth, sites } = req.query;
        
        if (!startMonth || !endMonth) {
            throw new ValidationError('Start and end month parameters are required (format: MMYYYY)');
        }

        // Validate month format
        const monthRegex = /^(0[1-9]|1[0-2])\d{4}$/;
        if (!monthRegex.test(startMonth) || !monthRegex.test(endMonth)) {
            throw new ValidationError('Invalid month format. Use MMYYYY format (e.g., 012024)');
        }

        // Parse sites parameter if provided
        const sitesList = sites ? sites.split(',') : [];

        // Fetch all allocations within the date range
        const allocations = await allocationDAL.getAllocations();
        
        // Filter allocations by date range and sites
        const filteredAllocations = allocations.filter(allocation => {
            const monthInRange = allocation.sk >= startMonth && allocation.sk <= endMonth;
            if (!monthInRange) return false;
            
            if (sitesList.length > 0) {
                const [_, productionSiteId] = allocation.pk.split('_');
                return sitesList.includes(productionSiteId);
            }
            return true;
        });

        // Process data for charts
        const processedData = processAllocationData(filteredAllocations);

        res.json({
            success: true,
            data: processedData
        });
    } catch (error) {
        logger.error('[GraphicalReportController] GetGraphicalAllocationReport Error:', error);
        next(error);
    }
};

function processAllocationData(allocations) {
    // Group allocations by month
    const monthlyData = {};
    const siteData = {};

    allocations.forEach(allocation => {
        const [companyId, productionSiteId, consumptionSiteId] = allocation.pk.split('_');
        const month = allocation.sk;
        const siteKey = `${productionSiteId}_${consumptionSiteId}`;

        // Initialize monthly data structure
        if (!monthlyData[month]) {
            monthlyData[month] = {
                c1: 0, c2: 0, c3: 0, c4: 0, c5: 0,
                total: 0
            };
        }

        // Initialize site data structure
        if (!siteData[siteKey]) {
            siteData[siteKey] = {
                productionSiteId,
                consumptionSiteId,
                monthlyAllocations: {},
                totalAllocation: 0
            };
        }

        // Calculate period totals
        ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(period => {
            const value = Number(allocation[period] || 0);
            monthlyData[month][period] += value;
            monthlyData[month].total += value;

            // Add to site-specific data
            if (!siteData[siteKey].monthlyAllocations[month]) {
                siteData[siteKey].monthlyAllocations[month] = {
                    c1: 0, c2: 0, c3: 0, c4: 0, c5: 0,
                    total: 0
                };
            }
            siteData[siteKey].monthlyAllocations[month][period] = value;
            siteData[siteKey].monthlyAllocations[month].total += value;
            siteData[siteKey].totalAllocation += value;
        });
    });

    // Convert to arrays for charting
    const months = Object.keys(monthlyData).sort();
    const lineChartData = {
        labels: months,
        datasets: [
            { label: 'C1', data: months.map(m => monthlyData[m].c1) },
            { label: 'C2', data: months.map(m => monthlyData[m].c2) },
            { label: 'C3', data: months.map(m => monthlyData[m].c3) },
            { label: 'C4', data: months.map(m => monthlyData[m].c4) },
            { label: 'C5', data: months.map(m => monthlyData[m].c5) }
        ]
    };

    const barChartData = {
        labels: months,
        datasets: [{
            label: 'Total Allocation',
            data: months.map(m => monthlyData[m].total)
        }]
    };

    // Process site-specific data
    const siteSpecificData = Object.values(siteData).map(site => ({
        productionSiteId: site.productionSiteId,
        consumptionSiteId: site.consumptionSiteId,
        totalAllocation: site.totalAllocation,
        monthlyData: Object.entries(site.monthlyAllocations).map(([month, data]) => ({
            month,
            ...data
        }))
    }));

    return {
        overall: {
            lineChart: lineChartData,
            barChart: barChartData
        },
        siteSpecific: siteSpecificData
    };
}

module.exports = {
    getGraphicalAllocationReport
};
