import axios from 'axios';
import { API_CONFIG, API_HEADERS, getAuthHeader } from '../config/api.config';

const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_HEADERS,
});

apiClient.interceptors.request.use((config) => {
  config.headers = { ...config.headers, ...getAuthHeader() };
  return config;
});

export const fetchAllUnitData = async () => {
  try {
    const [productionUnits, consumptionUnits, bankingUnits] = await Promise.all([
      apiClient.get(API_CONFIG.ENDPOINTS.PRODUCTION.UNIT.GET_ALL('companyId', 'siteId')),
      apiClient.get(API_CONFIG.ENDPOINTS.CONSUMPTION.UNIT.GET_ALL('companyId', 'siteId')),
      apiClient.get(API_CONFIG.ENDPOINTS.BANKING.GET_ALL),
    ]);

    const totalUnits = (productionUnits.data || []).length +
                      (consumptionUnits.data || []).length +
                      (bankingUnits.data || []).length;

    return {
      productionUnits: productionUnits.data || [],
      consumptionUnits: consumptionUnits.data || [],
      bankingUnits: bankingUnits.data || [],
      totalUnits,
    };
  } catch (error) {
    console.error('Error fetching unit data:', error);
    throw new Error('Failed to fetch unit data');
  }
};

export const fetchDashboardData = async () => {
  try {
    const [roles, productionSites, consumptionSites] = await Promise.all([
      apiClient.get(API_CONFIG.ENDPOINTS.ROLES.GET_ALL),
      apiClient.get(API_CONFIG.ENDPOINTS.PRODUCTION.SITE.GET_ALL),
      apiClient.get(API_CONFIG.ENDPOINTS.CONSUMPTION.SITE.GET_ALL),
    ]);

    return {
      roles: roles.data || [],
      productionSites: productionSites.data || [],
      consumptionSites: consumptionSites.data || [],
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw new Error('Failed to fetch dashboard data');
  }
};

export const calculateUnitsData = async () => {
  try {
    // Fetch all unit data using the existing fetchAllUnitData method
    const { productionUnits, consumptionUnits, bankingUnits } = await fetchAllUnitData();

    // Validate that the fetched data is an array
    const validProductionUnits = Array.isArray(productionUnits) ? productionUnits : [];
    const validConsumptionUnits = Array.isArray(consumptionUnits) ? consumptionUnits : [];
    const validBankingUnits = Array.isArray(bankingUnits) ? bankingUnits : [];

    // Calculate total units for production, consumption, and banking
    const totalProductionUnits = validProductionUnits.reduce((sum, unit) => {
      return sum + (unit.c1 || 0) + (unit.c2 || 0) + (unit.c3 || 0) + (unit.c4 || 0) + (unit.c5 || 0);
    }, 0);

    const totalConsumptionUnits = validConsumptionUnits.reduce((sum, unit) => {
      return sum + (unit.c1 || 0) + (unit.c2 || 0) + (unit.c3 || 0) + (unit.c4 || 0) + (unit.c5 || 0);
    }, 0);

    const totalBankingUnits = validBankingUnits.reduce((sum, unit) => {
      return sum + (unit.c1 || 0) + (unit.c2 || 0) + (unit.c3 || 0) + (unit.c4 || 0) + (unit.c5 || 0);
    }, 0);

    // Return the calculated data
    return {
      totalProductionUnits,
      totalConsumptionUnits,
      totalBankingUnits,
      netUnits: totalProductionUnits - totalConsumptionUnits + totalBankingUnits,
    };
  } catch (error) {
    console.error('Error calculating units data:', error);
    throw new Error('Failed to calculate units data');
  }
};

export const calculateUnitsDataByFinancialYear = async (selectedFinancialYear) => {
  try {
    // Fetch all unit data using the existing fetchAllUnitData method
    const { productionUnits, consumptionUnits, bankingUnits } = await fetchAllUnitData();

    // Validate that the fetched data is an array
    const validProductionUnits = Array.isArray(productionUnits) ? productionUnits : [];
    const validConsumptionUnits = Array.isArray(consumptionUnits) ? consumptionUnits : [];
    const validBankingUnits = Array.isArray(bankingUnits) ? bankingUnits : [];

    // Define the start and end dates for the selected financial year
    const startYear = parseInt(selectedFinancialYear.split('-')[0], 10);
    const startDate = new Date(startYear, 3, 1); // April 1st
    const endDate = new Date(startYear + 1, 2, 31); // March 31st

    // Filter units based on the financial year
    const filterByFinancialYear = (units) => {
      return units.filter((unit) => {
        const unitDate = new Date(unit.date); // Assuming each unit has a 'date' field
        return unitDate >= startDate && unitDate <= endDate;
      });
    };

    const filteredProductionUnits = filterByFinancialYear(validProductionUnits);
    const filteredConsumptionUnits = filterByFinancialYear(validConsumptionUnits);
    const filteredBankingUnits = filterByFinancialYear(validBankingUnits);

    // Calculate total units for production, consumption, and banking
    const totalProductionUnits = filteredProductionUnits.reduce((sum, unit) => {
      return sum + (unit.c1 || 0) + (unit.c2 || 0) + (unit.c3 || 0) + (unit.c4 || 0) + (unit.c5 || 0);
    }, 0);

    const totalConsumptionUnits = filteredConsumptionUnits.reduce((sum, unit) => {
      return sum + (unit.c1 || 0) + (unit.c2 || 0) + (unit.c3 || 0) + (unit.c4 || 0) + (unit.c5 || 0);
    }, 0);

    const totalBankingUnits = filteredBankingUnits.reduce((sum, unit) => {
      return sum + (unit.c1 || 0) + (unit.c2 || 0) + (unit.c3 || 0) + (unit.c4 || 0) + (unit.c5 || 0);
    }, 0);

    // Return the calculated data
    return {
      totalProductionUnits,
      totalConsumptionUnits,
      totalBankingUnits,
      netUnits: totalProductionUnits - totalConsumptionUnits + totalBankingUnits,
    };
  } catch (error) {
    console.error('Error calculating units data by financial year:', error);
    throw new Error('Failed to calculate units data by financial year');
  }
};