import { useState } from 'react';
import { updateUserSiteAccess } from '../utils/siteAccessUtils';
import { useSnackbar } from 'notistack';
import api from '../services/api';

/**
 * Hook for managing site access operations
 * Provides functionality to update a user's accessible sites
 */
export const useSiteAccess = () => {
  const [updatingAccess, setUpdatingAccess] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  /**
   * Updates a user's site access in the backend
   * @param {Object} user - The user object
   * @param {Object|string} siteData - The site data object or site ID string
   * @param {string} siteType - The type of site ('production' or 'consumption')
   * @returns {Promise<boolean>} True if the update was successful
   */
  const updateSiteAccess = async (user, siteData, siteType) => {
    if (!user) {
      console.error('[useSiteAccess] User is required');
      enqueueSnackbar('User authentication required', { variant: 'error' });
      return false;
    }

    if (!siteData) {
      console.error('[useSiteAccess] Site data is required');
      enqueueSnackbar('Site information is required', { variant: 'error' });
      return false;
    }

    if (!['production', 'consumption'].includes(siteType)) {
      console.error(`[useSiteAccess] Invalid site type: ${siteType}`);
      enqueueSnackbar('Invalid site type', { variant: 'error' });
      return false;
    }

    try {
      setUpdatingAccess(true);
      
      const userId = user.username || user.email || user.userId;
      console.log(`[useSiteAccess] Starting ${siteType} site access update for user ${userId}`, {
        siteData,
        siteType
      });

      // Call the update function
      await updateUserSiteAccess(user, siteData, siteType);
      
      // Show success message
      enqueueSnackbar('Site access updated successfully', {
        variant: 'success',
        autoHideDuration: 3000
      });
      
      console.log(`[useSiteAccess] Successfully updated ${siteType} site access for user ${userId}`);
      return true;
      
    } catch (error) {
      console.error(`[useSiteAccess] Error updating ${siteType} site access:`, error);
      
      // Handle authentication errors specifically
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Check if token exists
        const authToken = localStorage.getItem('auth_token');
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!authToken) {
          enqueueSnackbar('Your session has expired. Please log in again.', {
            variant: 'error',
            persist: true,
            autoHideDuration: 5000
          });
          // Clear any invalid tokens
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          // Optionally redirect to login
          // window.location.href = '/login';
          return false;
        }
        
        // Token might be expired, try to refresh it
        if (refreshToken) {
          try {
            console.log('[useSiteAccess] Attempting to refresh token...');
            // Call the refresh token endpoint
            const refreshResponse = await api.post('/api/auth/refresh', { refreshToken }, {
              skipAuthRetry: true // Prevent infinite loops
            });
            
            if (refreshResponse.data?.accessToken) {
              // Update stored tokens
              localStorage.setItem('auth_token', refreshResponse.data.accessToken);
              if (refreshResponse.data.refreshToken) {
                localStorage.setItem('refresh_token', refreshResponse.data.refreshToken);
              }
              
              // Retry the original request
              console.log('[useSiteAccess] Token refreshed, retrying request...');
              return await updateSiteAccess(user, siteData, siteType);
            }
          } catch (refreshError) {
            console.error('[useSiteAccess] Error refreshing token:', refreshError);
            // Clear invalid tokens on refresh failure
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
            
            enqueueSnackbar('Session expired. Please log in again.', {
              variant: 'error',
              persist: true,
              autoHideDuration: 5000
            });
            // Optionally redirect to login
            // window.location.href = '/login';
            return false;
          }
        }
        
        // If we get here, refresh token is missing or refresh failed
        enqueueSnackbar('Your session has expired. Please log in again.', {
          variant: 'error',
          persist: true,
          autoHideDuration: 5000
        });
        // Clear any remaining tokens
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        // Optionally redirect to login
        // window.location.href = '/login';
        return false;
      }
      
      // Handle other types of errors
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update site access';
      enqueueSnackbar(
        `Site created, but there was an issue updating your access: ${errorMessage}`,
        { 
          variant: 'warning', 
          autoHideDuration: 5000,
          persist: errorMessage.includes('retry')
        }
      );
      
      return false;
    } finally {
      setUpdatingAccess(false);
    }
  };

  return { updateSiteAccess, updatingAccess };
};

export default useSiteAccess;
