import api from './apiUtils';
import { API_CONFIG } from '../config/api.config';

const handleApiError = (error) => {
  console.error('[ConsumptionSiteAPI] Error:', error);
  
  if (error.message === 'The site was modified by another user. Please refresh and try again.') {
    // This is our custom version conflict message, pass it through
    throw error;
  }
  
  // If it's a version conflict from the server
  if (error.response?.status === 409) {
    // Clear any cached data to force a fresh fetch
    if (siteCache) {
      siteCache.data = [];
      siteCache.lastUpdated = null;
    }
    throw new Error('The site was modified by another user. Please refresh and try again.');
  }
  
  // Handle other errors
  const errorMessage = error.response?.data?.message || error.message || 'An error occurred';
  throw new Error(errorMessage);
};

const formatSiteData = (data) => {
  try {
    if (!data || typeof data !== 'object') {
      console.warn('[ConsumptionSiteAPI] Invalid data object:', data);
      return null;
    }
    
    // Handle annual consumption from different possible field names
    let annualConsumption = 0;
    const rawValue = data.annualConsumption ?? data.annualConsumption_L ?? data.annualConsumption_N?.N;
    
    if (rawValue !== undefined && rawValue !== null) {
      if (typeof rawValue === 'number') {
        annualConsumption = Math.round(Number(rawValue));
      } else if (typeof rawValue === 'string') {
        const cleanValue = rawValue.trim() === '' ? '0' : rawValue.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleanValue);
        annualConsumption = isNaN(num) ? 0 : Math.round(num);
      } else if (typeof rawValue === 'object' && rawValue.N) {
        const num = parseFloat(rawValue.N);
        annualConsumption = isNaN(num) ? 0 : Math.round(num);
      }
    }
    
    // Format and validate each field with strict type checking
    const formatted = {
      companyId: String(data.companyId || '1'),
      companyName: data.companyName || data.company?.name || 'Unknown Company',
      consumptionSiteId: String(data.consumptionSiteId || '1'),
      name: data.name?.toString().trim() || 'Unnamed Site',
      type: data.type?.toString().trim() || 'Industry',
      location: data.location?.toString().trim() || 'Unknown Location',
      annualConsumption: annualConsumption,
      annualConsumption_L: annualConsumption, // Keep both for backward compatibility
      htscNo: data.htscNo ? String(data.htscNo).trim() : '',
      // Normalize status to lowercase and ensure it's one of the valid values
      status: ['active', 'inactive', 'maintenance'].includes(String(data.status || '').toLowerCase()) 
        ? String(data.status).toLowerCase() 
        : 'active',
      version: Number(data.version || 1),
      createdat: data.createdat || new Date().toISOString(),
      updatedat: data.updatedat || new Date().toISOString(),
    };    
    
    // Validate required fields after formatting
    if (!formatted.companyId || !formatted.consumptionSiteId) {
      console.warn('[ConsumptionSiteAPI] Missing required IDs:', {
        companyId: data.companyId,
        consumptionSiteId: data.consumptionSiteId
      });
      return null;
    }

    return formatted;
  } catch (error) {
    console.error('[ConsumptionSiteAPI] Error formatting site data:', error);
    return null;
  }
};

// Cache for storing consumption sites data
const siteCache = {
  data: [],
  lastUpdated: null,
  isUpdating: false
};

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

class ConsumptionSiteApi {
  constructor() {
    // Bind all methods to preserve 'this' context
    this.fetchAll = this.fetchAll.bind(this);
    this.fetchOne = this.fetchOne.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
    this.invalidateCache = this.invalidateCache.bind(this);
  }

  async fetchAll(forceRefresh = false, retries = 3, delay = 1000) {
    try {
      // Return cached data if available and fresh
      if (!forceRefresh && 
          siteCache.data.length > 0 && 
          siteCache.lastUpdated && 
          (Date.now() - siteCache.lastUpdated) < CACHE_TTL) {
        return {
          success: true,
          data: [...siteCache.data],
          total: siteCache.data.length,
          fromCache: true
        };
      }

      // If a refresh is already in progress, wait for it
      if (siteCache.isUpdating) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchAll(forceRefresh, retries, delay);
      }

      // Set the updating flag
      siteCache.isUpdating = true;

      // Fetch fresh data from the API
      const response = await api.get(API_CONFIG.ENDPOINTS.CONSUMPTION.SITE.GET_ALL);
      
      // Format and validate the response data
      const formattedData = [];
      for (const item of response.data.data || []) {
        const formatted = formatSiteData(item);
        if (formatted) {
          formattedData.push(formatted);
        }
      }

      // Update the cache
      siteCache.data = formattedData;
      siteCache.lastUpdated = Date.now();
      siteCache.isUpdating = false;

      return {
        success: true,
        data: [...formattedData],
        total: formattedData.length,
        fromCache: false
      };
    } catch (error) {
      console.error('[ConsumptionSiteAPI] Error fetching sites:', error);
      
      // Retry on failure
      if (retries > 0) {
        console.log(`[ConsumptionSiteAPI] Retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchAll(forceRefresh, retries - 1, delay * 1.5);
      }
      
      // If we're out of retries, throw the error
      throw handleApiError(error);
    } finally {
      // Ensure we always clear the updating flag
      siteCache.isUpdating = false;
    }
  }

  async fetchOne(companyId, consumptionSiteId) {
    try {
      if (!companyId || !consumptionSiteId) {
        throw new Error('Company ID and Site ID are required');
      }

      // Try to get from cache first
      const cachedData = siteCache.data.find(
        site => site.companyId === String(companyId) && 
               site.consumptionSiteId === String(consumptionSiteId)
      );
      
      if (cachedData) {
        return {
          success: true,
          data: { ...cachedData },
          fromCache: true
        };
      }

      // Not in cache, fetch from API
      const response = await api.get(
        API_CONFIG.ENDPOINTS.CONSUMPTION.SITE.GET_ONE(companyId, consumptionSiteId)
      );

      const formatted = formatSiteData(response.data.data);
      if (!formatted) {
        throw new Error('Invalid site data received from server');
      }

      // Update cache
      const existingIndex = siteCache.data.findIndex(
        site => site.companyId === formatted.companyId && 
               site.consumptionSiteId === formatted.consumptionSiteId
      );
      
      if (existingIndex >= 0) {
        siteCache.data[existingIndex] = formatted;
      } else {
        siteCache.data.push(formatted);
      }
      
      siteCache.lastUpdated = Date.now();

      return {
        success: true,
        data: { ...formatted },
        fromCache: false
      };
    } catch (error) {
      console.error(`[ConsumptionSiteAPI] Error fetching site ${companyId}/${consumptionSiteId}:`, error);
      throw handleApiError(error);
    }
  }

  async create(data, authContext = {}) {
    try {
      // Get auth token from localStorage
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }
      
      // Get user info from token or auth context
      const user = authContext?.user || JSON.parse(localStorage.getItem('user') || '{}');
      
      // Handle company ID from multiple sources
      let companyId = data.companyId;
      const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
      
      if (!companyId) {
        // Try to get companyId from multiple possible locations
        if (user?.companyId) {
          companyId = user.companyId;
        } else if (user?.metadata?.companyId) {
          companyId = user.metadata.companyId;
        } else if (isDevelopment) {
          companyId = '1';
          console.log('[ConsumptionSiteAPI] No company ID provided, using default in development:', companyId);
        } else {
          throw new Error('Company ID is required to create a consumption site');
        }
      }
      
      // Ensure companyId is a string
      companyId = String(companyId);

      // Prepare the site data with proper formatting
      const siteData = {
        ...data,
        // Ensure required fields are properly formatted
        name: String(data.name || '').trim(),
        type: String(data.type || 'Industry').trim(),
        location: String(data.location || '').trim(),
        annualConsumption_L: Number(data.annualConsumption_L || 0),
        status: String(data.status || 'Active').trim(),
        // Ensure companyId is a string
        companyId: String(companyId)
      };

      console.log('[ConsumptionSiteAPI] Creating consumption site with:', siteData);

      const response = await api.post(
        API_CONFIG.ENDPOINTS.CONSUMPTION.SITE.CREATE,
        siteData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Invalidate cache to ensure fresh data on next fetch
      this.invalidateCache();
      
      return response.data;
    } catch (error) {
      console.error('[ConsumptionSiteAPI] Error creating site:', error);
      throw handleApiError(error);
    }
  }

  async update(companyId, consumptionSiteId, data, retryCount = 3, originalVersion = null) {
    try {
      if (!companyId || !consumptionSiteId) {
        throw new Error('Company ID and Site ID are required');
      }

      // Get current data to preserve any fields not being updated
      const current = await this.fetchOne(companyId, consumptionSiteId, true); // Force refresh
      const currentData = current.data;

      // Check if this is a retry and the version has changed from our original attempt
      if (originalVersion !== null && originalVersion !== currentData.version) {
        throw new Error('The site was modified by another user. Please refresh and try again.');
      }

      // Store original version on first attempt
      if (originalVersion === null) {
        originalVersion = currentData.version;
      }

      // Handle annual consumption from different possible field names
      let annualConsumption = 0;
      const rawValue = data.annualConsumption ?? data.annualConsumption_L;
      
      if (rawValue !== undefined && rawValue !== null) {
        if (typeof rawValue === 'number') {
          annualConsumption = Math.round(Number(rawValue));
        } else if (typeof rawValue === 'string') {
          const cleanValue = rawValue.trim() === '' ? '0' : rawValue.replace(/[^0-9.]/g, '');
          const num = parseFloat(cleanValue);
          annualConsumption = isNaN(num) ? 0 : Math.round(num);
        } else if (typeof rawValue === 'object' && rawValue.N) {
          const num = parseFloat(rawValue.N);
          annualConsumption = isNaN(num) ? 0 : Math.round(num);
        }
      }

      // Prepare the site data with proper formatting
      const siteData = {
        ...currentData,
        ...data,
        companyId: String(companyId),
        consumptionSiteId: String(consumptionSiteId),
        name: String(data.name || currentData.name || '').trim(),
        type: String(data.type || currentData.type || 'industrial').trim().toLowerCase(),
        location: String(data.location || currentData.location || '').trim(),
        annualConsumption: annualConsumption,
        annualConsumption_L: annualConsumption,
        // Ensure status is one of the valid values and normalize to lowercase
        status: ['active', 'inactive', 'maintenance'].includes(String(data.status || currentData.status || 'active').toLowerCase())
          ? String(data.status || currentData.status || 'active').toLowerCase()
          : 'active',
        version: (currentData.version || 0) + 1,
        updatedat: new Date().toISOString()
      };

      console.log('[ConsumptionSiteAPI] Updating site with:', siteData);

      const response = await api.put(
        API_CONFIG.ENDPOINTS.CONSUMPTION.SITE.UPDATE(companyId, consumptionSiteId),
        siteData
      );

      console.log('[ConsumptionSiteAPI] Site updated:', response.data);
      
      // Invalidate the cache
      this.invalidateCache();
      
      // Cache the successful response
      const successData = response.data;
      
      // Update the cache with the new version
      const cacheIndex = siteCache.data.findIndex(
        site => site.companyId === String(companyId) && site.consumptionSiteId === String(consumptionSiteId)
      );
      if (cacheIndex !== -1) {
        siteCache.data[cacheIndex] = successData;
      }
      
      return successData;
    } catch (error) {
      console.error(`[ConsumptionSiteAPI] Error updating site ${companyId}/${consumptionSiteId}:`, error);
      
      // Handle version conflict with retry
      if (error.response?.status === 409 && retryCount > 0) {
        console.log(`[ConsumptionSiteAPI] Version conflict detected, retrying... (${retryCount} attempts left)`);
        
        // Clear the cache to ensure we get fresh data
        this.invalidateCache();
        
        // Wait a short time before retrying to allow other operations to complete
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
        
        // Retry the update with one less retry attempt, passing the original version
        return this.update(companyId, consumptionSiteId, data, retryCount - 1, originalVersion);
      }
      
      // If we're out of retries or it's not a version conflict
      this.invalidateCache(); // Clear cache on error
      throw handleApiError(error);
    }
  }

  async delete(companyId, consumptionSiteId) {
    try {
      if (!companyId || !consumptionSiteId) {
        throw new Error('Company ID and Consumption Site ID are required');
      }

      console.log(`[ConsumptionSiteAPI] Deleting site ${companyId}/${consumptionSiteId}`);

      const response = await api.delete(
        API_CONFIG.ENDPOINTS.CONSUMPTION.SITE.DELETE(companyId, consumptionSiteId)
      );

      console.log('[ConsumptionSiteAPI] Site deleted:', response.data);
      
      // Invalidate the cache
      this.invalidateCache();
      
      return response.data;
    } catch (error) {
      console.error(`[ConsumptionSiteAPI] Error deleting site ${companyId}/${consumptionSiteId}:`, error);
      throw handleApiError(error);
    }
  }

  // Invalidate the cache
  invalidateCache() {
    siteCache.data = [];
    siteCache.lastUpdated = null;
    console.log('[ConsumptionSiteAPI] Cache invalidated');
  }
}

const consumptionSiteApi = new ConsumptionSiteApi();
export default consumptionSiteApi;