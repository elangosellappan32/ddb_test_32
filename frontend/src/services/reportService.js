import axios from 'axios';

const API_BASE_URL = 'http://localhost:3333/api';

export const fetchFormVAData = async (financialYear) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/health/formva`, {
      params: { financialYear },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching Form V-A data:', error);
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid financial year format');
    }
    throw new Error('Failed to fetch Form V-A data');
  }
};

export const fetchFormVBData = async (financialYear) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/health/formvb`, {
      params: { financialYear },
    });
    if (!response.data?.success) {
      throw new Error('Invalid response format');
    }
    return response.data;
  } catch (error) {
    console.error('Error fetching Form V-B data:', error);
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid financial year format');
    } else if (error.response?.status === 404) {
      throw new Error('No data found for the selected financial year');
    } else if (error.message === 'Invalid response format') {
      throw new Error('Server returned an invalid response format');
    }
    throw new Error(error.response?.data?.message || 'Failed to fetch Form V-B data');
  }
};

export const fetchConsumptionSites = async () => {
  try {
    const response = await axios.get('/api/consumption-sites');
    return response;
  } catch (error) {
    throw new Error('Failed to fetch consumption sites: ' + error.message);
  }
};