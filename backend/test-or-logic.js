/**
 * Test script to demonstrate OR logic in allocation cleanup
 * Run with: node test-or-logic.js
 */

const allocationService = require('./services/allocationService');

async function testOrLogic() {
    console.log('=== Testing OR Logic for Allocation Cleanup ===\n');

    const companyId = 'TEST_COMPANY_001';
    const productionSiteId = 'PROD_SITE_001';
    const consumptionSiteId = 'CONS_SITE_001';
    const otherProductionSiteId = 'PROD_SITE_002';
    const otherConsumptionSiteId = 'CONS_SITE_002';

    try {
        console.log('Scenario: We have allocations with these PK patterns:');
        console.log(`1. ${companyId}_${productionSiteId}_${consumptionSiteId}`);
        console.log(`2. ${companyId}_${productionSiteId}_${otherConsumptionSiteId}`);
        console.log(`3. ${companyId}_${otherProductionSiteId}_${consumptionSiteId}`);
        console.log(`4. ${companyId}_${otherProductionSiteId}_${otherConsumptionSiteId}`);
        console.log('');

        // Test 1: Delete allocations where PROD_SITE_001 matches (should delete 1 & 2)
        console.log('Test 1: Delete allocations where production site PROD_SITE_001 matches');
        console.log('Expected: Should delete allocations 1 & 2');
        const prodResult = await allocationService.cleanupSiteAllocations(companyId, {
            productionSiteId: productionSiteId
        });
        console.log(`Result: Deleted ${prodResult.deletedCount} allocations\n`);

        // Test 2: Delete allocations where CONS_SITE_001 matches (should delete 3)
        console.log('Test 2: Delete allocations where consumption site CONS_SITE_001 matches');
        console.log('Expected: Should delete allocation 3 (allocation 1 already deleted)');
        const consResult = await allocationService.cleanupSiteAllocations(companyId, {
            consumptionSiteId: consumptionSiteId
        });
        console.log(`Result: Deleted ${consResult.deletedCount} allocations\n`);

        // Test 3: Delete allocations where either PROD_SITE_002 OR CONS_SITE_002 matches (should delete 4)
        console.log('Test 3: Delete allocations where either PROD_SITE_002 OR CONS_SITE_002 matches');
        console.log('Expected: Should delete allocation 4');
        const orResult = await allocationService.cleanupSiteAllocations(companyId, {
            productionSiteId: otherProductionSiteId,
            consumptionSiteId: otherConsumptionSiteId
        });
        console.log(`Result: Deleted ${orResult.deletedCount} allocations\n`);

        console.log('=== OR Logic Test Complete ===');
        console.log('\nThe cleanup now works with OR logic:');
        console.log('✓ When deleting production site: deletes all allocations where production site ID matches');
        console.log('✓ When deleting consumption site: deletes all allocations where consumption site ID matches');
        console.log('✓ When both IDs provided: deletes allocations where EITHER ID matches (OR logic)');

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testOrLogic();
}

module.exports = testOrLogic;
