import { API_CONFIG, API_BASE_URL, API_HEADERS } from '../config';

// Export a test function that can be exposed to window
const testAPIConnection = async () => {
  const endpoints = [
    API_CONFIG.ENDPOINTS.PRODUCTION.SITES.GET_ALL,
    API_CONFIG.ENDPOINTS.PRODUCTION.UNITS.GET_ALL,
    API_CONFIG.ENDPOINTS.PRODUCTION.CHARGES.GET_ALL
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: API_HEADERS
      });
      const data = await response.json();
      results.push({ endpoint, status: 'success', data });
    } catch (error) {
      results.push({ endpoint, status: 'error', error: error.message });
      console.error(`[API Test] ❌ ${endpoint} failed:`, error);
    }
  }

  return results;
};

// Expose the test function to window object for console access
window.testAPI = testAPIConnection;

// Add this to your apiTest.js
window.checkAPIConfig = () => {
  console.log({
    BASE_URL: API_BASE_URL,
    ENDPOINTS: API_CONFIG.ENDPOINTS,
    HEADERS: API_HEADERS
  });
};

export { testAPIConnection };