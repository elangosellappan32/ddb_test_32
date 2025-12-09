import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSnackbar } from 'notistack';
import {
  Box, Grid, Typography, Alert, Button, CircularProgress, Paper, IconButton, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Tooltip,
  Card, CardContent, CardActions, Divider, FormControl, InputLabel, Select, FormHelperText,
  TableSortLabel, Toolbar, TableFooter, Link, Breadcrumbs, Chip
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  Lock as LockIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import userApi from '../services/userApi';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';

const UserPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { user: currentUser } = useAuth();

  // State for users data and loading
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // State for dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // State for table and pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState('username');
  const [order, setOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'

  // Form state
  const [formValues, setFormValues] = useState({
    username: '',
    email: '',
    roleId: '',
    companyId: currentUser?.companyId || '',
    isActive: true,
    metadata: {}
  });
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchUsers = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      else setRefreshing(true);

      const result = await userApi.getAll();
      const list = Array.isArray(result?.data) ? result.data : [];
      setUsers(list);
      setError(null);
      return list;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to load users';
      setError(errorMsg);
      enqueueSnackbar(errorMsg, { variant: 'error' });
      return [];
    } finally {
      if (showLoading) setLoading(false);
      else setRefreshing(false);
    }
  }, [enqueueSnackbar]);

  const getCompanyName = useCallback((companyId) => {
    if (!companyId) return 'N/A';
    
    // If companies haven't loaded yet, return a loading indicator
    if (!companiesLoaded || companies.length === 0) {
      console.log('Companies not loaded yet, returning loading for ID:', companyId);
      return 'Loading...';
    }
    
    // Try multiple comparison approaches to handle type mismatches
    const company = companies.find(c => {
      const dbCompanyId = c.companyId;
      const searchId = companyId;
      
      // Convert both to strings and compare
      return dbCompanyId.toString() === searchId.toString() ||
             dbCompanyId === searchId ||
             dbCompanyId === Number(searchId) ||
             Number(dbCompanyId) === Number(searchId);
    });
    
    const companyName = company?.companyName;
    
    if (companyName) {
      console.log(`Found company: ID ${companyId} -> ${companyName}`);
      return companyName;
    } else {
      console.log(`Company not found for ID: ${companyId} (type: ${typeof companyId}). Available companies:`, companies.map(c => ({ id: c.companyId, type: typeof c.companyId, name: c.companyName })));
      return companyId;
    }
  }, [companies, companiesLoaded]);

  // Helper function to get company names for a user
  const getUserCompanyNames = useCallback((userObj) => {
    if (!userObj || !companiesLoaded) return 'N/A';

    console.log('getUserCompanyNames called for user:', userObj?.username);
    console.log('User metadata:', userObj?.metadata);

    // Handle array format: companies: [1, 5]
    if (userObj?.metadata?.accessibleSites?.companies && Array.isArray(userObj.metadata.accessibleSites.companies)) {
      const companyIds = userObj.metadata.accessibleSites.companies;
      console.log('Found companies array:', companyIds);
      const companyNames = companyIds
        .map(id => getCompanyName(id))
        .filter(name => name && name !== 'N/A');
      
      console.log('Company names from array:', companyNames);
      
      if (companyNames.length > 0) {
        return companyNames.join(', ');
      }
    }
    
    // Handle DynamoDB list format: company.L[{S: "1"}, {S: "5"}]
    if (userObj?.metadata?.accessibleSites?.company?.L && userObj.metadata.accessibleSites.company.L.length > 0) {
      const companyIds = userObj.metadata.accessibleSites.company.L.map(c => c.S);
      console.log('Found DynamoDB company list:', companyIds);
      const companyNames = companyIds
        .map(id => getCompanyName(id))
        .filter(name => name && name !== 'N/A');
      
      console.log('Company names from DynamoDB list:', companyNames);
      
      if (companyNames.length > 0) {
        return companyNames.join(', ');
      }
    }
    
    // Fallback to single company logic
    let companyId = userObj?.companyId || userObj?.metadata?.companyId || userObj?.company?.id;
    
    if (!companyId && userObj?.metadata?.department) {
      companyId = userObj.metadata.department === 'STRIO' ? '1' : 
                 userObj.metadata.department === 'SMR' ? '5' : null;
    }
    
    if (!companyId && userObj?.email) {
      companyId = userObj.email.includes('@strio.com') ? '1' : 
                 userObj.email.includes('@smr.com') ? '5' : null;
    }
    
    console.log('Fallback companyId:', companyId);
    const fallbackName = companyId ? getCompanyName(companyId) : 'N/A';
    console.log('Fallback company name:', fallbackName);
    
    return fallbackName;
  }, [companiesLoaded, getCompanyName]);

  const fetchCompanies = useCallback(async () => {
    try {
      console.log('=== Starting fetchCompanies ===');
      const result = await userApi.getCompanies();
      console.log('fetchCompanies - API result:', result);
      
      // Handle the response structure from the backend
      const companiesList = Array.isArray(result?.data) ? result.data : [];
      console.log('fetchCompanies - Extracted companies list:', companiesList);
      console.log('fetchCompanies - Number of companies:', companiesList.length);
      
      if (companiesList.length > 0) {
        companiesList.forEach((company, index) => {
          console.log(`fetchCompanies - Company ${index + 1}: ID=${company.companyId}, Name=${company.companyName}`);
        });
      }
      
      setCompanies(companiesList);
      setCompaniesLoaded(true);
      console.log('fetchCompanies - Companies set and loaded flag set');
    } catch (err) {
      console.error('fetchCompanies - Failed to load companies:', err);
      // Use hardcoded company data as fallback since we know these exist in the database
      const hardcodedCompanies = [
        { companyId: 1, companyName: 'STRIO KAIZEN HITECH RESEARCH LABS PVT LTD' },
        { companyId: 2, companyName: 'POLYSPIN EXPORTS LTD' },
        { companyId: 3, companyName: 'PEL TEXTILES' },
        { companyId: 4, companyName: 'A RAMAR AND SONS' },
        { companyId: 5, companyName: 'SMR ENERGY' }
      ];
      console.log('fetchCompanies - Using hardcoded companies as fallback:', hardcodedCompanies);
      setCompanies(hardcodedCompanies);
      setCompaniesLoaded(true);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      console.log('=== Starting fetchRoles ===');
      // Clear any existing roles to show loading state
      setRoles([]);
      
      // Fetch roles from the database
      const result = await userApi.getRoles();
      console.log('fetchRoles - API result:', result);
      
      // Handle different response structures
      let rolesList = [];
      if (Array.isArray(result)) {
        rolesList = result;
      } else if (result && Array.isArray(result.data)) {
        rolesList = result.data;
      } else if (result && Array.isArray(result.roles)) {
        rolesList = result.roles;
      } else {
        console.warn('fetchRoles - Unexpected response structure, using fallback');
        throw new Error('Unexpected API response structure');
      }
      
      // Ensure we have a valid array of roles
      if (!Array.isArray(rolesList) || rolesList.length === 0) {
        console.warn('fetchRoles - No roles found in response, using fallback');
        throw new Error('No roles found in response');
      }
      
      console.log('fetchRoles - Extracted roles list:', rolesList);
      
      // Transform role data to match expected format
      const transformedRoles = rolesList
        .filter(role => role) // Filter out any null/undefined roles
        .map(role => ({
          roleId: String(role.roleId || role.id || '').toUpperCase(),
          roleName: String(role.roleName || role.name || role.roleId || role.id || 'Unnamed Role')
        }))
        .filter(role => role.roleId); // Filter out any roles without an ID
      
      console.log('fetchRoles - Transformed roles:', transformedRoles);
      
      if (transformedRoles.length === 0) {
        throw new Error('No valid roles found after transformation');
      }
      
      setRoles(transformedRoles);
      return transformedRoles;
    } catch (err) {
      console.error('fetchRoles - Failed to load roles:', err);
      // Fallback to mock data if API fails
      const mockRoles = [
        { roleId: 'SUPERADMIN', roleName: 'Super Admin' },
        { roleId: 'ADMIN', roleName: 'Admin' },
        { roleId: 'USER', roleName: 'User' },
        { roleId: 'VIEWER', roleName: 'Viewer' }
      ];
      console.warn('fetchRoles - Using mock roles as fallback:', mockRoles);
      setRoles(mockRoles);
      return mockRoles;
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchUsers(false);
  }, [fetchUsers]);

  const handleViewDetails = useCallback((userObj) => {
    console.log('handleViewDetails called with user:', userObj?.username);
    console.log('Current selectedUser before update:', selectedUser?.username);
    setSelectedUser(userObj);
    console.log('Selected user set to for details:', userObj?.username);
    setIsDetailsOpen(true);
  }, [selectedUser]);

  const handleEdit = useCallback((userObj) => {
    setIsEditMode(true);
    setSelectedUser(userObj);
    setFormValues({
      username: userObj.username || '',
      email: userObj.email || '',
      password: '',
      roleId: userObj.roleId || '',
      isActive: userObj.isActive !== undefined ? userObj.isActive : true
    });
    setFormError(null);
    setIsCreateOpen(true);
  }, []);

  const handleDelete = useCallback((userObj) => {
    console.log('handleDelete called with user:', userObj?.username);
    console.log('Current selectedUser before update:', selectedUser?.username);
    setSelectedUser(userObj);
    console.log('Selected user set to:', userObj?.username);
    setIsDeleteOpen(true);
  }, [selectedUser]);

  const handleOpenCreate = useCallback(() => {
    setIsEditMode(false);
    setSelectedUser(null);
    setFormValues({
      username: '',
      email: '',
      password: '',
      roleId: '',
      isActive: true
    });
    setFormError(null);
    setIsCreateOpen(true);
  }, []);

  const handleCloseCreate = useCallback(() => {
    if (isSubmitting) return;
    setIsCreateOpen(false);
    setIsEditMode(false);
    setSelectedUser(null);
  }, [isSubmitting]);

  const handleRequestSort = useCallback((property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  }, [orderBy, order]);

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'table' ? 'card' : 'table');
  }, []);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleFormChange = useCallback((event) => {
    const { name, value } = event.target;
    if (name === 'isActive') {
      setFormValues((prev) => ({ ...prev, [name]: value === 'true' }));
    } else {
      setFormValues((prev) => ({ ...prev, [name]: value }));
    }
  }, []);

  const handleCreateSubmit = async (event) => {
    event.preventDefault();

    // Basic validation
    if (!formValues.username || !formValues.username.trim()) {
      setFormError('Username is required');
      return;
    }

    if (!isEditMode && (!formValues.password || !formValues.password.trim())) {
      setFormError('Password is required for new users');
      return;
    }

    if (formValues.email && !/\S+@\S+\.\S+/.test(formValues.email)) {
      setFormError('Please enter a valid email address');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const userData = {
        username: formValues.username.trim(),
        email: (formValues.email || '').trim(),
        roleId: formValues.roleId || 'USER',
        isActive: formValues.isActive
      };

      if (isEditMode && selectedUser?.username) {
        // Update existing user
        await userApi.update(selectedUser.username, userData);
        enqueueSnackbar('User updated successfully', { variant: 'success' });
      } else {
        // Create new user
        userData.password = formValues.password;
        await userApi.create(userData);
        enqueueSnackbar('User created successfully', { variant: 'success' });
      }

      // Refresh users list
      await fetchUsers(false);
      handleCloseCreate();
    } catch (err) {
      const errorMsg = err.response?.data?.message ||
        (isEditMode ? 'Failed to update user' : 'Failed to create user');
      setFormError(errorMsg);
      enqueueSnackbar(errorMsg, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDelete = useCallback(() => {
    if (isSubmitting) return;
    setIsDeleteOpen(false);
    setSelectedUser(null);
  }, [isSubmitting]);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedUser?.username) return;

    // Prevent deleting yourself
    if (selectedUser.username === currentUser?.userId) {
      enqueueSnackbar('Cannot delete your own user account', { variant: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      await userApi.delete(selectedUser.username);
      enqueueSnackbar(`User "${selectedUser.username}" deleted successfully`, { variant: 'success' });

      // Close dialog
      setIsDeleteOpen(false);
      setSelectedUser(null);

      // Refresh users list
      await fetchUsers(false);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to delete user';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedUser, currentUser, fetchUsers, enqueueSnackbar]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (orderBy) {
        const aValue = a[orderBy] || '';
        const bValue = b[orderBy] || '';

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return order === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        return order === 'asc'
          ? (aValue > bValue ? 1 : -1)
          : (bValue > aValue ? 1 : -1);
      }
      return 0;
    });
  }, [users, orderBy, order]);

  const paginatedUsers = useMemo(() => {
    return sortedUsers.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [sortedUsers, page, rowsPerPage]);

  const renderStatusChip = useCallback((isActive) => {
    return (
      <Chip
        label={isActive ? 'Active' : 'Inactive'}
        color={isActive ? 'success' : 'error'}
        size="small"
        variant="filled"
      />
    );
  }, []);

  const visuallyHidden = {
    border: 0,
    clip: 'rect(0 0 0 0)',
    height: 1,
    margin: -1,
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    top: 20,
    width: 1,
  };

  const renderActions = useCallback((userObj) => (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
      <Tooltip title="View Details">
        <span>
          <IconButton
            size="small"
            color="info"
            onClick={() => handleViewDetails(userObj)}
            aria-label="view details"
          >
            <ViewIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Edit">
        <span>
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleEdit(userObj)}
            aria-label="edit"
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={userObj.username === currentUser?.userId ? 'Cannot delete yourself' : 'Delete'}>
        <span>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDelete(userObj)}
            disabled={userObj.username === currentUser?.userId}
            aria-label="delete"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  ), [currentUser, handleEdit, handleDelete, handleViewDetails]);

  const EnhancedTableHead = () => (
    <TableHead>
      <TableRow>
        {[
          { id: 'username', label: 'Username' },
          { id: 'email', label: 'Email' },
          { id: 'roleId', label: 'Role' },
          { id: 'isActive', label: 'Status' },
          { id: 'createdAt', label: 'Created' }
        ].map((headCell) => (
          <TableCell
            key={headCell.id}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : 'asc'}
              onClick={() => handleRequestSort(headCell.id)}
            >
              {headCell.label}
              {orderBy === headCell.id ? (
                <Box component="span" sx={visuallyHidden}>
                  {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                </Box>
              ) : null}
            </TableSortLabel>
          </TableCell>
        ))}
        <TableCell align="right">Actions</TableCell>
      </TableRow>
    </TableHead>
  );

  const renderCardView = () => (
    <Grid container spacing={3}>
      {paginatedUsers.map((userObj) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={userObj.username}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">{userObj.username}</Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                <strong>Email:</strong> {userObj.email || 'N/A'}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                <strong>Role:</strong> {userObj.roleId}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <strong>Status:</strong>
                {renderStatusChip(userObj.isActive)}
              </Box>
            </CardContent>
            <Divider />
            <CardActions sx={{ justifyContent: 'flex-end' }}>
              {renderActions(userObj)}
            </CardActions>
          </Card>
        </Grid>
      ))}
      <Grid item xs={12} sx={{ mt: 2 }}>
        <TablePagination
          component="div"
          count={users.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
          sx={{
            '& .MuiTablePagination-toolbar': {
              paddingLeft: 0,
              paddingRight: 1
            }
          }}
        />
      </Grid>
    </Grid>
  );

  const renderTableView = () => (
    <TableContainer component={Paper} sx={{ mt: 3, maxHeight: '70vh', overflow: 'auto' }}>
      <Table stickyHeader>
        <EnhancedTableHead />
        <TableBody>
          {paginatedUsers.map((userObj, index) => (
            <TableRow
              key={`${userObj.username}-${index}`}
              hover
              sx={{ '&:hover': { cursor: 'pointer' } }}
            >
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {userObj.username}
                </Typography>
              </TableCell>
              <TableCell>{userObj.email || 'N/A'}</TableCell>
              <TableCell>
                <Chip label={userObj.roleId} size="small" variant="outlined" />
              </TableCell>
              <TableCell>
                {renderStatusChip(userObj.isActive)}
              </TableCell>
              <TableCell>
                {userObj.createdAt
                  ? new Date(userObj.createdAt).toLocaleDateString()
                  : 'N/A'}
              </TableCell>
              <TableCell align="right">
                {renderActions(userObj)}
              </TableCell>
            </TableRow>
          ))}

          {paginatedUsers.length === 0 && !loading && (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                <Typography color="text.secondary">
                  No users found
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      try {
        setInitialLoading(true);
        
        // 1. First load companies
        console.log('Loading companies...');
        await fetchCompanies();
        
        // 2. Then load roles
        console.log('Loading roles...');
        await fetchRoles();
        
        // 3. Finally load users
        console.log('Loading users...');
        await fetchUsers();
        
      } catch (err) {
        console.error('Error loading initial data:', err);
        enqueueSnackbar('Error loading data. Some features may be limited.', { 
          variant: 'error',
          autoHideDuration: 5000
        });
      } finally {
        if (isMounted) {
          setInitialLoading(false);
        }
      }
    };
    
    loadInitialData();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [fetchUsers, fetchRoles, fetchCompanies, enqueueSnackbar]);

  // Debug delete dialog state changes
  useEffect(() => {
    if (isDeleteOpen && selectedUser) {
      console.log('Delete dialog opened with selectedUser:', selectedUser?.username);
      console.log('Delete dialog selectedUser object:', selectedUser);
      console.log('Delete dialog user metadata:', selectedUser?.metadata);
    }
  }, [isDeleteOpen, selectedUser]);

  if (loading && initialLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={40} />
        <Typography variant="body1" color="text.secondary">
          Loading user data and companies...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: 'background.paper', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 4,
        borderBottom: '2px solid #000000',
        pb: 2
      }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            User Management
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip 
              label={companiesLoaded ? "Companies Loaded" : "Loading Companies..."}
              color={companiesLoaded ? "success" : "warning"}
              size="small"
              variant="outlined"
            />
            <Chip 
              label={`${users.length} Users`}
              color="primary"
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton 
            onClick={toggleViewMode}
            color="primary"
            size="large"
          >
            {viewMode === 'card' ? <ViewListIcon /> : <ViewModuleIcon />}
          </IconButton>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading || refreshing}
            size="medium"
            sx={{ 
              fontWeight: 500,
              textTransform: 'none',
              borderRadius: 1.5
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            disabled={loading}
            size="medium"
            sx={{ 
              fontWeight: 500,
              textTransform: 'none',
              borderRadius: 1.5
            }}
          >
            Add User
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            borderRadius: 1,
            boxShadow: 1,
            '& .MuiAlert-message': {
              display: 'flex',
              alignItems: 'center'
            },
            '& .MuiAlert-icon': {
              fontSize: 24
            }
          }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : !loading && users.length === 0 ? (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          textAlign: 'center',
          minHeight: '50vh',
          backgroundColor: 'background.paper',
          borderRadius: 2,
          boxShadow: 1,
          mx: 'auto',
          maxWidth: '600px',
          my: 4
        }}>
          <Typography variant="h5" color="textPrimary" gutterBottom>
            No Users Found
          </Typography>

          <Typography variant="body1" color="textSecondary" paragraph>
            Get started by adding your first user.
          </Typography>

          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{
              mt: 3,
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              textTransform: 'none',
              whiteSpace: 'nowrap',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 3
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            Add New User
          </Button>
        </Box>
      ) : viewMode === 'table' ? (
        renderTableView()
      ) : (
        renderCardView()
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateOpen}
        onClose={handleCloseCreate}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 3
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          py: 2.5,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          fontSize: '1.25rem',
          fontWeight: 600
        }}>
          <LockIcon sx={{ mr: 1.5, fontSize: 28 }} />
          {isEditMode ? 'Edit User' : 'Add New User'}
        </DialogTitle>

        <form onSubmit={handleCreateSubmit}>
          <DialogContent sx={{ p: 3 }}>
            {formError && (
              <Alert
                severity="error"
                sx={{
                  mb: 2,
                  borderRadius: 1,
                  boxShadow: 1,
                  '& .MuiAlert-message': {
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center'
                  },
                  '& .MuiAlert-icon': {
                    fontSize: 24
                  }
                }}
              >
                {formError}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Username"
                  name="username"
                  value={formValues.username}
                  onChange={handleFormChange}
                  margin="normal"
                  required
                  variant="outlined"
                  size="small"
                  InputLabelProps={{
                    shrink: true,
                  }}
                  InputProps={{
                    sx: { borderRadius: 1 }
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formValues.email}
                  onChange={handleFormChange}
                  margin="normal"
                  variant="outlined"
                  size="small"
                  InputLabelProps={{
                    shrink: true,
                  }}
                  InputProps={{
                    sx: { borderRadius: 1 }
                  }}
                />
              </Grid>

              {!isEditMode && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Password"
                    name="password"
                    type="password"
                    value={formValues.password}
                    onChange={handleFormChange}
                    margin="normal"
                    required={!isEditMode}
                    variant="outlined"
                    size="small"
                    InputLabelProps={{
                      shrink: true,
                    }}
                    InputProps={{
                      sx: { borderRadius: 1 }
                    }}
                  />
                </Grid>
              )}

              <Grid item xs={12} sm={6}>
                <FormControl
                  fullWidth
                  margin="normal"
                  required
                  size="small"
                  error={!formValues.roleId && formSubmitAttempted}
                >
                  <InputLabel id="role-label">
                    {roles.length === 0 ? 'Loading roles...' : 'Role'}
                  </InputLabel>
                  <Select
                    labelId="role-label"
                    name="roleId"
                    value={formValues.roleId || ''}
                    onChange={handleFormChange}
                    label={roles.length === 0 ? 'Loading roles...' : 'Role'}
                    variant="outlined"
                    sx={{ borderRadius: 1 }}
                    disabled={roles.length === 0}
                    displayEmpty
                    renderValue={(selected) => {
                      if (!selected) return <em>Select a role</em>;
                      const role = roles.find(r => r.roleId === selected);
                      return role ? role.roleName : selected;
                    }}
                  >
                    {roles.length === 0 ? (
                      <MenuItem disabled>
                        <Box display="flex" alignItems="center" width="100%">
                          <CircularProgress size={20} sx={{ mr: 1 }} />
                          Loading roles...
                        </Box>
                      </MenuItem>
                    ) : (
                      <MenuItem value="" disabled>
                        <em>Select a role</em>
                      </MenuItem>
                    )}
                    {roles.map((role) => (
                      <MenuItem key={role.roleId} value={role.roleId}>
                        {role.roleName}
                      </MenuItem>
                    ))}
                  </Select>
                  {!formValues.roleId && formSubmitAttempted && (
                    <FormHelperText error>Please select a role</FormHelperText>
                  )}
                  {roles.length === 0 && !initialLoading && (
                    <FormHelperText error>
                      Failed to load roles. Using default roles.
                    </FormHelperText>
                  )}
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl
                  fullWidth
                  margin="normal"
                  size="small"
                >
                  <InputLabel id="status-label">Status</InputLabel>
                  <Select
                    labelId="status-label"
                    name="isActive"
                    value={formValues.isActive.toString()}
                    onChange={handleFormChange}
                    label="Status"
                    variant="outlined"
                    sx={{ borderRadius: 1 }}
                  >
                    <MenuItem value="true">Active</MenuItem>
                    <MenuItem value="false">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions sx={{ p: 2.5, borderTop: 1, borderColor: 'divider', gap: 1 }}>
            <Button
              onClick={handleCloseCreate}
              disabled={isSubmitting}
              variant="outlined"
              color="inherit"
              sx={{
                textTransform: 'none',
                borderRadius: 1,
                px: 3,
                py: 1,
                fontWeight: 500
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
              sx={{
                textTransform: 'none',
                borderRadius: 1,
                px: 3,
                py: 1,
                fontWeight: 500,
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none'
                }
              }}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Enhanced User Profile Dialog */}
      <Dialog
        open={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 3
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          py: 2.5,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '1.25rem',
          fontWeight: 600
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <PersonIcon sx={{ mr: 1.5, fontSize: 28 }} />
            User Profile
          </Box>
          {selectedUser?.username === currentUser?.userId && (
            <Chip 
              label="Your Account" 
              color="secondary" 
              size="small" 
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {/* Profile Header */}
          <Box sx={{ 
            p: 3, 
            bgcolor: 'primary.light', 
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: 3
            }}>
              <Box sx={{ 
                width: 100, 
                height: 100, 
                borderRadius: '50%', 
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '2.5rem',
                fontWeight: 600
              }}>
                {selectedUser?.username?.charAt(0)?.toUpperCase() || 'U'}
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {selectedUser?.username}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                  {selectedUser?.email || 'No email provided'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip 
                    label={selectedUser?.roleId || 'USER'} 
                    color="primary" 
                    size="small" 
                    variant="outlined"
                  />
                  <Chip 
                    label={selectedUser?.isActive !== false ? 'Active' : 'Inactive'} 
                    color={selectedUser?.isActive !== false ? 'success' : 'error'} 
                    size="small" 
                  />
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Main Content */}
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {/* Personal Information */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ 
                      mb: 2, 
                      pb: 1, 
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      <PersonIcon fontSize="small" />
                      Personal Information
                    </Typography>
                    
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: '120px 1fr',
                      gap: '12px 8px',
                      '& > :nth-child(odd)': {
                        color: 'text.secondary',
                        fontWeight: 500
                      }
                    }}>
                      <Typography variant="body2">Username:</Typography>
                      <Typography variant="body2">{selectedUser?.username || 'N/A'}</Typography>

                      <Typography variant="body2">Email:</Typography>
                      <Typography variant="body2">
                        {selectedUser?.email || selectedUser?.emailId || 'No email provided'}
                      </Typography>

                      <Typography variant="body2">Account Status:</Typography>
                      <Box>
                        <Chip 
                          label={selectedUser?.isActive !== false ? 'Active' : 'Inactive'} 
                          size="small" 
                          color={selectedUser?.isActive !== false ? 'success' : 'error'} 
                          sx={{ height: 24 }}
                        />
                      </Box>

                      <Typography variant="body2">Member Since:</Typography>
                      <Typography variant="body2">
                        {selectedUser?.createdAt 
                          ? new Date(selectedUser.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })
                          : 'N/A'}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Company & Role */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ 
                      mb: 2, 
                      pb: 1, 
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      <BusinessIcon fontSize="small" />
                      Company & Role
                    </Typography>
                    
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: '140px 1fr',
                      gap: '12px 8px',
                      '& > :nth-child(odd)': {
                        color: 'text.secondary',
                        fontWeight: 500
                      }
                    }}>
                      <Typography variant="body2">Role:</Typography>
                      <Box>
                        <Chip 
                          label={selectedUser?.roleId || 'USER'} 
                          color="primary" 
                          size="small" 
                          variant="outlined"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </Box>

                      <Typography variant="body2">Department:</Typography>
                      <Box>
                        {selectedUser?.metadata?.department ? (
                          <Chip 
                            label={selectedUser.metadata.department}
                            size="small"
                            color="secondary"
                            variant="outlined"
                          />
                        ) : (
                          <Typography variant="body2" color="textSecondary">N/A</Typography>
                        )}
                      </Box>

                      <Typography variant="body2">Access Level:</Typography>
                      <Box>
                        {selectedUser?.metadata?.accessLevel ? (
                          <Chip 
                            label={selectedUser.metadata.accessLevel}
                            size="small"
                            color={selectedUser.metadata.accessLevel === 'Admin' ? 'primary' : 'default'}
                            variant="outlined"
                          />
                        ) : selectedUser?.roleId ? (
                          <Chip 
                            label={selectedUser.roleId}
                            size="small"
                            color="default"
                            variant="outlined"
                          />
                        ) : (
                          <Typography variant="body2" color="textSecondary">Limited Access</Typography>
                        )}
                      </Box>

                      <Typography variant="body2">Company:</Typography>
                      <Box>
                        {!companiesLoaded ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={16} />
                            <Typography variant="body2">Loading companies...</Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2">
                            {getUserCompanyNames(selectedUser) || 'No company assigned'}
                          </Typography>
                        )}
                      </Box>

                      <Typography variant="body2">Last Updated:</Typography>
                      <Typography variant="body2">
                        {selectedUser?.updatedAt 
                          ? new Date(selectedUser.updatedAt).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'N/A'}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Activity & Metadata */}
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" sx={{ 
                      mb: 2, 
                      pb: 1, 
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      <HistoryIcon fontSize="small" />
                      Activity & Metadata
                    </Typography>
                    
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                      gap: 3
                    }}>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Last Login
                        </Typography>
                        <Typography variant="body2">
                          {selectedUser?.lastLogin 
                            ? new Date(selectedUser.lastLogin).toLocaleString()
                            : 'Never logged in'}
                        </Typography>
                      </Box>

                      {selectedUser?.metadata?.department && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Department
                          </Typography>
                          <Typography variant="body2">
                            {selectedUser.metadata.department}
                          </Typography>
                        </Box>
                      )}

                      {selectedUser?.metadata?.phone && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Phone
                          </Typography>
                          <Typography variant="body2">
                            {selectedUser.metadata.phone}
                          </Typography>
                        </Box>
                      )}

                      {selectedUser?.createdAt && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Account Created
                          </Typography>
                          <Typography variant="body2">
                            {new Date(selectedUser.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Display additional metadata if available */}
                    {selectedUser?.metadata && Object.keys(selectedUser.metadata).length > 0 && (
                      <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Additional Information
                        </Typography>
                        <Box component="pre" sx={{ 
                          p: 2, 
                          bgcolor: 'background.default', 
                          borderRadius: 1,
                          maxHeight: 200,
                          overflow: 'auto',
                          fontSize: '0.8rem',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {JSON.stringify(selectedUser.metadata, null, 2)}
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={() => setIsDetailsOpen(false)}
            variant="outlined"
            color="inherit"
            sx={{ textTransform: 'none' }}
          >
            Close
          </Button>
          <Button 
            onClick={() => {
              setIsDetailsOpen(false);
              handleEdit(selectedUser);
            }}
            variant="contained"
            color="primary"
            sx={{ textTransform: 'none' }}
            startIcon={<EditIcon />}
          >
            Edit Profile
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteOpen}
        onClose={handleCloseDelete}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2.5,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            overflow: 'visible'
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: 'error.main',
          color: 'error.contrastText',
          py: 3,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          fontSize: '1.3rem',
          fontWeight: 700,
          letterSpacing: 0.5
        }}>
          <DeleteIcon sx={{ mr: 2, fontSize: 32 }} />
          Delete User
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {/* User Name Section */}
          <Box sx={{
            bgcolor: 'primary.light',
            border: '2px solid',
            borderColor: 'primary.main',
            borderRadius: 2,
            p: 2,
            mb: 3,
            textAlign: 'center'
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              You are about to delete
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.dark' }}>
              {selectedUser?.username}
            </Typography>
          </Box>

          {/* Warning Message */}
          <Box sx={{
            bgcolor: 'error.light',
            border: '1px solid',
            borderColor: 'error.lighter',
            borderRadius: 1.5,
            p: 2,
            mb: 3,
            display: 'flex',
            gap: 2
          }}>
            <Box sx={{ color: 'error.main', flexShrink: 0, pt: 0.25 }}>
              ⚠️
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: 'error.dark' }}>
                This action cannot be undone
              </Typography>
              <Typography variant="caption" color="text.secondary">
                The user account and all associated data will be permanently deleted from the system.
              </Typography>
            </Box>
          </Box>

          {/* User Details */}
          <Box sx={{
            bgcolor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: 1.5,
            p: 2
          }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              User Details:
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              <strong>Username:</strong> {selectedUser?.username}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              <strong>Email:</strong> {selectedUser?.email || selectedUser?.emailId || 'N/A'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              <strong>Role:</strong> {selectedUser?.roleId || selectedUser?.role || selectedUser?.roleName || 'USER'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              <strong>Company:</strong> {(() => {
                if (!companiesLoaded) {
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={12} />
                      <span>Loading...</span>
                    </Box>
                  );
                }
                
                return getUserCompanyNames(selectedUser);
              })()}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              <strong>Created:</strong> {selectedUser?.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'N/A'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              <strong>Last Updated:</strong> {selectedUser?.updatedAt ? new Date(selectedUser.updatedAt).toLocaleDateString() : 'N/A'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              <strong>Status:</strong> {selectedUser?.isActive !== false ? 'Active' : 'Inactive'}
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ 
          p: 2.5, 
          borderTop: '1px solid',
          borderColor: 'divider',
          gap: 1.5,
          bgcolor: '#fafafa'
        }}>
          <Button
            onClick={handleCloseDelete}
            disabled={isSubmitting}
            variant="outlined"
            color="inherit"
            sx={{
              textTransform: 'none',
              borderRadius: 1.5,
              px: 4,
              py: 1.2,
              fontWeight: 600,
              border: '2px solid #e0e0e0',
              transition: 'all 0.3s ease',
              '&:hover': {
                border: '2px solid #999',
                bgcolor: '#f5f5f5'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
            sx={{
              textTransform: 'none',
              borderRadius: 1.5,
              px: 4,
              py: 1.2,
              fontWeight: 600,
              boxShadow: 'none',
              bgcolor: 'error.main',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 24px rgba(211, 47, 47, 0.4)',
                bgcolor: 'error.dark',
                transform: 'translateY(-2px)'
              },
              '&:disabled': {
                opacity: 0.6
              }
            }}
          >
            {isSubmitting ? 'Deleting...' : 'Delete User'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserPage;
