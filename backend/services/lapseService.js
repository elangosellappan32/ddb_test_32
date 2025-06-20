const lapseDAL = require('../lapse/lapseDAL');
const logger = require('../utils/logger');

class LapseService {
    async create(lapseData) {
        try {
            // Normalize data
            const normalizedData = {
                ...lapseData,
                type: 'LAPSE',
                companyId: lapseData.companyId || '1',
                pk: `${lapseData.companyId || '1'}_${lapseData.productionSiteId}`,
                sk: lapseData.month
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
            return await lapseDAL.updateLapse(pk, sk, updates);
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