import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import {
  Box, Grid, Typography, Alert, Button, CircularProgress, Paper, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Switch, FormControlLabel
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon, Edit as EditIcon, Delete as DeleteIcon, ViewModule as ViewModuleIcon, ViewList as ViewListIcon } from '@mui/icons-material';
import productionSiteApi from '../../services/productionSiteApi';
import ProductionSiteCard from './ProductionSiteCard';
import ProductionSiteDialog from './ProductionSiteDialog';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';
import useSiteAccess from '../../hooks/useSiteAccess';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const Production = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { 
    user, 
    isAdmin, 
    getAccessibleSites, 
    hasSiteAccess,
    refreshAccessibleSites,
    updateUser
  } = useAuth();
  
  const [sites, setSites] = useState([]);
  const [filteredSites, setFilteredSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingAccess, setUpdatingAccess] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'
  const [retryCount, setRetryCount] = useState(0);

  const { updateSiteAccess, updatingAccess: accessUpdating } = useSiteAccess();
  
  // Get accessible sites for the current user
  const { productionSites: accessibleSites } = useMemo(() => {
    return getAccessibleSites();
  }, [getAccessibleSites]);
  
  // Enhance user object with hasSiteAccess function
  const enhancedUser = useMemo(() => {
    if (!user) return null;
    return {
      ...user,
      hasSiteAccess: (siteId, siteType) => {
        if (isAdmin()) return true;
        return hasSiteAccess(siteId, siteType);
      }
    };
  }, [user, isAdmin, hasSiteAccess]);

  // Check permissions
  const permissions = useMemo(() => ({
    create: hasPermission(user, 'production', 'CREATE'),
    read: hasPermission(user, 'production', 'READ'),
    update: hasPermission(user, 'production', 'UPDATE'),
    delete: hasPermission(user, 'production', 'DELETE')
  }), [user]);

  // Check if user has access to any production sites or can create new ones
  const hasAccessToSites = useMemo(() => {
    // Log current access state for debugging
    console.log('Checking production site access:', {
      isAdmin: isAdmin(),
      userRole: user?.role,
      hasReadPermission: permissions?.read,
      hasCreatePermission: permissions?.create,
      accessibleSitesCount: accessibleSites?.length || 0,
      permissions: user?.permissions
    });

    // Admin always has full access
    if (isAdmin()) {
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
      isAdmin: isAdmin(),
      accessibleSitesCount: accessibleSites?.length,
      user: {
        role: user?.role,
        hasPermissions: Boolean(user?.permissions)
      }
    });

    return false;
  }, [isAdmin, user, permissions, accessibleSites]);

  // Filter sites based on user's accessible sites
  const filterSitesByAccess = useCallback((sitesData) => {
    try {
      if (!user) {
        console.log('No user found, returning empty sites');
        return [];
      }
      
      // Admin can see all sites
      if (isAdmin()) {
        console.log('Admin user, returning all sites');
        return sitesData;
      }
      
      // If no accessible sites data, check permissions
      if (!accessibleSites || accessibleSites.length === 0) {
        // For viewer and user roles with READ permission, show all sites
        if (user.role && ['VIEWER', 'USER'].includes(user.role.toUpperCase()) && 
            hasPermission(user, 'production', 'READ')) {
          console.log(`${user.role} with READ permission, returning all sites`);
          return sitesData;
        }
        console.log('No accessible sites found for user');
        return [];
      }
      
      console.log('Filtering sites. Accessible site IDs:', accessibleSites);
      
      const filtered = sitesData.filter(site => {
        // Format the site ID to match the stored format (companyId_siteId)
        const siteId = `${site.companyId}_${site.productionSiteId}`;
        const hasAccess = hasSiteAccess(siteId, 'production');
        if (!hasAccess) {
          console.log(`User does not have access to site ${siteId}`);
        }
        return hasAccess;
      });
      
      console.log(`Filtered ${sitesData.length} sites to ${filtered.length} accessible sites`);
      return filtered;
      
    } catch (error) {
      console.error('Error filtering sites by access:', error);
      return [];
    }
  }, [user, isAdmin, accessibleSites, hasSiteAccess]);

  const validateSiteData = (site) => {
    return {
      companyId: Number(site.companyId) || 1,
      productionSiteId: Number(site.productionSiteId),
      name: site.name?.trim() || 'Unnamed Site',
      type: site.type?.trim() || 'Unknown',
      location: site.location?.trim() || 'Unknown Location',
      capacity_MW: Number(parseFloat(site.capacity_MW || 0).toFixed(2)),
      injectionVoltage_KV: Number(site.injectionVoltage_KV || 0),
      annualProduction_L: Number(site.annualProduction_L || 0),
      htscNo: site.htscNo || '',
      banking: Number(site.banking || 0),
      status: ['Active', 'Inactive', 'Maintenance'].includes(site.status) ? site.status : 'Unknown',
      version: Number(site.version) || 1,
      createdat: site.createdat || new Date().toISOString(),
      updatedat: site.updatedat || new Date().toISOString()
    };
  };

  // Fetch sites data
  const fetchSites = useCallback(async (retry = false) => {
    try {
      // Clear existing data when starting a new fetch
      if (!retry) {
        setSites([]);
        setFilteredSites([]);
        setError(null);
        setLoading(true);
        setRetryCount(0);
      }

      console.log('[Production] Fetching sites, attempt:', retryCount + 1);
      
      // Force a fresh fetch by adding a timestamp to bypass cache
      const timestamp = new Date().getTime();
      const response = await productionSiteApi.fetchAll(`?t=${timestamp}`);
      
      // Log the raw response for debugging
      console.log('[Production] Raw API response:', response);
      
      // Handle case where response is an array directly
      let sitesData = Array.isArray(response) ? response : response?.data || [];
      
      // If data is nested under 'Items', extract it
      if (sitesData?.Items && Array.isArray(sitesData.Items)) {
        sitesData = sitesData.Items;
      }
      
      // Transform data to ensure consistent format
      const formattedData = sitesData.map(site => ({
        id: `${site.companyId || '1'}_${site.productionSiteId || ''}`, // Add unique ID for React keys
        companyId: String(site.companyId || '1'),
        productionSiteId: String(site.productionSiteId || ''),
        name: site.name || 'Unnamed Site',
        type: (site.type || 'unknown').toLowerCase(),
        location: site.location || 'Unknown Location',
        status: (site.status || 'inactive').toLowerCase(),
        capacity_MW: Number(site.capacity_MW || 0),
        injectionVoltage_KV: Number(site.injectionVoltage_KV || 0),
        annualProduction_L: Number(site.annualProduction_L || 0),
        htscNo: site.htscNo || '',
        banking: site.banking || 0,
        version: Number(site.version || 1),
        createdat: site.createdat || new Date().toISOString(),
        updatedat: site.updatedat || new Date().toISOString()
      }));
      
      console.log('[Production] Formatted data:', formattedData);
      
      // Filter sites based on user's accessible sites
      const filtered = filterSitesByAccess(formattedData);
      console.log('[Production] Accessible sites for user:', filtered);
      
      // Update state in a single batch
      setSites(formattedData);
      setFilteredSites(filtered);
      
      // Only show success message if not a retry
      if (!retry) {
        if (formattedData.length === 0) {
          enqueueSnackbar('No production sites found', { 
            variant: 'info',
            autoHideDuration: 3000
          });
        } else {
          enqueueSnackbar(`Successfully loaded ${filtered.length} sites`, { 
            variant: 'success',
            autoHideDuration: 2000
          });
        }
      }
      
      setLoading(false);
      
    } catch (err) {
      
      if (retryCount < MAX_RETRIES) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchSites(true), RETRY_DELAY);
        return;
      }

      setError('Failed to load production sites. Please try again.');
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
    }
  }, [enqueueSnackbar, retryCount, user]);

  useEffect(() => {
    if (user) {
      fetchSites();
    } else {
      setError('Please log in to view production sites');
    }
  }, [fetchSites, user]);
  
  // Update filtered sites when accessible sites or sites change
  useEffect(() => {
    if (sites.length > 0) {
      const filtered = filterSitesByAccess(sites);
      setFilteredSites(filtered);
      
      if (filtered.length === 0 && sites.length > 0 && !user?.isAdmin) {
        enqueueSnackbar('You do not have access to any production sites', { variant: 'info' });
      }
    }
  }, [sites, filterSitesByAccess, user, enqueueSnackbar]);

  const handleSiteClick = useCallback((site) => {
    if (!site?.companyId || !site?.productionSiteId) {
      enqueueSnackbar('Invalid site data', { variant: 'error' });
      return;
    }
    navigate(`/production/${site.companyId}/${site.productionSiteId}`);
  }, [navigate, enqueueSnackbar]);

  const handleAddClick = useCallback(() => {
    if (!permissions.create) {
      enqueueSnackbar('You do not have permission to create sites', { 
        variant: 'error' 
      });
      return;
    }
    setSelectedSite({
      name: '',
      type: '',
      location: '',
      capacity_MW: '',
      injectionVoltage_KV: '',
      htscNo: '',
      status: 'Active',
      banking: 0,
      annualProduction_L: ''
    });
    setIsEditing(false);
    setDialogOpen(true);
  }, [permissions.create, enqueueSnackbar]);

  const handleEditClick = useCallback((site) => {
    if (!permissions.update) {
      enqueueSnackbar('You do not have permission to edit sites', { 
        variant: 'error' 
      });
      return;
    }
    
    // Ensure we have all required fields including companyId
    const siteWithRequiredFields = {
      ...site,
      companyId: site.companyId || (user?.companyId ? String(user.companyId) : null)
    };
    
    if (!siteWithRequiredFields.companyId) {
      enqueueSnackbar('Cannot determine company information. Please log out and log back in.', {
        variant: 'error',
        autoHideDuration: 10000
      });
      return;
    }
    
    console.log('Setting selected site for edit:', siteWithRequiredFields);
    setSelectedSite(siteWithRequiredFields);
    setIsEditing(true);
    setDialogOpen(true);
  }, [permissions.update, enqueueSnackbar, user]);

  const handleDeleteClick = useCallback(async (site) => {
    if (!site) return;
    
    try {
      setSelectedSite(site);
      setLoading(true);
      
      // Check if user has delete permission for this specific site
      const siteKey = `${site.companyId}_${site.productionSiteId}`;
      const canDelete = hasPermission(
        enhancedUser, 
        'production', 
        'DELETE', 
        { siteId: siteKey, siteType: 'production' }
      );
      
      if (!canDelete) {
        throw new Error('You do not have permission to delete this production site');
      }
      
      const confirmed = window.confirm(`Are you sure you want to delete ${site.name}?`);
      if (!confirmed) return;
      
      // Log deletion attempt
      console.log('Deleting production site:', { 
        companyId: site.companyId, 
        siteId: site.productionSiteId,
        siteKey
      });
      
      // Delete the site from the database
      await productionSiteApi.delete(site.companyId, site.productionSiteId);
      
      // Refresh the site list to update the UI
      // The fetchSites call will get the updated list from the server
      await fetchSites();
      
      // Show success message
      enqueueSnackbar('Production site deleted successfully', { 
        variant: 'success',
        autoHideDuration: 5000
      });
      
    } catch (error) {
      console.error('Error deleting production site:', {
        error,
        response: error.response?.data,
        site: site ? {
          id: site.id,
          companyId: site.companyId,
          productionSiteId: site.productionSiteId,
          name: site.name
        } : 'No site data'
      });
      
      let errorMessage = 'Failed to delete production site';
      
      // Handle specific error cases
      if (error.response) {
        // Server responded with an error status code
        errorMessage = error.response.data?.message || error.response.statusText || errorMessage;
        
        // Handle 404 - Not Found (already deleted)
        if (error.response.status === 404) {
          errorMessage = 'This site was already deleted or does not exist';
          // Still refresh the site list to update the UI
          await fetchSites();
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        // Other errors
        errorMessage = error.message || errorMessage;
      }
      
      // Show error message to user
      enqueueSnackbar(errorMessage, { 
        variant: 'error',
        autoHideDuration: 10000,
        action: (key) => (
          <Button color="inherit" size="small" onClick={() => enqueueSnackbar.close(key)}>
            Dismiss
          </Button>
        )
      });
      
      // Refresh accessible sites to ensure consistency
      try {
        if (refreshAccessibleSites) {
          await refreshAccessibleSites();
        }
      } catch (refreshError) {
        console.error('Error refreshing accessible sites after delete error:', refreshError);
        // Continue execution even if refresh fails
      }
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, fetchSites, hasSiteAccess, refreshAccessibleSites, updateUser, user, enhancedUser]);

  const handleOpenDialog = (site = null) => {
    setSelectedSite(site);
    // Make sure to pass null for new sites to ensure proper button text
    setDialogOpen(true);
  };

  const handleSubmit = async (formData) => {
    try {
      setLoading(true);
      setError(null);
      console.log('[Production] Starting form submission with data:', formData);
      
      // Check if we have a valid user
      if (!user) {
        const errorMsg = 'Please log in to create or edit production sites.';
        console.error('[Production] No user found');
        throw new Error(errorMsg);
      }
      
      const currentUser = user;
      console.log('[Production] Current user object:', currentUser);
      console.log('[Production] User metadata:', JSON.stringify(currentUser.metadata, null, 2));
      
      if (currentUser.metadata?.accessibleSites) {
        console.log('[Production] Accessible sites structure:', {
          productionSites: currentUser.metadata.accessibleSites.productionSites,
          consumptionSites: currentUser.metadata.accessibleSites.consumptionSites
        });
      }

      // Get company ID - try multiple sources
      let companyId = null;
      let source = 'none';
      
      // 1. Try selected site first (for edits)
      if (selectedSite?.companyId) {
        companyId = String(selectedSite.companyId);
        source = 'selectedSite';
        console.log(`[Production] Using company ID from selected site: ${companyId}`);
      }
      
      // 2. Try user object's companyId
      if (!companyId && currentUser.companyId) {
        companyId = String(currentUser.companyId);
        source = 'user.companyId';
        console.log(`[Production] Using company ID from user object: ${companyId}`);
      }
      
      // 3. Try to extract from accessible sites
      if (!companyId && currentUser.metadata?.accessibleSites?.productionSites?.L?.length > 0) {
        const firstSite = currentUser.metadata.accessibleSites.productionSites.L[0]?.S;
        console.log('[Production] First accessible site:', firstSite);
        
        if (firstSite && firstSite.includes('_')) {
          companyId = firstSite.split('_')[0];
          source = 'accessibleSites';
          console.log(`[Production] Extracted company ID from accessible sites: ${companyId}`);
        }
      }
      
      // 4. Try to get from user's department
      if (!companyId && currentUser.metadata?.department) {
        const dept = currentUser.metadata.department.toLowerCase();
        console.log(`[Production] Checking department for company ID: ${dept}`);
        
        // Map department names to company IDs
        const departmentMap = {
          'smr': '5',
          'strio': '1',
          'it': '1', // Default to STRIO for IT department
          'admin': '1', // Default to STRIO for admin
          'administration': '1' // Default to STRIO for administration
        };
        
        // Check if any department keyword matches
        for (const [key, value] of Object.entries(departmentMap)) {
          if (dept.includes(key)) {
            companyId = value;
            source = `department (${key.toUpperCase()})`;
            console.log(`[Production] Derived company ID from department (${dept}): ${companyId}`);
            break;
          }
        }
      }
      
      // 5. If still no company ID, use a default (e.g., for admin users)
      if (!companyId && currentUser.role && ['admin', 'superadmin'].includes(currentUser.role.toLowerCase())) {
        companyId = '1'; // Default to STRIO for admin users
        source = 'default (admin user)';
        console.log(`[Production] Using default company ID for admin user: ${companyId}`);
      }
      
      // Log final company ID and source
      if (companyId) {
        console.log(`[Production] Successfully determined company ID: ${companyId} (source: ${source})`);
        
        // Ensure the companyId is properly set in the user object for updateSiteAccess
        const updatedUser = {
          ...currentUser,
          companyId: companyId,
          company: currentUser.company || { id: companyId },
          metadata: {
            ...currentUser.metadata,
            companyId: currentUser.metadata?.companyId || companyId
          }
        };
        
        // Update the user in the auth context if needed
        if (updateUser) {
          updateUser(updatedUser);
        }
        
        // Update the currentUser reference for the rest of the function
        currentUser.companyId = companyId;
      } else {
        const errorMsg = 'Company ID is required to manage production sites. Please ensure your account is properly associated with a company.';
        console.error('[Production] No company ID found in user context or accessible sites');
        console.error('[Production] User metadata:', JSON.stringify(currentUser.metadata, null, 2));
        throw new Error(errorMsg);
      }

      // Transform form data as needed
      const submitData = {
        ...formData,
        capacity_MW: formData.capacity_MW != null ? Number(formData.capacity_MW) : null,
        injectionVoltage_KV: formData.injectionVoltage_KV != null ? Number(formData.injectionVoltage_KV) : null,
        annualProduction_L: formData.annualProduction_L != null ? Number(formData.annualProduction_L) : 0,
        banking: formData.banking ? 1 : 0,
        status: formData.status || 'Active',
        version: selectedSite ? (selectedSite.version || 1) : 1,
      };
      
      console.log('Submitting production site with company ID:', companyId, 'data:', submitData);
      
      let result;
      let isNewSite = false;
      
      if (selectedSite?.productionSiteId) {
        // Update existing site
        console.log('Updating existing site with ID:', selectedSite.productionSiteId);
        
        result = await productionSiteApi.update(
          companyId, 
          selectedSite.productionSiteId, 
          submitData
        );
        
        enqueueSnackbar('Production site updated successfully', { 
          variant: 'success',
          autoHideDuration: 3000
        });
      } else {
        // Create new site
        isNewSite = true;
        console.log('Creating new site for company:', companyId);
        
        // Add companyId to the site data
        const siteData = { ...submitData, companyId };
        
        // Create the site
        result = await productionSiteApi.create(siteData, { user: currentUser });
        
        // Handle both response formats: direct data or response.data
        const responseData = result.data || result;
        
        if (!responseData || (!responseData.productionSiteId && !responseData.data?.productionSiteId)) {
          console.error('Invalid response format from server:', result);
          throw new Error('Failed to create site: Invalid response format from server');
        }
        
        // Extract the created site data
        const createdSite = responseData.data || responseData;
        
        console.log('[Production] Site created successfully:', {
          companyId: createdSite.companyId,
          productionSiteId: createdSite.productionSiteId,
          response: responseData
        });
        
        // Update user's site access
        if (currentUser) {
          try {
            console.log('[Production] Updating user site access for new site:', {
              companyId: createdSite.companyId,
              productionSiteId: createdSite.productionSiteId,
              currentUser
            });
            
            await updateSiteAccess(currentUser, createdSite, 'production');
            console.log('[Production] Successfully updated user site access');
          } catch (accessError) {
            console.error('[Production] Error updating user site access:', accessError);
            // Don't fail the request if access update fails
          }
        }
        
        enqueueSnackbar('Production site created successfully', { 
          variant: 'success',
          autoHideDuration: 3000
        });
        
        // Refresh the site list
        await fetchSites();
        
        // Return the created site data
        return createdSite;
      }
      
      // For new sites, update user's accessible sites
      if (isNewSite && result?.companyId && result?.productionSiteId) {
        try {
          console.log('[Production] Updating user site access for new site:', {
            companyId: result.companyId,
            productionSiteId: result.productionSiteId,
            currentUser: {
              id: currentUser.id || currentUser.userId,
              email: currentUser.email,
              username: currentUser.username
            }
          });
          
          // Prepare site data for access update
          const siteData = {
            companyId: result.companyId,
            productionSiteId: result.productionSiteId,
            name: result.name || formData.name || 'New Production Site',
            type: 'production',
            status: result.status || formData.status || 'Active',
            capacity_MW: result.capacity_MW,
            location: result.location || formData.location,
            ...result
          };
          
          console.log('[Production] Calling updateSiteAccess with:', {
            user: { id: currentUser.id, email: currentUser.email },
            siteData: { ...siteData, productionSiteId: siteData.productionSiteId },
            siteType: 'production'
          });
          
          // Update site access
          const accessUpdated = await updateSiteAccess(currentUser, siteData, 'production');
          
          if (accessUpdated) {
            console.log('[Production] Successfully updated user site access');
            
            // Refresh user data to get updated accessible sites
            try {
              // The accessible sites will be refreshed when the user object updates
              console.log('[Production] Site access updated, user data will refresh');
            } catch (refreshError) {
              console.warn('[Production] Warning: Could not refresh accessible sites:', refreshError);
              // Non-critical error, continue
            }
            
            enqueueSnackbar('Site access updated successfully', {
              variant: 'success',
              autoHideDuration: 3000
            });
          }
        } catch (accessError) {
          console.error('[Production] Error updating user site access:', accessError);
          // Don't fail the whole operation if access update fails
          enqueueSnackbar(
            'Site created, but there was an issue updating your access. Please refresh the page to see the new site.',
            { 
              variant: 'warning', 
              autoHideDuration: 6000,
              persist: true
            }
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
      console.error('Error saving production site:', error);
      
      let errorMessage = 'Failed to save production site';
      let variant = 'error';
      let autoHideDuration = 8000;
      
      if (error.code === 'NO_COMPANY_ASSOCIATION') {
        errorMessage = error.message;
        variant = 'warning';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      enqueueSnackbar(errorMessage, {
        variant,
        autoHideDuration,
        action: (key) => (
          <Button
            color="inherit"
            size="small"
            onClick={() => enqueueSnackbar.close(key)}
          >
            Dismiss
          </Button>
        )
      });
    } finally {
      setLoading(false);
    }
  };

  const renderCardView = () => (
    <Grid container spacing={3} sx={{ mt: 2 }}>
      {filteredSites.map((site) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={`${site.companyId}_${site.productionSiteId}`}>
          <ProductionSiteCard 
            site={site} 
            onEdit={permissions.update ? () => handleSiteClick(site) : null}
            onDelete={permissions.delete ? () => handleDeleteClick(site) : null}
          />
        </Grid>
      ))}
    </Grid>
  );

  const renderTableView = () => (
    <TableContainer component={Paper} sx={{ mt: 3, maxHeight: '70vh', overflow: 'auto' }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Location</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="right">Capacity (MW)</TableCell>
            <TableCell align="right">Production (L)</TableCell>
            <TableCell>HTSC No</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredSites.map((site) => {
            const statusColor = site.status === 'active' ? 'success' : 
                              site.status === 'inactive' ? 'error' : 'warning';
                              
            return (
              <TableRow 
                key={`${site.companyId}_${site.productionSiteId}`}
                hover
                sx={{ '&:hover': { cursor: 'pointer' } }}
                onClick={() => handleSiteClick(site)}
              >
                <TableCell>{site.name}</TableCell>
                <TableCell>{site.location}</TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{site.type}</TableCell>
                <TableCell align="right">{site.capacity_MW.toLocaleString()}</TableCell>
                <TableCell align="right">{site.annualProduction_L.toLocaleString()}</TableCell>
                <TableCell>{site.htscNo || '-'}</TableCell>
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
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSiteClick(site);
                      }} 
                      size="small"
                      color="primary"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {permissions.delete && (
                      <IconButton 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(site);
                        }} 
                        size="small" 
                        color="error"
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
  );

  if (!hasAccessToSites) {
    return (
      <Box p={3}>
        <Alert 
          severity="info"
          sx={{ 
            '& .MuiAlert-message': {
              display: 'flex',
              alignItems: 'center'
            }
          }}
        >
          You don't have permission to view any production sites. Please contact your administrator.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: 'background.paper', minHeight: '100vh' }}>
      {/* Production Site Dialog */}
      <ProductionSiteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        initialData={selectedSite}
        loading={loading}
        permissions={permissions}
        user={user}
        isEditing={isEditing}
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
          Production Sites
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton 
            onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
            color="primary"
            size="large"
          >
            {viewMode === 'card' ? <ViewListIcon /> : <ViewModuleIcon />}
          </IconButton>
          {hasAccessToSites && (permissions.create || isAdmin()) && (
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
      ) : !loading && filteredSites.length === 0 ? (
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
            {permissions.create || isAdmin() ? 'No Production Sites Found' : 'No Access to Production Sites'}
          </Typography>
          
          <Typography variant="body1" color="textSecondary" paragraph>
            {permissions.create || isAdmin() 
              ? 'Get started by adding your first production site.'
              : 'You do not have access to any production sites. Please contact your administrator for access.'}
          </Typography>
          
          {(permissions.create || isAdmin()) && (
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => {
                console.log('Opening dialog from no sites message');
                setSelectedSite(null);
                setIsEditing(false);
                setDialogOpen(true);
              }}
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
              Add New Production Site
            </Button>
          )}
          
          {/* Always render the dialog in the DOM to ensure it can be opened */}
          <ProductionSiteDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            onSubmit={handleSubmit}
            initialData={selectedSite}
            loading={loading}
            permissions={permissions}
            user={user}
            isEditing={isEditing}
          />
        </Box>
      ) : viewMode === 'table' ? (
        renderTableView()
      ) : (
        <Grid container spacing={3}>
          {filteredSites.map((site) => (
            <Grid item xs={12} sm={6} md={4} key={`site_${site.companyId}_${site.productionSiteId}`}>
              <ProductionSiteCard 
                site={site}
                onView={() => handleSiteClick(site)}
                onEdit={permissions.update ? () => handleEditClick(site) : null}
                onDelete={permissions.delete ? () => handleDeleteClick(site) : null}
                userRole={user?.role}
                permissions={permissions}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <ProductionSiteDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedSite(null);
          setIsEditing(false);
        }}
        onSubmit={handleSubmit}
        initialData={selectedSite}
        loading={loading}
        permissions={permissions}
        existingSites={sites}
        user={user}
        isEditing={isEditing}
      />
    </Box>
  );
};

export default Production;