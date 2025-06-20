const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
    DynamoDBDocumentClient, 
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
    DeleteCommand,
    ScanCommand
} = require('@aws-sdk/lib-dynamodb');
const TableNames = require('../constants/tableNames');
const logger = require('../utils/logger');

class BankingDAL {
    constructor() {
        try {
            const client = new DynamoDBClient({
                endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
                maxAttempts: 3
            });
            this.docClient = DynamoDBDocumentClient.from(client);
            this.tableName = TableNames.BANKING;
            this.validateTable();
        } catch (error) {
            logger.error('Failed to initialize DynamoDB client:', error);
            throw new Error('Database connection failed');
        }
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
            
            const bankingItem = {
                ...item,
                // Add new banking values to existing ones
                c1: (existingBanking?.c1 || 0) + Number(item.c1 || 0),
                c2: (existingBanking?.c2 || 0) + Number(item.c2 || 0),
                c3: (existingBanking?.c3 || 0) + Number(item.c3 || 0),
                c4: (existingBanking?.c4 || 0) + Number(item.c4 || 0),
                c5: (existingBanking?.c5 || 0) + Number(item.c5 || 0),
                siteName: item.siteName || '',
                createdAt: existingBanking?.createdAt || now,
                updatedAt: now,
                version: (existingBanking?.version || 0) + 1
            };

            // Calculate total banking after update
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
            const updateExpression = [];
            const expressionAttributeValues = {
                ':updatedAt': new Date().toISOString(),
                ':inc': 1
            };
            const expressionAttributeNames = {};

            Object.entries(updates).forEach(([key, value]) => {
                if (value !== undefined && !['pk', 'sk'].includes(key)) {
                    const attrKey = `#${key}`;
                    const attrValue = `:${key}`;
                    updateExpression.push(`${attrKey} = ${attrValue}`);
                    expressionAttributeValues[attrValue] = value;
                    expressionAttributeNames[attrKey] = key;
                }
            });

            expressionAttributeNames['#updatedAt'] = 'updatedAt';
            expressionAttributeNames['#version'] = 'version';
            updateExpression.push('#updatedAt = :updatedAt');
            updateExpression.push('#version = #version + :inc');

            const response = await this.docClient.send(new UpdateCommand({
                TableName: this.tableName,
                Key: { pk, sk },
                UpdateExpression: `SET ${updateExpression.join(', ')}`,
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
}

module.exports = new BankingDAL();