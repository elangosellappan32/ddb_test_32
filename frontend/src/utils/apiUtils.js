import axios from 'axios';
import { API_BASE_URL, API_HEADERS, API_CONFIG } from '../config/api.config';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_HEADERS
});

export const fetchData = async (endpoint) => {
  try {
    const response = await api.get(endpoint);

    return response.data;
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      throw new Error(`API Error: ${error.response.status} - ${error.response.statusText}`);
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error('No response received from server. Please check if the server is running.');
    } else {
      // Something happened in setting up the request that triggered an Error
      throw new Error(`Request configuration error: ${error.message}`);
    }
  }
};

export default api;