const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
const { 
    DynamoDBDocumentClient, 
    PutCommand 
} = require("@aws-sdk/lib-dynamodb");
const TableNames = require('../backend/constants/tableNames');

const client = new DynamoDBClient({
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local'
    }
});

const docClient = DynamoDBDocumentClient.from(client);

const timestamp = new Date().toISOString();

const createRoleTable = async () => {
    const params = {
        TableName: 'RoleTable',
        KeySchema: [
            { AttributeName: 'roleId', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'roleId', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Created RoleTable');

        // Insert default roles
        const defaultRoles = [
            {
                roleId: 'ROLE-1',
                roleName: 'admin',
                description: 'Administrator role with full access',
                permissions: {
                    production: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'production-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'production-charges': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'consumption': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'consumption-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    users: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    roles: ['READ']
                },
                metadata: {
                    accessLevel: 'Full',
                    isSystemRole: true
                },
                createdAt: timestamp,
                updatedAt: timestamp
            },
            {
                roleId: 'ROLE-2',
                roleName: 'user',
                description: 'Standard user with basic access',
                permissions: {
                    production: ['READ', 'UPDATE'],
                    'production-units': ['READ', 'UPDATE'],
                    'production-charges': ['READ', 'UPDATE'],
                    'consumption': ['READ', 'UPDATE'],
                    'consumption-units': ['READ', 'UPDATE'],
                    users: ['READ'],
                    roles: ['READ']
                },
                metadata: {
                    accessLevel: 'Standard',
                    isSystemRole: true
                },
                createdAt: timestamp,
                updatedAt: timestamp
            },
            {
                roleId: 'ROLE-3',
                roleName: 'viewer',
                description: 'Read-only access',
                permissions: {
                    production: ['READ'],
                    'production-units': ['READ'],
                    'production-charges': ['READ'],
                    'consumption': ['READ'],
                    'consumption-units': ['READ'],
                    users: ['READ'],
                    roles: ['READ']
                },
                metadata: {
                    accessLevel: 'Basic',
                    isSystemRole: true
                },
                createdAt: timestamp,
                updatedAt: timestamp
            }
        ];

        for (const role of defaultRoles) {
            await docClient.send(new PutCommand({
                TableName: 'RoleTable',
                Item: role
            }));
        }
        console.log('Added default roles to RoleTable');
    } catch (error) {
        if (error.name === 'ResourceInUseException') {
            console.log('RoleTable already exists');
        } else {
            throw error;
        }
    }
};

const createBankingTable = async () => {
    try {
        // Check if table already exists
        await client.send(new DescribeTableCommand({ TableName: TableNames.BANKING }));
        console.log('Banking table already exists, skipping creation');
        return;
    } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
            throw error;
        }
    }

    const params = {
        TableName: TableNames.BANKING,
        KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'sk', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'pk', AttributeType: 'S' },
            { AttributeName: 'sk', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Banking table created successfully');
    } catch (error) {
        console.error('Error creating Banking table:', error);
        throw error;
    }
};

const createAllocationTable = async () => {
    try {
        // Check if table already exists
        await client.send(new DescribeTableCommand({ TableName: TableNames.ALLOCATION }));
        console.log('Allocation table already exists, skipping creation');
        return;
    } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
            throw error;
        }
    }

    const params = {
        TableName: TableNames.ALLOCATION,
        KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'sk', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'pk', AttributeType: 'S' },
            { AttributeName: 'sk', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'sk-index',
                KeySchema: [
                    { AttributeName: 'sk', KeyType: 'HASH' }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                }
            }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Allocation table created successfully');
    } catch (error) {
        console.error('Error creating Allocation table:', error);
        throw error;
    }
};

const createProductionSitesTable = async () => {
    try {
        // Check if table already exists
        await client.send(new DescribeTableCommand({ TableName: TableNames.PRODUCTION_SITES }));
        console.log('Production Sites table already exists, skipping creation');
        return;
    } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
            throw error;
        }
    }

    const params = {
        TableName: TableNames.PRODUCTION_SITES,
        KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'sk', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'pk', AttributeType: 'S' },
            { AttributeName: 'sk', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Production Sites table created successfully');
    } catch (error) {
        console.error('Error creating Production Sites table:', error);
        throw error;
    }
};

const createProductionUnitTable = async () => {
    try {
        // Check if table already exists
        await client.send(new DescribeTableCommand({ TableName: TableNames.PRODUCTION_UNIT }));
        console.log('Production Unit table already exists, skipping creation');
        return;
    } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
            throw error;
        }
    }

    const params = {
        TableName: TableNames.PRODUCTION_UNIT,
        KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'sk', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'pk', AttributeType: 'S' },
            { AttributeName: 'sk', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Production Unit table created successfully');
    } catch (error) {
        console.error('Error creating Production Unit table:', error);
        throw error;
    }
};

const createProductionChargeTable = async () => {
    try {
        // Check if table already exists
        await client.send(new DescribeTableCommand({ TableName: TableNames.PRODUCTION_CHARGE }));
        console.log('Production Charge table already exists, skipping creation');
        return;
    } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
            throw error;
        }
    }

    const params = {
        TableName: TableNames.PRODUCTION_CHARGE,
        KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'sk', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'pk', AttributeType: 'S' },
            { AttributeName: 'sk', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Production Charge table created successfully');
    } catch (error) {
        console.error('Error creating Production Charge table:', error);
        throw error;
    }
};

const createConsumptionSitesTable = async () => {
    try {
        // Check if table already exists
        await client.send(new DescribeTableCommand({ TableName: TableNames.CONSUMPTION_SITES }));
        console.log('Consumption Sites table already exists, skipping creation');
        return;
    } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
            throw error;
        }
    }

    const params = {
        TableName: TableNames.CONSUMPTION_SITES,
        KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'sk', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'pk', AttributeType: 'S' },
            { AttributeName: 'sk', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Consumption Sites table created successfully');
    } catch (error) {
        console.error('Error creating Consumption Sites table:', error);
        throw error;
    }
};

const createConsumptionUnitTable = async () => {
    try {
        // Check if table already exists
        await client.send(new DescribeTableCommand({ TableName: TableNames.CONSUMPTION_UNIT }));
        console.log('Consumption Unit table already exists, skipping creation');
        return;
    } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
            throw error;
        }
    }

    const params = {
        TableName: TableNames.CONSUMPTION_UNIT,
        KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'sk', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'pk', AttributeType: 'S' },
            { AttributeName: 'sk', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Consumption Unit table created successfully');
    } catch (error) {
        console.error('Error creating Consumption Unit table:', error);
        throw error;
    }
};

const createLapseTable = async () => {
    try {
        // Check if table already exists
        await client.send(new DescribeTableCommand({ TableName: TableNames.LAPSE }));
        console.log('Lapse table already exists, skipping creation');
        return;
    } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
            throw error;
        }
    }

    const params = {
        TableName: TableNames.LAPSE,
        KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'sk', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'pk', AttributeType: 'S' },
            { AttributeName: 'sk', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Lapse table created successfully');
    } catch (error) {
        console.error('Error creating Lapse table:', error);
        throw error;
    }
};

const createCaptiveTable = async () => {
    try {
        // Check if table already exists
        await client.send(new DescribeTableCommand({ TableName: TableNames.CAPTIVE }));
        console.log('Captive table already exists, skipping creation');
        return;
    } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
            throw error;
        }
    }

    const params = {
        TableName: TableNames.CAPTIVE,
        KeySchema: [
            { AttributeName: 'generatorCompanyId', KeyType: 'HASH' },
            { AttributeName: 'shareholderCompanyId', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'generatorCompanyId', AttributeType: 'N' },
            { AttributeName: 'shareholderCompanyId', AttributeType: 'N' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Captive table created successfully');
    } catch (error) {
        console.error('Error creating Captive table:', error);
        throw error;
    }
};

const createDefaultCaptiveData = async () => {
    const captiveData = [
        {
            generatorCompanyId: 1,  // STRIO KAIZEN HITECH RESEARCH LABS PVT LTD
            shareholderCompanyId: 1, // POLYSPIN EXPORTS LTD
            consumptionSiteId: '1',
            effectiveFrom: '2024-01-02',
            shareholdingPercentage: 27
        },
        {
            generatorCompanyId: 1,  // STRIO KAIZEN HITECH RESEARCH LABS PVT LTD
            shareholderCompanyId: 2, // PEL TEXTILES
            consumptionSiteId: '2',
            effectiveFrom: '2024-01-02',
            shareholdingPercentage: 12
        },
        {
            generatorCompanyId: 1,  // STRIO KAIZEN HITECH RESEARCH LABS PVT LTD
            shareholderCompanyId: 3, // A RAMAR AND SONS
            consumptionSiteId: '3',
            effectiveFrom: '2024-01-02',
            shareholdingPercentage: 61
        }
    ];

    for (const data of captiveData) {
        try {
            await docClient.send(new PutCommand({
                TableName: TableNames.CAPTIVE,
                Item: data
            }));
            console.log(`Created Captive entry for Generator ${data.generatorCompanyId} and Shareholder ${data.shareholderCompanyId}`);
        } catch (error) {
            console.error(`Error creating Captive entry for Generator ${data.generatorCompanyId} and Shareholder ${data.shareholderCompanyId}:`, error);
        }
    }
};

const createCompanyTable = async () => {
    try {
        // Check if table already exists
        await client.send(new DescribeTableCommand({ TableName: 'CompanyTable' }));
        console.log('Company table already exists, skipping creation');
        return;
    } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
            throw error;
        }
    }

    const params = {
        TableName: 'CompanyTable',
        KeySchema: [
            { AttributeName: 'companyId', KeyType: 'HASH' },
            { AttributeName: 'companyName', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'companyId', AttributeType: 'N' },
            { AttributeName: 'companyName', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Company table created successfully');
    } catch (error) {
        console.error('Error creating Company table:', error);
        throw error;
    }
};

const createDefaultCompanies = async () => {
    const companies = [
        {
            companyId: 1,
            companyName: 'STRIO KAIZEN HITECH RESEARCH LABS PVT LTD',
            type: 'generator',
            address: 'Plot 42, Sipcot Industrial Complex, Hosur, Tamil Nadu 635126',
            mobile: '+91 9876543210',
            emailId: 'info@striokaizen.com',
            contactPerson: 'Rajesh Kumar',
            managingDirector: 'Dr. Anand Sharma'
        },
        {
            companyId: 2,
            companyName: 'POLYSPIN EXPORTS LTD',
            type: 'shareholder',
            address: 'Survey No. 156, GIDC Estate, Vapi, Gujarat 396195',
            mobile: '+91 8765432109', 
            emailId: 'contact@polyspinexports.com',
            contactPerson: 'Vikram Patel',
            managingDirector: 'Sanjay Gupta'
        },
        {
            companyId: 3,
            companyName: 'PEL TEXTILES',
            type: 'shareholder',
            address: 'Block A-23, Sector 7, Noida, Uttar Pradesh 201301',
            mobile: '+91 7654321098',
            emailId: 'sales@peltextiles.in',
            contactPerson: 'Priya Malhotra',
            managingDirector: 'Arun Mehta'
        },
        {
            companyId: 4,
            companyName: 'A RAMAR AND SONS',
            type: 'shareholder',
            address: 'No. 15, Mint Street, Sowcarpet, Chennai, Tamil Nadu 600079',
            mobile: '+91 9543210987',
            emailId: 'info@aramarandsons.com',
            contactPerson: 'Suresh Ramar',
            managingDirector: 'Ramesh Ramar'
        },
        {
            companyId: 5,  // Using numeric ID for SMR Energy
            companyName: 'SMR ENERGY',
            type: 'generator',
            address: '123 Energy Street, Chennai, Tamil Nadu 600001',
            mobile: '+91 9876543210',
            emailId: 'smr@energy.com',
            contactPerson: 'SMR Admin',
            managingDirector: 'Dr. SMR Sharma'
        }
    ];

    for (const company of companies) {
        try {
            await docClient.send(new PutCommand({
                TableName: 'CompanyTable',
                Item: company
            }));
            console.log(`Created company: ${company.companyName}`);
        } catch (error) {
            console.error(`Error creating company ${company.companyName}:`, error);
        }
    }
};

const createUserTable = async () => {
    const params = {
        TableName: TableNames.USERS,
        KeySchema: [
            { AttributeName: 'username', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'username', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Created UserTable');
    } catch (error) {
        if (error.name === 'ResourceInUseException') {
            console.log('UserTable already exists');
        } else {
            throw error;
        }
    }
};

const createDefaultUsers = async () => {
    const users = [
        // STRIO Admin
        {
            username: 'strio_admin',
            email: 'admin@strio.com',
            password: 'admin123',
            roleId: 'ROLE-1',
            metadata: {
                department: 'IT Administration',
                accessLevel: 'ADMIN',
                accessibleSites: {
                    productionSites: { L: [
                        { S: '1_1' }, { S: '1_2' }, { S: '1_3' }, { S: '1_4' }, { S: '1_5' }
                    ]},
                    consumptionSites: { L: [
                        { S: '1_1' }, { S: '1_2' }, { S: '1_3' }, { S: '1_4' }, { S: '1_5' }
                    ]}
                }
            },
            isActive: true,
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            lastLogin: null
        },
        // STRIO User
        {
            username: 'strio_user',
            email: 'user@strio.com',
            password: 'user123',
            roleId: 'ROLE-2',
            metadata: {
                department: 'Operations',
                accessLevel: 'MANAGER',
                accessibleSites: {
                    productionSites: { L: [
                        { S: '1_1' }, { S: '1_2' }
                    ]},
                    consumptionSites: { L: [
                        { S: '1_1' }, { S: '1_2' }, { S: '1_3' }
                    ]}
                }
            },
            isActive: true,
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            lastLogin: null
        },
        // STRIO Viewer
        {
            username: 'strio_viewer',
            email: 'viewer@strio.com',
            password: 'viewer123',
            roleId: 'ROLE-3',
            metadata: {
                department: 'Monitoring',
                accessLevel: 'VIEWER',
                accessibleSites: {
                    productionSites: { L: [
                        { S: '1_1' }
                    ]},
                    consumptionSites: { L: [
                        { S: '1_1' }, { S: '1_2' }
                    ]}
                }
            },
            isActive: true,
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            lastLogin: null
        },
        // SMR Admin
        {
            username: 'smr_admin',
            email: 'admin@smr.com',
            password: 'admin123',
            roleId: 'ROLE-1',
            metadata: {
                department: 'SMR Administration',
                accessLevel: 'ADMIN',
                companyId: '5',  // Add companyId for SMR Energy
                accessibleSites: {
                    productionSites: { L: [
                        { S: '5_1' }
                    ]},
                    consumptionSites: { L: [
                        { S: '2_1' }, { S: '3_2' }, { S: '5_1' }
                    ]}
                }
            },
            isActive: true,
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            lastLogin: null
        },
        // SMR User
        {
            username: 'smr_user',
            email: 'user@smr.com',
            password: 'user123',
            roleId: 'ROLE-2',
            metadata: {
                department: 'SMR Operations',
                accessLevel: 'MANAGER',
                companyId: '5',  // Add companyId for SMR Energy
                accessibleSites: {
                    productionSites: { L: [
                        { S: '5_1' }
                    ]},
                    consumptionSites: { L: [
                        { S: '2_1' }, { S: '3_2' }
                    ]}
                }
            },
            isActive: true,
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            lastLogin: null
        },
        // SMR Viewer
        {
            username: 'smr_viewer',
            email: 'viewer@smr.com',
            password: 'viewer123',
            roleId: 'ROLE-3',
            metadata: {
                department: 'SMR Monitoring',
                accessLevel: 'VIEWER',
                companyId: '5',  // Add companyId for SMR Energy
                accessibleSites: {
                    productionSites: { L: [
                        { S: '5_1' }
                    ]},
                    consumptionSites: { L: [
                        { S: '2_1' }, { S: '3_2' }
                    ]}
                }
            },
            isActive: true,
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            lastLogin: null
        }
    ];

    for (const user of users) {
        try {
            await docClient.send(new PutCommand({
                TableName: 'UserTable',
                Item: user
            }));
            console.log(`Created user: ${user.username}`);
        } catch (error) {
            console.error(`Error creating user ${user.username}:`, error);
        }
    }
};

const init = async () => {
    await createRoleTable();
    await createUserTable();
    await createBankingTable();
    await createAllocationTable();
    await createCompanyTable();
    await createProductionSitesTable();
    await createProductionUnitTable();
    await createProductionChargeTable();
    await createConsumptionSitesTable();
    await createConsumptionUnitTable();
    await createLapseTable();
    await createCaptiveTable();
    await createDefaultUsers();
    await createDefaultCompanies();
    await createDefaultCaptiveData();
};

init()
    .then(() => console.log('Database initialized successfully'))
    .catch(console.error);