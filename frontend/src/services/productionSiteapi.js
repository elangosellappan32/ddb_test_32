import api from './apiUtils';
import { API_CONFIG } from '../config/api.config';

const handleApiError = (error) => {
  console.error('API Error:', error);
  throw new Error(error.response?.data?.message || error.message || 'An error occurred');
};

const formatSiteData = (data) => {
  try {
    // Ensure we have the required fields
    if (!data || typeof data !== 'object') {
      console.warn('[ProductionSiteAPI] Invalid data object:', data);
      return null;
    }

    // Format and validate each field with strict type checking
    const formatted = {
      companyId: Number(data.companyId),
      productionSiteId: Number(data.productionSiteId),
      name: data.name?.toString().trim() || 'Unnamed Site',
      type: data.type?.toString().trim() || 'Unknown',
      location: data.location?.toString().trim() || 'Unknown Location',
      capacity_MW: Number(parseFloat(data.capacity_MW || 0)).toFixed(2),
      injectionVoltage_KV: Number(data.injectionVoltage_KV || 0),
      annualProduction_L: Number(data.annualProduction_L || 0),
      htscNo: data.htscNo ? Number(data.htscNo) : 0,
      banking: Number(data.banking || 0),
      status: ['Active', 'Inactive', 'Maintenance'].includes(data.status) ? data.status : 'Active',
      version: Number(data.version || 1),
      createdat: data.createdat || new Date().toISOString(),
      updatedat: data.updatedat || new Date().toISOString()
    };

    // Validate required fields after formatting
    if (isNaN(formatted.companyId) || isNaN(formatted.productionSiteId)) {
      console.warn('[ProductionSiteAPI] Invalid IDs:', {
        companyId: data.companyId,
        productionSiteId: data.productionSiteId
      });
      return null;
    }

    return formatted;
  } catch (error) {
    console.error('[ProductionSiteAPI] Error formatting site data:', error);
    return null;
  }
};

// Cache for storing production sites data
let productionSitesCache = {
  data: [],
  lastUpdated: null,
  isUpdating: false
};

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

class ProductionSiteApi {
  constructor() {
    // Bind all methods to preserve 'this' context
    this.fetchAll = this.fetchAll.bind(this);
    this.fetchOne = this.fetchOne.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
  }

  async fetchAll(forceRefresh = false, retries = 3, delay = 1000) {
    const now = Date.now();
    
    // Return cached data if it's still fresh and not forcing refresh
    if (!forceRefresh && 
        productionSitesCache.lastUpdated && 
        (now - productionSitesCache.lastUpdated) < CACHE_TTL) {
      console.log('[ProductionSiteAPI] Returning cached data');
      return {
        success: true,
        data: [...productionSitesCache.data],
        total: productionSitesCache.data.length,
        fromCache: true
      };
    }

    // If another request is in progress, wait for it
    if (productionSitesCache.isUpdating) {
      console.log('[ProductionSiteAPI] Update in progress, waiting...');
      await new Promise(resolve => setTimeout(resolve, 500));
      return this.fetchAll(forceRefresh, retries, delay);
    }

    productionSitesCache.isUpdating = true;

    const attempt = async (attemptsLeft) => {
      try {
        console.log(`[ProductionSiteAPI] Fetching all sites, attempt ${retries - attemptsLeft + 1}/${retries}`);
        const response = await api.get(API_CONFIG.ENDPOINTS.PRODUCTION.SITE.GET_ALL);
        
        // Extract and validate the data
        let sites = [];
        if (Array.isArray(response?.data?.data)) {
          sites = response.data.data;
        } else if (Array.isArray(response?.data)) {
          sites = response.data;
        } else if (response?.data) {
          sites = [response.data];
        } else {
          console.warn('[ProductionSiteAPI] Unexpected response format:', response);
          throw new Error('Invalid response format from server');
        }
        
        // Format and validate each site
        const formattedSites = sites
          .map(site => {
            try {
              return formatSiteData(site);
            } catch (error) {
              console.warn('[ProductionSiteAPI] Error formatting site data:', error, site);
              return null;
            }
          })
          .filter(site => {
            const isValid = site !== null && 
                         site.companyId !== undefined && 
                         site.productionSiteId !== undefined;
            if (!isValid) {
              console.warn('[ProductionSiteAPI] Invalid site data, skipping:', site);
            }
            return isValid;
          });

        // Log summary of formatted data
        console.log(`[ProductionSiteAPI] Successfully formatted ${formattedSites.length} of ${sites.length} sites`);
        
        if (formattedSites.length === 0 && sites.length > 0) {
          console.warn('[ProductionSiteAPI] No valid sites found in the response');
          throw new Error('No valid production sites found in the response');
        }

        // Update cache
        productionSitesCache = {
          data: formattedSites,
          lastUpdated: Date.now(),
          isUpdating: false
        };

        return {
          success: true,
          data: [...formattedSites],
          total: formattedSites.length,
          fromCache: false
        };
      } catch (error) {
        console.error(`[ProductionSiteAPI] Fetch error (${attemptsLeft} attempts left):`, error);
        
        if (attemptsLeft <= 1) {
          productionSitesCache.isUpdating = false;
          
          // If we have cached data, return it with an error flag
          if (productionSitesCache.data.length > 0) {
            console.warn('[ProductionSiteAPI] Using cached data due to fetch error');
            return {
              success: false,
              data: [...productionSitesCache.data],
              total: productionSitesCache.data.length,
              fromCache: true,
              error: error.message || 'Failed to fetch fresh data',
              originalError: error
            };
          }
          
          throw error;
        }
        
        // Wait before retrying with exponential backoff
        const backoffDelay = delay * (retries - attemptsLeft + 1);
        console.log(`[ProductionSiteAPI] Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return attempt(attemptsLeft - 1);
      }
    };

    try {
      return await attempt(retries);
    } catch (error) {
      productionSitesCache.isUpdating = false;
      
      // If we have cached data, return it with an error flag
      if (productionSitesCache.data.length > 0) {
        console.warn('[ProductionSiteAPI] Using cached data after all retries failed');
        return {
          success: false,
          data: [...productionSitesCache.data],
          total: productionSitesCache.data.length,
          fromCache: true,
          error: error.message || 'Failed to fetch production sites',
          originalError: error
        };
      }
      
      throw new Error(error.message || 'Failed to fetch production sites');
    }
  }

  async fetchOne(companyId, productionSiteId) {
    try {
      console.log('[ProductionSiteAPI] Fetching site:', { companyId, productionSiteId });
      const response = await api.get(
        API_CONFIG.ENDPOINTS.PRODUCTION.SITE.GET_ONE(companyId, productionSiteId)
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }

  async create(data, authContext) {
    try {
      console.log('[ProductionSiteAPI] Received create request with data:', data);
      
      // Validate user context
      if (!authContext?.user) {
        throw new Error('User context is required to create a site');
      }
      
      const userId = authContext.user.username || authContext.user.email;
      if (!userId) {
        throw new Error('User ID not found in auth context');
      }
      
      // Set environment
      const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
      
      // Get company ID from multiple sources in order of precedence
      let companyId = data.companyId;
      
      if (!companyId && authContext?.user) {
        // Try to get companyId from different possible locations in auth context
        const sources = [
          { value: authContext.user.companyId, source: 'user.companyId' },
          { value: authContext.user.metadata?.companyId, source: 'user.metadata.companyId' }
        ];

        if (authContext.user.accessibleSites?.productionSites?.L?.length > 0) {
          const firstSiteId = authContext.user.accessibleSites.productionSites.L[0].S;
          const siteCompanyId = parseInt(firstSiteId.split('_')[0], 10);
          if (!isNaN(siteCompanyId)) {
            sources.push({ value: siteCompanyId, source: 'user.accessibleSites[0]' });
          }
        }

        console.log('[ProductionSiteAPI] Auth context:', {
          user: authContext.user,
          metadata: authContext.user.metadata,
          isDevelopment
        });

        for (const source of sources) {
          if (source.value) {
            companyId = source.value;
            console.log(`[ProductionSiteAPI] Using companyId from ${source.source}:`, companyId);
            break;
          }
        }
      }

      // If no company ID found and we're in development, use default
      if (!companyId && isDevelopment) {
        companyId = 1;
        console.log('[ProductionSiteAPI] Using default development companyId:', companyId);
      }

      // Validate company ID
      if (companyId) {
        companyId = Number(companyId);
        if (isNaN(companyId) || companyId <= 0) {
          if (isDevelopment) {
            companyId = 1;
            console.log('[ProductionSiteAPI] Invalid company ID, using default in development:', companyId);
          } else {
            throw new Error('Invalid company ID format');
          }
        }
      } else {
        const error = new Error('No company association found. Please contact your administrator to set up your company association.');
        error.code = 'NO_COMPANY_ASSOCIATION';
        error.details = {
          environment: process.env.NODE_ENV,
          user: authContext?.user?.username,
          metadata: authContext?.user?.metadata
        };
        throw error;
      }

      // Prepare the site data with proper formatting
      const siteData = {
        ...data,
        companyId,
        createdBy: userId,  // Track which user created this site
        name: String(data.name || '').trim(),
        type: String(data.type || 'Solar').trim(),
        location: String(data.location || '').trim(),
        status: String(data.status || 'Active').trim(),
        capacity_MW: parseFloat(data.capacity_MW) || 0,
        injectionVoltage_KV: parseFloat(data.injectionVoltage_KV) || 0,
        annualProduction_L: parseFloat(data.annualProduction_L) || 0,
        htscNo: data.htscNo ? String(data.htscNo).trim() : '',
        injectionSubstation: data.injectionSubstation ? String(data.injectionSubstation).trim() : '',
        feederName: data.feederName ? String(data.feederName).trim() : '',
        description: data.description ? String(data.description).trim() : '',
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString(),
        version: 1
      };

      console.log('[ProductionSiteAPI] Creating production site with:', siteData);

      const response = await api.post(
        API_CONFIG.ENDPOINTS.PRODUCTION.SITE.CREATE,
        siteData
      );

      console.log('[ProductionSiteAPI] Production site created:', response.data);
      
      // Schedule a refresh of all sites data after 3 seconds
      setTimeout(() => {
        console.log('[ProductionSiteAPI] Refreshing sites data after creation...');
        this.fetchAll(true).catch(err => {
          console.error('[ProductionSiteAPI] Error refreshing sites:', err);
        });
      }, 3000);

      return response.data;

    } catch (error) {
      const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
      // If it's a company association error in development, retry with default company
      if (error.code === 'NO_COMPANY_ASSOCIATION' && isDevelopment) {
        console.warn('[ProductionSiteAPI] No company association found, retrying with default company in development');
        return this.create({ ...data, companyId: 1 }, authContext);
      }
      
      // For other errors, format them properly
      const errorMessage = error.response?.data?.message || 
                         error.response?.data?.error || 
                         error.message ||
                         'Failed to create production site';
      const serverError = new Error(errorMessage);
      serverError.status = error.response?.status;
      serverError.details = {
        ...error.response?.data,
        originalError: error.message,
        environment: process.env.NODE_ENV
      };
      serverError.code = error.code || error.response?.data?.code;
      throw serverError;
    }
  }

  async update(companyId, productionSiteId, data) {
    try {
      if (!companyId) {
        throw new Error('Company ID is required to update a production site');
      }

      const siteData = {
        ...data,
        companyId: companyId,
        productionSiteId,
        updatedat: new Date().toISOString()
      };

      const response = await api.put(
        API_CONFIG.ENDPOINTS.PRODUCTION.SITE.UPDATE(companyId, productionSiteId),
        siteData
      );

      // Schedule a refresh of all sites data after 3 seconds
      setTimeout(() => {
        console.log('[ProductionSiteAPI] Refreshing sites data after update...');
        this.fetchAll(true).catch(err => {
          console.error('[ProductionSiteAPI] Error refreshing sites:', err);
        });
      }, 3000);

      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }

  async delete(companyId, productionSiteId) {
    try {
      if (!companyId || !productionSiteId) {
        throw new Error('Company ID and Production Site ID are required');
      }

      // Ensure IDs are strings for the API call
      const companyIdStr = String(companyId);
      const productionSiteIdStr = String(productionSiteId);

      const response = await api.delete(
        API_CONFIG.ENDPOINTS.PRODUCTION.SITE.DELETE(companyIdStr, productionSiteIdStr)
      );

      // Schedule a refresh of all sites data after 3 seconds
      setTimeout(() => {
        console.log('[ProductionSiteAPI] Refreshing sites data after deletion...');
        this.fetchAll(true).catch(err => {
          console.error('[ProductionSiteAPI] Error refreshing sites:', err);
        });
      }, 3000);

      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }
}

const productionSiteApi = new ProductionSiteApi();
export default productionSiteApi;