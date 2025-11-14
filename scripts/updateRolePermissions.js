const { DynamoDBClient, UpdateTableCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local'
    }
});

const docClient = DynamoDBDocumentClient.from(client);

const updateRolePermissions = async () => {
    try {
        const roles = [
            {
                roleId: 'ROLE-1',
                permissions: {
                    production: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'production-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'production-charges': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'consumption': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'consumption-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    allocation: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    banking: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    lapse: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    captive: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    company: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    users: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    roles: ['READ']
                }
            },
            {
                roleId: 'ROLE-2',
                permissions: {
                    production: ['READ', 'UPDATE'],
                    'production-units': ['READ', 'UPDATE'],
                    'production-charges': ['READ', 'UPDATE'],
                    'consumption': ['READ', 'UPDATE'],
                    'consumption-units': ['READ', 'UPDATE'],
                    allocation: ['READ', 'UPDATE'],
                    banking: ['READ', 'UPDATE'],
                    lapse: ['READ', 'UPDATE'],
                    captive: ['READ'],
                    company: ['READ'],
                    users: ['READ'],
                    roles: ['READ']
                }
            },
            {
                roleId: 'ROLE-3',
                permissions: {
                    production: ['READ'],
                    'production-units': ['READ'],
                    'production-charges': ['READ'],
                    'consumption': ['READ'],
                    'consumption-units': ['READ'],
                    allocation: ['READ'],
                    banking: ['READ'],
                    lapse: ['READ'],
                    captive: ['READ'],
                    company: ['READ'],
                    users: ['READ'],
                    roles: ['READ']
                }
            }
        ];

        for (const role of roles) {
            const params = {
                TableName: 'RoleTable',
                Key: { roleId: role.roleId },
                UpdateExpression: 'SET #perms = :permissions, updatedAt = :updatedAt',
                ExpressionAttributeNames: {
                    '#perms': 'permissions'
                },
                ExpressionAttributeValues: {
                    ':permissions': role.permissions,
                    ':updatedAt': new Date().toISOString()
                }
            };

            await docClient.send(new UpdateCommand(params));
            console.log(`Updated permissions for ${role.roleId}`);
        }

        console.log('All role permissions updated successfully');
    } catch (error) {
        console.error('Error updating role permissions:', error);
        process.exit(1);
    }
};

updateRolePermissions();
