import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  FormControl, InputLabel, Select, MenuItem, Switch, Typography,
  Box, Autocomplete, TextField, Paper
} from '@mui/material';
import { getAccessibleSiteIds } from '../../utils/siteAccessUtils';
import { useAuth } from '../../context/AuthContext';
import productionSiteApi from '../../services/productionSiteApi';
import consumptionSiteApi from '../../services/consumptionSiteApi';
import allocationService from '../../services/allocationService';

// Helper to make array of months for financial year: ["042024", ..., "122024", "012025",..., "032025"]
function getFinancialYearMonths(fy) {
  const [startYear, endYear] = fy.split('-').map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) months.push((m < 10 ? '0' : '') + m + String(startYear));
  for (let m = 1; m <= 3; m++) months.push((m < 10 ? '0' : '') + m + String(endYear));
  return months;
}

// Format months like "Apr FY2024", "May2024", ... "Mar2025"
function formatMonthDisplay(monthKey) {
  if (!monthKey || monthKey.length !== 6) return monthKey;
  const monthNum = parseInt(monthKey.slice(0, 2), 10) - 1; // Convert to 0-based index
  const yearNum = monthKey.slice(2);
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return `${monthNames[monthNum]} ${yearNum}`;
}

// Sort months for the financial year (April to March)
function getSortedFinancialYearMonths(fy) {
  const months = getFinancialYearMonths(fy);
  return months.sort((a, b) => {
    const monthA = parseInt(a.slice(0, 2));
    const monthB = parseInt(b.slice(0, 2));
    const yearA = parseInt(a.slice(2));
    const yearB = parseInt(b.slice(2));
    if (yearA !== yearB) return yearA - yearB;
    // April=4 should come before Jan=1 for the fiscal year
    const adjustedMonthA = monthA < 4 ? monthA + 12 : monthA;
    const adjustedMonthB = monthB < 4 ? monthB + 12 : monthB;
    return adjustedMonthA - adjustedMonthB;
  });
}

// Given a pk and site maps, get readable label
function getPairLabelFromPk(pk, prodMap, consMap) {
  const parts = pk.split('_');
  const prodId = parts.length === 3 ? parts[1] : parts[0];
  const consId = parts.length === 3 ? parts[2] : parts[1];
  const prodName = prodMap[prodId] || prodId;
  const consName = consMap[consId] || consId;
  return `${prodName} → ${consName}`;
}

const palette = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
  '#D4A5A5', '#9B786F', '#E3EAA7', '#86AFC2', '#FFD3B6'
];

const GraphicalAllocationReport = () => {
  const currentYear = new Date().getFullYear();
  const defaultFY = `${currentYear}-${currentYear + 1}`;
  const [financialYear, setFinancialYear] = useState(defaultFY);
  const [loading, setLoading] = useState(true);
  const [prodSiteMap, setProdSiteMap] = useState({});
  const [consSiteMap, setConsSiteMap] = useState({});
  const [pairDataMap, setPairDataMap] = useState({});
  const [availablePairs, setAvailablePairs] = useState([]);
  const [selectedPairs, setSelectedPairs] = useState([]);
  const [error, setError] = useState('');
  const [graphType, setGraphType] = useState('line');
  const { user } = useAuth();

  // Fetch and process allocation data
  useEffect(() => {
    setLoading(true);
    setError('');

    (async () => {
      try {
        // Get accessible site ids
        const prodIds = getAccessibleSiteIds(user, 'production');
        const consIds = getAccessibleSiteIds(user, 'consumption');
        const extractSiteId = id => (id && id.includes('_') ? id.split('_')[1] : id);
        const accessibleProdIds = prodIds.map(extractSiteId);
        const accessibleConsIds = consIds.map(extractSiteId);

        // Site info for display names
        const [prods, conss] = await Promise.all([
          productionSiteApi.fetchAll().then(r => r.data || []),
          consumptionSiteApi.fetchAll().then(r => r.data || [])
        ]);
        const prodMap = {};
        prods.forEach(s => { prodMap[String(s.productionSiteId)] = s.name || s.siteName || s.productionSiteId; });
        setProdSiteMap(prodMap);
        const consMap = {};
        conss.forEach(s => { consMap[String(s.consumptionSiteId)] = s.name || s.siteName || s.consumptionSiteId; });
        setConsSiteMap(consMap);

        const months = getFinancialYearMonths(financialYear);

        // All allocation data for the FY span
        const allocArrays = await Promise.all(
          months.map(m => allocationService.fetchAllocationsByMonth(m).catch(() => []))
        );
        let allocs = allocArrays.flat();
        allocs = allocs.map(item =>
          item && item.allocated && typeof item.allocated === 'object'
            ? { ...item, ...item.allocated }
            : item
        );

        // Filter by accessible sites
        allocs = allocs.filter(item => {
          // Handles both legacy and modern PK
          let prodId, consId;
          const pkParts = item.pk.split('_');
          if (pkParts.length === 3) {
            [, prodId, consId] = pkParts;
          } else {
            [prodId, consId] = pkParts;
          }
          return (
            (!accessibleProdIds.length || accessibleProdIds.includes(prodId)) &&
            (!accessibleConsIds.length || accessibleConsIds.includes(consId))
          );
        });

        // Create pair option list
        const pairMap = new Map();
        allocs.forEach(item => {
          const pairKey = item.pk;
          const label = getPairLabelFromPk(pairKey, prodMap, consMap);
          pairMap.set(pairKey, { key: pairKey, label });
        });

        // Map data by pair, filling zeros for missing months of FY
        const dataMap = new Map();
        pairMap.forEach((pair, pairKey) => {
          // Find all month's data for this pair
          const pairData = allocs.filter(a => a.pk === pairKey);
          const monthMap = new Map();
          pairData.forEach(u => {
            const mKey = u.sk;
            const c1 = Math.max(0, Number(u.c1) || 0);
            const c2 = Math.max(0, Number(u.c2) || 0);
            const c3 = Math.max(0, Number(u.c3) || 0);
            const c4 = Math.max(0, Number(u.c4) || 0);
            const c5 = Math.max(0, Number(u.c5) || 0);
            const total = c1 + c2 + c3 + c4 + c5;
            if (mKey && mKey.length === 6 && months.includes(mKey)) {
              monthMap.set(mKey, { sk: mKey, pairKey, c1, c2, c3, c4, c5, total });
            }
          });
          // Fill in zeros for months without data
          dataMap.set(pairKey, months.map(month => {
            return monthMap.get(month)
              || { sk: month, pairKey, c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, total: 0 };
          }));
        });

        // Provide pairs for selection, pre-select first 5 if nothing already selected
        setPairDataMap(Object.fromEntries(dataMap));
        const availablePairsList = Array.from(pairMap.values());
        setAvailablePairs(availablePairsList);

        if (!selectedPairs.length) {
          setSelectedPairs(availablePairsList.slice(0, 5));
        } else {
          // Remove any now-invalid selected pairs
          const availableKeys = new Set(availablePairsList.map(item => item.key));
          setSelectedPairs(selectedPairs.filter(pair => availableKeys.has(pair.key)));
        }
        if (availablePairsList.length === 0) {
          setError('No sites selected. Please select sites to view data.');
        }
      } catch (err) {
        setError('Failed to load allocation data. Please try again.');
      }
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [user, financialYear]); // Only reload on FY/user change

  // FY options for dropdown
  const fyOptions = [];
  for (let y = 2020; y <= currentYear; y++) {
    fyOptions.push({
      value: `${y}-${y + 1}`,
      label: `April ${y} - March ${y + 1}`
    });
  }

  // Prepare chart data array with sitenames as series
  const sortedMonths = getSortedFinancialYearMonths(financialYear);
  const chartData = sortedMonths.map(month => {
    const monthData = { month: formatMonthDisplay(month), monthKey: month };
    selectedPairs.forEach(pair => {
      const series = pairDataMap[pair.key];
      if (series) {
        const datapoint = series.find(e => e.sk === month) || {};
        // Key: <pairLabel>_cN (shows name in legend/axis)
        ['c1', 'c2', 'c3', 'c4', 'c5'].forEach((cKey) => {
          monthData[`${pair.label}_${cKey}`] = datapoint[cKey] || 0;
        });
      } else {
        ['c1', 'c2', 'c3', 'c4', 'c5'].forEach((cKey) => {
          monthData[`${pair.label}_${cKey}`] = 0;
        });
      }
    });
    return monthData;
  });

  // Series keys for rendering lines/bars
  const seriesKeys = [];
  selectedPairs.forEach((pair, i) => {
    ['c1','c2','c3','c4','c5'].forEach((c,j) => {
      seriesKeys.push({
        key: `${pair.label}_${c}`,
        pairLabel: pair.label,
        c,
        color: palette[(i*5 + j) % palette.length]
      });
    });
  });

  // Render always shows controls and chart area (like GraphicalLapseReport)
  
  return (
    <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Allocation Analysis</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, my: 2 }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Financial Year</InputLabel>
          <Select
            value={financialYear}
            onChange={e => setFinancialYear(e.target.value)}
            label="Financial Year"
          >
            {fyOptions.map(fy => (
              <MenuItem key={fy.value} value={fy.value}>{fy.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', alignItems: 'center', pl: 1 }}>
          <Typography sx={{ fontSize: 14, pr: 1 }}>Bar</Typography>
          <Switch
            checked={graphType === 'line'}
            onChange={() => setGraphType(prev => prev === 'line' ? 'bar' : 'line')}
            color="primary"
            sx={{ mx: 1 }}
          />
          <Typography sx={{ fontSize: 14, pl: 1 }}>Line</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 300 }}>
          <Autocomplete
            multiple
            options={availablePairs}
            getOptionLabel={option => option.label}
            value={availablePairs.filter(pair => selectedPairs.some(sel => sel.key === pair.key))}
            onChange={(_, vals) => setSelectedPairs(vals)}
            renderInput={params => (
              <TextField
                {...params}
                variant="outlined"
                label="Select Sites"
                size="small"
              />
            )}
            sx={{ width: '100%' }}
            disableCloseOnSelect
            isOptionEqualToValue={(option, value) => option.key === value.key}
          />
        </Box>
      </Box>

      <Box sx={{ width: '100%', height: 500 }}>
        {loading ? (
          <Typography>Loading allocation data...</Typography>
        ) : error && !availablePairs.length ? (
          <Typography >{error}</Typography>
        ) : selectedPairs.length === 0 ? (
          <Typography>No sites selected. Please select sites to view data.</Typography>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {graphType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} tick={{ fontSize: 12 }} height={70} />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => {
                    const i = name.lastIndexOf('_');
                    const pair = name.substring(0, i);
                    const cat = name.substring(i + 1);
                    return [value, `${pair} ${cat.toUpperCase()}`];
                  }}
                  labelFormatter={label => `Month: ${label}`}
                />
                <Legend
                  formatter={name => {
                    const i = name.lastIndexOf('_');
                    const pair = name.substring(0, i);
                    const cat = name.substring(i + 1);
                    return `${pair} ${cat.toUpperCase()}`;
                  }}
                />
                {seriesKeys.map(({ key, color }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} tick={{ fontSize: 12 }} height={70} />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => {
                    const i = name.lastIndexOf('_');
                    const pair = name.substring(0, i);
                    const cat = name.substring(i + 1);
                    return [value, `${pair} ${cat.toUpperCase()}`];
                  }}
                  labelFormatter={label => `Month: ${label}`}
                />
                <Legend
                  formatter={name => {
                    const i = name.lastIndexOf('_');
                    const pair = name.substring(0, i);
                    const cat = name.substring(i + 1);
                    return `${pair} ${cat.toUpperCase()}`;
                  }}
                />
                {seriesKeys.map(({ key, color }) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={color}
                    radius={[4, 4, 0, 0]}
                    stack={key.split('_')[0]}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </Box>
    </Paper>
  );
};

export default GraphicalAllocationReport;
