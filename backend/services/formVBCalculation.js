const productionUnitDAL = require('../productionUnit/productionUnitDAL');
const consumptionUnitDAL = require('../consumptionUnit/consumptionUnitDAL');
const bankingDAL = require('../banking/bankingDAL');
const allocationDAL = require('../allocation/allocationDAL');
const consumptionSiteDAL = require('../consumptionSite/consumptionSiteDAL');
const logger = require('../utils/logger');

async function calculateFormVBMetrics(financialYear) {
    try {
        // Parse the financial year (e.g., '2024-2025')
        const [startYearStr, endYearStr] = financialYear.split('-');
        const startYear = parseInt(startYearStr, 10);
        const endYear = parseInt(endYearStr, 10);

        // Generate months for the financial year (MMYYYY format)
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

        // Fetch all required data in parallel
        const [productionData, consumptionData, bankingData, allocationData, consumptionSites] = await Promise.all([
            productionUnitDAL.getAllProductionUnits(),
            consumptionUnitDAL.getAllConsumptionUnits(),
            bankingDAL.getAllBankingUnits(),
            allocationDAL.getAllAllocatedUnits(),
            consumptionSiteDAL.getAllConsumptionSites()
        ]);

        // Create a map of consumption sites for faster lookup
        const siteMap = new Map(
            consumptionSites.map(site => [
                site.consumptionSiteId, 
                { 
                    ...site,
                    name: site.name || site.siteName || 'Unnamed Site',
                    equityShares: Number(site.equityShares || 0),
                    allocationPercentage: Number(site.allocationPercentage || 0)
                }
            ])
        );

        // Filter data by months in the financial year
        const filterByMonths = (data) => {
            return data.filter(item => item.sk && months.includes(item.sk));
        };

        // Filter and process data for the financial year
        const filteredProductionData = filterByMonths(productionData);
        const filteredConsumptionData = filterByMonths(consumptionData);
        const filteredBankingData = filterByMonths(bankingData);
        const filteredAllocationData = filterByMonths(allocationData);

        // Calculate totals for all periods (c1-c5)
        const calculateTotal = (items) => {
            return items.reduce((sum, item) => {
                const values = [
                    Number(item.c1) || 0, 
                    Number(item.c2) || 0, 
                    Number(item.c3) || 0, 
                    Number(item.c4) || 0, 
                    Number(item.c5) || 0
                ];
                return sum + values.reduce((a, b) => a + b, 0);
            }, 0);
        };

        // Calculate total generated units
        const totalGeneratedUnits = calculateTotal(filteredProductionData);

        // Calculate auxiliary consumption (5% of total generation)
        const auxiliaryConsumption = totalGeneratedUnits * 0.05;

        // Calculate aggregate generation (net of auxiliary consumption)
        const aggregateGeneration = Math.max(0, totalGeneratedUnits - auxiliaryConsumption);

        // Calculate 51% of aggregate generation (verification criteria)
        const verificationCriteria = aggregateGeneration * 0.51;

        // Calculate actual consumption units
        const totalAllocatedUnits = calculateTotal(filteredAllocationData);
        const percentageAdjusted = aggregateGeneration > 0 ? 
            (totalAllocatedUnits / aggregateGeneration) * 100 : 0;

        // Calculate site metrics
        const siteMetrics = Array.from(siteMap.values()).map(site => {
            const siteAllocations = filteredAllocationData.filter(a => 
                a.consumptionSiteId === site.consumptionSiteId
            );

            const siteTotalAllocated = calculateTotal(siteAllocations);
            const siteShare = (site.equityShares / 100) || 0;

            // Calculate permitted consumption based on site's share
            const siteVerificationCriteria = verificationCriteria * siteShare;
            const sitePermittedConsumption = {
                withZero: siteVerificationCriteria,
                minus10: siteVerificationCriteria * 0.9,
                plus10: siteVerificationCriteria * 1.1
            };

            // Check if actual consumption is within permitted range
            const isCompliant = (
                siteTotalAllocated <= sitePermittedConsumption.plus10 && 
                siteTotalAllocated >= sitePermittedConsumption.minus10
            );

            return {
                siteId: site.consumptionSiteId,
                siteName: site.name,
                equityShares: site.equityShares,
                allocationPercentage: site.allocationPercentage || (siteShare * 100),
                annualGeneration: totalGeneratedUnits,
                auxiliaryConsumption: auxiliaryConsumption,
                verificationCriteria: siteVerificationCriteria,
                permittedConsumption: sitePermittedConsumption,
                actualConsumption: siteTotalAllocated,
                normsCompliance: isCompliant,
                lastUpdated: new Date().toISOString()
            };
        });

        logger.info(`Form VB metrics calculated for ${financialYear}`, {
            totalSites: siteMetrics.length,
            totalGeneratedUnits,
            auxiliaryConsumption,
            aggregateGeneration,
            verificationCriteria,
            totalAllocatedUnits,
            percentageAdjusted
        });

        return {
            financialYear,
            totalGeneratedUnits,
            auxiliaryConsumption,
            aggregateGeneration,
            verificationCriteria,
            totalAllocatedUnits,
            percentageAdjusted,
            siteMetrics,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        logger.error('[calculateFormVBMetrics] Error:', error);
        throw error;
    }
}

module.exports = calculateFormVBMetrics;
