import axios from 'axios';
import { API_BASE_URL } from '../config/api.config';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.debug('[API] Adding auth token to request');
    }
    // Don't retry refresh token requests
    config.skipAuthRetry = config.url?.includes('/auth/refresh');
    return config;
  },
  (error) => {
    console.error('[API] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle authentication errors
    if (error.response?.status === 401 && !originalRequest.skipAuthRetry && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          // Try to refresh the token
          const response = await axios.post('/api/auth/refresh', { refreshToken });
          const { accessToken, refreshToken: newRefreshToken } = response.data;

          if (accessToken && newRefreshToken) {
            // Update stored tokens
            localStorage.setItem('auth_token', accessToken);
            localStorage.setItem('refresh_token', newRefreshToken);
            api.defaults.headers.Authorization = `Bearer ${accessToken}`;
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;

            // Retry the original request
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        console.error('[API] Token refresh failed:', refreshError);
      }

      // If refresh failed or no refresh token available
      const isPublicRoute = window.location.pathname.match(/\/(production|consumption)\/\d+\/\d+/);
      if (!isPublicRoute) {
        // Clear credentials and redirect to login
        console.warn('[API] Authentication failed - clearing credentials');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/login';
      } else {
        // For public routes, don't redirect on auth errors
        console.warn('[API] Auth error on public route - continuing');
      }
    }
    
    // Enhance error message
    const errorMessage = error.response?.data?.message || error.message || 'An error occurred';
    error.message = errorMessage;
    
    return Promise.reject(error);
  }
);

export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error
    const message = error.response.data?.message || error.message;
    console.error(`[API Error] ${error.response.status}: ${message}`);
    throw new Error(message);
  } else if (error.request) {
    // Request made but no response
    console.error('[API Error] No response received:', error.request);
    throw new Error('No response received from server');
  } else {
    // Request setup error
    console.error('[API Error] Request failed:', error.message);
    throw new Error(error.message);
  }
};

export default api;