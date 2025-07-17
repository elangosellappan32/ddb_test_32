import React, { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAccessibleSiteIds } from '../../utils/siteAccessUtils';
import { useAuth } from '../../context/AuthContext';
import { fetchAllProductionUnits, fetchAllConsumptionUnits } from '../../utils/siteUnitApi';
import { FormControl, InputLabel, Select, MenuItem, Switch, Typography, Box, Autocomplete, TextField, Paper } from '@mui/material';
import productionSiteApi from '../../services/productionSiteapi';
import consumptionSiteApi from '../../services/consumptionSiteapi';

// Helper function to get financial year months

const getFinancialYearMonths = (fy) => {
  // fy format: '2024-2025' => months: '042024' to '032025'
  const [startYear, endYear] = fy.split('-').map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) {
    months.push((m < 10 ? '0' : '') + m + String(startYear));
  }
  for (let m = 1; m <= 3; m++) {
    months.push((m < 10 ? '0' : '') + m + String(endYear));
  }
  return months;
};

const GraphicalReport = () => {
  const currentYear = new Date().getFullYear();
  const defaultFY = `${currentYear}-${currentYear + 1}`;
  const [financialYear, setFinancialYear] = useState(defaultFY);
  const [unitType, setUnitType] = useState('production');
  const [siteDataMap, setSiteDataMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedSites, setSelectedSites] = useState([]);
  const [availableSites, setAvailableSites] = useState([]);
  const [error, setError] = useState(null);
  // const [graphType1, setGraphType1] = useState('line'); // Toggle for first pair of graphs (commented out)
  const [graphType2, setGraphType2] = useState('line'); // Toggle for second pair of graphs

  // Professional color palette with distinct colors for better visualization
  const palette = [
    '#2196F3', // Blue
    '#4CAF50', // Green
    '#FFC107', // Amber
    '#F44336', // Red
    '#9C27B0', // Purple
    '#00BCD4', // Cyan
    '#8BC34A', // Light Green
    '#FF9800', // Orange
    '#E91E63', // Pink
    '#673AB7', // Deep Purple
    '#03A9F4', // Light Blue
    '#009688', // Teal
    '#FF5722', // Deep Orange
    '#795548', // Brown
    '#607D8B'  // Blue Grey
  ];

  const { user } = useAuth();
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      const newSiteDataMap = new Map();
      const availableSitesTemp = new Map();

      try {
        const siteIds = getAccessibleSiteIds(user, unitType);
        const months = getFinancialYearMonths(financialYear);

        // Fetch all sites first
        const allSites = await (unitType === 'production' 
          ? productionSiteApi.fetchAll()
          : consumptionSiteApi.fetchAll()
        ).then(res => res.data || []);

        // Process each site
        for (const combinedId of siteIds) {
          const [companyId, siteId] = combinedId.split('_');
          
          try {
            const unitsResponse = await (unitType === 'production'
              ? fetchAllProductionUnits(companyId, siteId)
              : fetchAllConsumptionUnits(companyId, siteId)
            );

            if (!unitsResponse?.data) {
              continue;
            }

            const idField = unitType === 'production' ? 'productionSiteId' : 'consumptionSiteId';
            const siteObj = allSites.find(s => 
              String(s[idField]) === String(siteId) && 
              String(s.companyId) === String(companyId)
            );

            if (!siteObj) {
              continue;
            }

            // Create a unique key based on company and actual site ID
            const siteKey = `${siteObj.companyId}_${siteObj[idField]}`;
            
            // Skip if we already processed this site
            if (newSiteDataMap.has(siteKey)) continue;

            const processedUnits = processUnitData(unitsResponse.data, siteObj, siteKey, months);
            
            // Only add sites with actual data
            if (processedUnits.some(unit => unit.total > 0)) {
              newSiteDataMap.set(siteKey, processedUnits);
              availableSitesTemp.set(siteKey, {
                key: siteKey,
                name: siteObj.name,
                companyId: siteObj.companyId,
                [idField]: siteObj[idField],
                siteData: siteObj
              });
            }
          } catch (error) {
            // Silently handle the error and continue processing other sites
          }
        }

        if (newSiteDataMap.size === 0) {
          setError('No data available for the selected period');
        } else {
          setSiteDataMap(Object.fromEntries(newSiteDataMap));
          const availableSitesList = Array.from(availableSitesTemp.values());
          setAvailableSites(availableSitesList);
          
          // Update selected sites if none are selected or if changing unit type
          if (selectedSites.length === 0) {
            setSelectedSites(availableSitesList.slice(0, 5));
          } else {
            // Keep only valid selections when switching unit types
            const validSiteKeys = new Set(availableSitesList.map(site => site.key));
            const validSelectedSites = selectedSites.filter(site => validSiteKeys.has(site.key));
            if (validSelectedSites.length !== selectedSites.length) {
              setSelectedSites(validSelectedSites);
            }
          }
        }
      } catch (err) {
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    // Helper function to process unit data
    const processUnitData = (units, siteObj, siteKey, months) => {
      const processedUnits = new Map();
      const [companyId, siteId] = siteKey.split('_');
      
      // First, filter units that belong to this site
      const siteUnits = units.filter(unit => {
        const unitBelongsToSite = 
          String(unit.companyId) === String(companyId) && 
          String(unit.productionSiteId || unit.consumptionSiteId) === String(siteId);
        return unitBelongsToSite;
      });
      
      // Then validate and normalize the month format
      const validUnits = siteUnits.filter(unit => {
        const monthKey = unit.date || unit.sk || unit.period;
        const isValid = monthKey && monthKey.length === 6 && months.includes(monthKey);
        return isValid;
      });

      // Sort units by month to ensure chronological order
      validUnits.sort((a, b) => {
        const monthA = a.date || a.sk || a.period;
        const monthB = b.date || b.sk || b.period;
        return monthA.localeCompare(monthB);
      });

      // Process each unit and ensure proper C values
      validUnits.forEach(unit => {
        const monthKey = unit.date || unit.sk || unit.period;
        const monthNum = monthKey.slice(0, 2);
        const yearNum = monthKey.slice(2);
        
        // Calculate C values with proper validation
        const c1 = Math.max(0, Number(unit.c1) || 0);
        const c2 = Math.max(0, Number(unit.c2) || 0);
        const c3 = Math.max(0, Number(unit.c3) || 0);
        const c4 = Math.max(0, Number(unit.c4) || 0);
        const c5 = Math.max(0, Number(unit.c5) || 0);
        
        const total = c1 + c2 + c3 + c4 + c5;
        
        // Only add if there are actual values
        if (total > 0) {
          const monthData = {
            sk: monthKey,
            siteKey: siteKey,
            siteName: siteObj.name,
            companyId: siteObj.companyId,
            period: monthKey,
            month: monthNum,
            year: yearNum,
            displayMonth: `${monthNum}/${yearNum}`,
            c1, c2, c3, c4, c5,
            total
          };
          
          processedUnits.set(monthKey, monthData);
        }
      });

      // Fill in missing months with zero values
      const completeData = months.map(month => {
        const monthNum = month.slice(0, 2);
        const yearNum = month.slice(2);
        const existingData = processedUnits.get(month);
        
        if (existingData) {
          return existingData;
        }

        // Create empty data point for missing months
        const emptyData = {
          sk: month,
          siteKey: siteKey,
          siteName: siteObj.name,
          companyId: siteObj.companyId,
          period: month,
          month: monthNum,
          year: yearNum,
          displayMonth: `${monthNum}/${yearNum}`,
          c1: 0, c2: 0, c3: 0, c4: 0, c5: 0,
          total: 0
        };
        return emptyData;
      });

      return completeData;
    };

    if (user) {
      loadData();
    }
  }, [user, financialYear, unitType, selectedSites]);

  // Financial year options (from 1950 to current year)
  const fyOptions = [];
  for (let y = 1950; y <= currentYear; y++) {
    fyOptions.push({
      value: `${y}-${y + 1}`,
      label: `April ${y} - March ${y + 1}`
    });
  }

  // Helper function to format months for display
  const formatMonthDisplay = (monthKey, showYear = true) => {
    if (!monthKey || monthKey.length !== 6) return monthKey;
    const monthNum = parseInt(monthKey.slice(0, 2), 10);
    const yearNum = monthKey.slice(2);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = monthNum - 1;
    const isNewFY = monthNum === 4; // April marks the start of FY
    return showYear 
      ? `${monthNames[monthIdx]}${isNewFY ? ` FY${yearNum}` : ''}`
      : monthNames[monthIdx];
  };

  // Helper function to format full month names
  const formatFullMonthDisplay = (monthKey) => {
    if (!monthKey || monthKey.length !== 6) return monthKey;
    const monthNum = parseInt(monthKey.slice(0, 2), 10);
    const yearNum = monthKey.slice(2);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthIdx = monthNum - 1;
    return `${monthNames[monthIdx]} ${yearNum}`;
  };

  // Helper function to get sorted months for the financial year
  const getSortedFinancialYearMonths = (fy) => {
    const months = getFinancialYearMonths(fy);
    // Sort chronologically within the financial year
    return months.sort((a, b) => {
      const monthA = parseInt(a.slice(0, 2));
      const monthB = parseInt(b.slice(0, 2));
      const yearA = parseInt(a.slice(2));
      const yearB = parseInt(b.slice(2));
      
      if (yearA !== yearB) return yearA - yearB;
      
      // Adjust month comparison for financial year (April = 1, March = 12)
      const adjustedMonthA = monthA < 4 ? monthA + 12 : monthA;
      const adjustedMonthB = monthB < 4 ? monthB + 12 : monthB;
      return adjustedMonthA - adjustedMonthB;
    });
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading graphical report...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3, m: 2 }}>
      <Typography variant="h5" gutterBottom>
        {unitType === 'production' ? 'Production' : 'Consumption'} Units Analysis
      </Typography>
      
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <FormControl sx={{ minWidth: 220 }} size="small">
          <InputLabel>Financial Year</InputLabel>
          <Select 
            value={financialYear} 
            label="Financial Year" 
            onChange={e => setFinancialYear(e.target.value)}
          >
            {fyOptions.map(fy => (
              <MenuItem key={fy.value} value={fy.value}>{fy.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ mr: 1 }}>Production</Typography>
          <Switch 
            checked={unitType === 'consumption'} 
            onChange={e => setUnitType(e.target.checked ? 'consumption' : 'production')}
          />
          <Typography sx={{ ml: 1 }}>Consumption</Typography>
        </Box>

        <Autocomplete
          multiple
          id="site-selector"
          options={availableSites}
          value={selectedSites}
          onChange={(_, newValue) => setSelectedSites(newValue)}
          getOptionLabel={option => option.name}
          isOptionEqualToValue={(option, value) => option.key === value.key}
          renderOption={(props, option) => (
            <li {...props} key={option.key}>
              {option.name}
            </li>
          )}
          renderInput={params => (
            <TextField
              {...params}
              variant="outlined"
              label="Select Sites"
              size="small"
              sx={{ minWidth: 300 }}
            />
          )}
          sx={{ flexGrow: 1 }}
          ListboxProps={{
            style: { maxHeight: '200px' }
          }}
        />
      </Box>

      {/* First pair of graphs - Temporarily commented out
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Total C Values by Site</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography sx={{ mr: 1 }}>Bar</Typography>
            <Switch
              checked={graphType1 === 'line'}
              onChange={(e) => setGraphType1(e.target.checked ? 'line' : 'bar')}
            />
            <Typography sx={{ ml: 1 }}>Line</Typography>
          </Box>
        </Box>
        
        <ResponsiveContainer width="100%" height={400}>
          {graphType1 === 'line' ? (
            <LineChart 
              margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
              data={(() => {
                const sortedMonths = getSortedFinancialYearMonths(financialYear);
                return sortedMonths.map(month => {
                  const monthData = { sk: month };
                  selectedSites.forEach(site => {
                    const siteData = siteDataMap[site.key];
                    if (!siteData) return;
                    const data = siteData.find(d => d.sk === month);
                    if (data) {
                      monthData[`${site.key}_total`] = data.total;
                    }
                  });
                  return monthData;
                });
              })()}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="sk" 
                tickFormatter={sk => formatMonthDisplay(sk)}
                height={60}
                tick={{ angle: -45 }}
              />
              <YAxis label={{ value: 'Total C Value', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                labelFormatter={sk => formatFullMonthDisplay(sk)}
                formatter={(value, name) => [Number(value).toFixed(2), name.split('_')[0]]}
              />
              <Legend />
              {selectedSites.map((site, index) => (
                <Line
                  key={site.key}
                  dataKey={`${site.key}_total`}
                  name={site.name}
                  stroke={palette[index % palette.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart
              margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
              data={(() => {
                const sortedMonths = getSortedFinancialYearMonths(financialYear);
                return sortedMonths.map(month => {
                  const monthData = { sk: month };
                  selectedSites.forEach(site => {
                    const siteData = siteDataMap[site.key];
                    if (!siteData) return;
                    const data = siteData.find(d => d.sk === month);
                    if (data) {
                      monthData[`${site.key}_total`] = data.total;
                    }
                  });
                  return monthData;
                });
              })()}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="sk" 
                tickFormatter={sk => formatMonthDisplay(sk)}
                height={60}
                tick={{ angle: -45 }}
              />
              <YAxis label={{ value: 'Total C Value', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                labelFormatter={sk => formatFullMonthDisplay(sk)}
                formatter={(value, name) => [Number(value).toFixed(2), name.split('_')[0]]}
              />
              <Legend />
              {selectedSites.map((site, index) => (
                <Bar
                  key={site.key}
                  dataKey={`${site.key}_total`}
                  name={site.name}
                  fill={palette[index % palette.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </Box>
      */}

      {/* Second pair of graphs */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">C1-C5 Values by Site</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography sx={{ mr: 1 }}>Bar</Typography>
            <Switch
              checked={graphType2 === 'line'}
              onChange={(e) => setGraphType2(e.target.checked ? 'line' : 'bar')}
            />
            <Typography sx={{ ml: 1 }}>Line</Typography>
          </Box>
        </Box>

        <ResponsiveContainer width="100%" height={600}>
          {graphType2 === 'line' ? (
            <LineChart 
              margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
              data={(() => {
                const sortedMonths = getSortedFinancialYearMonths(financialYear);
                return sortedMonths.map(month => {
                  const monthData = { sk: month };
                  selectedSites.forEach(site => {
                    const siteData = siteDataMap[site.key];
                    if (!siteData) return;
                    const data = siteData.find(d => d.sk === month);
                    if (data) {
                      ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(cKey => {
                        monthData[`${site.key}_${cKey}`] = data[cKey];
                      });
                    }
                  });
                  return monthData;
                });
              })()}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="sk" 
                tickFormatter={sk => formatMonthDisplay(sk)}
                height={60}
                tick={{ angle: -45 }}
              />
              <YAxis label={{ value: 'C Values', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                labelFormatter={sk => formatFullMonthDisplay(sk)}
                formatter={(value, name) => {
                  const [siteName, cValue] = name.split(' - ');
                  return [Number(value).toFixed(2), `${siteName} ${cValue}`];
                }}
              />
              <Legend />
              {selectedSites.map((site, siteIndex) => (
                ['c1', 'c2', 'c3', 'c4', 'c5'].map((cKey, cIndex) => (
                  <Line
                    key={`${site.key}_${cKey}`}
                    dataKey={`${site.key}_${cKey}`}
                    name={`${site.name} - ${cKey.toUpperCase()}`}
                    stroke={palette[(siteIndex * 5 + cIndex) % palette.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                ))
              ))}
            </LineChart>
          ) : (
            <BarChart
              margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
              data={(() => {
                const sortedMonths = getSortedFinancialYearMonths(financialYear);
                const combinedData = [];

                sortedMonths.forEach(month => {
                  const monthData = {
                    sk: month,
                    month: month.slice(0, 2),
                    year: month.slice(2),
                    displayMonth: formatMonthDisplay(month, true)
                  };

                  let hasData = false;
                  selectedSites.forEach(site => {
                    const siteData = siteDataMap[site.key];
                    if (!siteData || !Array.isArray(siteData)) return;

                    const siteMonthData = siteData.find(d => d.sk === month);
                    if (siteMonthData) {
                      ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(cKey => {
                        monthData[`${site.key}_${cKey}`] = siteMonthData[cKey];
                        if (siteMonthData[cKey] > 0) hasData = true;
                      });
                    }
                  });

                  if (hasData) {
                    combinedData.push(monthData);
                  }
                });

                return combinedData;
              })()}
              barGap={5}
              barCategoryGap={30}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="sk"
                tickFormatter={sk => formatMonthDisplay(sk)}
                interval={0}
                angle={-30}
                height={80}
              />
              <YAxis label={{ value: 'C Values', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                labelFormatter={sk => formatFullMonthDisplay(sk)}
                formatter={(value, name) => {
                  const [siteName, cValue] = name.split(' - ');
                  return [Number(value).toFixed(2), `${siteName} ${cValue}`];
                }}
              />
              <Legend />
              {selectedSites.map((site, siteIndex) => (
                ['c1', 'c2', 'c3', 'c4', 'c5'].map((cKey, cIndex) => (
                  <Bar
                    key={`${site.key}_${cKey}`}
                    dataKey={`${site.key}_${cKey}`}
                    name={`${site.name} - ${cKey.toUpperCase()}`}
                    fill={palette[(siteIndex * 5 + cIndex) % palette.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default GraphicalReport;
