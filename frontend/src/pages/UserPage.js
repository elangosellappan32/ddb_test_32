import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSnackbar } from 'notistack';
import {
  Box, Grid, Typography, Alert, Button, CircularProgress, Paper, IconButton, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Tooltip,
  Card, CardContent, CardActions, Divider, FormControl, InputLabel, Select,
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
  Lock as LockIcon
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // State for dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

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
    password: '',
    roleId: '',
    isActive: true
  });
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

  const fetchRoles = useCallback(async () => {
    try {
      // This would need a roles API endpoint - for now we'll use mock data
      const mockRoles = [
        { roleId: 'ADMIN', roleName: 'Admin' },
        { roleId: 'USER', roleName: 'User' },
        { roleId: 'VIEWER', roleName: 'Viewer' }
      ];
      setRoles(mockRoles);
    } catch (err) {
      console.error('Failed to load roles:', err);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchUsers(false);
  }, [fetchUsers]);

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
    setSelectedUser(userObj);
    setIsDeleteOpen(true);
  }, []);

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
      <Tooltip title="Edit">
        <IconButton
          size="small"
          color="primary"
          onClick={() => handleEdit(userObj)}
          aria-label="edit"
        >
          <EditIcon fontSize="small" />
        </IconButton>
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
  ), [currentUser, handleEdit, handleDelete]);

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
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <PersonIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: '#1976d2' }}>Users</Typography>
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
                >
                  <InputLabel id="role-label">Role</InputLabel>
                  <Select
                    labelId="role-label"
                    name="roleId"
                    value={formValues.roleId}
                    onChange={handleFormChange}
                    label="Role"
                    variant="outlined"
                    sx={{ borderRadius: 1 }}
                  >
                    <MenuItem value="">
                      <em>Select Role</em>
                    </MenuItem>
                    {roles.map((role) => (
                      <MenuItem key={role.roleId} value={role.roleId}>
                        {role.roleName}
                      </MenuItem>
                    ))}
                  </Select>
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
              <strong>Email:</strong> {selectedUser?.email || 'N/A'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              <strong>Role:</strong> {selectedUser?.roleId}
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
