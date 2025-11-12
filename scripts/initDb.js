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
        console.log('Captive table created successfully with generatorCompanyId as PK and shareholderCompanyId as SK');
    } catch (error) {
        console.error('Error creating Captive table:', error);
        throw error;
    }
};

const createDefaultCaptiveData = async () => {
    const timestamp = new Date().toISOString();
    
    // Flat structure with all attributes at the top level
    const captiveData = [
        // STRIO KAIZEN - PEL TEXTILES
        {
            generatorCompanyId: 1,
            shareholderCompanyId: 3,
            generatorCompanyName: 'STRIO KAIZEN',
            shareholderCompanyName: 'PEL TEXTILES',
            consumptionSiteName: 'PEL TEXTILES Unit 1',
            allocationPercentage: 10,
            allocationStatus: 'active',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        
        // STRIO KAIZEN - RAMAR & SONS
        {
            generatorCompanyId: 1,
            shareholderCompanyId: 4,
            generatorCompanyName: 'STRIO KAIZEN',
            shareholderCompanyName: 'RAMAR & SONS',
            consumptionSiteName: 'RAMAR & SONS Factory',
            allocationPercentage: 9,
            allocationStatus: 'active',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        
        // STRIO KAIZEN - POLYSPIN
        {
            generatorCompanyId: 1,
            shareholderCompanyId: 2,
            generatorCompanyName: 'STRIO KAIZEN',
            shareholderCompanyName: 'POLYSPIN',
            consumptionSiteName: 'POLYSPIN Manufacturing',
            allocationPercentage: 8,
            allocationStatus: 'active',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        
        // SMR ENERGY - RAMAR & SONS
        {
            generatorCompanyId: 5,
            shareholderCompanyId: 4,
            generatorCompanyName: 'SMR ENERGY',
            shareholderCompanyName: 'RAMAR & SONS',
            consumptionSiteName: 'RAMAR & SONS Factory',
            allocationPercentage: 8,
            allocationStatus: 'active',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        
        // SMR ENERGY - PEL TEXTILES
        {
            generatorCompanyId: 5,
            shareholderCompanyId: 3,
            generatorCompanyName: 'SMR ENERGY',
            shareholderCompanyName: 'PEL TEXTILES',
            consumptionSiteName: 'PEL TEXTILES Unit 1',
            allocationPercentage: 9,
            allocationStatus: 'active',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        
        // SMR ENERGY - POLYSPIN
        {
            generatorCompanyId: 5,
            shareholderCompanyId: 2,
            generatorCompanyName: 'SMR ENERGY',
            shareholderCompanyName: 'POLYSPIN EXPORTS LTD',
            consumptionSiteName: 'POLYSPIN Manufacturing',
            allocationPercentage: 7,
            allocationStatus: 'active',
            createdAt: timestamp,
            updatedAt: timestamp
        }
    ];

    // First verify allocation percentages
    const generatorAllocations = {};
    for (const data of captiveData) {
        const genId = data.generatorCompanyId;
        if (!generatorAllocations[genId]) {
            generatorAllocations[genId] = 0;
        }
        generatorAllocations[genId] += data.allocationPercentage;
    }

    // Verify totals
    for (const [genId, total] of Object.entries(generatorAllocations)) {
        const expectedTotal = genId === '1' ? 27 : 24;  // STRIO KAIZEN: 27%, SMR ENERGY: 24%
        if (Math.abs(total - expectedTotal) > 0.01) { // Allow for small floating point differences
            throw new Error(`Invalid allocation total for generator ${genId}: ${total}% (expected ${expectedTotal}%)`);
        }
        console.log(`Verified allocations for generator ${genId}: ${total}%`);
    }

    for (const data of captiveData) {
        try {
            // Create a new item with all the flat attributes
            const item = { ...data };
            
            // Ensure numeric fields are numbers
            item.generatorCompanyId = Number(item.generatorCompanyId);
            item.shareholderCompanyId = Number(item.shareholderCompanyId);
            item.allocationPercentage = Number(item.allocationPercentage) || 0;
            
            // Ensure timestamps are set
            const now = new Date().toISOString();
            item.createdAt = item.createdAt || now;
            item.updatedAt = now;
            
            await docClient.send(new PutCommand({
                TableName: TableNames.CAPTIVE,
                Item: item
            }));
            
            console.log(`Created Captive entry for Generator ${item.generatorCompanyId} and Shareholder ${item.shareholderCompanyId} (${item.shareholdingPercentage}%)`);
        } catch (error) {
            console.error('Error creating Captive entry:', {
                error: error.message,
                data: data,
                stack: error.stack
            });
            throw error; // Re-throw to stop execution on error
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
                accessibleSites: {
                    productionSites: { L: [
                        { S: '1_1' }, { S: '1_2' }
                    ]},
                    consumptionSites: { L: [
                        { S: '2_1' }, { S: '3_2' }
                    ]},
                    company: { L: [
                        { S: '1' }
                    ]}
                }
            },
            isActive: true,
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            lastLogin: null
        },
        // Consultant Admin
        {
            username: 'consultant_admin',
            email: 'consultant@strio.com',
            password: 'consultant123',
            roleId: 'ROLE-1',
            metadata: {
                accessibleSites: {
                    productionSites: { L: [
                        { S: '1_1' }, { S: '1_2' }, { S: '5_3' }
                    ]},
                    consumptionSites: { L: [
                        { S: '2_1' }, { S: '3_2' }, { S: '4_3' }
                    ]},
                    company: { L: [
                        { S: '1' }, { S: '5' }
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
                accessibleSites: {
                    productionSites: { L: [
                        { S: '1_1' }, { S: '1_2' }
                    ]},
                    consumptionSites: { L: [
                        { S: '2_1' }, { S: '3_2' }
                    ]},
                    company: { L: [
                        { S: '1' }
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
                accessibleSites: {
                    productionSites: { L: [
                        { S: '1_1' }
                    ]},
                    consumptionSites: { L: [
                        { S: '2_1' }, { S: '3_2' }
                    ]},
                    company: { L: [
                        { S: '1' }
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
                accessibleSites: {
                    productionSites: { L: [
                        { S: '5_3' }
                    ]},
                    consumptionSites: { L: [
                        { S: '2_1' }, { S: '3_2' }
                    ]},
                    company: { L: [
                        { S: '5' }
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
                accessibleSites: {
                    productionSites: { L: [
                        { S: '5_3' }
                    ]},
                    consumptionSites: { L: [
                        { S: '2_1' }, { S: '3_2' }
                    ]},
                    company: { L: [
                        { S: '5' }
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
                accessibleSites: {
                    productionSites: { L: [
                        { S: '5_3' }
                    ]},
                    consumptionSites: { L: [
                        { S: '2_1' }
                    ]},
                    company: { L: [
                        { S: '5' }
                    ]}
                }
            },
            isActive: true,
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            lastLogin: null
        },
        {
            username: 'star_admin',
            email: 'viewer@smr.com',
            password: 'admin123',
            roleId: 'ROLE-1',
            metadata: {
                accessibleSites: {
                    productionSites: { L: [
                        { S: '1_1' }, { S: '1_2' }, { S: '5_3' }
                    ]},
                    consumptionSites: { L: [
                        { S: '1_1' }, { S: '3_2' }, { S: '5_1' }
                    ]},
                    company: { L: [
                        { S: '1' }, { S: '5' }
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

const generateCaptiveData = () => {
    const timestamp = new Date().toISOString();
    
    // Define the captive data with specific allocation percentages
    const captiveData = [
        // STRIO KAIZEN (Generator Company 1) - Total 27%
        {
            generatorCompanyId: 1, // Primary hash key
            shareholderCompanyId: 3, // Primary range key
            generatorCompanyName: 'STRIO KAIZEN',
            shareholderCompanyName: 'PEL TEXTILES',
            allocationPercentage: 10,  // Adjusted allocation
            allocationStatus: 'active',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        // STRIO KAIZEN - RAMAR & SONS
        {
            generatorCompanyId: 1, // Primary hash key
            shareholderCompanyId: 4, // Primary range key
            generatorCompanyName: 'STRIO KAIZEN',
            shareholderCompanyName: 'RAMAR & SONS',
            allocationPercentage: 9,  // Part of 27% total
            allocationStatus: 'active',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        
        // STRIO KAIZEN - POLYSPIN EXPORTS
        {
            generatorCompanyId: 1, // Primary hash key
            shareholderCompanyId: 2, // Primary range key
            generatorCompanyName: 'STRIO KAIZEN',
            shareholderCompanyName: 'POLYSPIN EXPORTS LTD',
            allocationPercentage: 8,  // Part of 27% total
            allocationStatus: 'active',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        
        // SMR ENERGY - PEL TEXTILES
        {
            generatorCompanyId: 5, // Primary hash key
            shareholderCompanyId: 3, // Primary range key
            generatorCompanyName: 'SMR ENERGY',
            shareholderCompanyName: 'PEL TEXTILES',
            allocationPercentage: 9,  // Part of 24% total
            allocationStatus: 'active',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        
        // SMR ENERGY - RAMAR & SONS
        {
            generatorCompanyId: 5, // Primary hash key
            shareholderCompanyId: 4, // Primary range key
            generatorCompanyName: 'SMR ENERGY',
            shareholderCompanyName: 'RAMAR & SONS',
            allocationPercentage: 8,  // Part of 24% total
            allocationStatus: 'active',
            createdAt: timestamp,
            updatedAt: timestamp
        },
        
        // SMR ENERGY - POLYSPIN EXPORTS
        {
            generatorCompanyId: 5, // Primary hash key
            shareholderCompanyId: 2, // Primary range key
            generatorCompanyName: 'SMR ENERGY',
            shareholderCompanyName: 'POLYSPIN EXPORTS LTD',
            allocationPercentage: 7,  // Part of 24% total
            allocationStatus: 'active',
            createdAt: timestamp,
            updatedAt: timestamp
        }
    ];

    // Verify allocation percentages per generator company
    const verifyAllocations = () => {
        const generatorTotals = {};
        const shareholderAllocations = {};
        
        captiveData.forEach(item => {
            // Track generator totals
            if (!generatorTotals[item.generatorCompanyId]) {
                generatorTotals[item.generatorCompanyId] = 0;
            }
            generatorTotals[item.generatorCompanyId] += item.allocationPercentage;
            
            // Track shareholder allocations per generator
            const key = `${item.generatorCompanyId}-${item.shareholderCompanyId}`;
            shareholderAllocations[key] = item.allocationPercentage;
        });

        // Verify STRIO KAIZEN (1) has 27% total with proper split
        if (Math.abs(generatorTotals[1] - 27) > 0.01) {
            throw new Error(`STRIO KAIZEN allocations total ${generatorTotals[1]}%, expected 27%`);
        }
        
        // Verify PEL TEXTILES (3) allocation for STRIO KAIZEN
        if (shareholderAllocations['1-3'] !== 10) {
            throw new Error(`Invalid allocation for PEL TEXTILES from STRIO KAIZEN: ${shareholderAllocations['1-3']}%, expected 10%`);
        }
        
        // Verify RAMAR & SONS (4) allocation for STRIO KAIZEN
        if (shareholderAllocations['1-4'] !== 9) {
            throw new Error(`Invalid allocation for RAMAR & SONS from STRIO KAIZEN: ${shareholderAllocations['1-4']}%, expected 9%`);
        }
        
        // Verify POLYSPIN (2) allocation for STRIO KAIZEN
        if (shareholderAllocations['1-2'] !== 8) {
            throw new Error(`Invalid allocation for POLYSPIN from STRIO KAIZEN: ${shareholderAllocations['1-2']}%, expected 8%`);
        }

        // Verify SMR ENERGY (5) has 24% total with proper split
        if (Math.abs(generatorTotals[5] - 24) > 0.01) {
            throw new Error(`SMR ENERGY allocations total ${generatorTotals[5]}%, expected 24%`);
        }
        
        // Verify PEL TEXTILES (3) allocation for SMR ENERGY
        if (shareholderAllocations['5-3'] !== 9) {
            throw new Error(`Invalid allocation for PEL TEXTILES from SMR ENERGY: ${shareholderAllocations['5-3']}%, expected 9%`);
        }
        
        // Verify RAMAR & SONS (4) allocation for SMR ENERGY
        if (shareholderAllocations['5-4'] !== 8) {
            throw new Error(`Invalid allocation for RAMAR & SONS from SMR ENERGY: ${shareholderAllocations['5-4']}%, expected 8%`);
        }
        
        // Verify POLYSPIN (2) allocation for SMR ENERGY
        if (shareholderAllocations['5-2'] !== 7) {
            throw new Error(`Invalid allocation for POLYSPIN from SMR ENERGY: ${shareholderAllocations['5-2']}%, expected 7%`);
        }

        console.log('Allocation percentages verified successfully');
        console.log('Generator company totals:', generatorTotals);
        console.log('Individual shareholder allocations:', shareholderAllocations);
    };

    // Verify before returning
    verifyAllocations();
    return captiveData;
};

// Main initialization function
const init = async () => {
    try {
        // Create all tables
        await createRoleTable();
        await createBankingTable();
        await createAllocationTable();
        await createProductionSitesTable();
        await createProductionUnitTable();
        await createProductionChargeTable();
        await createConsumptionSitesTable();
        await createConsumptionUnitTable();
        await createLapseTable();
        await createCaptiveTable();
        await createCompanyTable();
        await createUserTable();
        
        // Create default data
        await createDefaultCompanies();
        await createDefaultUsers();
        
        // Generate and insert captive data
        const captiveData = generateCaptiveData();
        console.log(`Generated ${captiveData.length} captive data entries`);
        
        // Insert captive data in batches
        const batchSize = 10;
        for (let i = 0; i < captiveData.length; i += batchSize) {
            const batch = captiveData.slice(i, i + batchSize);
            await Promise.all(batch.map(async (item) => {
                const params = {
                    TableName: TableNames.CAPTIVE,
                    Item: item
                };
                try {
                    await docClient.send(new PutCommand(params));
                    console.log(`Inserted captive data for Generator ${item.generatorCompanyId} and Shareholder ${item.shareholderCompanyId}`);
                } catch (error) {
                    console.error('Error inserting captive data:', error);
                }
            }));
        }
        
        console.log('Database initialized successfully with captive data');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
};

// Start the initialization process
init().catch(console.error);