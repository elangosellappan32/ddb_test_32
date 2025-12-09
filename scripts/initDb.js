const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
const { 
    DynamoDBDocumentClient, 
    PutCommand,
    ScanCommand,
    DeleteCommand
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
                roleName: 'super_admin',
                description: 'Super Administrator with full system access including user and role management',
                permissions: {
                    production: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'production-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'production-charges': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    consumption: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'consumption-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    allocation: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    banking: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    lapse: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    captive: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    company: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    users: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    roles: ['CREATE', 'READ', 'UPDATE', 'DELETE']
                },
                metadata: {
                    accessLevel: 'Super Admin',
                    isSystemRole: true
                },
                createdAt: timestamp,
                updatedAt: timestamp
            },
            {
                roleId: 'ROLE-2',
                roleName: 'admin',
                description: 'Administrator role with full access except user and role management',
                permissions: {
                    production: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'production-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'production-charges': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    consumption: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'consumption-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    allocation: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    banking: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    lapse: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    captive: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    company: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
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
                roleId: 'ROLE-3',
                roleName: 'user',
                description: 'Standard user with basic access',
                permissions: {
                    production: ['READ', 'UPDATE'],
                    'production-units': ['READ', 'UPDATE'],
                    'production-charges': ['READ', 'UPDATE'],
                    consumption: ['READ', 'UPDATE'],
                    'consumption-units': ['READ', 'UPDATE'],
                    allocation: ['READ', 'UPDATE'],
                    banking: ['READ', 'UPDATE'],
                    lapse: ['READ', 'UPDATE'],
                    captive: ['READ'],
                    company: ['READ'],
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
                roleId: 'ROLE-4',
                roleName: 'viewer',
                description: 'Read-only access',
                permissions: {
                    production: ['READ'],
                    'production-units': ['READ'],
                    'production-charges': ['READ'],
                    consumption: ['READ'],
                    'consumption-units': ['READ'],
                    allocation: ['READ'],
                    banking: ['READ'],
                    lapse: ['READ'],
                    captive: ['READ'],
                    company: ['READ'],
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
        BillingMode: 'PAY_PER_REQUEST'
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Banking table created successfully with PAY_PER_REQUEST billing');
        
        // Insert sample data from JSON schema
        await insertBankingData();
    } catch (error) {
        console.error('Error creating Banking table:', error);
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
            { AttributeName: 'companyId', KeyType: 'HASH' },
            { AttributeName: 'productionSiteId', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'companyId', AttributeType: 'N' },
            { AttributeName: 'productionSiteId', AttributeType: 'N' }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Production Sites table created successfully with PAY_PER_REQUEST billing');
        
        // Insert sample data from JSON schema
        await insertProductionSiteData();
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
        BillingMode: 'PAY_PER_REQUEST'
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Production Unit table created successfully with PAY_PER_REQUEST billing');
        
        // Insert sample data from JSON schema
        await insertProductionUnitData();
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
        BillingMode: 'PAY_PER_REQUEST'
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Production Charge table created successfully with PAY_PER_REQUEST billing');
        
        // Insert sample data from JSON schema
        await insertProductionChargeData();
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
            { AttributeName: 'companyId', KeyType: 'HASH' },
            { AttributeName: 'consumptionSiteId', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'companyId', AttributeType: 'S' },
            { AttributeName: 'consumptionSiteId', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Consumption Sites table created successfully with PAY_PER_REQUEST billing');
        
        // Insert sample data from JSON schema
        await insertConsumptionSiteData();
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
        BillingMode: 'PAY_PER_REQUEST'
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Consumption Unit table created successfully with PAY_PER_REQUEST billing');
        
        // Insert sample data from JSON schema
        await insertConsumptionUnitData();
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
        BillingMode: 'PAY_PER_REQUEST'
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Lapse table created successfully with PAY_PER_REQUEST billing');
        
        // Insert sample data from JSON schema
        await insertLapseData();
    } catch (error) {
        console.error('Error creating Lapse table:', error);
        throw error;
    }
};

const insertProductionSiteData = async () => {
    const productionSites = [
        {
            companyId: 1,
            productionSiteId: 1,
            name: "Star_Radhapuram_600KW",
            location: "Tirunelveli, Radhapuram ",
            type: "Wind",
            banking: 1,
            capacity_MW: 0.6,
            annualProduction_L: 9,
            htscNo: 79204721131,
            injectionVoltage_KV: 33,
            status: "Active",
            createdat: "2025-03-29T03:55:02.802Z",
            updatedat: "2025-03-29T03:55:02.802Z",
            version: 1,
            timetolive: 0
        },
        {
            companyId: 1,
            productionSiteId: 2,
            name: "DVN_Keelathur_1WM",
            location: "Pudukkottai, Keelathur",
            type: "Solar",
            banking: 0,
            capacity_MW: 1,
            annualProduction_L: 18,
            htscNo: 69534460069,
            injectionVoltage_KV: 22,
            status: "Active",
            createdat: "2025-03-29T03:55:02.802Z",
            updatedat: "2025-03-29T03:55:02.802Z",
            version: 1,
            timetolive: 0
        },
        {
            companyId: 5,
            productionSiteId: 3,
            name: "DVN_Keelathur_1WM",
            location: "Pudukkottai, Keelathur",
            type: "SITE",
            banking: 0,
            capacity_MW: 23,
            annualProduction_L: 3,
            htscNo: 34444,
            injectionVoltage_KV: 33433,
            status: "Active",
            createdat: "2025-03-29T03:55:02.802Z",
            updatedat: "2025-03-29T03:55:02.802Z",
            version: 1,
            timetolive: 0
        }
    ];

    for (const site of productionSites) {
        try {
            await docClient.send(new PutCommand({
                TableName: TableNames.PRODUCTION_SITES,
                Item: site
            }));
            console.log(`Added production site: ${site.name} (Company ${site.companyId}, Site ${site.productionSiteId})`);
        } catch (error) {
            console.error(`Error adding production site ${site.name}:`, error);
        }
    }
};

const insertProductionChargeData = async () => {
    // ProductionChargeTable has empty TableData in JSON schema
    console.log('ProductionChargeTable has no sample data in JSON schema');
};

const insertLapseData = async () => {
    // LapseTable has empty TableData in JSON schema
    console.log('LapseTable has no sample data in JSON schema');
};

const insertBankingData = async () => {
    const bankingData = [
        {
            pk: "1_2",
            sk: "072025",
            c1: 150,
            c2: 20,
            c3: 340,
            c4: 34,
            c5: 33,
            timetolive: 0,
            version: 1,
            updatedAt: "2025-08-06T13:02:44.583Z",
            createdAt: "2025-09-27T01:58:45.363Z"
        },
        {
            pk: "1_2",
            sk: "082025",
            c1: 100,
            c2: 30,
            c3: 0,
            c4: 23,
            c5: 344,
            timetolive: 0,
            version: 1,
            updatedAt: "2025-08-24T02:22:48.125Z",
            createdAt: "2024-07-16T05:14:35.165Z"
        },
        {
            pk: "5_3",
            sk: "072025",
            c1: 222,
            c2: 334,
            c3: 0,
            c4: 22,
            c5: 444,
            timetolive: 0,
            version: 1,
            updatedAt: "2025-08-24T02:22:48.125Z",
            createdAt: "2024-07-16T05:14:35.165Z"
        }
    ];

    for (const data of bankingData) {
        try {
            await docClient.send(new PutCommand({
                TableName: TableNames.BANKING,
                Item: data
            }));
            console.log(`Added banking data: ${data.pk} - ${data.sk}`);
        } catch (error) {
            console.error(`Error adding banking data ${data.pk}:`, error);
        }
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
        BillingMode: 'PAY_PER_REQUEST'
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('Allocation table created successfully with PAY_PER_REQUEST billing');
    } catch (error) {
        console.error('Error creating Allocation table:', error);
        throw error;
    }
};

const insertConsumptionSiteData = async () => {
    const consumptionSites = [
        {
            companyId: "2",
            consumptionSiteId: "1",
            name: "Polyspin Exports ltd",
            location: "tirunelveli",
            type: "industrial",
            annualConsumption: 2.1,
            "status ": "active",
            version: 1,
            timetolive: 0
        },
        {
            companyId: "3",
            consumptionSiteId: "2",
            name: "Pel Textiles",
            location: "coimbatore",
            type: "textile manufactuting",
            annualConsumption: 2.3,
            "status ": "active",
            version: 1,
            timetolive: 0
        },
        {
            companyId: "4",
            consumptionSiteId: "3",
            name: "M/S Ramar and Sons",
            location: "madurai",
            type: "industrial",
            annualConsumption: 1.23,
            "status ": "active",
            version: 1,
            timetolive: 0
        }
    ];

    for (const site of consumptionSites) {
        try {
            await docClient.send(new PutCommand({
                TableName: TableNames.CONSUMPTION_SITES,
                Item: site
            }));
            console.log(`Added consumption site: ${site.name} (Company ${site.companyId}, Site ${site.consumptionSiteId})`);
        } catch (error) {
            console.error(`Error adding consumption site ${site.name}:`, error);
        }
    }
};

const insertConsumptionUnitData = async () => {
    const consumptionUnits = [
        {
            pk: "1_1",
            sk: "112024",
            c1: 1,
            c2: 2,
            c3: 4,
            c4: 6,
            c5: 4,
            version: 1,
            timetolive: 0
        },
        {
            pk: "1_2",
            sk: "112024",
            c1: 2,
            c2: 3,
            c3: 5,
            c4: 4,
            c5: 4,
            version: 1,
            timetolive: 0
        },
        {
            pk: "1_3",
            sk: "112024",
            c1: 3,
            c2: 4,
            c3: 6,
            c4: 4,
            c5: 5,
            version: 1,
            timetolive: 0
        }
    ];

    for (const unit of consumptionUnits) {
        try {
            await docClient.send(new PutCommand({
                TableName: TableNames.CONSUMPTION_UNIT,
                Item: unit
            }));
            console.log(`Added consumption unit: ${unit.pk} - ${unit.sk}`);
        } catch (error) {
            console.error(`Error adding consumption unit ${unit.pk}:`, error);
        }
    }
};

const insertProductionUnitData = async () => {
    const productionUnits = [
        {
            pk: "\\>KXN0/TTl",
            sk: "2025-03-12T04:28:58.976Z",
            import_c1: 558555620966400,
            import_c2: 6950780783296512,
            import_c3: 1713612236259328,
            import_c4: 5299806943576064,
            import_c5: 4084687653830656,
            timetolive: 485090792570880,
            version: 5455578539229184,
            createdat: "2024-10-29T07:06:31.803Z",
            updatedat: "2025-06-09T16:01:14.326Z",
            export_c1: 6140490764255232,
            export_c2: 1143475405848576,
            export_c3: 8035050882859008,
            export_c4: 2881872759619584,
            export_c5: 8709347414638592,
            net_export_c1: 6889701623463936,
            net_export_c2: 202303185354752,
            net_export_c3: 1174536900837376,
            net_export_c4: 1955245749960704,
            net_export_c5: 6997905286103040
        },
        {
            pk: "@%Mg,qKax-",
            sk: "2024-11-16T03:14:08.876Z",
            import_c1: 1414916300865536,
            import_c2: 8027009103953920,
            import_c3: 2666344321384448,
            import_c4: 4036803449323520,
            import_c5: 3175076904042496,
            timetolive: 4136383107039232,
            version: 4165131013455872,
            createdat: "2025-12-25T11:19:57.791Z",
            updatedat: "2025-07-28T13:58:38.029Z",
            export_c1: 5783904386547712,
            export_c2: 6665614351400960,
            export_c3: 7556265194553344,
            export_c4: 2786382223245312,
            export_c5: 170745969770496,
            net_export_c1: 5820684223643648,
            net_export_c2: 7930549479931904,
            net_export_c3: 4143596661899264,
            net_export_c4: 6776662630858752,
            net_export_c5: 4696560814260224
        },
        {
            pk: "o/R?z)nS9y",
            sk: "2026-01-05T19:13:46.162Z",
            import_c1: 250252158304256,
            import_c2: 6532284159098880,
            import_c3: 8200145304813568,
            import_c4: 3335250029576192,
            import_c5: 4072332352028672,
            timetolive: 2904828212674560,
            version: 8591889531928576,
            createdat: "2026-07-26T00:18:45.220Z",
            updatedat: "2025-06-12T07:54:40.527Z",
            export_c1: 8359640047812608,
            export_c2: 1161527526686720,
            export_c3: 3085603121922048,
            export_c4: 4734862422441984,
            export_c5: 4460288239730688,
            net_export_c1: 2965747762462720,
            net_export_c2: 2054829845250048,
            net_export_c3: 3892201528492032,
            net_export_c4: 4363458141224960,
            net_export_c5: 1594797164855296
        },
        {
            pk: "1,]B\"*EC(k",
            sk: "2026-02-20T23:25:16.112Z",
            import_c1: 5470601005236224,
            import_c2: 4045765915705344,
            import_c3: 4067546454032384,
            import_c4: 8037032769093632,
            import_c5: 7344015645081600,
            timetolive: 8675956742946816,
            version: 574203048755200,
            createdat: "2025-09-01T04:19:01.353Z",
            updatedat: "2025-11-28T20:26:24.523Z",
            export_c1: 8520154709229568,
            export_c2: 7176202571743232,
            export_c3: 7823888981426176,
            export_c4: 1621610215768064,
            export_c5: 175784859795456,
            net_export_c1: 8718666692558848,
            net_export_c2: 7855242699866112,
            net_export_c3: 8158933917106176,
            net_export_c4: 6267982936276992,
            net_export_c5: 3327667029934080
        },
        {
            pk: "+<DIo)WV3c",
            sk: "2025-09-11T13:44:09.773Z",
            import_c1: 5776625597677568,
            import_c2: 5218695284523008,
            import_c3: 4277241015959552,
            import_c4: 1349056395739136,
            import_c5: 6664589668253696,
            timetolive: 5889233176756224,
            version: 953064691335168,
            createdat: "2026-05-24T19:29:40.836Z",
            updatedat: "2025-08-29T20:24:12.207Z",
            export_c1: 4285789833789440,
            export_c2: 8608390225854464,
            export_c3: 6383441962598400,
            export_c4: 7233624841650176,
            export_c5: 7952156875292672,
            net_export_c1: 3416171181244416,
            net_export_c2: 2579748085563392,
            net_export_c3: 6130910086823936,
            net_export_c4: 4876955549696000,
            net_export_c5: 4906038929129472
        }
    ];

    for (const unit of productionUnits) {
        try {
            await docClient.send(new PutCommand({
                TableName: TableNames.PRODUCTION_UNIT,
                Item: unit
            }));
            console.log(`Added production unit: ${unit.pk} - ${unit.sk}`);
        } catch (error) {
            console.error(`Error adding production unit ${unit.pk}:`, error);
        }
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

const createCaptiveTable = async () => {
    const tableName = TableNames.CAPTIVE;
    const params = {
        TableName: tableName,
        KeySchema: [
            { AttributeName: 'generatorCompanyId', KeyType: 'HASH' },  // Partition key
            { AttributeName: 'shareholderCompanyId', KeyType: 'RANGE' }  // Sort key
        ],
        AttributeDefinitions: [
            { AttributeName: 'generatorCompanyId', AttributeType: 'N' },  // N = Number
            { AttributeName: 'shareholderCompanyId', AttributeType: 'N' },
            { AttributeName: 'allocationStatus', AttributeType: 'S' }  // For GSI
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'StatusIndex',
                KeySchema: [
                    { AttributeName: 'allocationStatus', KeyType: 'HASH' },
                    { AttributeName: 'generatorCompanyId', KeyType: 'RANGE' }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 1,
                    WriteCapacityUnits: 1
                }
            }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1
        }
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log(`Created ${tableName} table successfully`);
    } catch (error) {
        if (error.name === 'ResourceInUseException') {
            console.log(`${tableName} table already exists, skipping creation`);
        } else {
            console.error(`Error creating ${tableName} table:`, error);
            throw error;
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
        // Super Admin
        {
            username: 'super_admin',
            email: 'superadmin@system.com',
            password: 'superadmin123',
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
        // STRIO Admin
        {
            username: 'strio_admin',
            email: 'admin@strio.com',
            password: 'admin123',
            roleId: 'ROLE-2',
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
        // Consultant Admin
        {
            username: 'consultant_admin',
            email: 'consultant@strio.com',
            password: 'consultant123',
            roleId: 'ROLE-2',
            metadata: {
                accessibleSites: {
                    productionSites: { L: [
                        { S: '1_1' }, { S: '1_2' }, { S: '5_3' }
                    ]},
                    consumptionSites: { L: [
                        { S: '2_1' }, { S: '3_2' }, { S: '4_3' }
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
        // STRIO User
        {
            username: 'strio_user',
            email: 'user@strio.com',
            password: 'user123',
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
        // STRIO Viewer
        {
            username: 'strio_viewer',
            email: 'viewer@strio.com',
            password: 'viewer123',
            roleId: 'ROLE-4',
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
        // SMR Admin
        {
            username: 'smr_admin',
            email: 'admin@smr.com',
            password: 'admin123',
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
        // SMR User
        {
            username: 'smr_user',
            email: 'user@smr.com',
            password: 'user123',
            roleId: 'ROLE-3',
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
            roleId: 'ROLE-4',
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
        // Star Admin
        {
            username: 'star_admin',
            email: 'staradmin@system.com',
            password: 'admin123',
            roleId: 'ROLE-2',
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
        },
        {
            username: 'super_admin',
            email: 'superadmin@system.com',
            password: 'superadmin123',
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
                        { S: '1' }, { S: '2' }, { S: '3' }, { S: '4' }, { S: '5' }
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
            consumptionSiteName: 'PEL TEXTILES Unit 1',
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
            consumptionSiteName: 'RAMAR & SONS Factory',
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
            consumptionSiteName: 'POLYSPIN Manufacturing',
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
            consumptionSiteName: 'PEL TEXTILES Unit 1',
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
            consumptionSiteName: 'RAMAR & SONS Factory',
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
        
        // First, delete existing captive data if any
        try {
            const { Items: existingItems } = await docClient.send(new ScanCommand({
                TableName: TableNames.CAPTIVE
            }));
            
            if (existingItems && existingItems.length > 0) {
                console.log(`Found ${existingItems.length} existing captive records, deleting...`);
                await Promise.all(existingItems.map(async (item) => {
                    await docClient.send(new DeleteCommand({
                        TableName: TableNames.CAPTIVE,
                        Key: {
                            generatorCompanyId: item.generatorCompanyId,
                            shareholderCompanyId: item.shareholderCompanyId
                        }
                    }));
                }));
                console.log('Deleted all existing captive records');
            }
        } catch (error) {
            if (error.name !== 'ResourceNotFoundException') {
                console.error('Error clearing existing captive data:', error);
                throw error;
            }
        }

        // Insert new captive data in batches
        const batchSize = 10;
        for (let i = 0; i < captiveData.length; i += batchSize) {
            const batch = captiveData.slice(i, i + batchSize);
            await Promise.all(batch.map(async (item) => {
                const params = {
                    TableName: TableNames.CAPTIVE,
                    Item: {
                        ...item,
                        generatorCompanyId: Number(item.generatorCompanyId),
                        shareholderCompanyId: Number(item.shareholderCompanyId),
                        allocationPercentage: Number(item.allocationPercentage),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                };
                try {
                    await docClient.send(new PutCommand(params));
                    console.log(`Inserted captive data for Generator ${item.generatorCompanyId} and Shareholder ${item.shareholderCompanyId} (${item.allocationPercentage}%)`);
                } catch (error) {
                    console.error('Error inserting captive data:', {
                        error: error.message,
                        item,
                        stack: error.stack
                    });
                    throw error;
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