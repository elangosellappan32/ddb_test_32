import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  Paper
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

import productionSiteApi from '../../services/productionSiteapi';
import consumptionSiteApi from '../../services/consumptionSiteapi';
import allocationService from '../../services/allocationService';
import bankingApi from '../../services/bankingApi';
import lapseApi from '../../services/lapseApi';
import { getAccessibleSiteIds } from '../../utils/siteAccessUtils';
import { useAuth } from '../../context/AuthContext';

const palette = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
];

const getFYMonths = fy => {
  const [start, end] = fy.split('-').map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) months.push(`${m < 10 ? '0' : ''}${m}${start}`);
  for (let m = 1; m <= 3; m++) months.push(`${m < 10 ? '0' : ''}${m}${end}`);
  return months;
};
const formatMonth = key => {
  const n = parseInt(key.slice(0, 2), 10) - 1;
  const y = key.slice(2);
  return [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ][n] + '/' + y;
};

async function getSiteMaps() {
  const [prods, conss] = await Promise.all([
    productionSiteApi.fetchAll().then(res => res.data || []),
    consumptionSiteApi.fetchAll().then(res => res.data || [])
  ]);
  const prodMap = {};
  prods.forEach(s => { prodMap[String(s.productionSiteId)] = s.name || s.siteName || s.productionSiteId; });
  const consMap = {};
  conss.forEach(s => { consMap[String(s.consumptionSiteId)] = s.name || s.siteName || s.consumptionSiteId; });
  return { prodMap, consMap };
}

async function fetchCPerSiteModule(financialYear, user) {
  const months = getFYMonths(financialYear);
  const result = {}; // { [module_site]: { [month]: sum } }

  // --- Build maps for readable names ---
  const { prodMap, consMap } = await getSiteMaps();

  // --- PRODUCTION
  {
    const siteIds = getAccessibleSiteIds(user, 'production');
    const allSites = await productionSiteApi.fetchAll().then(res => res.data || []);
    for (const combinedId of siteIds) {
      const [companyId, siteId] = combinedId.split('_');
      const site = allSites.find(s =>
        String(s.productionSiteId) === String(siteId) && String(s.companyId) === String(companyId)
      );
      if (!site) continue;
      const siteLabel = `${site.name || site.productionSiteId}_production`;
      result[siteLabel] = {};
      if (site.productionUnitApi?.fetchAll) {
        const response = await site.productionUnitApi.fetchAll(companyId, siteId);
        const arr = Array.isArray(response?.data) ? response.data : [];
        months.forEach(m => result[siteLabel][m] = 0);
        arr.forEach(unit => {
          let m = unit.sk || unit.period || '';
          if (!m && unit.date) {
            const d = new Date(unit.date);
            m = `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
          }
          if (!m || !months.includes(m)) return;
          result[siteLabel][m] +=
            (Number(unit.c1) || 0) +
            (Number(unit.c2) || 0) +
            (Number(unit.c3) || 0) +
            (Number(unit.c4) || 0) +
            (Number(unit.c5) || 0);
        });
      }
    }
  }

  // --- CONSUMPTION
  {
    const siteIds = getAccessibleSiteIds(user, 'consumption');
    const allSites = await consumptionSiteApi.fetchAll().then(res => res.data || []);
    for (const combinedId of siteIds) {
      const [companyId, siteId] = combinedId.split('_');
      const site = allSites.find(s =>
        String(s.consumptionSiteId) === String(siteId) && String(s.companyId) === String(companyId)
      );
      if (!site) continue;
      const siteLabel = `${site.name || site.consumptionSiteId}_consumption`;
      result[siteLabel] = {};
      // TODO: Add your consumption units data fetch and summation here!
    }
  }

  // --- ALLOCATION: allocationService
  for (const m of months) {
    const arr = await allocationService.fetchAllocationsByMonth(m).catch(() => []);
    arr.forEach(item => {
      // PK format: prefix_prodId_consId (e.g. 'alloc_123_456')
      const parts = (item.pk || '').split('_');
      const prodId = parts[1], consId = parts[2];
      const prodName = prodMap[prodId] || prodId;
      const consName = consMap[consId] || consId;
      const allocLabel = `${prodName} \u2192 ${consName}_allocation`; // Use → unicode arrow
      if (!result[allocLabel]) result[allocLabel] = {};
      if (!result[allocLabel][m]) result[allocLabel][m] = 0;
      const d = item.allocated || item;
      result[allocLabel][m] +=
        (Number(d.c1) || 0) +
        (Number(d.c2) || 0) +
        (Number(d.c3) || 0) +
        (Number(d.c4) || 0) +
        (Number(d.c5) || 0);
    });
  }

  // --- BANKING & LAPSE (per production site)
  for (const [api, suffix] of [
    [bankingApi, 'banking'],
    [lapseApi, 'lapse']
  ]) {
    const siteIds = getAccessibleSiteIds(user, 'production');
    const allSites = await productionSiteApi.fetchAll().then(res => res.data || []);
    for (const combinedId of siteIds) {
      const [companyId, siteId] = combinedId.split('_');
      const site = allSites.find(s =>
        String(s.productionSiteId) === String(siteId) && String(s.companyId) === String(companyId)
      );
      if (!site) continue;
      const siteLabel = `${site.name || site.productionSiteId}_${suffix}`;
      result[siteLabel] = result[siteLabel] || {};
      months.forEach(m => { if (!result[siteLabel][m]) result[siteLabel][m] = 0; });
      try {
        const res = await api.fetchAllByPk(`${companyId}_${siteId}`);
        (Array.isArray(res) ? res : []).forEach(rec => {
          let m = rec.sk || (rec.date ? (() => {
            const d = new Date(rec.date);
            return `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
          })() : rec.period);
          if (!m || !months.includes(m)) return;
          const allocated = rec.allocated || rec;
          result[siteLabel][m] +=
            (Number(allocated.c1) || 0) +
            (Number(allocated.c2) || 0) +
            (Number(allocated.c3) || 0) +
            (Number(allocated.c4) || 0) +
            (Number(allocated.c5) || 0);
        });
      } catch { }
    }
  }

  return result;
}

// Filters only months (rows) where at least *one* series (site) has >0 value
function filterRowsWithData(rows, legendKeys) {
  const keys = legendKeys.map(k => k.key);
  return rows.filter(row => 
    keys.some(key => row[key] && row[key] > 0)
  );
}

const GraphicalCombinedReport = () => {
  const currentYear = new Date().getFullYear();
  const defaultFY = `${currentYear}-${currentYear + 1}`;
  const [financialYear, setFinancialYear] = useState(defaultFY);
  const [graphType, setGraphType] = useState('bar');
  const [chartData, setChartData] = useState([]);
  const [legendKeys, setLegendKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    setLoading(true);
    setError('');
    (async () => {
      try {
        const months = getFYMonths(financialYear);
        const siteData = await fetchCPerSiteModule(financialYear, user);

        // Compose 'Recharts' rows per month
        const monthlyRows = months.map(m => {
          const row = { month: formatMonth(m) };
          Object.entries(siteData).forEach(([label, values]) => {
            row[label] = values[m] || 0;
          });
          return row;
        });

        // Legend keys: all series (site_module) labels
        const labels = Object.keys(siteData);
        const legendArray = labels.map((k, i) => ({
          key: k,
          color: palette[i % palette.length]
        }));

        setLegendKeys(legendArray);

        // Only keep rows (months) with any data
        const filteredRows = filterRowsWithData(monthlyRows, legendArray);

        setChartData(filteredRows);

      } catch (e) {
        setError('Failed to load combined site data');
      }
      setLoading(false);
    })();
  }, [financialYear, user]);

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
      <Typography variant="h5" gutterBottom>
        Site-wise Monthly Combined C Values (All Modules)
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Financial Year</InputLabel>
          <Select
            value={financialYear}
            onChange={e => setFinancialYear(e.target.value)}
            label="Financial Year"
          >
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => (
              <MenuItem key={year} value={`${year}-${year + 1}`}>
                {`${year}-${(year + 1).toString().slice(-2)}`}
              </MenuItem>
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
      </Box>
      <Box sx={{ width: '100%', height: 540 }}>
        {loading
          ? <Typography>Loading data...</Typography>
          : error
            ? <Typography color="error">{error}</Typography>
            : (
              <ResponsiveContainer width="100%" height="100%">
                {graphType === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" angle={-45} tick={{ fontSize: 12 }} height={70} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {legendKeys.map(({ key, color }) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={key}
                        stroke={color}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    ))}
                  </LineChart>
                ) : (
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                    barCategoryGap={20} // tweak for spacing
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" angle={-45} tick={{ fontSize: 12 }} height={70} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {legendKeys.map(({ key, color }) => (
                      <Bar
                        key={key}
                        dataKey={key}
                        name={key}
                        fill={color}
                        radius={[4, 4, 0, 0]}
                        barSize={28}   // Improved bar width here!
                      />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            )
        }
      </Box>
    </Paper>
  );
};

export default GraphicalCombinedReport;
