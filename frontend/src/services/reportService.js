import axios from 'axios';

const API_BASE_URL = 'http://localhost:3333/api';

export const fetchFormVAData = async (financialYear) => {
  try {
    console.log(`Fetching Form V-A data for financial year: ${financialYear}`);
    const response = await axios.get(`${API_BASE_URL}/form/formva`, {
      params: { financialYear },
    });
    
    // Log the complete response for debugging
    console.group('Form V-A API Response:');
    console.log('Full Response:', response);
    console.log('Response Data:', response.data);
    console.log('Response Status:', response.status);
    console.log('Response Headers:', response.headers);
    
    if (response.data && response.data.data) {
      console.log('Form V-A Data Structure:');
      console.table({
        'totalGeneratedUnits': response.data.data.totalGeneratedUnits,
        'auxiliaryConsumption': response.data.data.auxiliaryConsumption,
        'aggregateGeneration': response.data.data.aggregateGeneration,
        'percentage51': response.data.data.percentage51,
        'totalAllocatedUnits': response.data.data.totalAllocatedUnits,
        'percentageAdjusted': response.data.data.percentageAdjusted,
        'hasSiteMetrics': Array.isArray(response.data.data.siteMetrics)
      });
    }
    console.groupEnd();

    if (response.status === 200) {
      // Check if we have a valid response structure
      if (!response.data) {
        console.error('Empty response data from Form V-A API');
        throw new Error('Empty response from server');
      }

      // Handle both response structures: {success, data} or direct data object
      const responseData = response.data.data || response.data;
      
      // Log the data being returned
      console.log('Processed Form V-A data for worksheet:', responseData);

      // Always return the complete response with success and data properties
      return {
        success: true,
        data: responseData
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