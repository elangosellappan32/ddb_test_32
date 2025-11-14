const { 
    DynamoDBDocumentClient, 
    GetCommand,
    QueryCommand,
    ScanCommand,
    PutCommand,
    UpdateCommand,
    DeleteCommand
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

const getNextCompanyId = async () => {
    const { Items } = await docClient.send(new ScanCommand({
        TableName,
        ProjectionExpression: 'companyId'
    }));

    if (!Items || Items.length === 0) {
        return 1;
    }

    const maxId = Items.reduce((max, item) => {
        const id = Number(item.companyId) || 0;
        return id > max ? id : max;
    }, 0);

    return maxId + 1;
};

const createCompany = async (companyData) => {
    try {
        // If client supplies a numeric companyId, use it; otherwise auto-generate
        let companyId = Number(companyData.companyId);
        if (!companyId || Number.isNaN(companyId) || companyId <= 0) {
            companyId = await getNextCompanyId();
        }

        const item = {
            companyId,
            companyName: companyData.companyName,
            type: companyData.type,
            address: companyData.address || '',
            contactPerson: companyData.contactPerson || '',
            mobile: companyData.mobile || '',
            emailId: companyData.emailId || '',
            managingDirector: companyData.managingDirector || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await docClient.send(new PutCommand({
            TableName,
            Item: item
        }));

        return item;
    } catch (error) {
        logger.error('Error in createCompany:', error);
        throw error;
    }
};
// at top imports: UpdateCommand, DeleteCommand are already imported

const updateCompany = async (companyId, updates) => {
  try {
    // Get the existing item so we know the full key
    const existing = await getCompanyById(companyId);
    if (!existing) {
      return null;
    }

    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    // Do NOT include 'companyName' here – it is part of the primary key and
    // DynamoDB does not allow key attributes to be updated.
    const allowedFields = [
      'type',
      'address',
      'contactPerson',
      'mobile',
      'emailId',
      'managingDirector'
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        const attrName = `#${field}`;
        const attrValue = `:${field}`;
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = field;
        expressionAttributeValues[attrValue] = updates[field];
      }
    });

    // Always update updatedAt
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    if (updateExpressions.length === 0) {
      return existing; // nothing to change
    }

    const command = new UpdateCommand({
      TableName,
      Key: {
        companyId: Number(existing.companyId),
        companyName: existing.companyName
      },
      UpdateExpression: 'SET ' + updateExpressions.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });

    const result = await docClient.send(command);
    return result.Attributes;
  } catch (error) {
    logger.error('Error in updateCompany:', error);
    throw error;
  }
};

const deleteCompany = async (companyId) => {
  try {
    // Get existing item to get the full key
    const existing = await getCompanyById(companyId);
    if (!existing) {
      return null;
    }

    const command = new DeleteCommand({
      TableName,
      Key: {
        companyId: Number(existing.companyId),
        companyName: existing.companyName
      },
      ReturnValues: 'ALL_OLD'
    });

    const result = await docClient.send(command);
    return result.Attributes;
  } catch (error) {
    logger.error('Error in deleteCompany:', error);
    throw error;
  }
};

module.exports = {
  getCompany,
  getCompanyById,
  getCompaniesByType,
  getAllCompanies,
  getGeneratorCompanies,
  getShareholderCompanies,
  createCompany,
  updateCompany,
  deleteCompany
};