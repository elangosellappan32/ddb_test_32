import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  FormControl, InputLabel, Select, MenuItem, Switch,
  Typography, Box, Paper, CircularProgress, Alert,
  Button
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { getAccessibleSiteIds } from '../../utils/siteAccessUtils';
import {
  fetchAllProductionUnits,
  fetchAllConsumptionUnits
} from '../../utils/siteUnitApi';
import allocationService from '../../services/allocationService';
import bankingApi from '../../services/bankingApi';
import lapseApi from '../../services/lapseApi';

// Helper: Get months for a financial year (April–March)
const getFinancialYearMonths = (fy) => {
  const [startYear, endYear] = fy.split('-').map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) months.push(`${m < 10 ? '0' : ''}${m}${startYear}`);
  for (let m = 1; m <= 3; m++) months.push(`${m < 10 ? '0' : ''}${m}${endYear}`);
  return months;
};

// Sort financial year months so Apr-Dec comes before Jan-Mar
const getSortedFinancialYearMonths = (fy) => {
  const months = getFinancialYearMonths(fy);
  return months.sort((a, b) => {
    const monthA = parseInt(a.slice(0, 2));
    const monthB = parseInt(b.slice(0, 2));
    const yearA = parseInt(a.slice(2));
    const yearB = parseInt(b.slice(2));
    // Move Jan-Mar (months <4) after Apr-Dec, matching financial year
    const adjA = monthA < 4 ? monthA + 12 : monthA;
    const adjB = monthB < 4 ? monthB + 12 : monthB;
    if (yearA !== yearB) return yearA - yearB;
    return adjA - adjB;
  });
};

const formatMonthDisplay = (monthKey) => {
  if (!monthKey || monthKey.length !== 6) return monthKey;
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const m = parseInt(monthKey.slice(0, 2), 10);
  return `${monthNames[m - 1]} ${monthKey.slice(2)}`;
};

const palette = {
  production: '#2196F3',
  consumption: '#4CAF50',
  allocation: '#FFC107',
  banking: '#FF9800',
  lapse: '#F44336',
};

const GraphicalTotalReport = () => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const defaultFY = `${currentYear}-${currentYear + 1}`;
  const [financialYear, setFinancialYear] = useState(defaultFY);
  const [graphType, setGraphType] = useState('line');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);

  // Financial year dropdown options
  const fyOptions = Array.from({ length: currentYear - 2019 + 1 }, (_, i) => {
    const year = 2020 + i;
    return {
      value: `${year}-${year + 1}`,
      label: `April ${year} - March ${year + 1}`
    };
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        // Get all the site IDs first
        const [prodSiteIds, consSiteIds] = await Promise.all([
          getAccessibleSiteIds(user, 'production'),
          getAccessibleSiteIds(user, 'consumption')
        ]);

        console.log('=== Site IDs ===');
        console.log('Production Sites:', prodSiteIds);
        console.log('Consumption Sites:', consSiteIds);

        const months = getFinancialYearMonths(financialYear);
        console.log('=== Financial Year Months ===', months);

        // Initialize structure with tracking for each site
        const monthlyTotals = {};
        months.forEach(month => {
          monthlyTotals[month] = {
            monthKey: month,
            month: formatMonthDisplay(month),
            production: 0,
            consumption: 0,
            allocation: 0,
            banking: 0,
            lapse: 0,
            // Track per-site totals to avoid double counting
            siteData: new Map()
          };
        });

        // Fetch production data
        console.log('=== Fetching Production Data ===');
        for (const siteId of prodSiteIds) {
          const [companyId, prodId] = siteId.split('_');
          try {
            const { data: units } = await fetchAllProductionUnits(companyId, prodId);
            console.log(`Production Units for site ${siteId}:`, units);
            units?.forEach(unit => {
              const month = unit.sk || unit.period || unit.date;
              if (month && monthlyTotals[month]) {
                const total = ['c1', 'c2', 'c3', 'c4', 'c5']
                  .reduce((sum, key) => sum + (Number(unit[key]) || 0), 0);
                monthlyTotals[month].production += total;
              }
            });
          } catch (err) {
            console.error(`Error fetching production data for site ${siteId}:`, err);
          }
        }

        // Fetch consumption data
        console.log('=== Fetching Consumption Data ===');
        for (const siteId of consSiteIds) {
          const [companyId, consId] = siteId.split('_');
          try {
            const { data: units } = await fetchAllConsumptionUnits(companyId, consId);
            console.log(`Consumption Units for site ${siteId}:`, units);
            units?.forEach(unit => {
              const month = unit.sk || unit.period || unit.date;
              if (month && monthlyTotals[month]) {
                const total = ['c1', 'c2', 'c3', 'c4', 'c5']
                  .reduce((sum, key) => sum + (Number(unit[key]) || 0), 0);
                monthlyTotals[month].consumption += total;
              }
            });
          } catch (err) {
            console.error(`Error fetching consumption data for site ${siteId}:`, err);
          }
        }

        // Fetch allocation, banking, and lapse data for each month and site
        const fetchSpecialData = async (month, siteId) => {
          console.log(`=== Fetching Special Data for Month ${month}, Site ${siteId} ===`);
          try {
            // Format the month key consistently and extract site components
            const monthKey = month.length === 6 ? month : month.padStart(6, '0');
            const [companyId, siteNo] = siteId.split('_');
            
            console.log(`Fetching data for month ${monthKey}, company ${companyId}, site ${siteNo}`);
            
            // Fetch all data types in parallel for each site and month
            const [allocations, bankingResponse, lapseResponse] = await Promise.all([
              allocationService.fetchAllocationsByMonth(monthKey).then(data => {
                console.log(`[Allocation] Raw data for ${monthKey}:`, data);
                // Filter for current site's allocations
                return data.filter(item => 
                  item.companyId === companyId && 
                  (item.consumptionSiteId === siteNo || item.productionSiteId === siteNo)
                );
              }).catch(err => {
                console.warn(`[Allocation] Error for ${monthKey}:`, err);
                return [];
              }),
              bankingApi.fetchByPeriod(monthKey).then(response => {
                console.log(`[Banking] Raw data for ${monthKey}:`, response);
                
                // Filter banking data for the current site
                const bankingItems = (response.data || []).filter(item => {
                  // Extract and normalize site identifiers
                  const itemCompanyId = item.companyId || item.pk?.split('_')?.[0];
                  const itemSiteId = item.siteId || item.pk?.split('_')?.[1];
                  const itemProdSiteId = item.productionSiteId;
                  
                  // Normalize all site IDs by removing leading zeros and spaces
                  const normalizedItemSiteId = String(itemSiteId || '').replace(/^0+|\s+/g, '');
                  const normalizedProdSiteId = String(itemProdSiteId || '').replace(/^0+|\s+/g, '');
                  const normalizedSiteNo = String(siteNo || '').replace(/^0+|\s+/g, '');
                  
                  // Check if banking item belongs to this site
                  const siteMatches = (
                    normalizedItemSiteId === normalizedSiteNo ||
                    normalizedProdSiteId === normalizedSiteNo
                  );
                  
                  // Match company and site ID, also check if banking data is for this period
                  const periodMatches = item.period === monthKey || item.sk === monthKey;
                  const matches = itemCompanyId === companyId && siteMatches && periodMatches;
                  
                  // Enhanced logging for banking data matching
                  console.log(`[Banking] Site match check for ${siteId}:`, {
                    companyMatch: itemCompanyId === companyId,
                    siteMatch: siteMatches,
                    details: {
                      itemCompanyId,
                      companyId,
                      itemSiteId: normalizedItemSiteId,
                      itemProdSiteId: normalizedProdSiteId,
                      targetSiteId: normalizedSiteNo
                    },
                    matches,
                    bankingEnabled: item.bankingEnabled,
                    period: monthKey,
                    allocated: item.allocated,
                    totalBanking: item.totalBanking
                  });
                  
                  return matches;
                }).map(item => {
                  // Extract banking values and use totalBanking as primary value
                  const totalBanking = Number(item.totalBanking || 0);
                  
                  // Calculate final banking total using only totalBanking when enabled
                  const finalBankingTotal = item.bankingEnabled ? totalBanking : 0;
                  
                  // For reference, still keep track of category values
                  const categoryTotals = {};
                  let allocatedTotal = 0;
                  ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(key => {
                    categoryTotals[key] = Number(item[key] || 0);
                    allocatedTotal += categoryTotals[key];
                  });
                  
                  console.log(`[Banking Processing] Month ${monthKey}, Site ${siteId}:`, {
                    allocated: {
                      total: allocatedTotal,
                      categories: categoryTotals
                    },
                    banking: {
                      total: totalBanking,
                      enabled: item.bankingEnabled,
                      final: finalBankingTotal
                    },
                    period: monthKey
                  });
                  
                  return {
                    ...item,
                    ...categoryTotals,
                    bankingEnabled: item.bankingEnabled,
                    banking: finalBankingTotal,
                    total: finalBankingTotal
                  };
                });

                console.log(`[Banking] Filtered data for ${monthKey}, site ${siteId}:`, {
                  originalCount: response.data?.length || 0,
                  filteredCount: bankingItems.length,
                  items: bankingItems
                });

                return bankingItems;
              }).catch(err => {
                console.warn(`[Banking] Error for ${monthKey}:`, err);
                return [];
              }),
              lapseApi.fetchByPeriod(monthKey).then(response => {
                console.log(`[Lapse] Raw data for ${monthKey}:`, response);
                const lapseItems = (response.data || []).filter(item => {
                  // Check if this lapse record belongs to the site
                  const fullSiteId = `${companyId}_${item.productionSiteId || item.consumptionSiteId || item.siteId}`;
                  return fullSiteId === siteId;
                });
                console.log(`[Lapse] Filtered data for ${monthKey}, site ${siteId}:`, lapseItems);
                return lapseItems;
              }).catch(err => {
                console.warn(`[Lapse] Error for ${monthKey}:`, err);
                return [];
              })
            ]);

            // Process all data with better logging and consistent handling
            const processData = (items, type) => {
              return items.map(item => {
                const processed = {
                  ...item,
                  ...(item.allocated || {}), // Handle allocated data if present
                };

                // Helper function to safely convert values to numbers
                const toNumber = (val) => {
                  const num = Number(val);
                  return isNaN(num) ? 0 : num;
                };

                // Process values depending on data type
                ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(key => {
                  if (type === 'banking') {
                    // For banking, check both allocated and direct values
                    const allocatedValue = item.allocated?.[key];
                    const directValue = item[key];
                    const bankingValue = item.banking || 0;
                    
                    // Sum up all relevant values
                    processed[key] = toNumber(allocatedValue ?? directValue) + toNumber(bankingValue);
                  } else if (type === 'allocation' || type === 'lapse') {
                    const allocatedValue = item.allocated?.[key];
                    const directValue = item[key];
                    processed[key] = toNumber(allocatedValue ?? directValue);
                  }

                  // Ensure no negative values
                  processed[key] = Math.max(0, processed[key]);
                });

                // Calculate total for all types
                processed.total = ['c1', 'c2', 'c3', 'c4', 'c5']
                  .reduce((sum, key) => sum + processed[key], 0);

                return processed;
              });
            };

            // Process data per category
            const processedData = {
              allocations: processData(allocations, 'allocation'),
              bankingData: processData(bankingResponse, 'banking'),
              lapseData: processData(lapseResponse, 'lapse')
            };

            // Calculate totals and log details
            const categoryTotals = {
              allocation: processedData.allocations.reduce((sum, item) => sum + item.total, 0),
              banking: processedData.bankingData.reduce((sum, item) => sum + (item.total || 0), 0),
              lapse: processedData.lapseData.reduce((sum, item) => sum + item.total, 0)
            };

            console.log(`[GraphicalTotalReport] Processed Data for ${monthKey}, site ${siteId}:`, {
              allocations: {
                count: processedData.allocations.length,
                total: categoryTotals.allocation,
                items: processedData.allocations
              },
              banking: {
                count: processedData.bankingData.length,
                total: categoryTotals.banking,
                items: processedData.bankingData
              },
              lapse: {
                count: processedData.lapseData.length,
                total: categoryTotals.lapse,
                items: processedData.lapseData
              }
            });

            return processedData;
          } catch (err) {
            console.error(`Error fetching data for ${month}, ${siteId}:`, err);
            return { allocations: [], bankingData: [], lapseData: [] };
          }
        };

        // Process data for all months
        for (const month of months) {
              try {
            let monthTotals = { allocation: 0, banking: 0, lapse: 0 };
            
            // Fetch and process data for each site
            const siteResults = await Promise.all(prodSiteIds.map(async (siteId) => {
              const { allocations, bankingData, lapseData } = await fetchSpecialData(month, siteId);
              


              // Calculate totals per category for this site
              const siteTotals = {
                allocation: allocations.reduce((sum, item) => {
                  const allocated = item.allocated || {};
                  const total = ['c1', 'c2', 'c3', 'c4', 'c5'].reduce((t, key) => 
                    t + Number(allocated[key] || item[key] || 0), 0);
                  return sum + total;
                }, 0),
                banking: bankingData.reduce((sum, item) => {
                  // Only include banking if it's enabled
                  if (!item.bankingEnabled) {
                    console.log(`[Banking Skip] Site ${siteId}: Banking disabled`);
                    return sum;
                  }

                  // Get both allocated and total banking values
                  const allocated = item.allocated || {};
                  const totalBanking = Number(item.totalBanking || 0);
                  
                  // Use the larger of allocated total or totalBanking value
                  // Use totalBanking as the primary value for banking units
                  const bankingValue = item.bankingEnabled ? Number(totalBanking || 0) : 0;

                  // For debugging, still calculate category values
                  const categoryValues = ['c1', 'c2', 'c3', 'c4', 'c5'].map(key => {
                    const allocatedValue = Number(allocated[key] || 0);
                    const directValue = Number(item[key] || 0);
                    return Math.max(allocatedValue, directValue);
                  });
                  const categoryTotal = categoryValues.reduce((t, v) => t + v, 0);
                  
                  console.log(`[Banking Total] Site ${siteId}, Processing:`, {
                    currentSum: sum,
                    categoryValues,
                    categoryTotal,
                    totalBanking,
                    bankingValue,
                    newTotal: sum + bankingValue,
                    details: {
                      allocated,
                      enabled: item.bankingEnabled,
                      period: item.period || item.sk,
                      usedValue: 'totalBanking'
                    }
                  });
                  
                  return sum + bankingValue;
                }, 0),
                lapse: lapseData.reduce((sum, item) => {
                  const allocated = item.allocated || {};
                  return sum + ['c1', 'c2', 'c3', 'c4', 'c5'].reduce((t, key) => 
                    t + Number(allocated[key] || item[key] || 0), 0);
                }, 0)
              };

              console.log(`Site ${siteId} totals for ${month}:`, {
                allocations: {
                  count: allocations.length,
                  items: allocations,
                  total: siteTotals.allocation
                },
                banking: {
                  count: bankingData.length,
                  items: bankingData,
                  total: siteTotals.banking
                },
                lapse: {
                  count: lapseData.length,
                  items: lapseData,
                  total: siteTotals.lapse
                }
              });
              
              return siteTotals;
            }));

            // Process data per site and store in monthly structure
            siteResults.forEach((siteTotals, index) => {
              const siteId = prodSiteIds[index];
              
              // Store individual site data
              if (!monthlyTotals[month].siteData.has(siteId)) {
                monthlyTotals[month].siteData.set(siteId, {
                  allocation: 0,
                  banking: 0,
                  lapse: 0
                });
              }

              console.log(`[Processing] Site ${siteId} data for ${month}:`, siteTotals);
              
              // Update site-specific totals
              const siteData = monthlyTotals[month].siteData.get(siteId);
              siteData.allocation = siteTotals.allocation;
              siteData.banking = siteTotals.banking;
              siteData.lapse = siteTotals.lapse;
              
              // Update monthly totals
              monthTotals.allocation += siteTotals.allocation;
              monthTotals.banking += siteTotals.banking;
              monthTotals.lapse += siteTotals.lapse;

              console.log(`[Updated] Month ${month}, Site ${siteId} totals:`, {
                siteData,
                monthTotals
              });
            });

            console.log(`[Monthly Totals] ${month}:`, monthTotals);
            // Calculate and update monthly totals with validation
            const currentMonthData = monthlyTotals[month];
            const siteDataEntries = Array.from(currentMonthData.siteData.values());
            
            // Sum up all site values for this month with validation
            const monthTotal = siteDataEntries.reduce((total, site) => {
              // Ensure we have valid numbers for each category
              const allocation = Math.max(0, Number(site.allocation) || 0);
              const banking = Math.max(0, Number(site.banking) || 0);
              const lapse = Math.max(0, Number(site.lapse) || 0);
              
              console.log(`[Monthly Aggregation] Processing site data for ${month}:`, {
                siteValues: { allocation, banking, lapse },
                runningTotals: {
                  allocation: total.allocation + allocation,
                  banking: total.banking + banking,
                  lapse: total.lapse + lapse
                }
              });
              
              return {
                allocation: total.allocation + allocation,
                banking: total.banking + banking,
                lapse: total.lapse + lapse
              };
            }, { allocation: 0, banking: 0, lapse: 0 });

            // Update the monthly totals
            monthlyTotals[month] = {
              ...monthlyTotals[month],
              allocation: monthTotal.allocation,
              banking: monthTotal.banking,
              lapse: monthTotal.lapse
            };

            console.log(`[Monthly Summary] ${month}:`, {
              siteCount: currentMonthData.siteData.size,
              totals: monthTotal,
              details: Object.fromEntries(currentMonthData.siteData)
            });
          } catch (err) {
            console.error(`Error processing month ${month}:`, err);
            // Don't set error for individual months, accumulate errors
            if (!error) {
              setError('Some data could not be loaded completely. The chart may show partial data.');
            }
          }
        }

        // Calculate net values and prepare final data
        const sortedMonths = getSortedFinancialYearMonths(financialYear);
        console.log('=== Monthly Totals Before Processing ===', monthlyTotals);

        const sortedChartData = sortedMonths.map(month => {
          const monthData = monthlyTotals[month];
          console.log(`[Processing Chart Data] ${month}:`, monthData);
          
          const processedData = {
            ...monthData,
            // Ensure non-negative values and format numbers
            allocation: Math.max(0, monthData.allocation || 0),
            banking: Math.max(0, monthData.banking || 0),
            lapse: Math.max(0, monthData.lapse || 0),
          };
          
          console.log(`[Processed Chart Data] ${month}:`, processedData);
          return processedData;
        });

        console.log('=== Final Chart Data ===', sortedChartData);

        setChartData(sortedChartData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchData();
  }, [financialYear, user, error]);

  // Add a tooltip formatter for better data display
  const customTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
      const specialTotal = ['allocation', 'banking', 'lapse'].reduce((sum, key) => {
        const entry = payload.find(p => p.name === key);
        return sum + (entry?.value || 0);
      }, 0);

      return (
        <Paper sx={{ p: 2, bgcolor: 'background.paper', minWidth: 200 }}>
          <Typography variant="subtitle2" gutterBottom>{label}</Typography>
          
          {/* Regular data */}
          {payload.map(entry => (
            <Box 
              key={entry.name} 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                color: entry.color,
                mb: 0.5 
              }}
            >
              <Typography variant="body2">
                {entry.name}:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'medium', ml: 2 }}>
                {entry.value.toLocaleString()} units
              </Typography>
            </Box>
          ))}

          {/* Totals */}
          <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(0,0,0,0.12)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">Special Total:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {specialTotal.toLocaleString()} units
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Total Units:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {total.toLocaleString()} units
              </Typography>
            </Box>
          </Box>
        </Paper>
      );
    }
    return null;
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
      <Typography variant="h5" gutterBottom>
        Total Units Analysis
      </Typography>
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <FormControl sx={{ minWidth: 220 }} size="small">
          <InputLabel>Financial Year</InputLabel>
          <Select
            value={financialYear}
            label="Financial Year"
            onChange={(e) => setFinancialYear(e.target.value)}
            disabled={loading}
          >
            {fyOptions.map((fy) => (
              <MenuItem key={fy.value} value={fy.value}>{fy.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
          <Typography sx={{ mr: 1 }}>Bar</Typography>
          <Switch
            checked={graphType === 'line'}
            onChange={(e) => setGraphType(e.target.checked ? 'line' : 'bar')}
            disabled={loading}
          />
          <Typography sx={{ ml: 1 }}>Line</Typography>
        </Box>
      </Box>

      <Box sx={{ height: 500, width: '100%' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
            <Button 
              size="small" 
              onClick={() => {
                setError(null);
                setFinancialYear(financialYear); // Trigger reload
              }}
              sx={{ ml: 2 }}
            >
              Retry
            </Button>
          </Alert>
        ) : chartData.length === 0 ? (
          <Typography>No data available for the selected period</Typography>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {graphType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  angle={-45}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip content={customTooltip} />
                <Legend />
                <Line type="monotone" dataKey="production" name="Production" stroke={palette.production} strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="consumption" name="Consumption" stroke={palette.consumption} strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="allocation" name="Allocation" stroke={palette.allocation} strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="banking" name="Banking" stroke={palette.banking} strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="lapse" name="Lapse" stroke={palette.lapse} strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  angle={-45}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip content={customTooltip} />
                <Legend />
                <Bar dataKey="production" name="Production" fill={palette.production} radius={[4, 4, 0, 0]} />
                <Bar dataKey="consumption" name="Consumption" fill={palette.consumption} radius={[4, 4, 0, 0]} />
                <Bar dataKey="allocation" name="Allocation" fill={palette.allocation} radius={[4, 4, 0, 0]} />
                <Bar dataKey="banking" name="Banking" fill={palette.banking} radius={[4, 4, 0, 0]} />
                <Bar dataKey="lapse" name="Lapse" fill={palette.lapse} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </Box>
    </Paper>
  );
};

export default GraphicalTotalReport;
