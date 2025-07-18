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
import productionSiteApi from '../../services/productionSiteapi';
import bankingApi from '../../services/bankingApi';

// Helper: Months for Apr–Mar FY
function getFinancialYearMonths(fy) {
  const [startYear, endYear] = fy.split('-').map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) months.push((m < 10 ? '0' : '') + m + String(startYear));
  for (let m = 1; m <= 3; m++) months.push((m < 10 ? '0' : '') + m + String(endYear));
  return months;
}
function formatMonthLabel(monthKey) {
  const M = parseInt(monthKey.slice(0, 2), 10) - 1;
  const y = monthKey.slice(2);
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][M] + '/' + y;
}
const palette = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
];
const cLabels = { c1: "C1", c2: "C2", c3: "C3", c4: "C4", c5: "C5" };

function processBankingData(bankingData, site, siteKey, months) {
  const byMonth = {};
  months.forEach(month =>
    byMonth[month] = {
      month,
      c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, total: 0,
      name: site?.name || 'Unknown Site', siteKey
    }
  );
  (bankingData || []).forEach(record => {
    let month = '';
    if (record.sk) month = record.sk;
    else if (record.date) {
      const d = new Date(record.date);
      month = `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
    } else if (record.period) month = record.period;
    if (!month || !byMonth[month]) return;
    const allocated = record.allocated || record;
    ['c1','c2','c3','c4','c5'].forEach(c =>
      byMonth[month][c] += Number(allocated[c] || 0)
    );
    byMonth[month].total =
      byMonth[month].c1 + byMonth[month].c2 + byMonth[month].c3 + byMonth[month].c4 + byMonth[month].c5;
  });
  return Object.values(byMonth);
}

const GraphicalBankingReport = () => {
  const currentYear = new Date().getFullYear();
  const defaultFY = `${currentYear}-${currentYear + 1}`;
  const [financialYear, setFinancialYear] = useState(defaultFY);
  const [siteDataMap, setSiteDataMap] = useState({}); // {siteKey: [...months]}
  const [availableSites, setAvailableSites] = useState([]); // [{key, name, ...}]
  const [selectedSites, setSelectedSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [graphType, setGraphType] = useState('line');
  const { user } = useAuth();

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
            const response = await bankingApi.fetchAllByPk(siteKey);
            const bankingData = Array.isArray(response) ? response : [];
            const processed = processBankingData(bankingData, siteObj, siteKey, months);
            siteDataMapNew[siteKey] = processed;
            if (processed.some(month => month.total > 0)) {
              availableSitesTemp.push({
                key: siteKey,
                name: siteObj.name,
                companyId: siteObj.companyId,
                productionSiteId: siteObj.productionSiteId
              });
            }
          } catch { /* error: treat as site with no data */ }
        }

        setSiteDataMap(siteDataMapNew);
        setAvailableSites(availableSitesTemp);
        if (!selectedSites.length) {
          setSelectedSites(availableSitesTemp.slice(0, 5).map(site => site.key));
        } else {
          const valid = availableSitesTemp.map(site => site.key);
          setSelectedSites(selectedSites.filter(k => valid.includes(k)));
        }
        if (!Object.keys(siteDataMapNew).length) setError('No banking data available for the selected period');
      } catch {
        setError('Failed to load banking data.');
      }
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [financialYear, user]);

  const chartData = getFinancialYearMonths(financialYear).map(month => {
    const row = { month: formatMonthLabel(month) };
    selectedSites.forEach(siteKey => {
      const siteObj = availableSites.find(s => s.key === siteKey);
      const siteName = siteObj?.name || siteKey;
      const data = siteDataMap[siteKey]?.find(item => item.month === month) || {};
      ['c1','c2','c3','c4','c5'].forEach(c =>
        row[`${siteName}-${c}`] = data[c] || 0
      );
    });
    return row;
  });
  const seriesKeys = [];
  selectedSites.forEach((siteKey, i) => {
    const siteObj = availableSites.find(s => s.key === siteKey);
    const siteName = siteObj?.name || siteKey;
    ['c1','c2','c3','c4','c5'].forEach((c,j) =>
      seriesKeys.push({ key: `${siteName}-${c}`, siteName, c, color: palette[(i*5 + j) % palette.length] })
    );
  });

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
      <Typography variant="h5" gutterBottom>Banking Analysis</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, my: 2 }}>
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
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Autocomplete
            multiple
            options={availableSites}
            getOptionLabel={option => option.name || option.key}
            value={availableSites.filter(site => selectedSites.includes(site.key))}
            onChange={(_, vals) => setSelectedSites(vals.map(s => s.key))}
            renderInput={params => (
              <TextField {...params} variant="outlined" label="Select Sites" size="small" />
            )}
            sx={{ width: '100%' }}
            disableCloseOnSelect
          />
        </Box>
      </Box>

      <Box sx={{ width: '100%', height: 500 }}>
        {loading
          ? <Typography>Loading banking data...</Typography>
          : error
            ? <Typography color="error">{error}</Typography>
            : selectedSites.length === 0
              ? <Typography>No sites selected. Please select sites to view data.</Typography>
              : (
                <ResponsiveContainer width="100%" height="100%">
                  {graphType === 'line' ? (
                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" angle={-45} tick={{ fontSize: 12 }} height={70} />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => {
                          const i = name.lastIndexOf('-');
                          if (i < 0) return [value, name];
                          const site = name.substring(0, i);
                          const cat = name.substring(i + 1);
                          return [value, `${site} ${cLabels[cat] || cat}`];
                        }}
                        labelFormatter={label => `Month: ${label}`}
                      />
                      <Legend formatter={name => {
                        const i = name.lastIndexOf('-');
                        if (i < 0) return name;
                        const site = name.substring(0, i);
                        const cat = name.substring(i + 1);
                        return `${site} ${cLabels[cat] || cat}`;
                      }} />
                      {seriesKeys.map(({ key, color }) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          name={key}
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
                          const i = name.lastIndexOf('-');
                          if (i < 0) return [value, name];
                          const site = name.substring(0, i);
                          const cat = name.substring(i + 1);
                          return [value, `${site} ${cLabels[cat] || cat}`];
                        }}
                        labelFormatter={label => `Month: ${label}`}
                      />
                      <Legend formatter={name => {
                        const i = name.lastIndexOf('-');
                        if (i < 0) return name;
                        const site = name.substring(0, i);
                        const cat = name.substring(i + 1);
                        return `${site} ${cLabels[cat] || cat}`;
                      }} />
                      {seriesKeys.map(({ key, color }) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          name={key}
                          fill={color}
                          radius={[4, 4, 0, 0]}
                          stack={key.split('-')[0]} // Stack per site
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

export default GraphicalBankingReport;
