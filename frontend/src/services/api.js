import axios from 'axios';
import { API_BASE_URL, API_HEADERS } from '../config/api.config';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: API_HEADERS,
  timeout: 10000
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('[API] Request Error:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API] Response Error:', error);
    if (error.response?.status === 404) {
      console.error('[API] Endpoint not found:', error.config.url);
    }
    return Promise.reject(error);
  }
);

export default api;

export { default as productionSiteApi } from './productionSiteapi';
export { default as productionUnitApi } from './productionUnitapi';
export { default as productionChargeApi } from './productionChargeapi';