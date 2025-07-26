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

    async create(lapseData) {
        try {
            // Extract c1-c5 values from allocated if they exist there
            const { allocated, ...restData } = lapseData;
            
            // Normalize data
            const normalizedData = {
                ...restData,
                type: 'LAPSE',
                companyId: lapseData.companyId || '1',
                pk: `${lapseData.companyId || '1'}_${lapseData.productionSiteId}`,
                sk: lapseData.month,
                // Ensure c1-c5 are at root level and are numbers
                c1: Number(allocated?.c1 || 0) || 0,
                c2: Number(allocated?.c2 || 0) || 0,
                c3: Number(allocated?.c3 || 0) || 0,
                c4: Number(allocated?.c4 || 0) || 0,
                c5: Number(allocated?.c5 || 0) || 0
            };

            // Create lapse record
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

    async update(pk, sk, updates) {
        try {
            // Extract c1-c5 values from allocated if they exist in updates
            const { allocated, ...restUpdates } = updates;
            
            // Prepare the update payload with c1-c5 at root level
            const updatePayload = {
                ...restUpdates,
                // Only include c1-c5 if they exist in allocated
                ...(allocated && {
                    c1: Number(allocated.c1 || 0) || 0,
                    c2: Number(allocated.c2 || 0) || 0,
                    c3: Number(allocated.c3 || 0) || 0,
                    c4: Number(allocated.c4 || 0) || 0,
                    c5: Number(allocated.c5 || 0) || 0
                })
            };
            
            return await lapseDAL.updateLapse(pk, sk, updatePayload);
        } catch (error) {
            logger.error('[LapseService] Update Error:', error);
            throw error;
        }
    }

    async delete(pk, sk) {
        try {
            return await lapseDAL.deleteLapse(pk, sk);
        } catch (error) {
            logger.error('[LapseService] Delete Error:', error);
            throw error;
        }
    }
}

module.exports = new LapseService();