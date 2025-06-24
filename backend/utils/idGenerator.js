const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

class IdGenerator {
  /**
   * Generate a new sequential ID for a site
   * @param {string} companyId - The company ID (kept for backward compatibility)
   * @param {string} siteType - Either 'production' or 'consumption'
   * @returns {Promise<number>} The next available ID
   */
  static async getNextSiteId(companyId, siteType) {
    const tableName = process.env.SITES_TABLE;
    const idField = siteType === 'production' ? 'productionSiteId' : 'consumptionSiteId';
    
    try {
      // Scan the entire table to find the highest ID
      const params = {
        TableName: tableName,
        ProjectionExpression: idField,
        FilterExpression: 'attribute_exists(' + idField + ')'
      };

      const result = await dynamodb.scan(params).promise();
      
      if (result.Items && result.Items.length > 0) {
        // Find the maximum ID across all items
        const maxId = result.Items.reduce((max, item) => {
          const currentId = parseInt(item[idField]) || 0;
          return currentId > max ? currentId : max;
        }, 0);
        
        // Return the highest ID + 1
        return maxId + 1;
      }
      
      // No sites found, start with 1
      return 1;
    } catch (error) {
      console.error(`Error getting next ${siteType} site ID for company ${companyId}:`, error);
      throw new Error(`Failed to generate site ID: ${error.message}`);
    }
  }
}

module.exports = IdGenerator;
