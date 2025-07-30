import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import {
  Box,
  Grid, 
  Typography,
  Alert,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Paper
} from '@mui/material';
import { 
  Add as AddIcon, 
  Refresh as RefreshIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import consumptionSiteApi from '../../services/consumptionSiteapi';
import ConsumptionSiteCard from './ConsumptionSiteCard';
import ConsumptionSiteDialog from './ConsumptionSiteDialog';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';

const Consumption = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { 
    user, 
    isAdmin,
    getAccessibleSites,
    hasSiteAccess
  } = useAuth() || {};
  
  const [filteredSites, setFilteredSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'
  
  // Permissions
  const permissions = useMemo(() => ({
    create: hasPermission(user, 'consumption', 'CREATE'),
    read: hasPermission(user, 'consumption', 'READ'),
    update: hasPermission(user, 'consumption', 'UPDATE'),
    delete: hasPermission(user, 'consumption', 'DELETE')
  }), [user]);

  // Get accessible sites for the current user
  const { consumptionSites: accessibleSites } = useMemo(() => {
    return getAccessibleSites ? getAccessibleSites() : { consumptionSites: [] };
  }, [getAccessibleSites]);
  
  // Check if user has access to any consumption sites or can create new ones
  const hasAccessToSites = useMemo(() => {
    // Log current access state for debugging
    console.log('Checking site access:', {
      isAdmin: isAdmin?.(),
      userRole: user?.role,
      hasReadPermission: permissions?.read,
      hasCreatePermission: permissions?.create,
      accessibleSitesCount: accessibleSites?.length || 0,
      permissions: user?.permissions
    });

    // Admin always has full access
    if (isAdmin?.()) {
      console.log('User has admin access');
      return true;
    }

    // Check for READ or CREATE permission
    if (permissions?.read || permissions?.create) {
      console.log('User has READ or CREATE permission');
      return true;
    }

    // Check for explicitly assigned sites
    const hasAssignedSites = accessibleSites && accessibleSites.length > 0;
    if (hasAssignedSites) {
      console.log('User has assigned sites:', accessibleSites);
      return true;
    }
    
    console.log('Access check result:', {
      hasAssignedSites,
      hasReadPermission: permissions?.read,
      hasCreatePermission: permissions?.create,
      isAdmin: isAdmin?.(),
      accessibleSitesCount: accessibleSites?.length,
      user: {
        role: user?.role,
        hasPermissions: Boolean(user?.permissions)
      }
    });

    return false;
  }, [isAdmin, accessibleSites, permissions?.read, user]);

  // Fetch sites
  const fetchSites = useCallback(async () => {
    try {
      setLoading(true);
      const response = await consumptionSiteApi.fetchAll();
      const data = response.data || [];
      // Filter sites based on user access
      if (isAdmin || permissions?.read) {
        // Admin or users with READ permission can see all sites
        console.log('User has full access to sites');
        setFilteredSites(data);
      } else if (accessibleSites?.length > 0) {
        // Filter sites that the user has access to
        const filtered = data.filter(site => 
          hasSiteAccess?.(site.companyId, site.consumptionSiteId)
        );
        
        console.log('Filtered accessible sites');
        setFilteredSites(filtered);
      }
      
    } catch (error) {
      console.error('Error fetching sites:', error);
      setError('Failed to load sites. Please try again.');
      enqueueSnackbar('Failed to load sites', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, getAccessibleSites, isAdmin, permissions?.read, hasSiteAccess]);

  // Initial data fetch
  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  // Handle add button click
  const handleAddClick = useCallback(() => {
    if (!permissions?.create) {
      enqueueSnackbar('You do not have permission to create sites', { variant: 'error' });
      return;
    }
    setSelectedSite(null);
    setDialogOpen(true);
  }, [enqueueSnackbar, permissions?.create]);

  // Handle dialog close
  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setSelectedSite(null);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (formData) => {
    console.log('Form submitted with data:', formData);
    setIsDialogLoading(true);
    
    try {
      const currentUser = user || JSON.parse(localStorage.getItem('user') || '{}');
      const companyId = currentUser?.companyId || '1';
      
      if (selectedSite?.consumptionSiteId) {
        // Update existing site
        await consumptionSiteApi.update(
          selectedSite.companyId,
          selectedSite.consumptionSiteId,
          formData
        );
        enqueueSnackbar('Site updated successfully', { variant: 'success' });
      } else {
        // Create new site
        const siteData = {
          ...formData,
          companyId,
          status: 'Active',
          user: {
            id: currentUser.id || currentUser.userId,
            email: currentUser.email,
            username: currentUser.username
          }
        };
        
        await consumptionSiteApi.create(siteData, { user: currentUser });
        enqueueSnackbar('Site created successfully', { variant: 'success' });
      }
      
      // Refresh sites and close dialog
      await fetchSites();
      setDialogOpen(false);
      setSelectedSite(null);
      
    } catch (error) {
      console.error('Error saving site:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save site';
      enqueueSnackbar(`Error: ${errorMessage}`, { variant: 'error' });
    } finally {
      setIsDialogLoading(false);
    }
  }, [enqueueSnackbar, selectedSite, user, fetchSites]);

  // Handle site refresh
  const handleRefreshSite = useCallback(async (site) => {
    try {
      await consumptionSiteApi.fetchOne(site.companyId, site.consumptionSiteId);
      await fetchSites();
      enqueueSnackbar('Site data refreshed', { variant: 'success' });
    } catch (error) {
      console.error('Error refreshing site:', error);
      enqueueSnackbar('Failed to refresh site data', { variant: 'error' });
    }
  }, [enqueueSnackbar, fetchSites]);

  // Handle edit click
  const handleEditClick = useCallback((site) => {
    if (!permissions?.update) {
      enqueueSnackbar('You do not have permission to edit sites', { variant: 'error' });
      return;
    }
    setSelectedSite(site);
    setDialogOpen(true);
  }, [enqueueSnackbar, permissions?.update]);

  // Handle view click
  const handleViewClick = useCallback((site) => {
    // Navigate to the site details page
    if (site?.companyId && site?.consumptionSiteId) {
      navigate(`/consumption/${site.companyId}/${site.consumptionSiteId}`);
    } else {
      enqueueSnackbar('Site information is incomplete for navigation', { variant: 'error' });
    }
  }, [navigate, enqueueSnackbar]);

  // Handle delete click
  const handleDeleteClick = useCallback(async (site) => {
    if (!permissions?.delete) {
      enqueueSnackbar('You do not have permission to delete sites', { variant: 'error' });
      return;
    }

    const siteName = site?.name || 'this site';
    if (!window.confirm(`Are you sure you want to delete "${siteName}"?`)) {
      return;
    }

    try {
      setLoading(true);
      // Try to get the ID from different possible locations in the site object
      const companyId = site?.companyId || '1';
      const siteId = site?.consumptionSiteId || 
                   site?.id?.split('_')?.[1] || 
                   site?.id || '';
      
      console.log('Deleting site with:', { companyId, siteId, site });
      
      if (!siteId) {
        throw new Error('Site ID is required for deletion');
      }

      await consumptionSiteApi.delete(companyId, siteId);
      enqueueSnackbar('Site deleted successfully', { variant: 'success' });
      await fetchSites();
    } catch (error) {
      console.error('Error deleting site:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete site';
      enqueueSnackbar(`Error: ${errorMessage}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, fetchSites, permissions?.delete]);

  // Render loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  // Render no access message
  if (!hasAccessToSites) {
    return (
      <Box p={3}>
        <Alert severity="info">
          You don't have permission to view any consumption sites. Please contact your administrator.
        </Alert>
      </Box>
    );
  }

  // Render no sites message
  if (!loading && filteredSites.length === 0) {
    const canCreate = permissions?.create || isAdmin?.();
    
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="info"
          sx={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            '& .MuiAlert-message': {
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2
            }
          }}
        >
          <Typography>
            {user?.isAdmin || canCreate 
              ? 'No consumption sites found. Would you like to add one?' 
              : 'No accessible consumption sites found. Please contact your administrator.'}
          </Typography>
          
          {canCreate && (
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleAddClick}
              size="medium"
              sx={{ 
                ml: 2,
                fontWeight: 500,
                textTransform: 'none',
                whiteSpace: 'nowrap'
              }}
              startIcon={<AddIcon />}
            >
              Add New Site
            </Button>
          )}
        </Alert>
        
        {/* Consumption Site Dialog - Moved here to ensure it's always in the DOM */}
        <ConsumptionSiteDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          onSubmit={handleSubmit}
          initialData={selectedSite || null}
          loading={isDialogLoading}
          permissions={permissions}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Consumption Site Dialog */}
      <ConsumptionSiteDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleSubmit}
        initialData={selectedSite || null}
        loading={isDialogLoading}
        permissions={permissions}
      />

      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        mb: 3,
        borderBottom: '2px solid #1976d2',
        pb: 2
      }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
          Consumption Sites
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => setViewMode(prev => prev === 'card' ? 'table' : 'card')}>
            {viewMode === 'card' ? <ViewListIcon /> : <ViewModuleIcon />}
          </IconButton>
          {permissions?.create && hasAccessToSites && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddClick}
              size="medium"
              sx={{ 
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 1.5
              }}
            >
              Add Site
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchSites}
            disabled={loading}
            size="medium"
            sx={{ 
              fontWeight: 500,
              textTransform: 'none',
              borderRadius: 1.5
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Error message */}
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

      {/* Table View */}
      {viewMode === 'table' ? (
        <TableContainer component={Paper} sx={{ mt: 3, maxHeight: '70vh', overflow: 'auto' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Annual Consumption (MWh)</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSites.map((site) => {
                const statusColor = site.status?.toLowerCase() === 'active' ? 'success' : 
                                  site.status?.toLowerCase() === 'inactive' ? 'error' : 'warning';
                
                return (
                  <TableRow 
                    key={`${site.companyId}-${site.consumptionSiteId}`}
                    hover
                    sx={{ '&:hover': { cursor: 'pointer' } }}
                    onClick={() => handleViewClick(site)}
                  >
                    <TableCell>{site.name}</TableCell>
                    <TableCell>{site.location}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{site.type}</TableCell>
                    <TableCell align="right">{Number(site.annualConsumption || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Box
                        component="span"
                        sx={{
                          px: 2,
                          py: 0.5,
                          borderRadius: 1,
                          backgroundColor: `${statusColor}.light`,
                          color: `${statusColor}.dark`,
                          fontWeight: 'medium',
                          display: 'inline-block',
                          minWidth: 80,
                          textAlign: 'center',
                          textTransform: 'capitalize'
                        }}
                      >
                        {site.status}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        {permissions?.update && (
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(site);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        )}
                        {permissions?.delete && (
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(site);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        /* Card View */
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {filteredSites.map((site) => (
            <Grid 
              item 
              key={`${site.companyId}-${site.consumptionSiteId}`} 
              xs={12} 
              sm={6} 
              md={4}
              lg={3}
              sx={{
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <ConsumptionSiteCard
                site={site}
                onEdit={permissions?.update ? () => handleEditClick(site) : null}
                onDelete={permissions?.delete ? () => handleDeleteClick(site) : null}
                permissions={permissions}
                onRefresh={() => handleRefreshSite(site)}
                lastUpdated={site.updatedAt || site.createdAt}
                onClick={() => handleViewClick(site)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default Consumption;
