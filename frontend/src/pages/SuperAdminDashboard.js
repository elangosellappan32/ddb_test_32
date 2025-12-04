import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import {
    Box,
    Container,
    Grid,
    Paper,
    Card,
    CardContent,
    CardHeader,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
    Typography,
    Alert
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import SecurityIcon from '@mui/icons-material/Security';
import StorageIcon from '@mui/icons-material/Storage';

const SuperAdminDashboard = () => {
    const { user, isSuperAdmin } = useAuth();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(true);
    const [systemStats, setSystemStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        totalSites: 0,
        totalCompanies: 0,
        systemHealth: 'healthy'
    });
    const [users, setUsers] = useState([]);
    const [openUserDialog, setOpenUserDialog] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        role: 'USER',
        companyId: ''
    });

    // Check if user is superadmin
    useEffect(() => {
        if (!isSuperAdmin()) {
            enqueueSnackbar('Access denied. Superadmin role required.', { variant: 'error' });
            navigate('/');
        }
        setLoading(false);
    }, [isSuperAdmin, navigate, enqueueSnackbar]);

    // Fetch system statistics
    const fetchSystemStats = async () => {
        try {
            // This would call an API endpoint to get system statistics
            // For now, using mock data
            setSystemStats({
                totalUsers: 15,
                activeUsers: 12,
                totalSites: 8,
                totalCompanies: 2,
                systemHealth: 'healthy'
            });
        } catch (error) {
            console.error('Failed to fetch system stats:', error);
            enqueueSnackbar('Failed to load system statistics', { variant: 'error' });
        }
    };

    // Fetch all users
    const fetchUsers = async () => {
        try {
            // This would call an API endpoint to get all users
            // For now, using mock data
            setUsers([
                {
                    id: '1',
                    username: 'admin1',
                    email: 'admin1@example.com',
                    role: 'ADMIN',
                    company: 'Company 1',
                    status: 'active',
                    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
                },
                {
                    id: '2',
                    username: 'user1',
                    email: 'user1@example.com',
                    role: 'USER',
                    company: 'Company 1',
                    status: 'active',
                    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
                },
                {
                    id: '3',
                    username: 'viewer1',
                    email: 'viewer1@example.com',
                    role: 'VIEWER',
                    company: 'Company 2',
                    status: 'active',
                    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString()
                }
            ]);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            enqueueSnackbar('Failed to load users', { variant: 'error' });
        }
    };

    // Initialize dashboard
    useEffect(() => {
        if (!isSuperAdmin()) return;
        fetchSystemStats();
        fetchUsers();
    }, [isSuperAdmin]);

    const handleOpenUserDialog = (user = null) => {
        if (user) {
            setSelectedUser(user);
            setFormData({
                username: user.username,
                email: user.email,
                role: user.role,
                companyId: user.company
            });
        } else {
            setSelectedUser(null);
            setFormData({
                username: '',
                email: '',
                role: 'USER',
                companyId: ''
            });
        }
        setOpenUserDialog(true);
    };

    const handleCloseUserDialog = () => {
        setOpenUserDialog(false);
        setSelectedUser(null);
    };

    const handleUserFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSaveUser = async () => {
        try {
            // This would call an API endpoint to save the user
            if (selectedUser) {
                enqueueSnackbar('User updated successfully', { variant: 'success' });
            } else {
                enqueueSnackbar('User created successfully', { variant: 'success' });
            }
            handleCloseUserDialog();
            fetchUsers();
        } catch (error) {
            console.error('Failed to save user:', error);
            enqueueSnackbar('Failed to save user', { variant: 'error' });
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;

        try {
            // This would call an API endpoint to delete the user
            enqueueSnackbar('User deleted successfully', { variant: 'success' });
            fetchUsers();
        } catch (error) {
            console.error('Failed to delete user:', error);
            enqueueSnackbar('Failed to delete user', { variant: 'error' });
        }
    };

    if (loading) {
        return (
            <Container>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                    <Typography>Loading...</Typography>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <AdminPanelSettingsIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                    <Typography variant="h4" component="h1">
                        Superadmin Dashboard
                    </Typography>
                </Box>
                <Alert severity="info">
                    You are logged in as <strong>{user?.username}</strong> with Superadmin privileges. You have full access to all system resources.
                </Alert>
            </Box>

            {/* System Statistics */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper 
                        sx={{ p: 2, textAlign: 'center', cursor: 'pointer', '&:hover': { boxShadow: 3 } }}
                        onClick={() => navigate('/users')}
                    >
                        <ManageAccountsIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                        <Typography variant="h6">{systemStats.totalUsers}</Typography>
                        <Typography variant="caption" color="textSecondary">Total Users</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', cursor: 'pointer', '&:hover': { boxShadow: 3 } }}>
                        <ManageAccountsIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                        <Typography variant="h6">{systemStats.activeUsers}</Typography>
                        <Typography variant="caption" color="textSecondary">Active Users</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', cursor: 'pointer', '&:hover': { boxShadow: 3 } }}>
                        <StorageIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                        <Typography variant="h6">{systemStats.totalSites}</Typography>
                        <Typography variant="caption" color="textSecondary">Production Sites</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', cursor: 'pointer', '&:hover': { boxShadow: 3 } }}>
                        <SecurityIcon sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                        <Typography variant="h6">{systemStats.totalCompanies}</Typography>
                        <Typography variant="caption" color="textSecondary">Companies</Typography>
                    </Paper>
                </Grid>
            </Grid>

            {/* User Management */}
            <Card sx={{ mb: 4 }}>
                <CardHeader
                    title="User Management"
                    action={
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => handleOpenUserDialog()}
                        >
                            Add New User
                        </Button>
                    }
                />
                <CardContent>
                    <TableContainer>
                        <Table>
                            <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                                <TableRow>
                                    <TableCell><strong>Username</strong></TableCell>
                                    <TableCell><strong>Email</strong></TableCell>
                                    <TableCell><strong>Role</strong></TableCell>
                                    <TableCell><strong>Company</strong></TableCell>
                                    <TableCell><strong>Status</strong></TableCell>
                                    <TableCell><strong>Last Login</strong></TableCell>
                                    <TableCell><strong>Actions</strong></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.username}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={user.role}
                                                size="small"
                                                color={user.role === 'ADMIN' ? 'error' : user.role === 'USER' ? 'warning' : 'default'}
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell>{user.company}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={user.status}
                                                size="small"
                                                color={user.status === 'active' ? 'success' : 'default'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {new Date(user.lastLogin).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={() => handleOpenUserDialog(user)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="text"
                                                color="error"
                                                onClick={() => handleDeleteUser(user.id)}
                                            >
                                                Delete
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>

            {/* User Dialog */}
            <Dialog open={openUserDialog} onClose={handleCloseUserDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {selectedUser ? 'Edit User' : 'Add New User'}
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <TextField
                        fullWidth
                        label="Username"
                        name="username"
                        value={formData.username}
                        onChange={handleUserFormChange}
                        disabled={!!selectedUser}
                        margin="normal"
                    />
                    <TextField
                        fullWidth
                        label="Email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleUserFormChange}
                        margin="normal"
                    />
                    <FormControl fullWidth margin="normal">
                        <InputLabel>Role</InputLabel>
                        <Select
                            name="role"
                            value={formData.role}
                            onChange={handleUserFormChange}
                            label="Role"
                        >
                            <MenuItem value="SUPERADMIN">Superadmin</MenuItem>
                            <MenuItem value="ADMIN">Admin</MenuItem>
                            <MenuItem value="USER">User</MenuItem>
                            <MenuItem value="VIEWER">Viewer</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        fullWidth
                        label="Company ID"
                        name="companyId"
                        value={formData.companyId}
                        onChange={handleUserFormChange}
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseUserDialog}>Cancel</Button>
                    <Button onClick={handleSaveUser} variant="contained" color="primary">
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default SuperAdminDashboard;
