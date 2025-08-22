import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { getAccessibleSiteIds } from '../../utils/siteAccessUtils';
import { useAuth } from '../../context/AuthContext';
import {
  FormControl, InputLabel, Select, MenuItem, Switch, Typography,
  Box, Autocomplete, TextField, Paper
} from '@mui/material';
import productionSiteApi from '../../services/productionSiteApi';
import lapseApi from '../../services/lapseApi';

// Get months from April of start year to March of next year
function getFinancialYearMonths(fy) {
  const [startYear, endYear] = fy.split('-').map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) months.push((m < 10 ? '0' : '') + m + startYear);
  for (let m = 1; m <= 3; m++) months.push((m < 10 ? '0' : '') + m + endYear);
  return months;
}

// Format months like "Apr 2024", "May 2024", ... "Mar 2025"
function formatMonthDisplay(monthKey) {
  if (!monthKey || monthKey.length !== 6) return monthKey;
  const monthNum = parseInt(monthKey.slice(0, 2), 10);
  const yearNum = monthKey.slice(2);
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthIdx = monthNum - 1;
  return `${monthNames[monthIdx]} ${yearNum}`;  // Simplified format without FY prefix
}

const palette = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
];
const cLabels = { c1: "C1", c2: "C2", c3: "C3", c4: "C4", c5: "C5" };

function processLapseData(lapseData, site, siteKey, months) {
  const byMonth = {};
  months.forEach(month =>
    byMonth[month] = {
      month,
      c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, total: 0,
      name: site?.name || 'Unknown Site', siteKey
    }
  );
  (lapseData || []).forEach(record => {
    let month = '';
    if (record.sk) month = record.sk;
    else if (record.date) {
      const d = new Date(record.date);
      month = `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
    } else if (record.period) month = record.period;
    if (!month || !byMonth[month]) return;
    const allocated = record.allocated || record;
    ['c1','c2','c3','c4','c5'].forEach(c =>
      byMonth[month][c] += Math.max(0, Number(allocated[c] || 0))
    );
    byMonth[month].total =
      byMonth[month].c1 + byMonth[month].c2 + byMonth[month].c3 +
      byMonth[month].c4 + byMonth[month].c5;
  });
  return Object.values(byMonth);
}

const GraphicalLapseReport = () => {
  const currentYear = new Date().getFullYear();
  const defaultFY = `${currentYear}-${currentYear + 1}`;
  const [financialYear, setFinancialYear] = useState(defaultFY);
  const [siteDataMap, setSiteDataMap] = useState({});
  const [availableSites, setAvailableSites] = useState([]);
  const [selectedSites, setSelectedSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [graphType, setGraphType] = useState('line');
  const { user } = useAuth();

  // Build dropdown years from 2020–current+1
  const fyOptions = [];
  for (let y = 2020; y <= currentYear; y++) {
    fyOptions.push({
      value: `${y}-${y + 1}`,
      label: `April ${y} - March ${y + 1}`
    });
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    (async () => {
      try {
        const siteIds = getAccessibleSiteIds(user, 'production');
        const months = getFinancialYearMonths(financialYear);
        const allSites = await productionSiteApi.fetchAll().then(res => res.data || []);
        const siteDataMapNew = {};
        const availableSitesTemp = [];

        for (const combinedId of siteIds) {
          const [companyId, siteId] = combinedId.split('_');
          const siteObj = allSites.find(s =>
            String(s.productionSiteId) === String(siteId) &&
            String(s.companyId) === String(companyId)
          );
          if (!siteObj) continue;

          const siteKey = `${siteObj.companyId}_${siteObj.productionSiteId}`;
          if (siteDataMapNew[siteKey]) continue;

          try {
            const response = await lapseApi.fetchAllByPk(siteKey);
            const lapseData = Array.isArray(response) ? response : [];
            const processed = processLapseData(lapseData, siteObj, siteKey, months);
            siteDataMapNew[siteKey] = processed;

            if (processed.some(month => month.total > 0)) {
              availableSitesTemp.push({
                key: siteKey,
                name: siteObj.name,
                companyId: siteObj.companyId,
                productionSiteId: siteObj.productionSiteId
              });
            }
          } catch { }
        }

        setSiteDataMap(siteDataMapNew);
        setAvailableSites(availableSitesTemp);
        if (!selectedSites.length) {
          setSelectedSites(availableSitesTemp.slice(0, 5).map(s => s.key));
        } else {
          const valid = availableSitesTemp.map(s => s.key);
          setSelectedSites(selectedSites.filter(k => valid.includes(k)));
        }
        if (!Object.keys(siteDataMapNew).length) {
          setError('No lapse data available for the selected period');
        }
      } catch {
        setError('Failed to load lapse data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [financialYear, user]);

  // Prepare chart data
  const months = getFinancialYearMonths(financialYear);
  const chartData = months.map(month => {
    const row = { month: formatMonthDisplay(month) };
    selectedSites.forEach(siteKey => {
      const siteObj = availableSites.find(s => s.key === siteKey);
      const siteName = siteObj?.name || siteKey;
      const data = siteDataMap[siteKey]?.find(item => item.month === month) || {};
      ['c1','c2','c3','c4','c5'].forEach(c =>
        row[`${siteName}_${c}`] = data[c] || 0
      );
    });
    return row;
  });

  const seriesKeys = [];
  selectedSites.forEach((siteKey, i) => {
    const site = availableSites.find(s => s.key === siteKey);
    const siteName = site?.name || siteKey;
    ['c1','c2','c3','c4','c5'].forEach((c,j) => {
      seriesKeys.push({
        key: `${siteName}_${c}`,
        siteName,
        c,
        color: palette[(i*5 + j) % palette.length]
      });
    });
  });

  return (
    <Paper elevation={3} sx={{ p: 4, my: 2, borderRadius: 2, boxShadow: '0 4px 20px 0 rgba(0,0,0,0.1)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, borderBottom: '1px solid #e0e0e0', pb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#2c3e50' }}>Lapse Analysis</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 220 }} variant="outlined">
            <InputLabel>Financial Year</InputLabel>
            <Select
              value={financialYear}
              onChange={e => setFinancialYear(e.target.value)}
              label="Financial Year"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1,
                  backgroundColor: '#fff',
                },
              }}
            >
              {fyOptions.map(fy => (
                <MenuItem key={fy.value} value={fy.value}>
                  {fy.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f5f5f5', px: 1.5, py: 0.5, borderRadius: 1 }}>
            <Typography variant="body2" sx={{ color: graphType === 'bar' ? '#1976d2' : 'inherit', fontWeight: graphType === 'bar' ? 600 : 400 }}>Bar</Typography>
            <Switch
              checked={graphType === 'line'}
              onChange={() => setGraphType(prev => prev === 'line' ? 'bar' : 'line')}
              color="primary"
              size="small"
            />
            <Typography variant="body2" sx={{ color: graphType === 'line' ? '#1976d2' : 'inherit', fontWeight: graphType === 'line' ? 600 : 400 }}>Line</Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 300 }}>
            <Autocomplete
              multiple
              options={availableSites}
              getOptionLabel={(option) => option.name || option.key}
              value={availableSites.filter(site => selectedSites.includes(site.key))}
              onChange={(_, newValue) => setSelectedSites(newValue.map(v => v.key))}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  label="Select Sites"
                  placeholder="Sites"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1,
                      backgroundColor: '#fff',
                    },
                  }}
                />
              )}
              sx={{ minWidth: 300 }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Box
                    {...getTagProps({ index })}
                    key={option.key}
                    sx={{
                      backgroundColor: '#e3f2fd',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      margin: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      '& .MuiChip-deleteIcon': {
                        color: '#1976d2',
                        '&:hover': {
                          color: '#1565c0',
                        },
                      },
                    }}
                  >
                    {option.name || option.key}
                  </Box>
                ))
              }
            />
          </Box>
        </Box>
      </Box>

      <Box sx={{ width: '100%', height: 500 }}>
        {loading ? (
          <Typography>Loading lapse data...</Typography>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : selectedSites.length === 0 ? (
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
                    const site = name.substring(0, i);
                    const cat = name.substring(i + 1);
                    return [value, `${site} ${cLabels[cat] || cat}`];
                  }}
                  labelFormatter={label => `Month: ${label}`}
                />
                <Legend
                  formatter={name => {
                    const i = name.lastIndexOf('_');
                    const site = name.substring(0, i);
                    const cat = name.substring(i + 1);
                    return `${site} ${cLabels[cat] || cat}`;
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
                    const site = name.substring(0, i);
                    const cat = name.substring(i + 1);
                    return [value, `${site} ${cLabels[cat] || cat}`];
                  }}
                  labelFormatter={label => `Month: ${label}`}
                />
                <Legend
                  formatter={name => {
                    const i = name.lastIndexOf('_');
                    const site = name.substring(0, i);
                    const cat = name.substring(i + 1);
                    return `${site} ${cLabels[cat] || cat}`;
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

export default GraphicalLapseReport;