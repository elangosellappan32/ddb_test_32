import { useState } from 'react';
import { updateUserSiteAccess } from '../utils/siteAccessUtils';
import { useSnackbar } from 'notistack';

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
      
      // Show appropriate error message
      const errorMessage = error.message || 'Failed to update site access';
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
