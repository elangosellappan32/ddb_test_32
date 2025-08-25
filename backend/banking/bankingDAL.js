const { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const TableNames = require('../constants/tableNames');
const logger = require('../utils/logger');
const docClient = require('../utils/db');

class BankingDAL {
    constructor() {
        this.docClient = docClient;
        this.tableName = TableNames.BANKING;
    }

    async validateTable() {
        try {
            // Validate table exists by attempting to scan with limit 1
            await this.docClient.send(new ScanCommand({
                TableName: this.tableName,
                Limit: 1
            }));
        } catch (error) {
            logger.error('Banking table validation failed:', error);
            throw new Error('Banking table not found');
        }
    }

    calculateTotal(item) {
        return (item.c1 || 0) +
               (item.c2 || 0) +
               (item.c3 || 0) +
               (item.c4 || 0) +
               (item.c5 || 0);
    }

    async createBanking(item) {
        try {
            const now = new Date().toISOString();
            // Get existing banking record if it exists
            const existingBanking = await this.getBanking(item.pk, item.sk);
            
            // If record exists, update it with new values (don't add to existing values)
            if (existingBanking) {
                const { charge, ...itemWithoutCharge } = item;
                const updateData = {
                    ...itemWithoutCharge,
                    // Use new values directly, don't add to existing
                    c1: Number(item.c1 || 0),
                    c2: Number(item.c2 || 0),
                    c3: Number(item.c3 || 0),
                    c4: Number(item.c4 || 0),
                    c5: Number(item.c5 || 0),
                    updatedAt: now,
                    version: (existingBanking.version || 0) + 1
                };
                
                // Calculate total banking with new values
                updateData.totalBanking = this.calculateTotal(updateData);
                
                // Use update operation to ensure we don't lose any existing fields
                return await this.updateBanking(item.pk, item.sk, updateData);
            }
            
            // If no existing record, create a new one
            const { charge, ...itemWithoutCharge } = item;
            const bankingItem = {
                ...itemWithoutCharge,
                // Use provided values directly
                c1: Number(item.c1 || 0),
                c2: Number(item.c2 || 0),
                c3: Number(item.c3 || 0),
                c4: Number(item.c4 || 0),
                c5: Number(item.c5 || 0),
                siteName: item.siteName || '',
                createdAt: now,
                updatedAt: now,
                version: 1
            };

            // Calculate total banking
            bankingItem.totalBanking = this.calculateTotal(bankingItem);

            await this.docClient.send(new PutCommand({
                TableName: this.tableName,
                Item: bankingItem
            }));

            return bankingItem;
        } catch (error) {
            logger.error('[BankingDAL] Create Error:', error);
            throw error;
        }
    }

    async getBanking(pk, sk) {
        try {
            const response = await this.docClient.send(new GetCommand({
                TableName: this.tableName,
                Key: { pk, sk }
            }));
            return response.Item;
        } catch (error) {
            logger.error('[BankingDAL] Get Error:', error);
            throw error;
        }
    }

    async queryBankingByPeriod(pk, sk) {
        try {
            const response = await this.docClient.send(new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
                ExpressionAttributeValues: {
                    ':pk': pk,
                    ':sk': sk
                }
            }));
            return response.Items || [];
        } catch (error) {
            logger.error('[BankingDAL] Query Error:', error);
            throw error;
        }
    }

    async updateBanking(pk, sk, updates) {
        try {
            // Create a clean copy of updates without pk/sk and with proper values
            const cleanUpdates = {};
            const now = new Date().toISOString();
            
            // Initialize expression attribute names and values
            const expressionAttributeNames = {};
            const expressionAttributeValues = {
                ':updatedAt': now,
                ':inc': 1,
                ':zero': 0
            };
            
            // Start with base update expressions
            const updateExpressions = [
                'SET #updatedAt = :updatedAt',
                '#version = if_not_exists(#version, :zero) + :inc'
            ];
            
            // Add reserved words to expression attribute names
            expressionAttributeNames['#updatedAt'] = 'updatedAt';
            expressionAttributeNames['#version'] = 'version';
            
            // Process each update field
            for (const [key, value] of Object.entries(updates)) {
                if (['pk', 'sk', 'updatedAt', 'version', 'charge'].includes(key)) continue;
                
                // Handle special cases for c1-c5 to ensure they're numbers
                const processedValue = key.match(/^c[1-5]$/) ? (Number(value) || 0) : value;
                cleanUpdates[key] = processedValue;
                
                // Create unique attribute names using a prefix
                const attrKey = `#attr_${key}`;
                const valKey = `:val_${key}`;
                
                expressionAttributeNames[attrKey] = key;
                expressionAttributeValues[valKey] = processedValue;
                
                // Add to update expressions
                updateExpressions.push(`${attrKey} = ${valKey}`);
            }
            
            // Calculate total if any c1-c5 values were updated
            if (Object.keys(cleanUpdates).some(k => k.match(/^c[1-5]$/))) {
                const existingItem = await this.getBanking(pk, sk) || {};
                const totalBanking = this.calculateTotal({
                    ...existingItem,
                    ...cleanUpdates
                });
                
                // Use unique name for totalBanking
                const totalKey = '#attr_totalBanking';
                const totalValKey = ':val_totalBanking';
                
                expressionAttributeNames[totalKey] = 'totalBanking';
                expressionAttributeValues[totalValKey] = totalBanking;
                updateExpressions.push(`${totalKey} = ${totalValKey}`);
            }

            const response = await this.docClient.send(new UpdateCommand({
                TableName: this.tableName,
                Key: { pk, sk },
                UpdateExpression: updateExpressions.join(', '),
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW'
            }));

            return response.Attributes;
        } catch (error) {
            logger.error('[BankingDAL] Update Error:', error);
            throw error;
        }
    }

    async deleteBanking(pk, sk) {
        try {
            await this.docClient.send(new DeleteCommand({
                TableName: this.tableName,
                Key: { pk, sk }
            }));
            return true;
        } catch (error) {
            logger.error('[BankingDAL] Delete Error:', error);
            throw error;
        }
    }

    async getAllBanking() {
        try {
            const response = await this.docClient.send(new ScanCommand({
                TableName: this.tableName
            }));
            
            // Transform and validate the data
            const items = response.Items || [];
            return items.map(item => ({
                ...item,
                c1: Number(item.c1 || 0),
                c2: Number(item.c2 || 0),
                c3: Number(item.c3 || 0),
                c4: Number(item.c4 || 0),
                c5: Number(item.c5 || 0),
                totalBanking: Number(item.totalBanking || 0),
                siteName: item.siteName || ''
            }));
        } catch (error) {
            logger.error('[BankingDAL] GetAll Error:', error);
            throw error;
        }
    }

    async getAllBankingUnits() {
        return this.getAllBanking();
    }

    async getYearlyBanking(year) {
        try {
            const params = {
                TableName: this.tableName,
                FilterExpression: 'begins_with(sk, :yearPrefix)',
                ExpressionAttributeValues: {
                    ':yearPrefix': year
                }
            };

            const result = await this.docClient.send(new ScanCommand(params));
            return result.Items || [];
        } catch (error) {
            logger.error('[BankingDAL] GetYearlyBanking Error:', error);
            throw error;
        }
    }

    async getAprilMayData(year) {
        try {
            const aprilSK = `04${year}`;
            const maySK = `05${year}`;
            
            const params = {
                TableName: this.tableName,
                FilterExpression: 'sk = :april OR sk = :may',
                ExpressionAttributeValues: {
                    ':april': aprilSK,
                    ':may': maySK
                }
            };

            const result = await this.docClient.send(new ScanCommand(params));
            return result.Items || [];
        } catch (error) {
            logger.error('[BankingDAL] GetAprilMayData Error:', error);
            throw error;
        }
    }

    /**
     * Get all banking records for a specific primary key (site)
     * @param {string} pk - The primary key (site identifier)
     * @returns {Promise<Array>} - Array of banking records
     */
    async getBankingByPk(pk) {
        try {
            const params = {
                TableName: this.tableName,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: {
                    ':pk': pk
                },
                // Sort by sk (date) in descending order to get the latest records first
                ScanIndexForward: false
            };

            let allItems = [];
            let lastEvaluatedKey = null;

            do {
                if (lastEvaluatedKey) {
                    params.ExclusiveStartKey = lastEvaluatedKey;
                }

                const result = await this.docClient.send(new QueryCommand(params));
                
                if (result.Items && result.Items.length > 0) {
                    allItems = [...allItems, ...result.Items];
                }
                
                lastEvaluatedKey = result.LastEvaluatedKey;
            } while (lastEvaluatedKey);

            return allItems;
        } catch (error) {
            logger.error('Error getting banking records by PK:', error);
            throw error;
        }
    }
}

module.exports = new BankingDAL();