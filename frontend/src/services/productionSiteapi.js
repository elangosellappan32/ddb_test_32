import api from './apiUtils';
import { API_CONFIG } from '../config/api.config';

// Helper function for timestamped logging
const logWithTime = (message, ...optionalParams) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, ...optionalParams);
};

const handleApiError = (error) => {
  logWithTime('❌ API Error:', error);
  throw new Error(error.response?.data?.message || error.message || 'An error occurred');
};

const formatSiteData = (data) => {
  try {
    logWithTime('[STEP] Formatting site data - Raw:', data);

    if (!data || typeof data !== 'object') {
      console.warn('[ProductionSiteAPI] Invalid data object:', data);
      return null;
    }

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
      status: ['active', 'inactive', 'maintenance'].includes(String(data.status || '').toLowerCase()) ? String(data.status).toLowerCase() : 'active',
      version: Number(data.version || 1),
      createdat: data.createdat || new Date().toISOString(),
      updatedat: data.updatedat || new Date().toISOString()
    };

    logWithTime('[STEP] Formatted site data:', formatted);
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
    this.fetchAll = this.fetchAll.bind(this);
    this.fetchOne = this.fetchOne.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
  }

  async fetchAll(forceRefresh = false, retries = 3, delay = 1000) {
    const now = Date.now();

    logWithTime(`[STEP 1] fetchAll called — forceRefresh=${forceRefresh}, retries=${retries}`);

    if (!forceRefresh && productionSitesCache.lastUpdated && (now - productionSitesCache.lastUpdated) < CACHE_TTL) {
      logWithTime('[CACHE] Returning cached data');
      console.table(productionSitesCache.data);
      return {
        success: true,
        data: [...productionSitesCache.data],
        total: productionSitesCache.data.length,
        fromCache: true
      };
    }

    if (productionSitesCache.isUpdating) {
      logWithTime('[INFO] Another fetch is in progress... waiting...');
      await new Promise(resolve => setTimeout(resolve, 500));
      return this.fetchAll(forceRefresh, retries, delay);
    }

    productionSitesCache.isUpdating = true;

    const attempt = async (attemptsLeft) => {
      try {
        logWithTime(`[STEP 2] Fetch attempt ${retries - attemptsLeft + 1}/${retries}`);

        const response = await api.get(API_CONFIG.ENDPOINTS.PRODUCTION.SITE.GET_ALL);
        logWithTime('[STEP 3] Raw API response:', response);

        let sites = [];
        if (Array.isArray(response?.data?.data)) {
          sites = response.data.data;
        } else if (Array.isArray(response?.data)) {
          sites = response.data;
        } else if (response?.data) {
          sites = [response.data];
        } else {
          throw new Error('Invalid response format from server');
        }

        logWithTime(`[STEP 4] Sites received: ${sites.length}`);
        console.table(sites);

        const formattedSites = sites
          .map((site, index) => {
            logWithTime(`[PROCESS] Formatting site ${index + 1}/${sites.length}`);
            return formatSiteData(site);
          })
          .filter(site => site !== null);

        logWithTime(`[STEP 5] Successfully formatted ${formattedSites.length} of ${sites.length} sites`);
        console.table(formattedSites);

        if (formattedSites.length === 0) {
          throw new Error('No valid production sites found');
        }

        productionSitesCache = {
          data: formattedSites,
          lastUpdated: Date.now(),
          isUpdating: false
        };

        logWithTime('[CACHE] Cache updated at', new Date(productionSitesCache.lastUpdated).toLocaleString());

        return {
          success: true,
          data: [...formattedSites],
          total: formattedSites.length,
          fromCache: false
        };
      } catch (error) {
        logWithTime(`[ERROR] Fetch failed (${attemptsLeft} attempts left):`, error);

        if (attemptsLeft <= 1) {
          productionSitesCache.isUpdating = false;
          if (productionSitesCache.data.length > 0) {
            logWithTime('[FALLBACK] Using cached data due to fetch failure');
            return {
              success: false,
              data: [...productionSitesCache.data],
              total: productionSitesCache.data.length,
              fromCache: true,
              error: error.message,
              originalError: error
            };
          }
          throw error;
        }

        const backoffDelay = delay * (retries - attemptsLeft + 1);
        logWithTime(`[RETRY] Retrying in ${backoffDelay} ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return attempt(attemptsLeft - 1);
      }
    };

    return attempt(retries);
  }

  async fetchOne(companyId, productionSiteId) {
    try {
      logWithTime('[FETCH ONE] Fetching site:', { companyId, productionSiteId });
      const response = await api.get(
        API_CONFIG.ENDPOINTS.PRODUCTION.SITE.GET_ONE(companyId, productionSiteId)
      );
      logWithTime('[FETCH ONE] API Response:', response.data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }

  async create(data, authContext = {}) {
    try {
      logWithTime('[CREATE] Received create request with data:', data);

      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Authentication token not found. Please log in again.');

      const user = authContext?.user || JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user.username || user.email;
      if (!userId) throw new Error('User ID not found. Please log in again.');

      const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
      let companyId = data.companyId;

      if (!companyId && authContext?.user) {
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
        for (const source of sources) {
          if (source.value) {
            companyId = source.value;
            logWithTime(`[CREATE] Using companyId from ${source.source}:`, companyId);
            break;
          }
        }
      }

      if (!companyId && isDevelopment) {
        companyId = 1;
        logWithTime('[CREATE] Using default development companyId:', companyId);
      }

      if (companyId) {
        companyId = Number(companyId);
        if (isNaN(companyId) || companyId <= 0) {
          if (isDevelopment) {
            companyId = 1;
            logWithTime('[CREATE] Invalid company ID, using default in development:', companyId);
          } else throw new Error('Invalid company ID format');
        }
      } else {
        throw new Error('No company association found.');
      }

      const siteData = {
        ...data,
        companyId,
        createdBy: userId,
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
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString(),
        version: 1
      };

      logWithTime('[CREATE] Creating production site with:', siteData);

      const response = await api.post(
        API_CONFIG.ENDPOINTS.PRODUCTION.SITE.CREATE,
        siteData,
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      productionSitesCache.data = [];
      productionSitesCache.lastUpdated = null;

      logWithTime('[CREATE] Production site created:', response.data);

      setTimeout(() => {
        logWithTime('[CREATE] Refreshing sites data after creation...');
        this.fetchAll(true).catch(err => console.error('[CREATE] Error refreshing sites:', err));
      }, 3000);

      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }

  async update(companyId, productionSiteId, data) {
    try {
      logWithTime('[UPDATE] Updating site:', { companyId, productionSiteId, data });

      const siteData = {
        ...data,
        companyId,
        productionSiteId,
        updatedat: new Date().toISOString()
      };

      const response = await api.put(
        API_CONFIG.ENDPOINTS.PRODUCTION.SITE.UPDATE(companyId, productionSiteId),
        siteData
      );

      setTimeout(() => {
        logWithTime('[UPDATE] Refreshing sites data after update...');
        this.fetchAll(true).catch(err => console.error('[UPDATE] Error refreshing sites:', err));
      }, 3000);

      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }

  async delete(companyId, productionSiteId) {
    try {
      logWithTime('[DELETE] Deleting site:', { companyId, productionSiteId });

      const response = await api.delete(
        API_CONFIG.ENDPOINTS.PRODUCTION.SITE.DELETE(String(companyId), String(productionSiteId))
      );

      setTimeout(() => {
        logWithTime('[DELETE] Refreshing sites data after deletion...');
        this.fetchAll(true).catch(err => console.error('[DELETE] Error refreshing sites:', err));
      }, 3000);

      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }
}

const productionSiteApi = new ProductionSiteApi();
export default productionSiteApi;
