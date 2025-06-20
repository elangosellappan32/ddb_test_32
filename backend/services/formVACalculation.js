const productionUnitDAL = require('../productionUnit/productionUnitDAL');
const consumptionUnitDAL = require('../consumptionUnit/consumptionUnitDAL');
const bankingDAL = require('../banking/bankingDAL');
const allocationDAL = require('../allocation/allocationDAL');
const consumptionSiteDAL = require('../consumptionSite/consumptionSiteDAL');
const logger = require('../utils/logger');

async function calculateFormVAMetrics(financialYear) {
    try {
        // Parse the financial year (e.g., '2024-2025')
        const [startYearStr, endYearStr] = financialYear.split('-');
        const startYear = parseInt(startYearStr, 10);
        const endYear = parseInt(endYearStr, 10);

        // Generate all months in the financial year (MMYYYY format)
        const months = [];
        // April to December of start year
        for (let month = 4; month <= 12; month++) {
            months.push(`${month.toString().padStart(2, '0')}${startYear}`);
        }
        // January to March of end year
        for (let month = 1; month <= 3; month++) {
            months.push(`${month.toString().padStart(2, '0')}${endYear}`);
        }

        logger.info('Processing months:', months);

        // Fetch all data from database
        const [productionData, consumptionData, bankingData, allocationData, consumptionSites] = await Promise.all([
            productionUnitDAL.getAllProductionUnits(),
            consumptionUnitDAL.getAllConsumptionUnits(),
            bankingDAL.getAllBankingUnits(),
            allocationDAL.getAllAllocatedUnits(),
            consumptionSiteDAL.getAllConsumptionSites()
        ]);

        // Filter data by months in the financial year
        const filterByMonths = (data) => {
            return data.filter(item => {
                if (!item.sk) return false;
                return months.includes(item.sk);
            });
        };

        const filteredProductionData = filterByMonths(productionData);
        const filteredConsumptionData = filterByMonths(consumptionData);
        const filteredBankingData = filterByMonths(bankingData);
        const filteredAllocationData = filterByMonths(allocationData);

        // Calculate total units for each dataset
        const calculateTotalUnits = (data) => {
            return data.reduce((sum, item) => {
                const periodSum = ['c1', 'c2', 'c3', 'c4', 'c5'].reduce((periodTotal, period) => 
                    periodTotal + (Number(item[period] || 0)), 0);
                return sum + periodSum;
            }, 0);
        };

        // Calculate main metrics from database data
        const totalGeneratedUnits = calculateTotalUnits(filteredProductionData);
        const auxiliaryConsumption = calculateTotalUnits(filteredConsumptionData);
        const totalBankingUnits = calculateTotalUnits(filteredBankingData);
        const aggregateGeneration = totalGeneratedUnits + totalBankingUnits;
        const percentage51 = Math.round(aggregateGeneration * 0.51);
        const totalAllocatedUnits = calculateTotalUnits(filteredAllocationData);
        const percentageAdjusted = aggregateGeneration > 0 
            ? ((totalAllocatedUnits / aggregateGeneration) * 100).toFixed(2)
            : 0;

        // Calculate site-specific metrics
        const siteMetrics = consumptionSites.map(site => {
            const siteAllocationData = filteredAllocationData.filter(item => 
                item.consumptionSiteId === site.id
            );
            
            const siteTotalAllocated = calculateTotalUnits(siteAllocationData);
            const siteShare = site.allocationPercentage || 0;
            
            // Use aggregateGeneration as the base for permitted consumption
            const basePermittedConsumption = aggregateGeneration;
            
            // Calculate variations
            const permittedConsumption = {
                base: basePermittedConsumption,
                minus10: basePermittedConsumption * 0.9,  // -10% variation
                withZero: basePermittedConsumption,       // 0% variation
                plus10: basePermittedConsumption * 1.1    // +10% variation
            };

            return {
                siteId: site.id,
                siteName: site.name,
                equityShares: site.equityShares || 0,
                allocationPercentage: siteShare,
                totalConsumptionUnits: siteTotalAllocated,
                annualGeneration: aggregateGeneration,
                auxiliaryConsumption: auxiliaryConsumption,
                verificationCriteria: percentage51,
                permittedConsumption,
                actualConsumption: siteTotalAllocated,
                // Check if actual consumption is within the permitted range
                normsCompliance: (
                    siteTotalAllocated <= permittedConsumption.plus10 && 
                    siteTotalAllocated >= permittedConsumption.minus10
                )
            };
        });

        logger.info('Form VA Calculations:', {
            totalGeneratedUnits,
            auxiliaryConsumption,
            aggregateGeneration,
            percentage51,
            totalAllocatedUnits,
            percentageAdjusted,
            siteMetrics: siteMetrics.map(site => ({
                siteName: site.siteName,
                actualConsumption: site.actualConsumption,
                permittedBase: site.permittedConsumption.base,
                variations: {
                    minus10: site.permittedConsumption.minus10,
                    withZero: site.permittedConsumption.withZero,
                    plus10: site.permittedConsumption.plus10
                }
            }))
        });

        return {
            totalGeneratedUnits,
            auxiliaryConsumption,
            aggregateGeneration,
            percentage51,
            totalAllocatedUnits,
            percentageAdjusted,
            siteMetrics
        };
    } catch (error) {
        logger.error('[calculateFormVAMetrics] Error:', error);
        throw error;
    }
}

module.exports = calculateFormVAMetrics;