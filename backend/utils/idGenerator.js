const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

class IdGenerator {
  /**
   * Generate a new sequential ID for a site
   * @param {string} companyId - The company ID
   * @param {string} siteType - Either 'production' or 'consumption'
   * @returns {Promise<number>} The next available ID
   */
  static async getNextSiteId(companyId, siteType) {
    const tableName = process.env.SITES_TABLE;
    const idField = siteType === 'production' ? 'productionSiteId' : 'consumptionSiteId';
    
    try {
      // Query to get the highest current ID for this company and site type
      const params = {
        TableName: tableName,
        IndexName: 'CompanyIdIndex',
        KeyConditionExpression: 'companyId = :companyId',
        ExpressionAttributeValues: {
          ':companyId': companyId,
        },
        ProjectionExpression: idField,
        ScanIndexForward: false, // Get items in descending order
        Limit: 1 // Only need the highest ID
      };

      const result = await dynamodb.query(params).promise();
      
      if (result.Items && result.Items.length > 0) {
        // Return the highest ID + 1
        return (parseInt(result.Items[0][idField]) || 0) + 1;
      }
      
      // No sites found for this company, start with 1
      return 1;
    } catch (error) {
      console.error(`Error getting next ${siteType} site ID for company ${companyId}:`, error);
      throw new Error(`Failed to generate site ID: ${error.message}`);
    }
  }
}

module.exports = IdGenerator;
