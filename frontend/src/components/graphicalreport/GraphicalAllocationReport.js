import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  CircularProgress,
  Chip,
} from '@mui/material';
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

import allocationService from '../../services/allocationService';
import productionSiteApi from '../../services/productionSiteapi';
import consumptionSiteApi from '../../services/consumptionSiteapi';
import { getAccessibleSiteIds } from '../../utils/siteAccessUtils';
import { useAuth } from '../../context/AuthContext';

// -------------------- Helpers ---------------------------
const getFinancialYearMonths = (fy) => {
  if (!fy || typeof fy !== 'string' || !fy.includes('-')) return [];
  const [startYear, endYear] = fy.split('-').map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) months.push(`${m < 10 ? '0' : ''}${m}${startYear}`);
  for (let m = 1; m <= 3; m++) months.push(`${m < 10 ? '0' : ''}${m}${endYear}`);
  return months;
};
const getSortedFinancialYearMonths = getFinancialYearMonths;

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatMonthDisplay = (sk) => {
  if (!sk || sk.length !== 6) return sk;
  const m = parseInt(sk.slice(0, 2), 10) - 1;
  const y = sk.slice(2);
  const isNewFY = m + 1 === 4;
  return `${monthNames[m]}${isNewFY ? ` FY${y}` : ''}`;
};
const formatFullMonthDisplay = (sk) => {
  if (!sk || sk.length !== 6) return sk;
  const m = parseInt(sk.slice(0, 2), 10) - 1;
  const y = sk.slice(2);
  return `${monthNames[m]} ${y}`;
};
// Simple color palette
const palette = [
  '#1976d2', '#9c27b0', '#ff9800', '#4caf50', '#e91e63',
  '#ff5722', '#3f51b5', '#009688', '#f44336', '#607d8b',
];

// Helper to build readable pair name for legend/series
const getPairCode = (pair, prodSiteMap, consSiteMap) => {
  if (!pair || !pair.key) return '';
  const [, prodId, consId] = pair.key.split('_');
  const prodName = prodSiteMap[prodId] ?? prodId;
  const consName = consSiteMap[consId] ?? consId;
  return `${prodName}_${consName}`;
};

// -------------------- Main Component --------------------
const GraphicalAllocationReport = () => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const defaultFY = `${currentYear}-${currentYear + 1}`;

  const [financialYear, setFinancialYear] = useState(defaultFY);
  const [graphType, setGraphType] = useState('bar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [allocationPairs, setAllocationPairs] = useState([]);
  const [selectedPairs, setSelectedPairs] = useState([]);
  const [pairDataMap, setPairDataMap] = useState({});

  const [prodSiteMap, setProdSiteMap] = useState({});
  const [consSiteMap, setConsSiteMap] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const rawAccessibleProdIds = getAccessibleSiteIds(user, 'production');
        const rawAccessibleConsIds = getAccessibleSiteIds(user, 'consumption');
        const extractSiteId = id => (id && id.includes('_') ? id.split('_')[1] : id);
        const accessibleProdIds = rawAccessibleProdIds.map(extractSiteId);
        const accessibleConsIds = rawAccessibleConsIds.map(extractSiteId);

        const [prodResp, consResp] = await Promise.all([
          productionSiteApi.fetchAll(),
          consumptionSiteApi.fetchAll(),
        ]);
        const prodMap = {};
        prodResp.data.forEach(site => {
          prodMap[String(site.productionSiteId)] = site.name || site.siteName || site.productionSiteId;
        });
        const consMap = {};
        consResp.data.forEach(site => {
          consMap[String(site.consumptionSiteId)] = site.name || site.siteName || site.consumptionSiteId;
        });
        setProdSiteMap(prodMap);
        setConsSiteMap(consMap);

        const monthsFY = getSortedFinancialYearMonths(financialYear);
        const allocationArrays = await Promise.all(
          monthsFY.map(m => allocationService.fetchAllocationsByMonth(m).catch(() => []))
        );
        let allocationData = allocationArrays.flat();
        allocationData = allocationData.map(item =>
          item && item.allocated && typeof item.allocated === 'object'
            ? { ...item, ...item.allocated }
            : item
        );

        const filtered = allocationData.filter(item => {
          const [, prodId, consId] = item.pk.split('_');
          return (
            (!accessibleProdIds.length || accessibleProdIds.includes(prodId)) &&
            (!accessibleConsIds.length || accessibleConsIds.includes(consId))
          );
        });

        const pairMap = {};
        filtered.forEach(item => {
          const [, prodId, consId] = item.pk.split('_');
          const key = item.pk;
          if (!pairMap[key]) {
            pairMap[key] = {
              key,
              name: `${prodMap[prodId] || prodId} → ${consMap[consId] || consId}`,
            };
          }
        });
        const pairList = Object.values(pairMap);
        setAllocationPairs(pairList);
        setSelectedPairs(pairList.slice(0, 5));

        const dataByPair = {};
        filtered.forEach(item => {
          const pairKey = item.pk;
          if (!dataByPair[pairKey]) dataByPair[pairKey] = [];
          dataByPair[pairKey].push({ ...item });
        });
        setPairDataMap(dataByPair);
        setLoading(false);
      } catch (err) {
        setError(err.message || 'Failed to load allocation data');
        setLoading(false);
      }
    };
    fetchData();
  }, [financialYear, user]);

  // --------- Chart Data Preparation per pair, per C category ------------
  const chartData = useMemo(() => {
    const months = getSortedFinancialYearMonths(financialYear);
    return months.map(month => {
      const row = { month };
      selectedPairs.forEach(pair => {
        const allocations = pairDataMap[pair.key] || [];
        const alloc = allocations.find(d => d.sk === month) || {};
        ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(cKey => {
          row[`${pair.key}_${cKey}`] = Number(alloc[cKey] || 0);
        });
      });
      return row;
    });
  }, [financialYear, selectedPairs, pairDataMap]);

  if (loading) return <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress /></Box>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Paper elevation={3} sx={{ p: 3, m: 2 }}>
      <Typography variant="h5" gutterBottom>Allocation Analysis (per Site-Pair & C1–C5)</Typography>

      {/* Controls */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <FormControl>
          <InputLabel id='fy-label'>Financial Year</InputLabel>
          <Select
            labelId='fy-label'
            value={financialYear}
            label='Financial Year'
            onChange={e => setFinancialYear(e.target.value)}
          >
            {[...Array(5)].map((_, i) => {
              const fyStart = currentYear - i;
              const fy = `${fyStart}-${fyStart + 1}`;
              return <MenuItem key={fy} value={fy}>{fy}</MenuItem>;
            })}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography>Bar</Typography>
          <Switch
            checked={graphType === 'line'}
            onChange={e => setGraphType(e.target.checked ? 'line' : 'bar')}
          />
          <Typography>Line</Typography>
        </Box>
      </Box>
      <FormControl sx={{ minWidth: 300, mb: 3 }}>
        <InputLabel id='pair-label'>Allocation Pairs</InputLabel>
        <Select
          labelId='pair-label'
          multiple
          value={selectedPairs.map(p => p.key)}
          onChange={e => {
            const keys = e.target.value;
            setSelectedPairs(allocationPairs.filter(p => keys.includes(p.key)));
          }}
          label='Allocation Pairs'
          renderValue={selected => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selected.map(value => {
                const obj = allocationPairs.find(p => p.key === value);
                return <Chip key={value} label={obj?.name || value} />;
              })}
            </Box>
          )}
        >
          {allocationPairs.map(pair => (
            <MenuItem key={pair.key} value={pair.key}>{pair.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={600}>
        {graphType === 'line' ? (
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tick={{ angle: -45, fontSize: 12 }}
              tickFormatter={formatMonthDisplay}
              height={60}
            />
            <YAxis
              label={{ value: 'Allocation Units', angle: -90, position: 'insideLeft' }}
              tickFormatter={val => val.toLocaleString()}
              width={80}
            />
            <Tooltip
              formatter={(v, n) => [`${Number(v).toLocaleString()}`, n]}
              labelFormatter={sk => `Month: ${formatFullMonthDisplay(sk)}`}
            />
            <Legend />
            {selectedPairs.flatMap((pair, pIdx) =>
              ['c1', 'c2', 'c3', 'c4', 'c5'].map((cKey, cIdx) => (
                <Line
                  key={`${pair.key}_${cKey}`}
                  type="monotone"
                  dataKey={`${pair.key}_${cKey}`}
                  name={`${getPairCode(pair, prodSiteMap, consSiteMap)}_${cKey.toUpperCase()}`}
                  stroke={palette[(pIdx * 5 + cIdx) % palette.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))
            )}
          </LineChart>
        ) : (
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tick={{ angle: -45, fontSize: 12 }}
              tickFormatter={formatMonthDisplay}
              height={60}
            />
            <YAxis
              label={{ value: 'Allocation Units', angle: -90, position: 'insideLeft' }}
              tickFormatter={val => val.toLocaleString()}
              width={80}
            />
            <Tooltip
              formatter={(v, n) => [`${Number(v).toLocaleString()}`, n]}
              labelFormatter={sk => `Month: ${formatFullMonthDisplay(sk)}`}
            />
            <Legend />
            {selectedPairs.flatMap((pair, pIdx) =>
              ['c1', 'c2', 'c3', 'c4', 'c5'].map((cKey, cIdx) => (
                <Bar
                  key={`${pair.key}_${cKey}`}
                  dataKey={`${pair.key}_${cKey}`}
                  name={`${getPairCode(pair, prodSiteMap, consSiteMap)}_${cKey.toUpperCase()}`}
                  fill={palette[(pIdx * 5 + cIdx) % palette.length]}
                  barSize={20}
                />
              ))
            )}
          </BarChart>
        )}
      </ResponsiveContainer>
    </Paper>
  );
};

export default GraphicalAllocationReport;
