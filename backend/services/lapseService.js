const lapseDAL = require('../lapse/lapseDAL');
const logger = require('../utils/logger');

class LapseService {
    async getLapsesByPk(pk) {
        try {
            return await lapseDAL.getLapsesByPk(pk);
        } catch (error) {
            logger.error('[LapseService] getLapsesByPk Error:', error);
            throw error;
        }
    }
    async getLapsesByPk(pk) {
        try {
            return await lapseDAL.getLapsesByPk(pk);
        } catch (error) {
            logger.error('[LapseService] getLapsesByPk Error:', error);
            throw error;
        }
    }

    async create(lapseData) {
        try {
            // Extract c1-c5 values from allocated if they exist there
            const { allocated, ...restData } = lapseData;
            
            // Normalize data
            const normalizedData = {
                ...restData,
                type: 'LAPSE', // Keep type as attribute but not in PK
                companyId: lapseData.companyId || '1',
                pk: `${lapseData.companyId || '1'}_${lapseData.productionSiteId}`, // Remove _LAPSE suffix
                sk: lapseData.month,
                // Ensure c1-c5 are at root level and are numbers
                c1: Number(allocated?.c1 || 0) || 0,
                c2: Number(allocated?.c2 || 0) || 0,
                c3: Number(allocated?.c3 || 0) || 0,
                c4: Number(allocated?.c4 || 0) || 0,
                c5: Number(allocated?.c5 || 0) || 0
            };

            // Check if lapse record already exists
            try {
                const existingLapses = await lapseDAL.getLapsesByPk(normalizedData.pk);
                const existing = existingLapses.find(l => l.sk === normalizedData.sk);
                
                if (existing) {
                    // Record exists, update it instead
                    logger.info('[LapseService] Lapse record already exists, updating instead', {
                        pk: normalizedData.pk,
                        sk: normalizedData.sk
                    });
                    return await lapseDAL.updateLapse(normalizedData.pk, normalizedData.sk, normalizedData);
                }
            } catch (error) {
            }

            // Create lapse record if it doesn't exist
            return await lapseDAL.createLapse(normalizedData);
        } catch (error) {
            logger.error('[LapseService] Create Error:', error);
            throw error;
        }
    }

    async getLapsesByMonth(month, companyId = '1') {
        try {
            return await lapseDAL.getLapsesByMonth(companyId, month);
        } catch (error) {
            logger.error('[LapseService] GetByMonth Error:', error);
            throw error;
        }
    }

    async getLapsesByProductionSite(productionSiteId, fromMonth, toMonth, companyId = '1') {
        try {
            return await lapseDAL.getLapsesByProductionSite(companyId, productionSiteId, fromMonth, toMonth);
        } catch (error) {
            logger.error('[LapseService] GetByProductionSite Error:', error);
            throw error;
        }
    }

    async getLapsesByCompanyAndMonth(companyId, month) {
        try {
            if (!companyId || !month) {
                throw new Error('Company ID and month are required');
            }
            
            const lapses = await lapseDAL.getLapsesByMonth(companyId, month);
            
            // Transform records to include allocated field for frontend
            return lapses.map(lapse => this.transformLapseForResponse(lapse));
        } catch (error) {
            logger.error('[LapseService] GetByCompanyAndMonth Error:', error);
            throw error;
        }
    }

    transformLapseForResponse(lapse) {
        if (!lapse) return lapse;
        const { c1, c2, c3, c4, c5, ...rest } = lapse;
        return {
            ...rest,
            c1: Number(c1 || 0),
            c2: Number(c2 || 0),
            c3: Number(c3 || 0),
            c4: Number(c4 || 0),
            c5: Number(c5 || 0),
            allocated: { c1, c2, c3, c4, c5 }
        };
    }

    async update(pk, sk, updates) {
        try {
            // Extract c1-c5 values from allocated if they exist in updates
            const { allocated, ...restUpdates } = updates;
            
            // Always include c1-c5 in the update payload
            const updatePayload = {
                ...restUpdates,
                // Convert values to numbers, ensuring 0 is preserved
                c1: allocated ? Number(allocated.c1) : (updates.c1 !== undefined ? Number(updates.c1) : undefined),
                c2: allocated ? Number(allocated.c2) : (updates.c2 !== undefined ? Number(updates.c2) : undefined),
                c3: allocated ? Number(allocated.c3) : (updates.c3 !== undefined ? Number(updates.c3) : undefined),
                c4: allocated ? Number(allocated.c4) : (updates.c4 !== undefined ? Number(updates.c4) : undefined),
                c5: allocated ? Number(allocated.c5) : (updates.c5 !== undefined ? Number(updates.c5) : undefined)
            };
            
            // Remove type suffix from pk if it exists
            const cleanPk = pk.endsWith('_LAPSE') ? pk.slice(0, -6) : pk;
            
            return await lapseDAL.updateLapse(cleanPk, sk, updatePayload);
        } catch (error) {
            logger.error('[LapseService] Update Error:', error);
            throw error;
        }
    }

    async delete(pk, sk) {
        try {
            // Remove type suffix from pk if it exists
            const cleanPk = pk.endsWith('_LAPSE') ? pk.slice(0, -6) : pk;
            return await lapseDAL.deleteLapse(cleanPk, sk);
        } catch (error) {
            logger.error('[LapseService] Delete Error:', error);
            throw error;
        }
    }
}

module.exports = new LapseService();