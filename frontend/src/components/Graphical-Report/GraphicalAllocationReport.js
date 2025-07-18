import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { getAccessibleSiteIds } from '../../utils/siteAccessUtils';
import { useAuth } from '../../context/AuthContext';
import productionSiteApi from '../../services/productionSiteapi';
import consumptionSiteApi from '../../services/consumptionSiteapi';
import allocationService from '../../services/allocationService';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  Typography,
  Box,
  Autocomplete,
  TextField,
  Paper,
} from '@mui/material';

// HELPER: Build Financial Year months in MMYYYY order (April-March)
const getFinancialYearMonths = (fy) => {
  const [startYear, endYear] = fy.split('-').map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) months.push(`${m < 10 ? '0' : ''}${m}${startYear}`);
  for (let m = 1; m <= 3; m++) months.push(`${m < 10 ? '0' : ''}${m}${endYear}`);
  return months;
};

// HELPER: Month label for x-axis and tooltips
const formatMonthDisplay = (monthKey) => {
  if (!monthKey || monthKey.length !== 6) return monthKey;
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const m = parseInt(monthKey.slice(0, 2), 10) - 1;
  const y = monthKey.slice(2);
  const isFYStart = m === 3; // April
  return `${monthNames[m]}${isFYStart ? ` FY${y}` : ''}`;
};

const getSortedFinancialYearMonths = (fy) => {
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
};

// HELPER: Given a pk and site maps, get readable label
function getPairLabelFromPk(pk, prodMap, consMap) {
  const parts = pk.split('_');
  // Accepts either 'pair_prodId_consId' (from allocation) or 'prodId_consId'
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

  const [pairDataMap, setPairDataMap] = useState({});   // { [pairKey]: [ {sk, ..., c1, ...} ... ] }
  const [availablePairs, setAvailablePairs] = useState([]);
  const [selectedPairs, setSelectedPairs] = useState([]);
  const [error, setError] = useState(null);
  const [graphType, setGraphType] = useState('line');
  const { user } = useAuth();

  // Fetch and process allocation data
  useEffect(() => {
    setLoading(true);
    setError(null);

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
          const [, prodId, consId] = item.pk.split('_');
          return (
            (!accessibleProdIds.length || accessibleProdIds.includes(prodId)) &&
            (!accessibleConsIds.length || accessibleConsIds.includes(consId))
          );
        });

        // Create pair option list, mapping keys to human readable names
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

        // Provide pairs for Autocomplete/selection, pre-select first 5 if nothing is already selected
        setPairDataMap(Object.fromEntries(dataMap));
        const availablePairsList = Array.from(pairMap.values());
        setAvailablePairs(availablePairsList);

        if (selectedPairs.length === 0) {
          setSelectedPairs(availablePairsList.slice(0, 5));
        } else {
          // Remove any now-invalid selected pairs
          const availableKeys = new Set(availablePairsList.map(item => item.key));
          setSelectedPairs(selectedPairs.filter(pair => availableKeys.has(pair.key)));
        }

        if (availablePairsList.length === 0) {
          setError('No allocation data available for the selected period');
        }
      } catch (err) {
        setError('Failed to load allocation data. Please try again.');
      }
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [user, financialYear]); // Only reload on FY/user change

  // Prepare FY options for dropdown
  const fyOptions = [];
  for (let y = 2020; y <= currentYear; y++) {
    fyOptions.push({
      value: `${y}-${y + 1}`,
      label: `April ${y} - March ${y + 1}`
    });
  }

  // Prepare Recharts data array with sitenames as series
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

  // Handle Loading & Error
  if (loading)
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading allocation report...</Typography>
      </Box>
    );
  if (error)
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );

  return (
    <Paper elevation={3} sx={{ p: 3, m: 2 }}>
      <Typography variant="h5" gutterBottom>
        Allocation Analysis (C1–C5 Values)
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

        <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
          <Typography sx={{ mr: 1 }}>Bar</Typography>
          <Switch
            checked={graphType === 'line'}
            onChange={e => setGraphType(e.target.checked ? 'line' : 'bar')}
          />
          <Typography sx={{ ml: 1 }}>Line</Typography>
        </Box>

        <Autocomplete
          multiple
          id="pair-selector"
          options={availablePairs}
          value={selectedPairs}
          onChange={(_, newValue) => setSelectedPairs(newValue)}
          getOptionLabel={option => option.label}
          isOptionEqualToValue={(option, value) => option.key === value.key}
          renderOption={(props, option) => (
            <li {...props} key={option.key}>
              {option.label}
            </li>
          )}
          renderInput={params => (
            <TextField
              {...params}
              variant="outlined"
              label="Select Allocation Pairs"
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

      <Box sx={{ height: 500 }}>
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
              <Tooltip />
              <Legend />
              {selectedPairs.flatMap((pair, pairIdx) =>
                ['c1', 'c2', 'c3', 'c4', 'c5'].map((cKey, cIdx) => (
                  <Line
                    key={`${pair.key}_${cKey}`}
                    type="monotone"
                    dataKey={`${pair.label}_${cKey}`}
                    name={`${pair.label} ${cKey.toUpperCase()}`}
                    stroke={palette[(pairIdx * 5 + cIdx) % palette.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                ))
              )}
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
              <Tooltip />
              <Legend />
              {selectedPairs.flatMap((pair, pairIdx) =>
                ['c1', 'c2', 'c3', 'c4', 'c5'].map((cKey, cIdx) => (
                  <Bar
                    key={`${pair.key}_${cKey}`}
                    dataKey={`${pair.label}_${cKey}`}
                    name={`${pair.label} ${cKey.toUpperCase()}`}
                    fill={palette[(pairIdx * 5 + cIdx) % palette.length]}
                    radius={[4, 4, 0, 0]}
                    stack={pair.key}
                  />
                ))
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default GraphicalAllocationReport;
