import axios from 'axios';

const API_BASE_URL = 'http://localhost:3333/api';

export const fetchFormVAData = async (financialYear) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/form/formva`, {
      params: { financialYear },
    });
    
    // Log the raw response for debugging
    console.log('Form V-A API Response:', response.data);

    if (response.status === 200) {
      // Check if we have a valid response structure
      if (!response.data || (!response.data.success && !response.data.data)) {
        console.error('Invalid Form V-A response format:', response.data);
        throw new Error('Invalid response format');
      }

      // Always return the complete response with success and data properties
      return {
        success: true,
        data: response.data.data || response.data
      };
    }
    throw new Error('No data found for the selected financial year');
  } catch (error) {
    console.error('Error fetching Form V-A data:', error);
    if (error.response?.status === 404) {
      throw new Error('No Form V-A data found for the selected financial year');
    }
    throw error.response?.data?.message || 'Failed to fetch Form V-A data';
  }
};

export const fetchFormVBData = async (financialYear) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/form/formvb`, {
      params: { financialYear },
    });
    
    // Log the raw response for debugging
    console.log('Form V-B API Response:', response.data);

    if (response.status === 200) {
      // Check if we have a valid response structure
      if (!response.data || (!response.data.success && !response.data.data)) {
        console.error('Invalid Form V-B response format:', response.data);
        throw new Error('Invalid response format');
      }

      // Always return the complete response with success and data properties
      return {
        success: true,
        data: response.data.data || response.data
      };
    }
    throw new Error('No data found for the selected financial year');
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