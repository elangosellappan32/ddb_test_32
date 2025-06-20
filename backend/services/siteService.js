const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const IdGenerator = require('../utils/idGenerator');

class SiteService {
  constructor() {
    this.tableName = process.env.SITES_TABLE;
  }

  /**
   * Create a new site with proper ID generation
   * @param {Object} siteData - The site data
   * @param {string} siteType - Either 'production' or 'consumption'
   * @returns {Promise<Object>} The created site with generated ID
   */
  async createSite(siteData, siteType) {
    try {
      const { companyId } = siteData;
      
      if (!companyId) {
        throw new Error('Company ID is required');
      }

      // Generate the next available site ID
      const nextId = await IdGenerator.getNextSiteId(companyId, siteType);
      const idField = siteType === 'production' ? 'productionSiteId' : 'consumptionSiteId';
      
      // Create the site with the generated ID
      const site = {
        ...siteData,
        [idField]: nextId.toString(),
        PK: `${companyId}_${siteType === 'production' ? 'P' : 'C'}${nextId.toString().padStart(4, '0')}`,
        SK: 'METADATA',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      };

      // Save to DynamoDB
      const params = {
        TableName: this.tableName,
        Item: site,
        ConditionExpression: 'attribute_not_exists(PK)'
      };

      await dynamodb.put(params).promise();
      
      return {
        success: true,
        data: site,
        message: `${siteType.charAt(0).toUpperCase() + siteType.slice(1)} site created successfully`
      };
    } catch (error) {
      console.error(`Error creating ${siteType} site:`, error);
      throw error;
    }
  }
  
  /**
   * Get all sites for a company and site type
   * @param {string} companyId - The company ID
   * @param {string} siteType - Either 'production' or 'consumption'
   * @returns {Promise<Array>} Array of sites
   */
  async getSites(companyId, siteType) {
    try {
      const params = {
        TableName: this.tableName,
        IndexName: 'CompanyIdIndex',
        KeyConditionExpression: 'companyId = :companyId',
        ExpressionAttributeValues: {
          ':companyId': companyId
        }
      };

      const result = await dynamodb.query(params).promise();
      
      // Filter by site type if provided
      let sites = result.Items || [];
      if (siteType) {
        const prefix = siteType === 'production' ? 'P' : 'C';
        sites = sites.filter(site => site.PK.startsWith(`${companyId}_${prefix}`));
      }
      
      return sites;
    } catch (error) {
      console.error(`Error getting ${siteType} sites for company ${companyId}:`, error);
      throw error;
    }
  }
}

module.exports = new SiteService();
