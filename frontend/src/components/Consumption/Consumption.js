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
  const [retryCount, setRetryCount] = useState(0);
  
  // Get accessible sites for the current user
  const { consumptionSites: accessibleSites } = useMemo(() => {
    return getAccessibleSites ? getAccessibleSites() : { consumptionSites: [] };
  }, [getAccessibleSites]);
  
  // Check if user has access to any consumption sites
  const hasAccessToSites = useMemo(() => {
    return isAdmin?.() || (accessibleSites && accessibleSites.length > 0);
  }, [isAdmin, accessibleSites]);
  
  // Filter sites based on user's accessible sites
  const filterSitesByAccess = useCallback((sitesData) => {
    try {
      if (!user) {
        console.log('No user found, returning empty sites');
        return [];
      }
      
      // Admin can see all sites
      if (isAdmin?.()) {
        console.log('Admin user, returning all sites');
        return sitesData;
      }
      
      // If no accessible sites, return empty array
      if (!accessibleSites?.length) {
        console.log('No accessible consumption sites found for user');
        return [];
      }
      
      console.log('Filtering consumption sites. Accessible site IDs:', accessibleSites);
      
      const filtered = sitesData.filter(site => {
        const siteId = `${site.companyId}_${site.consumptionSiteId}`;
        const hasAccess = hasSiteAccess(siteId, 'consumption');
        if (!hasAccess) {
          console.log(`User does not have access to site ${siteId}`);
        }
        return hasAccess;
      });
      
      console.log(`Filtered ${sitesData.length} consumption sites to ${filtered.length} accessible sites`);
      return filtered;
      
    } catch (error) {
      console.error('Error filtering consumption sites by access:', error);
      return [];
    }
  }, [user, isAdmin, accessibleSites, hasSiteAccess]);

  const permissions = useMemo(() => ({
    create: hasPermission(user, 'consumption', 'CREATE'),
    read: hasPermission(user, 'consumption', 'READ'),
    update: hasPermission(user, 'consumption', 'UPDATE'),
    delete: hasPermission(user, 'consumption', 'DELETE')
  }), [user]);

  const adminUser = useMemo(() => isAdmin(user), [user]);
  const totalSites = useMemo(() => sites.length, [sites]);

  // Format consumption for display
  const formatConsumption = useCallback((value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  }, []);

  // Process site data
  const processSiteData = useCallback((site) => {
    // Handle annual consumption - ensure it's a valid number
    let annualConsumption = 0;
    const rawValue = site.annualConsumption ?? site.annualConsumption_L;
    
    if (rawValue !== undefined && rawValue !== null) {
      if (typeof rawValue === 'number') {
        annualConsumption = Math.round(rawValue);
      } else if (typeof rawValue === 'string') {
        const cleanValue = rawValue.trim() === '' ? '0' : rawValue.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleanValue);
        annualConsumption = isNaN(num) ? 0 : Math.round(num);
      } else if (typeof rawValue === 'object' && rawValue.N) {
        const num = parseFloat(rawValue.N);
        annualConsumption = isNaN(num) ? 0 : Math.round(num);
      }
    }
    
    return {
      ...site,
      companyId: String(site.companyId || '1'),
      consumptionSiteId: String(site.consumptionSiteId || ''),
      name: site.name || 'Unnamed Site',
      type: (site.type || 'industrial').toLowerCase().trim(),
      location: site.location || 'Unknown Location',
      status: (site.status || 'inactive').toLowerCase().trim(),
      version: Number(site.version || 1),
      timetolive: Number(site.timetolive || 0),
      annualConsumption,
      formattedConsumption: formatConsumption(annualConsumption),
      createdAt: site.createdAt || site.createdat || new Date().toISOString(),
      updatedAt: site.updatedAt || site.updatedat || new Date().toISOString()
    };
  }, [formatConsumption]);

  // Fetch sites data
  const fetchSites = useCallback(async (retry = false) => {
    try {
      if (!retry) {
        setError(null);
        setLoading(true);
        setRetryCount(0);
      }

      console.log('[Consumption] Fetching sites, attempt:', retryCount + 1);
      const response = await consumptionSiteApi.fetchAll();
      
      // Log the raw response for debugging
      console.log('[Consumption] Raw API response:', response);
      
      // Handle case where response is an array directly
      let sitesData = Array.isArray(response) ? response : response?.data || [];
      
      // If data is nested under 'Items', extract it
      if (sitesData?.Items && Array.isArray(sitesData.Items)) {
        sitesData = sitesData.Items;
      }
      
      // Transform data to ensure consistent format
      const formattedData = sitesData.map(processSiteData);
      
      console.log('[Consumption] Formatted data:', formattedData);
      
      // Filter sites based on user's accessible sites
      const filtered = filterSitesByAccess(formattedData);
      console.log('[Consumption] Accessible sites for user:', filtered);
      
      setSites(formattedData);
      setFilteredSites(filtered);
      setLoading(false);
      
      if (formattedData.length === 0) {
        enqueueSnackbar('No consumption sites found', { variant: 'info' });
      } else {
        enqueueSnackbar(`Successfully loaded ${formattedData.length} sites`, { 
          variant: 'success',
          autoHideDuration: 2000
        });
      }

    } catch (err) {
      if (retryCount < MAX_RETRIES) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchSites(true), RETRY_DELAY);
        return;
      }

      setError('Failed to load consumption sites. Please try again.');
      setLoading(false);
      enqueueSnackbar('Failed to load sites', { 
        variant: 'error',
        action: (key) => (
          <Button color="inherit" size="small" onClick={() => {
            fetchSites();
            enqueueSnackbar.close(key);
          }}>
            Retry
          </Button>
        )
      });
      
      console.error('❌ [Consumption] Error fetching sites:', err);
    }
  }, [enqueueSnackbar, filterSitesByAccess, retryCount]);
  
  // Initial fetch and refresh when accessible sites change
  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const handleSiteClick = useCallback((site) => {
    if (!site?.companyId || !site?.consumptionSiteId) {
      enqueueSnackbar('Invalid site data', { variant: 'error' });
      return;
    }
    navigate(`/consumption/${site.companyId}/${site.consumptionSiteId}`);
  }, [navigate, enqueueSnackbar]);

  const handleAddClick = useCallback(() => {
    if (!permissions.create) {
      enqueueSnackbar('You do not have permission to create sites', { 
        variant: 'error' 
      });
      return;
    }
    setSelectedSite(null);
    setDialogOpen(true);
  }, [permissions.create, enqueueSnackbar]);

  const handleEditClick = useCallback((site) => {
    if (!permissions.update) {
      enqueueSnackbar('You do not have permission to edit sites', { 
        variant: 'error' 
      });
      return;
    }
    setSelectedSite(site);
    setDialogOpen(true);
  }, [permissions.update, enqueueSnackbar]);
  const handleDeleteClick = useCallback(async (site) => {
    if (!permissions.delete) {
      enqueueSnackbar('You do not have permission to delete sites', { 
        variant: 'error' 
      });
      return;
    }

    if (!site?.companyId || !site?.consumptionSiteId) {
      enqueueSnackbar('Invalid site data', { variant: 'error' });
      return;
    }
    
    try {
      const confirmed = await new Promise(resolve => {
        // Show a more detailed confirmation dialog
        const message = `Are you sure you want to delete "${site.name}"?\n\n` +
          'This action will:\n' +
          '- Permanently remove the consumption site\n' +
          '- Delete all associated consumption data\n' +
          '- Cannot be undone';
        resolve(window.confirm(message));
      });

      if (!confirmed) {
        enqueueSnackbar('Delete operation cancelled', { variant: 'info' });
        return;
      }

      setLoading(true);
      setError(null);

      await consumptionSiteApi.delete(site.companyId, site.consumptionSiteId);
      
      enqueueSnackbar('Site deleted successfully', { 
        variant: 'success',
        autoHideDuration: 3000
      });
      
      // Refresh the sites list
      await fetchSites();
    } catch (error) {
      console.error('[Consumption] Delete error:', error);
      setError('Failed to delete site. Please try again.');
      enqueueSnackbar(error.message || 'Failed to delete site', { 
        variant: 'error',
        autoHideDuration: 5000,
        action: (key) => (
          <Button color="inherit" size="small" onClick={() => {
            enqueueSnackbar.close(key);
          }}>
            Dismiss
          </Button>
        )
      });
    } finally {
      setLoading(false);
    }
  }, [permissions.delete, enqueueSnackbar, fetchSites]);

  const handleSubmit = async (formData) => {
    try {
      setLoading(true);
      setError(null);
      console.log('[Consumption] Starting form submission with data:', formData);
      
      // Check if we have a valid user
      const currentUser = user;
      if (!currentUser) {
        const errorMsg = 'Please log in to create or edit consumption sites.';
        console.error('[Consumption] No user found in context');
        throw new Error(errorMsg);
      }

      // Get company ID - prefer from selected site, then from user context
      const companyId = selectedSite?.companyId || 
                       (currentUser?.companyId ? String(currentUser.companyId) : null);
      
      if (!companyId) {
        const errorMsg = 'Company ID is required to manage consumption sites. Please ensure your account is properly associated with a company.';
        console.error('[Consumption] No company ID found in user context');
        throw new Error(errorMsg);
      }

      // Transform form data as needed
      const submitData = {
        ...formData,
        annualConsumption: formData.annualConsumption ? Number(formData.annualConsumption) : 0,
        timetolive: formData.timetolive ? Number(formData.timetolive) : 0,
        status: formData.status || 'active',
        version: selectedSite ? (selectedSite.version || 1) : 1,
      };
      
      console.log('Submitting consumption site with company ID:', companyId, 'data:', submitData);
      
      let result;
      let isNewSite = false;
      
      if (selectedSite?.consumptionSiteId) {
        // Update existing site
        console.log('Updating existing site with ID:', selectedSite.consumptionSiteId);
        
        result = await consumptionSiteApi.update(
          companyId,
          selectedSite.consumptionSiteId,
          submitData
        );
        
        enqueueSnackbar('Consumption site updated successfully', { 
          variant: 'success',
          autoHideDuration: 3000
        });
      } else {
        // Create new site
        isNewSite = true;
        console.log('Creating new site for company:', companyId);
        
        // Add companyId to the site data
        const siteData = { ...submitData, companyId };
        
        console.log('[Consumption] Creating consumption site with data:', siteData);
        
        try {
          // Create the site
          const response = await consumptionSiteApi.create(siteData, { user: currentUser });
          
          // The API returns { success, data, message, code }
          if (!response || !response.success || !response.data) {
            console.error('[Consumption] Invalid response from API:', response);
            throw new Error(response?.message || 'Failed to create site: Invalid response from server');
          }
          
          result = response.data;
          
          if (!result.consumptionSiteId) {
            console.error('[Consumption] Missing consumptionSiteId in response:', response);
            throw new Error('Failed to create site: Missing site ID in response');
          }
          
          console.log('[Consumption] Site created successfully:', {
            companyId: result.companyId,
            consumptionSiteId: result.consumptionSiteId,
            response: response
          });
          
          enqueueSnackbar('Consumption site created successfully', { 
            variant: 'success',
            autoHideDuration: 3000
          });
          
        } catch (error) {
          console.error('[Consumption] Error creating site:', error);
          throw new Error(`Failed to create site: ${error.message || 'Unknown error'}`);
        }
      }
      
      // For new sites, update user's accessible sites
      if (isNewSite && result?.companyId && result?.consumptionSiteId) {
        try {
          console.log('[Consumption] Updating user site access for new site:', {
            companyId: result.companyId,
            consumptionSiteId: result.consumptionSiteId,
            currentUser: {
              id: currentUser.id || currentUser.userId,
              email: currentUser.email,
              username: currentUser.username
            }
          });
          
          // Prepare site data for access update
          const siteData = {
            companyId: result.companyId,
            consumptionSiteId: result.consumptionSiteId,
            name: result.name || formData.name || 'New Consumption Site',
            type: 'consumption',
            status: result.status || formData.status || 'active',
            annualConsumption: result.annualConsumption,
            location: result.location || formData.location,
            ...result,
          };

          console.log('[Consumption] Site created/updated, refreshing accessible sites');

          // Refresh accessible sites from the server
          if (refreshAccessibleSites) {
            try {
              await refreshAccessibleSites();
              console.log('[Consumption] Successfully refreshed accessible sites');
            } catch (refreshError) {
              console.warn('[Consumption] Warning: Could not refresh accessible sites:', refreshError);
            }
          }

          // Refresh the site list to ensure UI is up to date
          try {
            await fetchSites();
            console.log('[Consumption] Successfully refreshed site data');
          } catch (refreshError) {
            console.warn('[Consumption] Warning: Could not refresh site data:', refreshError);
          }

          enqueueSnackbar('Site access updated successfully', { variant: 'success', autoHideDuration: 3000 });
        } catch (accessError) {
          console.error('[Consumption] Error updating user site access:', accessError);
          // Don't fail the whole operation if access update fails
          enqueueSnackbar(
            'Site created, but there was an issue updating your access. Please refresh the page to see the new site.',
            { variant: 'warning', autoHideDuration: 6000, persist: true }
          );
        }
      }

      // Common cleanup for both create and update
      setDialogOpen(false);
      setSelectedSite(null);

      // Refresh the sites list to show the updated data
      await fetchSites();

      return result;
    } catch (error) {
      console.error('[Consumption] Submit error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save site';

      // Handle specific error cases
      if (error.code === 'NO_COMPANY_ASSOCIATION') {
        enqueueSnackbar(error.message, {
          variant: 'warning',
          autoHideDuration: 8000,
          action: (key) => (
            <Button color="inherit" size="small" onClick={() => enqueueSnackbar.close(key)}>
              Contact Admin
            </Button>
          ),
        });
      } else {
        enqueueSnackbar(errorMessage, { variant: 'error', autoHideDuration: 5000 });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && sites.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  // Render no access message if user doesn't have access to any sites
  if (!hasAccessToSites) {
    return (
      <Box p={3}>
        <Alert severity="info">
          You don't have access to any consumption sites. Please contact your administrator to request access.
        </Alert>
      </Box>
    );
  }

  // Render no sites message
  if (!loading && sites.length === 0) {
    return (
      <Box p={3}>
        <Alert severity="info">
          No consumption sites found.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
            Consumption Sites
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {totalSites} {totalSites === 1 ? 'site' : 'sites'} • Total Consumption: {formatConsumption(sites.reduce((sum, site) => sum + (site.annualConsumption || 0), 0))} MWh/year
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => fetchSites()} disabled={loading}>
            Refresh
          </Button>
          {permissions.create && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddClick} disabled={loading}>
              Add Site
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
        </Box>
      ) : !hasAccessToSites ? (
        <Box p={3}>
          <Alert severity="info">
            You don't have access to any consumption sites. Please contact your administrator to request access.
          </Alert>
        </Box>
      ) : filteredSites.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 2, bgcolor: 'background.paper' }}>
          <Box sx={{ maxWidth: 400, mx: 'auto' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No consumption sites found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Get started by adding your first consumption site to track energy usage.
            </Typography>
            {permissions.create && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddClick} sx={{ mt: 2 }}>
                Add Site
              </Button>
            )}
          </Box>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredSites.map((site) => (
            <Grid item key={`${site.companyId}_${site.consumptionSiteId}`} xs={12} sm={6} lg={4} xl={3}>
              <ConsumptionSiteCard
                site={site}
                onView={() => handleSiteClick(site)}
                onEdit={permissions.update ? () => handleEditClick(site) : null}
                onDelete={permissions.delete ? () => handleDeleteClick(site) : null}
                onRefresh={fetchSites}
                permissions={permissions}
                lastUpdated={site.updatedAt}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {dialogOpen && (
        <ConsumptionSiteDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setSelectedSite(null);
          }}
          onSubmit={handleSubmit}
          initialData={selectedSite}
          loading={loading}
          permissions={permissions}
          totalSites={totalSites}
          existingSites={sites}
          user={user}
        />
      )}
    </Box>
  );
};

export default Consumption;
