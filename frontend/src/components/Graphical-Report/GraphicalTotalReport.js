import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  FormControl, InputLabel, Select, MenuItem, Switch, Typography,
  Box, Paper, CircularProgress, Alert
} from '@mui/material';
import { getAccessibleSiteIds } from '../../utils/siteAccessUtils';
import { useAuth } from '../../context/AuthContext';
import productionSiteApi from '../../services/productionSiteApi';
import lapseApi from '../../services/lapseApi';
import bankingApi from '../../services/bankingApi';
import allocationService from '../../services/allocationService';
import { fetchAllProductionUnits, fetchAllConsumptionUnits } from '../../utils/siteUnitApi';

// Helper: generate months for financial year Apr–Mar (e.g., "042024")
function getFinancialYearMonths(fy) {
  const [start, end] = fy.split('-').map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) months.push(`${m < 10 ? '0' : ''}${m}${start}`);
  for (let m = 1; m <= 3; m++) months.push(`${m < 10 ? '0' : ''}${m}${end}`);
  return months;
}

// Format month keys like "042024" to "Apr 2024"
function formatMonthDisplay(monthKey) {
  if (!monthKey || monthKey.length !== 6) return monthKey;
  const monthNum = parseInt(monthKey.slice(0, 2), 10);
  const yearNum = monthKey.slice(2);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[monthNum - 1]} ${yearNum}`;
}

// Process banking data into monthly totals
function processBankingTotals(bankingData, months) {
  const monthlyTotals = {};
  months.forEach(month => monthlyTotals[month] = 0);
  (bankingData || []).forEach(record => {
    let month = record.sk || record.period;
    if (!month && record.date) {
      const d = new Date(record.date);
      month = `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
    }
    if (!month || !(month in monthlyTotals)) return;
    if (record.bankingEnabled) {
      monthlyTotals[month] += Math.max(0, Number(record.totalBanking) || 0);
    }
  });
  return monthlyTotals;
}

// Process lapse data into monthly totals
function processLapseData(lapseData, months) {
  const monthlyTotals = {};
  months.forEach(m => monthlyTotals[m] = 0);
  (lapseData || []).forEach(record => {
    let month = record.sk || record.period;
    if (!month && record.date) {
      const d = new Date(record.date);
      month = `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
    }
    if (!month || !(month in monthlyTotals)) return;
    const allocated = record.allocated || record;
    monthlyTotals[month] += ['c1','c2','c3','c4','c5']
      .reduce((sum, key) => sum + Math.max(0, Number(allocated[key] || 0)), 0);
  });
  return monthlyTotals;
}

// Color palette for chart lines/bars
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
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Financial year options labeled like "April 2024 - March 2025"
  const fyOptions = [];
  for (let y = 2020; y <= currentYear; y++) {
    fyOptions.push({
      value: `${y}-${y + 1}`,
      label: `April ${y} - March ${y + 1}`
    });
  }

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const months = getFinancialYearMonths(financialYear);
        const totals = {};
        months.forEach(m => {
          totals[m] = { production: 0, consumption: 0, allocation: 0, banking: 0, lapse: 0 };
        });

        // Get accessible site IDs
        const [prodSiteIds, consSiteIds] = await Promise.all([
          getAccessibleSiteIds(user, 'production'),
          getAccessibleSiteIds(user, 'consumption')
        ]);
        const allSitesResponse = await productionSiteApi.fetchAll();
        const allSites = allSitesResponse.data || [];

        // Fetch production units totals
        for (const siteId of prodSiteIds) {
          const [companyId, pid] = siteId.split('_');
          try {
            const { data } = await fetchAllProductionUnits(companyId, pid);
            (data || []).forEach(unit => {
              const m = unit.sk || unit.period || unit.date;
              if (m && totals[m]) {
                totals[m].production += ['c1','c2','c3','c4','c5']
                  .reduce((sum, k) => sum + (Number(unit[k]) || 0), 0);
              }
            });
          } catch {}
        }

        // Fetch consumption units totals
        for (const siteId of consSiteIds) {
          const [companyId, cid] = siteId.split('_');
          try {
            const { data } = await fetchAllConsumptionUnits(companyId, cid);
            (data || []).forEach(unit => {
              const m = unit.sk || unit.period || unit.date;
              if (m && totals[m]) {
                totals[m].consumption += ['c1','c2','c3','c4','c5']
                  .reduce((sum, k) => sum + (Number(unit[k]) || 0), 0);
              }
            });
          } catch {}
        }

        // Fetch allocation totals per month
        for (const month of months) {
          try {
            const allocs = await allocationService.fetchAllocationsByMonth(month);
            (allocs || []).forEach(item => {
              const allocated = item.allocated || item;
              totals[month].allocation += ['c1','c2','c3','c4','c5']
                .reduce((sum, k) => sum + (Number(allocated[k]) || 0), 0);
            });
          } catch {}
        }

        // Fetch and aggregate banking data by site and month
        for (const siteId of prodSiteIds) {
          const [companyId, pid] = siteId.split('_');
          const siteObj = allSites.find(s =>
            String(s.productionSiteId) === String(pid) && String(s.companyId) === String(companyId)
          );
          if (!siteObj) continue;
          try {
            const bankingData = await bankingApi.fetchAllByPk(`${siteObj.companyId}_${siteObj.productionSiteId}`);
            const siteMonthly = processBankingTotals(Array.isArray(bankingData) ? bankingData : [], months);
            months.forEach(m => { totals[m].banking += siteMonthly[m]; });
          } catch {}
        }

        // Fetch and aggregate lapse data by site and month
        for (const siteId of prodSiteIds) {
          const [companyId, pid] = siteId.split('_');
          const siteObj = allSites.find(s =>
            String(s.productionSiteId) === String(pid) && String(s.companyId) === String(companyId)
          );
          if (!siteObj) continue;
          try {
            const lapseData = await lapseApi.fetchAllByPk(`${siteObj.companyId}_${siteObj.productionSiteId}`);
            const siteMonthly = processLapseData(Array.isArray(lapseData) ? lapseData : [], months);
            months.forEach(m => { totals[m].lapse += siteMonthly[m]; });
          } catch {}
        }

        // Prepare data for charts
        const rows = months.map(m => ({
          month: formatMonthDisplay(m),
          ...totals[m]
        }));

        setChartData(rows);
        if (rows.every(r => Object.values(r).every(v => v === 0))) {
          setError('No data available for the selected period');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load total report data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [financialYear, user]);

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
      <Typography variant="h5" gutterBottom>Total Units Analysis</Typography>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <FormControl sx={{ minWidth: 220 }} size="small">
          <InputLabel>Financial Year</InputLabel>
          <Select
            value={financialYear}
            onChange={e => setFinancialYear(e.target.value)}
            disabled={loading}
          >
            {fyOptions.map(fy => (
              <MenuItem key={fy.value} value={fy.value}>
                {fy.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography>Bar</Typography>
          <Switch
            checked={graphType === 'line'}
            onChange={() => setGraphType(prev => prev === 'line' ? 'bar' : 'line')}
            disabled={loading}
            sx={{ mx: 1 }}
          />
          <Typography>Line</Typography>
        </Box>
      </Box>

      <Box sx={{ height: 500 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : chartData.length === 0 ? (
          <Typography>No data available for the selected period.</Typography>
        ) : graphType === 'line' ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" angle={-45} height={70} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="production" stroke={palette.production} />
              <Line type="monotone" dataKey="consumption" stroke={palette.consumption} />
              <Line type="monotone" dataKey="allocation" stroke={palette.allocation} />
              <Line type="monotone" dataKey="banking" stroke={palette.banking} />
              <Line type="monotone" dataKey="lapse" stroke={palette.lapse} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" angle={-45} height={70} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="production" fill={palette.production} />
              <Bar dataKey="consumption" fill={palette.consumption} />
              <Bar dataKey="allocation" fill={palette.allocation} />
              <Bar dataKey="banking" fill={palette.banking} />
              <Bar dataKey="lapse" fill={palette.lapse} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Paper>
  );
};

export default GraphicalTotalReport;
