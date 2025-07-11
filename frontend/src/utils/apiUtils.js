import axios from 'axios';
import { API_BASE_URL, API_HEADERS, API_CONFIG } from '../config/api.config';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL, // Remove trailing slash if exists
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    ...API_HEADERS,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true // Include credentials (cookies) in cross-origin requests
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Fetches data from the API with proper error handling
 * @param {string} endpoint - The API endpoint (without base URL)
 * @param {Object} [params={}] - Query parameters
 * @returns {Promise} The response data
 */
/**
 * Fetches data from the API with proper error handling, retries, and timeout
 * @param {string} endpoint - The API endpoint (without base URL)
 * @param {Object} [params={}] - Query parameters
 * @param {Object} [options={}] - Additional options
 * @param {boolean} [options.requireAuth=true] - Whether authentication is required
 * @param {Object} [options.headers={}] - Additional headers to include
 * @param {number} [options.timeout=10000] - Request timeout in milliseconds
 * @param {number} [options.retry=0] - Number of retries on failure
 * @param {number} [options.retryDelay=1000] - Delay between retries in milliseconds
 * @returns {Promise} The response data
 */
export const fetchData = async (endpoint, params = {}, options = {}) => {
  const {
    requireAuth = true,
    headers: customHeaders = {},
    timeout = 10000,
    retry = 0,
    retryDelay = 1000,
    ...requestOptions
  } = options;

  // Ensure endpoint starts with a slash
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Convert params object to URLSearchParams
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value);
    }
  });
  
  // Build the URL with query parameters
  const url = queryParams.toString() 
    ? `${normalizedEndpoint}?${queryParams.toString()}`
    : normalizedEndpoint;
  
  // Get the auth token if required
  const authToken = localStorage.getItem('auth_token');
  if (requireAuth && !authToken) {
    throw new Error('Authentication required: No auth token found');
  }
  
  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(authToken && requireAuth ? { 'Authorization': `Bearer ${authToken}` } : {}),
    ...customHeaders
  };
  
  // Create a controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  // Function to make the actual request
  const makeRequest = async (attempt = 0) => {
    try {
      console.log(`API Request [${attempt + 1}]:`, {
        url: `${API_BASE_URL}${url}`,
        method: 'GET',
        headers,
        signal: controller.signal,
        ...requestOptions
      });
      
      const response = await api.get(url, {
        headers,
        signal: controller.signal,
        ...requestOptions
      });
      
      clearTimeout(timeoutId);
      return response.data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle specific error cases
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout}ms`);
      }
      
      // If we have retries left, wait and retry
      if (attempt < retry) {
        console.warn(`Request failed, retrying... (${attempt + 1}/${retry})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return makeRequest(attempt + 1);
      }
      
      // If no more retries, throw the error
      throw error;
    }
  };
  
  return makeRequest();
};

export default api;