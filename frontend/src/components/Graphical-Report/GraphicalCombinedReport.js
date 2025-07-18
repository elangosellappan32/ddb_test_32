// ──────────────────────────────────────────────────────────────────────────────
// GraphicalCombinedReport.jsx
// Enhanced implementation that fetches production, consumption, allocation (with access control),
// banking and lapse data, aggregates the five C-columns (c1–c5) per month, and
// visualizes the totals as either a bar or line chart.
//
// Key Enhancement: Allocation data is filtered to only show pairs where the user
// has access to both the production site AND consumption site.
//
// ‣ Place this file under:  src/components/GraphicalCombinedReport.jsx
// ‣ External dependencies:  @mui/material, recharts, React 18
// ‣ Local dependencies:     all API helpers (productionUnitApi, consumptionUnitApi, etc.),
//                            plus getAccessibleSiteIds() and AuthContext.
// ──────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
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
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

import productionSiteApi   from '../../services/productionSiteapi';
import consumptionSiteApi  from '../../services/consumptionSiteapi';
import productionUnitApi   from '../../services/productionUnitapi';
import consumptionUnitApi  from '../../services/consumptionUnitapi';
import allocationService   from '../../services/allocationService';
import bankingApi          from '../../services/bankingApi';
import lapseApi            from '../../services/lapseApi';
import { getAccessibleSiteIds } from '../../utils/siteAccessUtils';
import { useAuth } from '../../context/AuthContext';

// ──────────────────────────────────────────────────────────────────────────────
// 1.  Helper utilities
// ──────────────────────────────────────────────────────────────────────────────
const C_KEYS = ['c1', 'c2', 'c3', 'c4', 'c5'];
const PALETTE = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
];

const sumC = row =>
  C_KEYS.reduce((acc, k) => acc + (+row[k] || 0), 0);

const getFYMonths = fy => {
  const [start, end] = fy.split('-').map(Number);
  const list = [];
  for (let m = 4; m <= 12; m++) list.push(`${String(m).padStart(2, '0')}${start}`);
  for (let m = 1; m <= 3;  m++) list.push(`${String(m).padStart(2, '0')}${end}`);
  return list;
};

const formatMonth = key => {
  if (!key) return '';
  const idx  = +key.slice(0, 2) - 1;
  const year = key.slice(2);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[idx]}${idx === 3 ? ` FY${year}` : ` ${year}`}`;
};

// ──────────────────────────────────────────────────────────────────────────────
// 2.  Core aggregation with enhanced allocation filtering
// ──────────────────────────────────────────────────────────────────────────────
async function fetchCombinedC(financialYear, user) {
  const months   = getFYMonths(financialYear);
  const zeroByM  = Object.fromEntries(months.map(m => [m, 0]));
  const output   = {};                           // legendLabel -> {sk:val}

  // 2.1 ‣ Get user's accessible site IDs for allocation filtering
  const accessibleProdSites = new Set(
    getAccessibleSiteIds(user, 'production').map(id => id.split('_')[1]) // Extract siteId only
  );
  const accessibleConsSites = new Set(
    getAccessibleSiteIds(user, 'consumption').map(id => id.split('_')[1]) // Extract siteId only
  );

  console.log('User accessible production sites:', Array.from(accessibleProdSites));
  console.log('User accessible consumption sites:', Array.from(accessibleConsSites));

  // 2.2 ‣ Build name look-up tables
  const [{ data: prodSites = [] }, { data: consSites = [] }] = await Promise.all([
    productionSiteApi.fetchAll(),
    consumptionSiteApi.fetchAll()
  ]);
  const prodName = Object.fromEntries(prodSites.map(s =>
    [String(s.productionSiteId), s.name || s.siteName || s.productionSiteId]));
  const consName = Object.fromEntries(consSites.map(s =>
    [String(s.consumptionSiteId), s.name || s.siteName || s.consumptionSiteId]));

  // ─── Production units ──────────────────────────────────────────────────────
  await Promise.all(
    getAccessibleSiteIds(user, 'production').map(async id => {
      const [companyId, siteId] = id.split('_');
      const label = `${prodName[siteId] ?? siteId}_production`;
      output[label] = { ...zeroByM };

      try {
        const { data: rows = [] } = await productionUnitApi.fetchAll(companyId, siteId);
        console.log(`Fetched ${rows.length} production units for ${label}`);
        
        rows.forEach(r => {
          const m = r.sk || r.period ||
                    (r.date && (() => {
                      const d = new Date(r.date);
                      return `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
                    })());
          if (months.includes(m)) {
            const cValue = sumC(r);
            output[label][m] += cValue;
            console.log(`[PRODUCTION] ${label} | Month: ${m} | C-Sum: ${cValue}`);
          }
        });
      } catch (error) {
        console.error(`Error fetching production units for ${label}:`, error);
      }
    })
  );

  // ─── Consumption units ─────────────────────────────────────────────────────
  await Promise.all(
    getAccessibleSiteIds(user, 'consumption').map(async id => {
      const [companyId, siteId] = id.split('_');
      const label = `${consName[siteId] ?? siteId}_consumption`;
      output[label] = { ...zeroByM };

      try {
        const { data: rows = [] } = await consumptionUnitApi.fetchAll(companyId, siteId);
        console.log(`Fetched ${rows.length} consumption units for ${label}`);
        
        rows.forEach(r => {
          const m = r.sk || r.period ||
                    (r.date && (() => {
                      const d = new Date(r.date);
                      return `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
                    })());
          if (months.includes(m)) {
            const cValue = sumC(r);
            output[label][m] += cValue;
            console.log(`[CONSUMPTION] ${label} | Month: ${m} | C-Sum: ${cValue}`);
          }
        });
      } catch (error) {
        console.error(`Error fetching consumption units for ${label}:`, error);
      }
    })
  );

  // ─── Allocations with Access Control ───────────────────────────────────────
  await Promise.all(months.map(async m => {
    try {
      const rows = await allocationService.fetchAllocationsByMonth(m);
      console.log(`Processing ${rows.length} allocation records for month ${m}`);
      
      rows.forEach(r => {
        const [, pId, cId] = (r.pk || '').split('_');
        
        // ✅ Enhanced Access Control: Only show allocations where user has access to BOTH sites
        const hasAccessToProd = accessibleProdSites.has(pId);
        const hasAccessToCons = accessibleConsSites.has(cId);
        
        console.log(`Allocation ${pId} → ${cId}: prod access=${hasAccessToProd}, cons access=${hasAccessToCons}`);
        
        if (hasAccessToProd && hasAccessToCons) {
          const label = `${prodName[pId] ?? pId} → ${consName[cId] ?? cId}_allocation`;
          output[label] ??= { ...zeroByM };
          const cValue = sumC(r.allocated || r);
          output[label][m] += cValue;
          console.log(`[ALLOCATION] ${label} | Month: ${m} | C-Sum: ${cValue}`);
        } else {
          console.log(`[ALLOCATION FILTERED] Skipped ${pId} → ${cId}: insufficient access`);
        }
      });
    } catch (error) {
      console.error(`Error fetching allocations for month ${m}:`, error);
    }
  }));

  // ─── Banking + Lapse (two APIs, same logic) ────────────────────────────────
  for (const [api, suffix] of [[bankingApi, 'banking'], [lapseApi, 'lapse']]) {
    await Promise.all(
      getAccessibleSiteIds(user, 'production').map(async id => {
        const [companyId, siteId] = id.split('_');
        const label = `${prodName[siteId] ?? siteId}_${suffix}`;
        output[label] ??= { ...zeroByM };

        try {
          const rows = await api.fetchAllByPk(`${companyId}_${siteId}`);
          console.log(`Fetched ${rows.length} ${suffix} records for ${label}`);
          
          rows.forEach(r => {
            const m = r.sk || r.period ||
                      (r.date && (() => {
                        const d = new Date(r.date);
                        return `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
                      })());
            if (months.includes(m)) {
              const cValue = sumC(r.allocated || r);
              output[label][m] += cValue;
              console.log(`[${suffix.toUpperCase()}] ${label} | Month: ${m} | C-Sum: ${cValue}`);
            }
          });
        } catch (error) {
          console.error(`Error fetching ${suffix} data for ${label}:`, error);
        }
      })
    );
  }

  // 2.3 ‣ Filter out empty datasets
  const filteredOutput = Object.fromEntries(
    Object.entries(output).filter(([, values]) => 
      Object.values(values).some(val => val > 0)
    )
  );

  console.log('Final filtered output keys:', Object.keys(filteredOutput));
  return { months, output: filteredOutput };
}

// ──────────────────────────────────────────────────────────────────────────────
// 3.  Main React component
// ──────────────────────────────────────────────────────────────────────────────
export default function GraphicalCombinedReport() {
  const { user } = useAuth();
  const thisYear = new Date().getFullYear();

  const [fy, setFY]       = useState(`${thisYear}-${thisYear + 1}`);
  const [chartType, setT] = useState('bar');
  const [rows, setRows]   = useState([]);
  const [legend, setLeg]  = useState([]);
  const [busy, setBusy]   = useState(false);
  const [err,  setErr]    = useState('');
  const [stats, setStats] = useState({ total: 0, filtered: 0 });

  const fyChoices = [];
  for (let y = 2020; y <= thisYear; y++) {
    fyChoices.push({ value: `${y}-${y + 1}`, label: `April ${y} – March ${y + 1}` });
  }

  const load = useCallback(async () => {
    setBusy(true);  setErr('');  setStats({ total: 0, filtered: 0 });
    
    try {
      const { months, output } = await fetchCombinedC(fy, user);
      
      const totalDatasets = Object.keys(output).length;
      const filteredDatasets = Object.keys(output).filter(key => 
        Object.values(output[key]).some(val => val > 0)
      ).length;
      
      setStats({ total: totalDatasets, filtered: filteredDatasets });

      if (totalDatasets === 0) {
        setRows([]);
        setLeg([]);
        setErr('No data found for accessible sites');
        return;
      }

      const legendArr = Object.keys(output).map(
        (k, i) => ({ key: k, color: PALETTE[i % PALETTE.length] })
      );
      setLeg(legendArr);

      const table = months.map(m => ({
        month: formatMonth(m),
        ...Object.fromEntries(legendArr.map(({ key }) => [key, output[key][m] || 0]))
      })).filter(r => legendArr.some(({ key }) => r[key] > 0));

      setRows(table);
    } catch (error) {
      console.error('Error loading combined data:', error);
      setErr('Failed to load combined site data');
    }
    setBusy(false);
  }, [fy, user]);

  useEffect(() => {
    let live = true;
    load().finally(() => { if (!live) return; });
    return () => { live = false; };
  }, [load]);

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
      <Typography variant="h5" gutterBottom>
        Site-wise Monthly Combined C Values (All Modules)
      </Typography>
      
      {/* Enhanced info section */}
      <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          📊 Showing data for all accessible sites. Allocation data filtered to pairs where you have access to both production and consumption sites.
        </Typography>
        {stats.total > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            📈 Displaying {stats.filtered} of {stats.total} data series with non-zero values
          </Typography>
        )}
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Financial Year</InputLabel>
          <Select value={fy} label="Financial Year" onChange={e => setFY(e.target.value)}>
            {fyChoices.map(f => (
              <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', alignItems: 'center', pl: 1 }}>
          <Typography sx={{ fontSize: 14, pr: 1 }}>Bar</Typography>
          <Switch
            checked={chartType === 'line'}
            onChange={() => setT(t => (t === 'line' ? 'bar' : 'line'))}
            color="primary"
            sx={{ mx: 1 }}
          />
          <Typography sx={{ fontSize: 14, pl: 1 }}>Line</Typography>
        </Box>
      </Box>

      {/* Chart area */}
      <Box sx={{ width: '100%', height: 540 }}>
        {busy
          ? <Typography>Loading combined data…</Typography>
          : err
            ? <Typography color="error">{err}</Typography>
            : rows.length === 0
              ? <Typography color="text.secondary">No data available for your accessible sites in the selected period</Typography>
              : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'line' ? (
                    <LineChart data={rows} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" angle={-45} tick={{ fontSize: 12 }} height={70} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {legend.map(({ key, color }) => (
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
                      data={rows}
                      margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                      barCategoryGap={20}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" angle={-45} tick={{ fontSize: 12 }} height={70} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {legend.map(({ key, color }) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          name={key}
                          fill={color}
                          radius={[4, 4, 0, 0]}
                          barSize={28}
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
}
