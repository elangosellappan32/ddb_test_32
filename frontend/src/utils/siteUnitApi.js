import axios from 'axios';

// Fetch all production units for a site
export const fetchAllProductionUnits = async (companyId, siteId) => {
  const url = `/api/production-unit/${companyId}/${siteId}/all`;
  const response = await axios.get(url);
  return response.data;
};

// Fetch all consumption units for a site
export const fetchAllConsumptionUnits = async (companyId, siteId) => {
  const url = `/api/consumption-unit/${companyId}/${siteId}/all`;
  const response = await axios.get(url);
  return response.data;
};
