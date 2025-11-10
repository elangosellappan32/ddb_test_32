import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  MenuItem,
  TextField,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../context/AuthContext';
import allocationApi from '../../services/allocationApi';
import consumptionSiteApi from '../../services/consumptionSiteApi';
import productionSiteApi from '../../services/productionSiteApi';
import consumptionUnitApi from '../../services/consumptionUnitApi';

const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }) }));
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i);

const formatMonthKey = (m, y) => `${String(m).padStart(2, '0')}${y}`;

const groupByConsumptionSite = (allocations, siteMap, prodSiteMap) => {
  const grouped = {};
  allocations.forEach(item => {
    const consId = String(item.consumptionSiteId || '');
    if (!consId) return;
    if (!grouped[consId]) {
      grouped[consId] = {
        consumptionSiteId: consId,
        consumptionSiteName: siteMap[consId]?.name || siteMap[consId]?.Name || 'Consumption Site',
        rows: [],
        totals: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c24: 0 }
      };
    }
    const allocated = item.allocated || {};
    const prodId = String(item.productionSiteId || (item.pk?.split('_')[1] || ''));
    const prodName = prodSiteMap[prodId]?.name || prodSiteMap[prodId]?.siteName || item.productionSite || item.siteName || `Production Site ${prodId}`;
    const row = {
      pk: item.pk,
      sk: item.sk,
      productionSiteId: prodId,
      productionSiteName: prodName,
      c1: Number(item.c1 ?? allocated.c1 ?? 0) || 0,
      c2: Number(item.c2 ?? allocated.c2 ?? 0) || 0,
      c3: Number(item.c3 ?? allocated.c3 ?? 0) || 0,
      c4: Number(item.c4 ?? allocated.c4 ?? 0) || 0,
      c5: Number(item.c5 ?? allocated.c5 ?? 0) || 0,
      c24: 0,
      charge: allocated.charge === 1 || allocated.charge === true || item.charge === true || item.charge === 1
    };
    row.c24 = row.c1 + row.c2 + row.c3 + row.c4 + row.c5;
    grouped[consId].rows.push(row);
    grouped[consId].totals.c1 += row.c1;
    grouped[consId].totals.c2 += row.c2;
    grouped[consId].totals.c3 += row.c3;
    grouped[consId].totals.c4 += row.c4;
    grouped[consId].totals.c5 += row.c5;
    grouped[consId].totals.c24 += row.c24;
  });
  return grouped;
};

const ConsumptionAllocation = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [siteMap, setSiteMap] = useState({});
  const [allocData, setAllocData] = useState([]);
  const [prodSiteMap, setProdSiteMap] = useState({});
  const [selectedConsumptionSiteId, setSelectedConsumptionSiteId] = useState('all');
  const [consUnitsBySite, setConsUnitsBySite] = useState({}); // { [consId]: { c1,c2,c3,c4,c5,total } }

  const monthKey = useMemo(() => formatMonthKey(selectedMonth, selectedYear), [selectedMonth, selectedYear]);

  // Format number with thousands separators and no decimal places
  const formatNumber = (num) => {
    return Number(num || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  const fetchSites = useCallback(async () => {
    try {
      const [consResp, prodResp] = await Promise.all([
        consumptionSiteApi.fetchAll(),
        productionSiteApi.fetchAll()
      ]);

      const consMap = {};
      (consResp?.data || []).forEach(s => { consMap[String(s.consumptionSiteId)] = s; });
      setSiteMap(consMap);

      const pMap = {};
      (prodResp?.data || []).forEach(p => { pMap[String(p.productionSiteId)] = p; });
      setProdSiteMap(pMap);
    } catch (e) {
      enqueueSnackbar('Failed to load sites', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const fetchConsumptionUnitsForMonth = useCallback(async (monthKeyToUse, consMapArg) => {
    try {
      const consMapLocal = consMapArg || siteMap;
      const consIds = Object.keys(consMapLocal);
      if (consIds.length === 0) {
        setConsUnitsBySite({});
        return;
      }
      const normalizeDigits = (v) => String(v || '')?.replace(/[^0-9]/g, '');
      const toPairs = (val) => {
        const s = normalizeDigits(val);
        const out = new Set();
        if (s.length === 6) {
          const mm = s.slice(0,2);
          const yyyy = s.slice(2);
          out.add(`${mm}${yyyy}`); // MMYYYY
          out.add(`${yyyy}${mm}`); // YYYYMM
        } else if (s.length === 8) {
          // Assume YYYYMMDD
          const yyyy = s.slice(0,4);
          const mm = s.slice(4,6);
          out.add(`${mm}${yyyy}`);
          out.add(`${yyyy}${mm}`);
        } else if (s.length >= 4) {
          // Try last 6 digits as MMYYYY (in case prefix/suffix)
          const last6 = s.slice(-6);
          if (last6.length === 6) {
            const mm = last6.slice(0,2);
            const yyyy = last6.slice(2);
            out.add(`${mm}${yyyy}`);
            out.add(`${yyyy}${mm}`);
          }
        }
        return Array.from(out);
      };
      const targets = toPairs(monthKeyToUse);
      const results = await Promise.all(consIds.map(async (cid) => {
        try {
          const site = consMapLocal[cid] || {};
          const companyIdForSite = String(site.companyId || user?.companyId || user?.metadata?.companyId || '');
          const res = await consumptionUnitApi.fetchAll(companyIdForSite, cid);
          const arr = res?.data || [];
          // Find by multiple possible formats
          let entry = arr.find(u => {
            const d = normalizeDigits(u?.date || u?.sk || '');
            const candidates = toPairs(d);
            return candidates.some(c => targets.includes(c));
          });
          // Fallback: direct fetch one by MMYYYY
          if (!entry) {
            try {
              const mmYYYY = targets.find(t => t.length === 6 && /^[0-9]{6}$/.test(t) && t.slice(0,2) >= '01' && t.slice(0,2) <= '12');
              if (mmYYYY) {
                const single = await consumptionUnitApi.fetchOne(companyIdForSite, cid, mmYYYY);
                const data = single?.data || single; // service may return data in different shape
                if (data) {
                  entry = {
                    c1: Number(data.c1 || 0),
                    c2: Number(data.c2 || 0),
                    c3: Number(data.c3 || 0),
                    c4: Number(data.c4 || 0),
                    c5: Number(data.c5 || 0)
                  };
                }
              }
            } catch {}
          }
          const val = {
            c1: Number(entry?.c1 || 0),
            c2: Number(entry?.c2 || 0),
            c3: Number(entry?.c3 || 0),
            c4: Number(entry?.c4 || 0),
            c5: Number(entry?.c5 || 0),
            c24: 0
          };
          val.c24 = val.c1 + val.c2 + val.c3 + val.c4 + val.c5;
          return [cid, val];
        } catch {
          return [cid, { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c24: 0 }];
        }
      }));
      const map = {};
      results.forEach(([cid, val]) => { map[cid] = val; });
      setConsUnitsBySite(map);
    } catch (e) {
      // Non-fatal; show a warning
      enqueueSnackbar('Failed to load consumption units for month', { variant: 'warning' });
      setConsUnitsBySite({});
    }
  }, [enqueueSnackbar, siteMap, user?.companyId, user?.metadata?.companyId]);

  const fetchAllocations = useCallback(async () => {
    if (!user?.companyId && !user?.metadata?.companyId) return;
    try {
      setLoading(true);
      const companyId = String(user?.companyId || user?.metadata?.companyId || '');
      const res = await allocationApi.fetchAll(monthKey, companyId);
      setAllocData(res.allocations || []);
    } catch (e) {
      enqueueSnackbar(e.message || 'Failed to load allocations', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user?.companyId, monthKey, enqueueSnackbar]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  useEffect(() => {
    fetchAllocations();
  }, [fetchAllocations]);

  // When sites are loaded or month changes, load consumption units for that month
  useEffect(() => {
    if (Object.keys(siteMap).length > 0) {
      fetchConsumptionUnitsForMonth(monthKey, siteMap);
    }
  }, [monthKey, siteMap, fetchConsumptionUnitsForMonth]);

  const grouped = useMemo(() => groupByConsumptionSite(allocData, siteMap, prodSiteMap), [allocData, siteMap, prodSiteMap]);
  const consSiteIds = useMemo(() => {
    const ids = Object.keys(grouped).sort((a, b) => (siteMap[a]?.name || '').localeCompare(siteMap[b]?.name || ''));
    if (selectedConsumptionSiteId && selectedConsumptionSiteId !== 'all') {
      return ids.filter(id => id === String(selectedConsumptionSiteId));
    }
    return ids;
  }, [grouped, siteMap, selectedConsumptionSiteId]);

  const consumptionSiteOptions = useMemo(() => {
    // Build options from the loaded siteMap so user can filter even if there are no allocations yet
    return Object.values(siteMap)
      .map(s => ({ id: String(s.consumptionSiteId), name: s.name || s.Name || `Consumption Site ${s.consumptionSiteId}` }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [siteMap]);

  // Header title for Annexure page
  const headerTitle = useMemo(() => {
    return `Annexure for Adjustment HT Billing Working Sheet for the Month of ${selectedMonth}/${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  const formatDate = useCallback((value) => {
    try {
      if (!value) return 'N/A';
      const d = new Date(value);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>{headerTitle}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField size="small" select label="Consumption Site" value={selectedConsumptionSiteId} onChange={e => setSelectedConsumptionSiteId(e.target.value)} sx={{ minWidth: 220 }}>
            <MenuItem value="all">All Consumption Sites</MenuItem>
            {consumptionSiteOptions.map(opt => (
              <MenuItem key={opt.id} value={opt.id}>{opt.name} ({opt.id})</MenuItem>
            ))}
          </TextField>
          <TextField size="small" select label="Month" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
            {monthOptions.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="Year" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {yearOptions.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </TextField>
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : consSiteIds.length === 0 ? (
        <Typography variant="body1">No allocations found for the selected period.</Typography>
      ) : (
        consSiteIds.map(consId => {
          const section = grouped[consId];
          return (
            <Paper key={consId} sx={{ 
              p: 3, 
              mb: 3, 
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              '&:last-child': { mb: 0 }
            }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {section.consumptionSiteName || `Consumption Site ${consId}`} ({consId})
              </Typography>
              
              {/* Calculate section totals before rendering the table */}
              {(() => {
                const targetUnits = consUnitsBySite[consId] || { c24: 0, c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 };
                const sectionTotals = { ...targetUnits };
                
                return (
                  <Table size="small" sx={{ 
                border: '1px solid #e0e0e0',
                '& .MuiTableCell-root': {
                  border: '1px solid #f0f0f0',
                  padding: '8px 12px',
                  '&.header-cell': {
                    backgroundColor: '#f5f7fa',
                    fontWeight: 600,
                    color: '#2d3748',
                    borderBottom: '2px solid #e0e0e0'
                  },
                  '&.highlight': {
                    backgroundColor: '#f8f9fa',
                    fontWeight: 500
                  },
                  '&.subtext': {
                    color: '#6b7280',
                    fontSize: '0.85rem',
                    backgroundColor: '#fafafa'
                  },
                  '&.section-header': {
                    backgroundColor: '#e8f4fd',
                    fontWeight: 600,
                    color: '#1a365d'
                  },
                  '&.section-value': {
                    backgroundColor: '#f0f9ff',
                    fontWeight: 500
                  }
                },
                '& .MuiTableRow-hover:hover': {
                  backgroundColor: '#f8fafc'
                }
              }}>
                {/* Consumption Units Section */}
                <TableHead>
                  <TableRow>
                    <TableCell className="section-header" colSpan={7}>
                      Consumption Units
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="section-value">HT</TableCell>
                    <TableCell align="right" className="section-value">{formatNumber(sectionTotals.c24)}</TableCell>
                    <TableCell align="right" className="section-value">{formatNumber(sectionTotals.c1)}</TableCell>
                    <TableCell align="right" className="section-value">{formatNumber(sectionTotals.c2)}</TableCell>
                    <TableCell align="right" className="section-value">{formatNumber(sectionTotals.c3)}</TableCell>
                    <TableCell align="right" className="section-value">{formatNumber(sectionTotals.c4)}</TableCell>
                    <TableCell align="right" className="section-value">{formatNumber(sectionTotals.c5)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="section-value"></TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="section-value">Transmission Loss</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="section-header" colSpan={7} style={{ paddingTop: '20px' }}>
                      Production Site Allocations
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="header-cell">Production Site</TableCell>
                    <TableCell className="header-cell" align="center">C24</TableCell>
                    <TableCell className="header-cell" align="center">C1</TableCell>
                    <TableCell className="header-cell" align="center">C2</TableCell>
                    <TableCell className="header-cell" align="center">C3</TableCell>
                    <TableCell className="header-cell" align="center">C4</TableCell>
                    <TableCell className="header-cell" align="center">C5</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const cumulative = { c24: 0, c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 };
                    return section.rows
                      .slice()
                      .sort((a, b) => {
                        const da = prodSiteMap[a.productionSiteId]?.dateOfCommission ? new Date(prodSiteMap[a.productionSiteId]?.dateOfCommission) : null;
                        const db = prodSiteMap[b.productionSiteId]?.dateOfCommission ? new Date(prodSiteMap[b.productionSiteId]?.dateOfCommission) : null;
                        const ta = da && !isNaN(da) ? da.getTime() : 0;
                        const tb = db && !isNaN(db) ? db.getTime() : 0;
                        // Newest first
                        return tb - ta;
                      })
                      .map((r, idx) => {
                        // Available before applying this allocation
                        const available = {
                          c24: Math.max(0, sectionTotals.c24 - cumulative.c24),
                          c1: Math.max(0, sectionTotals.c1 - cumulative.c1),
                          c2: Math.max(0, sectionTotals.c2 - cumulative.c2),
                          c3: Math.max(0, sectionTotals.c3 - cumulative.c3),
                          c4: Math.max(0, sectionTotals.c4 - cumulative.c4),
                          c5: Math.max(0, sectionTotals.c5 - cumulative.c5)
                        };
                        // Remaining after applying this allocation (clamped)
                        const rem = {
                          c24: Math.max(0, available.c24 - (Number(r.c24) || 0)),
                          c1: Math.max(0, available.c1 - (Number(r.c1) || 0)),
                          c2: Math.max(0, available.c2 - (Number(r.c2) || 0)),
                          c3: Math.max(0, available.c3 - (Number(r.c3) || 0)),
                          c4: Math.max(0, available.c4 - (Number(r.c4) || 0)),
                          c5: Math.max(0, available.c5 - (Number(r.c5) || 0))
                        };
                        // Now update cumulative after computing remaining
                        cumulative.c24 += Number(r.c24) || 0;
                        cumulative.c1 += Number(r.c1) || 0;
                        cumulative.c2 += Number(r.c2) || 0;
                        cumulative.c3 += Number(r.c3) || 0;
                        cumulative.c4 += Number(r.c4) || 0;
                        cumulative.c5 += Number(r.c5) || 0;
                        return (
                          <React.Fragment key={`${r.pk}-${idx}`}>
                            {/* Main Data Row */}
                            <TableRow hover>
                              <TableCell className="highlight">
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  {r.charge && (
                                    <Box 
                                      component="span" 
                                      sx={{
                                        fontSize: '0.7rem',
                                        backgroundColor: '#e6f7ff',
                                        color: '#1890ff',
                                        px: 0.75,
                                        py: 0.25,
                                        borderRadius: '4px',
                                        fontWeight: 500,
                                        mr: 1
                                      }}
                                    >
                                      CHARGED
                                    </Box>
                                  )}
                                  {r.productionSiteName || r.productionSiteId}
                                </Box>
                              </TableCell>
                              <TableCell align="right">{formatNumber(r.c24)}</TableCell>
                              <TableCell align="right">{formatNumber(r.c1)}</TableCell>
                              <TableCell align="right">{formatNumber(r.c2)}</TableCell>
                              <TableCell align="right">{formatNumber(r.c3)}</TableCell>
                              <TableCell align="right">{formatNumber(r.c4)}</TableCell>
                              <TableCell align="right">{formatNumber(r.c5)}</TableCell>
                            </TableRow>
                            
                            {/* Available and Remaining Rows */}
                            <TableRow>
                              <TableCell className="subtext" sx={{ pl: 4 }}>Adjust</TableCell>
                              <TableCell className="subtext" align="right">{formatNumber(available.c24)}</TableCell>
                              <TableCell className="subtext" align="right">{formatNumber(available.c1)}</TableCell>
                              <TableCell className="subtext" align="right">{formatNumber(available.c2)}</TableCell>
                              <TableCell className="subtext" align="right">{formatNumber(available.c3)}</TableCell>
                              <TableCell className="subtext" align="right">{formatNumber(available.c4)}</TableCell>
                              <TableCell className="subtext" align="right">{formatNumber(available.c5)}</TableCell>
                            </TableRow>
                            
                            <TableRow>
                              <TableCell className="subtext" sx={{ pl: 4, borderBottom: '2px solid #e0e0e0' }}>Consumption balance</TableCell>
                              <TableCell className="subtext" align="right" sx={{ borderBottom: '2px solid #e0e0e0' }}>{formatNumber(rem.c24)}</TableCell>
                              <TableCell className="subtext" align="right" sx={{ borderBottom: '2px solid #e0e0e0' }}>{formatNumber(rem.c1)}</TableCell>
                              <TableCell className="subtext" align="right" sx={{ borderBottom: '2px solid #e0e0e0' }}>{formatNumber(rem.c2)}</TableCell>
                              <TableCell className="subtext" align="right" sx={{ borderBottom: '2px solid #e0e0e0' }}>{formatNumber(rem.c3)}</TableCell>
                              <TableCell className="subtext" align="right" sx={{ borderBottom: '2px solid #e0e0e0' }}>{formatNumber(rem.c4)}</TableCell>
                              <TableCell className="subtext" align="right" sx={{ borderBottom: '2px solid #e0e0e0' }}>{formatNumber(rem.c5)}</TableCell>
                            </TableRow>
                          </React.Fragment>
                        );
                      });
                  })()}
                </TableBody>
              </Table>
              );
            })()}
            </Paper>
          );
        })
      )}
    </Box>
  );
};

export default ConsumptionAllocation;
