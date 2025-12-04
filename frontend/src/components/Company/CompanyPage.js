import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSnackbar } from 'notistack';
import {
  Box, Grid, Typography, Alert, Button, CircularProgress, Paper, IconButton, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Tooltip,
  Card, CardContent, CardActions, Divider, FormControl, InputLabel, Select,
  TableSortLabel, Toolbar, TableFooter, Link, Breadcrumbs
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  BatteryChargingFull as CaptiveIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  Home as HomeIcon,
  BusinessCenter as BusinessCenterIcon
} from '@mui/icons-material';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import companyApi from '../../services/companyApi';
import GeneratorCaptiveDialog from './GeneratorCaptiveDialog';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';
import CompanyCard from './CompanyCard';

const CompanyPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  // State for companies data and loading
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // State for dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCaptiveDialogOpen, setIsCaptiveDialogOpen] = useState(false);
  const [captiveGeneratorCompany, setCaptiveGeneratorCompany] = useState(null);
  const [companySites, setCompanySites] = useState({ productionSites: { count: 0, sites: [] }, consumptionSites: { count: 0, sites: [] } });
  const [isCheckingSites, setIsCheckingSites] = useState(false);

  // State for table and pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState('companyName');
  const [order, setOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'

  // Form state
  const [formValues, setFormValues] = useState({
    companyName: '',
    type: '',
    address: '',
    contactPerson: '',
    mobile: '',
    emailId: ''
  });
  const [formError, setFormError] = useState(null);

  // Check permissions
  const permissions = useMemo(() => ({
    create: hasPermission(user, 'company', 'CREATE'),
    read: hasPermission(user, 'company', 'READ'),
    update: hasPermission(user, 'company', 'UPDATE'),
    delete: hasPermission(user, 'company', 'DELETE'),
    manageCaptive: hasPermission(user, 'captive', 'MANAGE')
  }), [user]);

  const fetchCompanies = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      else setRefreshing(true);

      const result = await companyApi.getAll();
      const list = Array.isArray(result?.data) ? result.data : [];
      setCompanies(list);
      setError(null);
      return list;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to load companies';
      setError(errorMsg);
      enqueueSnackbar(errorMsg, { variant: 'error' });
      return [];
    } finally {
      if (showLoading) setLoading(false);
      else setRefreshing(false);
    }
  }, [enqueueSnackbar]);

  const handleRefresh = useCallback(() => {
    fetchCompanies(false);
  }, [fetchCompanies]);

  const handleEdit = useCallback((company) => {
    setIsEditMode(true);
    setSelectedCompany(company);
    setFormValues({
      companyName: company.companyName || '',
      type: company.type ? company.type.charAt(0).toUpperCase() + company.type.slice(1).toLowerCase() : '',
      address: company.address || '',
      contactPerson: company.contactPerson || '',
      mobile: company.mobile || '',
      emailId: company.emailId || ''
    });
    setFormError(null);
    setIsCreateOpen(true);
  }, []);

  const handleDelete = useCallback((company) => {
    console.log('[CompanyPage] Delete initiated for company:', company);
    setSelectedCompany(company);
    setCompanySites({ productionSites: { count: 0, sites: [] }, consumptionSites: { count: 0, sites: [] } });
    setIsCheckingSites(true);
    setIsDeleteOpen(true);
    
    // Check if company has sites
    companyApi.checkSites(company.companyId)
      .then(result => {
        console.log('[CompanyPage] Sites check successful:', result);
        // Handle both direct data and wrapped response
        const siteData = result.data || result;
        setCompanySites({
          productionSites: siteData.productionSites || { count: 0, sites: [] },
          consumptionSites: siteData.consumptionSites || { count: 0, sites: [] }
        });
      })
      .catch(err => {
        console.error('[CompanyPage] Error checking company sites:', err);
        // Set empty sites on error
        setCompanySites({ productionSites: { count: 0, sites: [] }, consumptionSites: { count: 0, sites: [] } });
        // Show error notification
        enqueueSnackbar('Could not load site information', { variant: 'warning' });
      })
      .finally(() => {
        setIsCheckingSites(false);
      });
  }, [enqueueSnackbar]);

  const handleOpenCreate = useCallback(() => {
    setIsEditMode(false);
    setSelectedCompany(null);
    setFormValues({
      companyName: '',
      type: '',
      address: '',
      contactPerson: '',
      mobile: '',
      emailId: ''
    });
    setFormError(null);
    setIsCreateOpen(true);
  }, []);

  const handleCloseCreate = useCallback(() => {
    if (isSubmitting) return;
    setIsCreateOpen(false);
    setIsEditMode(false);
    setSelectedCompany(null);
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
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleOpenCaptiveDialog = useCallback((company) => {
    setCaptiveGeneratorCompany(company);
    setIsCaptiveDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedCompany?.companyId) {
      enqueueSnackbar('No company selected', { variant: 'error' });
      return;
    }

    // Check if company has associated sites
    const totalSites = (companySites?.productionSites?.count || 0) + (companySites?.consumptionSites?.count || 0);
    if (totalSites > 0) {
      enqueueSnackbar(
        `Cannot delete company with associated sites. Please delete all ${totalSites} site(s) first.`,
        { variant: 'error' }
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await companyApi.delete(selectedCompany.companyId);
      console.log('[CompanyPage] Delete response:', response);
      
      enqueueSnackbar(`Company "${selectedCompany.companyName}" deleted successfully`, { variant: 'success' });

      // Close dialog
      setIsDeleteOpen(false);
      setSelectedCompany(null);
      setCompanySites({ productionSites: { count: 0, sites: [] }, consumptionSites: { count: 0, sites: [] } });

      // Refresh companies list
      await fetchCompanies(false);
    } catch (err) {
      console.error('[CompanyPage] Delete failed:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to delete company';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCompany, fetchCompanies, enqueueSnackbar, companySites]);

  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a, b) => {
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
  }, [companies, orderBy, order]);

  const paginatedCompanies = useMemo(() => {
    return sortedCompanies.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [sortedCompanies, page, rowsPerPage]);

  const renderTypeBadge = useCallback((type) => {
    const typeColors = {
      generator: 'primary',
      shareholder: 'success',
      both: 'secondary',
      other: 'default'
    };

    const color = typeColors[type?.toLowerCase()] || 'default';
    const typeLabel = type || 'N/A';

    return (
      <Box
        component="span"
        sx={{
          px: 1.5,
          py: 0.5,
          borderRadius: 4,
          bgcolor: `${color}.light`,
          color: `${color}.dark`,
          fontSize: '0.75rem',
          fontWeight: 'medium',
          textTransform: 'capitalize',
          whiteSpace: 'nowrap',
          display: 'inline-block',
          minWidth: 80,
          textAlign: 'center'
        }}
      >
        {typeLabel}
      </Box>
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

  const renderActions = useCallback((company) => (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
      {permissions.update && (
        <Tooltip title="Edit">
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleEdit(company)}
            aria-label="edit"
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {permissions.delete && (
        <Tooltip title="Delete">
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDelete(company)}
            aria-label="delete"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {permissions.manageCaptive && company.type?.toLowerCase() === 'generator' && (
        <Tooltip title="Manage Captive">
          <IconButton
            size="small"
            color="secondary"
            onClick={() => handleOpenCaptiveDialog(company)}
            aria-label="manage captive"
          >
            <CaptiveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  ), [permissions, handleEdit, handleOpenCaptiveDialog]);

  const EnhancedTableHead = () => (
    <TableHead>
      <TableRow>
        {[
          { id: 'companyName', label: 'Company Name' },
          { id: 'type', label: 'Type' },
          { id: 'contactPerson', label: 'Contact Person' },
          { id: 'emailId', label: 'Email' },
          { id: 'mobile', label: 'Mobile' }
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
      {paginatedCompanies.map((company) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={company.companyId}>
          <CompanyCard
            company={company}
            onView={() => handleEdit(company)}
            onEdit={permissions.update ? () => handleEdit(company) : null}
            onDelete={permissions.delete ? () => handleDelete(company) : null}
            onRefresh={handleRefresh}
            permissions={permissions}
          />
        </Grid>
      ))}
      <Grid item xs={12} sx={{ mt: 2 }}>
        <TablePagination
          component="div"
          count={companies.length}
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
          {paginatedCompanies.map((company, index) => (
            <TableRow
              key={`${company.companyId || 'company'}-${index}`}
              hover
              sx={{ '&:hover': { cursor: 'pointer' } }}
            >
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {company.companyName}
                </Typography>
              </TableCell>
              <TableCell>{renderTypeBadge(company.type)}</TableCell>
              <TableCell>{company.contactPerson || 'N/A'}</TableCell>
              <TableCell>{company.emailId || 'N/A'}</TableCell>
              <TableCell>{company.mobile || 'N/A'}</TableCell>
              <TableCell align="right">
                {renderActions(company)}
              </TableCell>
            </TableRow>
          ))}

          {paginatedCompanies.length === 0 && !loading && (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                <Typography color="text.secondary">
                  No companies found
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const addNextId = useCallback((companyData) => {
    if (companies.length === 0) return { ...companyData, companyId: 1 };
    const maxId = Math.max(...companies.map(c => c.companyId || 0));
    return { ...companyData, companyId: maxId + 1 };
  }, [companies]);

  const handleCreateSubmit = async (event) => {
    event.preventDefault();

    // Basic validation
    if (!formValues.companyName || !formValues.companyName.trim()) {
      setFormError('Company name is required');
      return;
    }

    if (!formValues.type) {
      setFormError('Company type is required');
      return;
    }

    if (formValues.emailId && !/\S+@\S+\.\S+/.test(formValues.emailId)) {
      setFormError('Please enter a valid email address');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const companyData = {
        companyName: formValues.companyName.trim(),
        type: formValues.type,
        address: (formValues.address || '').trim(),
        contactPerson: (formValues.contactPerson || '').trim(),
        mobile: (formValues.mobile || '').trim(),
        emailId: (formValues.emailId || '').trim()
      };

      if (isEditMode && selectedCompany?.companyId != null) {
        // Update existing company
        await companyApi.update(selectedCompany.companyId, companyData);
        enqueueSnackbar('Company updated successfully', { variant: 'success' });
      } else {
        // Create new company
        const newCompany = addNextId(companyData);
        const created = await companyApi.create(newCompany);
        enqueueSnackbar('Company created successfully', { variant: 'success' });

        // If it's a generator company, open captive dialog
        const createdCompany = created?.data || created;
        if (createdCompany?.type?.toLowerCase() === 'generator') {
          setCaptiveGeneratorCompany(createdCompany);
          setIsCaptiveDialogOpen(true);
        }
      }

      // Refresh companies list
      const result = await companyApi.getAll();
      const list = Array.isArray(result?.data) ? result.data : [];
      setCompanies(list);

      // Reset form and close ̥dialog
      handleCloseCreate();
    } catch (err) {
      const errorMsg = err.response?.data?.message ||
        (isEditMode ? 'Failed to update company' : 'Failed to create company');
      setFormError(errorMsg);
      enqueueSnackbar(errorMsg, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDelete = useCallback(() => {
    if (isSubmitting) return;
    setIsDeleteOpen(false);
    setSelectedCompany(null);
  }, [isSubmitting]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

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
          <BusinessIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: '#1976d2' }}>Companies</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton 
            onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
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
          {permissions.create && (
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
              Add Company
            </Button>
          )}
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
      ) : !loading && companies.length === 0 ? (
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
            {permissions.create ? 'No Companies Found' : 'No Access to Companies'}
          </Typography>

          <Typography variant="body1" color="textSecondary" paragraph>
            {permissions.create
              ? 'Get started by adding your first company.'
              : 'You do not have access to any companies. Please contact your administrator for access.'}
          </Typography>

          {permissions.create && (
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
              Add New Company
            </Button>
          )}
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
          <BusinessIcon sx={{ mr: 1.5, fontSize: 28 }} />
          {isEditMode ? 'Edit Company' : 'Add New Company'}
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
                  label="Company Name"
                  name="companyName"
                  value={formValues.companyName}
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

              <Grid item xs={12} sm={6}>
                <FormControl
                  fullWidth
                  margin="normal"
                  required
                  size="small"
                >
                  <InputLabel id="company-type-label">Type</InputLabel>
                  <Select
                    labelId="company-type-label"
                    name="type"
                    value={formValues.type}
                    onChange={handleFormChange}
                    label="Type"
                    variant="outlined"
                    sx={{ borderRadius: 1 }}
                  >
                    <MenuItem value="">
                      <em>Select Type</em>
                    </MenuItem>
                    <MenuItem value="Generator">Generator</MenuItem>
                    <MenuItem value="Shareholder">Shareholder</MenuItem>
                    <MenuItem value="Both">Both</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Contact Person"
                  name="contactPerson"
                  value={formValues.contactPerson}
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

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  name="emailId"
                  type="email"
                  value={formValues.emailId}
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

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Mobile"
                  name="mobile"
                  value={formValues.mobile}
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

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  name="address"
                  value={formValues.address}
                  onChange={handleFormChange}
                  margin="normal"
                  multiline
                  rows={3}
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
        onClose={() => !isSubmitting && setIsDeleteOpen(false)}
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
          Delete Company
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {isCheckingSites ? (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              p: 6,
              minHeight: '250px'
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <CircularProgress size={50} sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Checking associated sites...
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ p: 3 }}>
              {/* Company Name Section */}
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
                  {selectedCompany?.companyName}
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
                    The company and all associated data will be permanently deleted from the system.
                  </Typography>
                </Box>
              </Box>

              {/* Sites Information Section */}
              {(companySites?.productionSites?.count > 0 || companySites?.consumptionSites?.count > 0) ? (
                <Box sx={{
                  bgcolor: '#fff5e1',
                  border: '2px solid #ffb74d',
                  borderRadius: 2,
                  p: 2.5,
                  mb: 2
                }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ 
                      bgcolor: '#ffa726',
                      borderRadius: '50%',
                      p: 1,
                      mr: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 40,
                      minHeight: 40
                    }}>
                      <Typography sx={{ fontSize: '1.2rem' }}>⚡</Typography>
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#e65100' }}>
                      {companySites?.productionSites?.count > 0 || companySites?.consumptionSites?.count > 0 
                        ? `${(companySites?.productionSites?.count || 0) + (companySites?.consumptionSites?.count || 0)} Associated Site${((companySites?.productionSites?.count || 0) + (companySites?.consumptionSites?.count || 0)) !== 1 ? 's' : ''} Found`
                        : 'Associated Sites Found'
                      }
                    </Typography>
                  </Box>

                  {/* Production Sites */}
                  {companySites?.productionSites?.count > 0 && (
                    <Box sx={{ mb: companySites?.consumptionSites?.count > 0 ? 2 : 0 }}>
                      <Box sx={{
                        bgcolor: '#fff9c4',
                        borderLeft: '4px solid #fbc02d',
                        p: 1.5,
                        borderRadius: '0 4px 4px 0'
                      }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: '#f57f17' }}>
                          🏭 Production Sites ({companySites?.productionSites?.count || 0})
                        </Typography>
                        <Box sx={{ pl: 2 }}>
                          {Array.isArray(companySites?.productionSites?.sites) && companySites.productionSites.sites.length > 0 ? (
                            companySites.productionSites.sites.map((site, idx) => (
                              <Box key={`prod-site-${idx}`} sx={{ mb: 0.75, display: 'flex', gap: 1 }}>
                                <Typography sx={{ color: '#fbc02d', fontWeight: 600, minWidth: 16, mt: 0.25 }}>▪</Typography>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#333' }}>
                                    {site?.name || 'Unnamed Production Site'}
                                  </Typography>
                                  {site?.location && (
                                    <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                                      📍 {site.location}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            ))
                          ) : (
                            <Typography variant="caption" sx={{ color: '#666' }}>
                              No production sites available
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  )}

                  {/* Consumption Sites */}
                  {companySites?.consumptionSites?.count > 0 && (
                    <Box>
                      <Box sx={{
                        bgcolor: '#e3f2fd',
                        borderLeft: '4px solid #1976d2',
                        p: 1.5,
                        borderRadius: '0 4px 4px 0'
                      }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: '#0d47a1' }}>
                          💧 Consumption Sites ({companySites?.consumptionSites?.count || 0})
                        </Typography>
                        <Box sx={{ pl: 2 }}>
                          {Array.isArray(companySites?.consumptionSites?.sites) && companySites.consumptionSites.sites.length > 0 ? (
                            companySites.consumptionSites.sites.map((site, idx) => (
                              <Box key={`cons-site-${idx}`} sx={{ mb: 0.75, display: 'flex', gap: 1 }}>
                                <Typography sx={{ color: '#1976d2', fontWeight: 600, minWidth: 16, mt: 0.25 }}>▪</Typography>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#333' }}>
                                    {site?.name || 'Unnamed Consumption Site'}
                                  </Typography>
                                  {site?.location && (
                                    <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                                      📍 {site.location}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            ))
                          ) : (
                            <Typography variant="caption" sx={{ color: '#666' }}>
                              No consumption sites available
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  )}

                  {/* Warning */}
                  <Box sx={{
                    bgcolor: '#ffebee',
                    p: 1.5,
                    borderRadius: 1,
                    mt: 2,
                    textAlign: 'center',
                    border: '1px solid #ffb3ba'
                  }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#c62828', display: 'block' }}>
                      ⚠️ WARNING: Deleting this company will permanently remove ALL associated sites and their data
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box sx={{
                  bgcolor: '#e8f5e9',
                  border: '1px solid #81c784',
                  borderRadius: 1.5,
                  p: 2,
                  mb: 2,
                  textAlign: 'center'
                }}>
                  <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 500 }}>
                    ✓ No associated sites. Safe to delete.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ 
          p: 2.5, 
          borderTop: '1px solid',
          borderColor: 'divider',
          gap: 1.5,
          bgcolor: '#fafafa'
        }}>
          <Button
            onClick={() => setIsDeleteOpen(false)}
            disabled={isSubmitting || isCheckingSites}
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
            disabled={isSubmitting || isCheckingSites || (companySites?.productionSites?.count > 0 || companySites?.consumptionSites?.count > 0)}
            startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
            title={companySites?.productionSites?.count > 0 || companySites?.consumptionSites?.count > 0 ? 'Delete all associated sites first' : ''}
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
            {isSubmitting ? 'Deleting...' : 'Delete Company'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Captive Dialog */}
      {captiveGeneratorCompany && (
        <GeneratorCaptiveDialog
          open={isCaptiveDialogOpen}
          onClose={() => {
            setIsCaptiveDialogOpen(false);
            setCaptiveGeneratorCompany(null);
          }}
          generatorCompany={captiveGeneratorCompany}
          shareholderCompanies={companies.filter(c =>
            c.type && (c.type.toLowerCase() === 'shareholder' || c.type.toLowerCase() === 'both')
          )}
        />
      )}
    </Box>
  );
};

export default CompanyPage;
