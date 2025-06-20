const { 
    DynamoDBDocumentClient, 
    GetCommand,
    QueryCommand,
    ScanCommand
} = require('@aws-sdk/lib-dynamodb');
const TableNames = require('../constants/tableNames');
const logger = require('../utils/logger');
const docClient = require('../utils/db');

const TableName = TableNames.COMPANY;

const getCompany = async (companyId, companyName) => {
    try {
        const { Item } = await docClient.send(new GetCommand({
            TableName,
            Key: {
                companyId: Number(companyId),
                companyName
            }
        }));
        return Item;
    } catch (error) {
        logger.error('Error in getCompany:', error);
        throw error;
    }
};

const getCompanyById = async (companyId) => {
    try {
        const { Items } = await docClient.send(new QueryCommand({
            TableName,
            KeyConditionExpression: 'companyId = :companyId',
            ExpressionAttributeValues: {
                ':companyId': Number(companyId)
            }
        }));
        return Items?.[0];
    } catch (error) {
        logger.error('Error in getCompanyById:', error);
        throw error;
    }
};

const getCompaniesByType = async (type) => {
    try {
        const { Items } = await docClient.send(new ScanCommand({
            TableName,
            FilterExpression: '#type = :type',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':type': type
            }
        }));
        return Items || [];
    } catch (error) {
        logger.error('Error in getCompaniesByType:', error);
        throw error;
    }
};

const getAllCompanies = async () => {
    try {
        const { Items } = await docClient.send(new ScanCommand({
            TableName
        }));
        return Items || [];
    } catch (error) {
        logger.error('Error in getAllCompanies:', error);
        throw error;
    }
};

const getGeneratorCompanies = async () => {
    return getCompaniesByType('generator');
};

const getShareholderCompanies = async () => {
    return getCompaniesByType('shareholder');
};

module.exports = {
    getCompany,
    getCompanyById,
    getCompaniesByType,
    getAllCompanies,
    getGeneratorCompanies,
    getShareholderCompanies
};
