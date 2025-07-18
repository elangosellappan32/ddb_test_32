import React, { useEffect, useState } from 'react';
import {
  BarChart, LineChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Paper, Typography, Switch, Box, FormControl, InputLabel, Select, MenuItem,
  Autocomplete, TextField,
} from '@mui/material';

import productionSiteApi from '../../services/productionSiteapi';
import { getAccessibleSiteIds } from '../../utils/siteAccessUtils';
import { useAuth } from '../../context/AuthContext';
import { fetchAllProductionUnits } from '../../utils/siteUnitApi'; // ✅ Same logic used in production report

// Chart color palette
const palette = [
  '#2196F3', '#4CAF50', '#FFC107', '#F44336', '#9C27B0',
  '#00BCD4', '#8BC34A', '#FF9800', '#E91E63', '#673AB7'
];

// 📌 Financial year month strings
const getFinancialYearMonths = (fy) => {
  const [start, end] = fy.split('-').map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) months.push(`${m < 10 ? '0' : ''}${m}${start}`);
  for (let m = 1; m <= 3; m++) months.push(`${m < 10 ? '0' : ''}${m}${end}`);
  return months;
};

const formatMonthForDisplay = (monthKey) => {
  if (!monthKey || monthKey.length !== 6) return monthKey;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNumber = parseInt(monthKey.slice(0, 2), 10);
  const year = monthKey.slice(2);
  return `${names[monthNumber - 1]} ${year}`;
};

const GraphicalCombinedReport = () => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const defaultFY = `${currentYear}-${currentYear + 1}`;

  const [financialYear, setFinancialYear] = useState(defaultFY);
  const [siteDataMap, setSiteDataMap] = useState({});
  const [selectedSites, setSelectedSites] = useState([]);
  const [availableSites, setAvailableSites] = useState([]);
  const [graphType, setGraphType] = useState('line');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const months = getFinancialYearMonths(financialYear);
  const fyOptions = Array.from({ length: currentYear - 2019 + 1 }).map((_, i) => {
    const year = 2020 + i;
    return { value: `${year}-${year + 1}`, label: `April ${year} - March ${year + 1}` };
  });

  useEffect(() => {
    const loadProductionData = async () => {
      setLoading(true);
      setError(null);
      const newSiteDataMap = new Map();
      const allowedSiteIds = getAccessibleSiteIds(user, 'production');
      const allSites = await productionSiteApi.fetchAll().then(res => res.data || []);
      
      const availableSitesTemp = [];

      try {
        for (const siteCombo of allowedSiteIds) {
          const [companyId, siteId] = siteCombo.split('_');
          const siteObj = allSites.find(s =>
            String(s.productionSiteId) === String(siteId) &&
            String(s.companyId) === String(companyId)
          );
          if (!siteObj) continue;

          const siteKey = `${companyId}_${siteId}`;
          const siteName = siteObj.name || `Site ${siteId}`;
          const unitsRes = await fetchAllProductionUnits(companyId, siteId);
          const units = unitsRes?.data || [];

          const monthlyData = processProductionUnits(units, months, siteName);
          if (monthlyData.some(d => d.total > 0)) {
            newSiteDataMap.set(siteKey, { name: siteName, data: monthlyData });
            availableSitesTemp.push({ key: siteKey, name: siteName });
          }
        }

        setSiteDataMap(Object.fromEntries(newSiteDataMap));
        setAvailableSites(availableSitesTemp);

        // Default selection
        if (selectedSites.length === 0) setSelectedSites(availableSitesTemp.slice(0, 3));
      } catch (err) {
        console.error('Failed to load production data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (user) loadProductionData();
  }, [user, financialYear]);

  const processProductionUnits = (units, months, siteLabel) => {
    const dataPerMonth = {};
    units.forEach(unit => {
      const month = unit.date || unit.period || unit.sk;
      if (!months.includes(month)) return;
      if (!dataPerMonth[month]) {
        dataPerMonth[month] = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 };
      }
      dataPerMonth[month].c1 += Number(unit.c1) || 0;
      dataPerMonth[month].c2 += Number(unit.c2) || 0;
      dataPerMonth[month].c3 += Number(unit.c3) || 0;
      dataPerMonth[month].c4 += Number(unit.c4) || 0;
      dataPerMonth[month].c5 += Number(unit.c5) || 0;
    });

    return months.map(month => {
      const entry = dataPerMonth[month] || {};
      return {
        sk: month,
        site: siteLabel,
        c1: entry.c1 || 0,
        c2: entry.c2 || 0,
        c3: entry.c3 || 0,
        c4: entry.c4 || 0,
        c5: entry.c5 || 0,
        total: (entry.c1 || 0) + (entry.c2 || 0) + (entry.c3 || 0) + (entry.c4 || 0) + (entry.c5 || 0)
      };
    });
  };

  const chartData = months.map(month => {
    const row = { month: formatMonthForDisplay(month) };
    selectedSites.forEach(site => {
      const siteInfo = siteDataMap[site.key];
      if (!siteInfo) return;
      const dataForMonth = siteInfo.data.find(d => d.sk === month);
      ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(c => {
        row[`${site.name}_${c}`] = dataForMonth ? dataForMonth[c] : 0;
      });
    });
    return row;
  });

  // UI
  if (loading) return <Typography sx={{ p: 3 }}>Loading combined report...</Typography>;
  if (error) return <Typography color="error" sx={{ p: 3 }}>{error}</Typography>;

  return (
    <Paper elevation={3} sx={{ p: 3, m: 2 }}>
      <Typography variant="h5" gutterBottom>Combined Production C1–C5 Chart</Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 3 }}>
        <FormControl sx={{ minWidth: 220 }} size="small">
          <InputLabel>Financial Year</InputLabel>
          <Select value={financialYear} onChange={e => setFinancialYear(e.target.value)}>
            {fyOptions.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', alignItems: 'center', mx: 2 }}>
          <Typography>Bar</Typography>
          <Switch
            checked={graphType === 'line'}
            onChange={() => setGraphType(prev => prev === 'bar' ? 'line' : 'bar')}
          />
          <Typography>Line</Typography>
        </Box>

        <Autocomplete
          multiple
          size="small"
          id="site-autocomplete"
          options={availableSites}
          value={selectedSites}
          getOptionLabel={opt => opt.name}
          isOptionEqualToValue={(o1, o2) => o1.key === o2.key}
          onChange={(_, val) => setSelectedSites(val)}
          renderInput={(params) => <TextField {...params} label="Select Sites" />}
          sx={{ minWidth: 300 }}
        />
      </Box>

      <Box sx={{ height: 500 }}>
        <ResponsiveContainer width="100%" height="100%">
          {
            graphType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 20, right: 30, bottom: 50 }}>
                <CartesianGrid />
                <XAxis dataKey="month" angle={-45} height={70} tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                {selectedSites.flatMap((site, siteIndex) =>
                  ['c1', 'c2', 'c3', 'c4', 'c5'].map((cKey, idx) => (
                    <Line
                      key={`${site.name}_${cKey}`}
                      dataKey={`${site.name}_${cKey}`}
                      name={`${site.name} ${cKey.toUpperCase()}`}
                      stroke={palette[(siteIndex * 5 + idx) % palette.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  ))
                )}
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 20, right: 30, bottom: 50 }}>
                <CartesianGrid />
                <XAxis dataKey="month" angle={-45} height={70} tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                {selectedSites.flatMap((site, siteIndex) =>
                  ['c1', 'c2', 'c3', 'c4', 'c5'].map((cKey, idx) => (
                    <Bar
                      key={`${site.name}_${cKey}`}
                      dataKey={`${site.name}_${cKey}`}
                      name={`${site.name} ${cKey.toUpperCase()}`}
                      fill={palette[(siteIndex * 5 + idx) % palette.length]}
                      stackId={site.key}
                    />
                  ))
                )}
              </BarChart>
            )
          }
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default GraphicalCombinedReport;
