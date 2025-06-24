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
  Paper
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import consumptionSiteApi from '../../services/consumptionSiteApi';
import ConsumptionSiteCard from './ConsumptionSiteCard';
import ConsumptionSiteDialog from './ConsumptionSiteDialog';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const Consumption = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { 
    user, 
    isAdmin,
    getAccessibleSites,
    hasSiteAccess,
    refreshAccessibleSites
  } = useAuth() || {};
  
  const [sites, setSites] = useState([]);
  const [filteredSites, setFilteredSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  
  // Get accessible sites for the current user
  const { consumptionSites: accessibleSites } = useMemo(() => {
    return getAccessibleSites ? getAccessibleSites() : { consumptionSites: [] };
  }, [getAccessibleSites]);
  
  // Check if user has access to any consumption sites
  const hasAccessToSites = useMemo(() => {
    return isAdmin?.() || (accessibleSites && accessibleSites.length > 0);
  }, [isAdmin, accessibleSites]);
  
  // Permissions
  const permissions = useMemo(() => ({
    create: hasPermission(user, 'consumption', 'CREATE'),
    read: hasPermission(user, 'consumption', 'READ'),
    update: hasPermission(user, 'consumption', 'UPDATE'),
    delete: hasPermission(user, 'consumption', 'DELETE')
  }), [user]);

  // Fetch sites
  const fetchSites = useCallback(async () => {
    try {
      setLoading(true);
      const response = await consumptionSiteApi.fetchAll();
      const data = response.data || [];
      setSites(data);
      
      // Filter sites based on user access
      if (isAdmin?.()) {
        setFilteredSites(data);
      } else {
        const accessibleSiteIds = new Set(accessibleSites?.map(s => s.id) || []);
        const filtered = data.filter(site => 
          accessibleSiteIds.has(`${site.companyId}_${site.consumptionSiteId}`)
        );
        setFilteredSites(filtered);
      }
      
    } catch (error) {
      console.error('Error fetching sites:', error);
      setError('Failed to load sites. Please try again.');
      enqueueSnackbar('Failed to load sites', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [accessibleSites, enqueueSnackbar, isAdmin]);

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
    // Navigate to the site details page or show details in a dialog
    // For now, we'll just log it since we don't have a details page
    console.log('Viewing site:', site);
  }, []);

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
    return (
      <Box p={3}>
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            No consumption sites found
          </Typography>
          {permissions.create && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddClick}
              sx={{ mt: 2 }}
            >
              Add Consumption Site
            </Button>
          )}
        </Paper>
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Consumption Sites
        </Typography>
        <Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddClick}
            disabled={!permissions.create}
            sx={{ mr: 2 }}
          >
            Add Site
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchSites}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Sites grid */}
      <Grid container spacing={3}>
        {filteredSites.map((site) => (
          <Grid item key={`${site.companyId}-${site.consumptionSiteId}`} xs={12} sm={6} md={4}>
            <ConsumptionSiteCard
              site={site}
              onView={() => handleViewClick(site)}
              onEdit={() => handleEditClick(site)}
              onDelete={() => handleDeleteClick(site)}
              permissions={permissions}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Consumption;
