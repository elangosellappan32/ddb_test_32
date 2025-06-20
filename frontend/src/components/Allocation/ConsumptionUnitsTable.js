import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  Tooltip
} from "@mui/material";
import {
  TrendingDown,
  Edit as EditIcon,
  Autorenew as AutorenewIcon,
  Info as InfoIcon
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { styled } from "@mui/material/styles";
import { format } from "date-fns";
import api from "../../services/apiUtils";

// Constants
const PEAK_PERIODS = ['c2', 'c3'];
const NON_PEAK_PERIODS = ['c1', 'c4', 'c5'];

// Styled components
const StyledTableCell = styled(TableCell)(({ theme, isheader, ispeak }) => ({
  padding: theme.spacing(1),
  ...(isheader === 'true' && {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.common.white,
    fontWeight: 'bold',
  }),
  ...(ispeak === 'true' && {
    backgroundColor: theme.palette.warning.light,
  }),
}));

const MonthGroupCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.grey[100],
  fontWeight: 'bold',
  padding: theme.spacing(1),
}));

const TotalRow = styled(TableRow)(({ theme }) => ({
  backgroundColor: theme.palette.grey[200],
  '& > td': {
    fontWeight: 'bold',
  },
}));

// Helper function for month formatting
const formatMonthDisplay = (monthKey) => {
  if (!monthKey) return "";
  const month = parseInt(monthKey.substring(0, 2));
  const year = parseInt(monthKey.substring(2));
  return format(new Date(year, month - 1), "MMMM yyyy");
};

const ConsumptionUnitsTable = ({ consumptionData, isLoading, error, onAllocationSaved }) => {
  // State for allocation dialog
  const [allocationDialog, setAllocationDialog] = useState(false);
  const [splitPercentages, setSplitPercentages] = useState([]);
  const [consumptionSites, setConsumptionSites] = useState([]);
  const [dialogError, setDialogError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const calculateTotal = useCallback((row, periods = ['c1', 'c2', 'c3', 'c4', 'c5']) => {
    return periods.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
  }, []);

  const calculatePeakTotal = useCallback((row) => 
    calculateTotal(row, PEAK_PERIODS), 
    [calculateTotal, PEAK_PERIODS]
  );

  const calculateNonPeakTotal = useCallback((row) => 
    calculateTotal(row, NON_PEAK_PERIODS), 
    [calculateTotal, NON_PEAK_PERIODS]
  );

  const handleAllocationClick = async () => {
    try {
      setIsProcessing(true);
      const [sitesResponse, captiveResponse] = await Promise.all([
        api.get('/consumption-site/all'),
        api.get('/captive')
      ]);

      const sites = sitesResponse.data?.data || [];
      const captiveData = captiveResponse.data || [];
      
      setConsumptionSites(sites);
      
      if (sites.length > 0) {
        if (captiveData.length > 0) {
          const percentages = sites.map(site => {
            const captive = captiveData.find(c => c.consumptionSiteId === site.consumptionSiteId);
            return captive ? captive.shareholdingPercentage : 0;
          });
          setSplitPercentages(percentages);
        } else {
          initializeEqualSplitPercentages(sites.length);
        }
        setAllocationDialog(true);
      } else {
        enqueueSnackbar('No consumption sites available', { variant: 'warning' });
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      enqueueSnackbar(error.message || 'Failed to fetch data', { variant: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const initializeEqualSplitPercentages = useCallback((siteCount) => {
    if (siteCount === 0) return;
    const equalShare = Math.floor(100 / siteCount);
    const remainder = 100 % siteCount;
    const percentages = Array(siteCount).fill(equalShare);
    if (remainder > 0) {
      percentages[0] += remainder;
    }
    setSplitPercentages(percentages);
  }, []);

  const handleAutoAllocate = useCallback(() => {
    if (consumptionSites.length === 0) return;

    try {
      const newSplitPercentages = consumptionSites.map(site => {
        const peakTotal = calculatePeakTotal(site);
        const nonPeakTotal = calculateNonPeakTotal(site);
        return { 
          siteId: site.consumptionSiteId,
          weight: (peakTotal * 0.6) + (nonPeakTotal * 0.4)
        };
      });

      const totalWeight = newSplitPercentages.reduce((sum, { weight }) => sum + weight, 0);
      
      if (totalWeight > 0) {
        const percentages = newSplitPercentages.map(({ weight }) => 
          Math.round((weight / totalWeight) * 100)
        );

        // Adjust for rounding errors
        const total = percentages.reduce((sum, value) => sum + value, 0);
        if (total !== 100) {
          const diff = 100 - total;
          const maxIndex = percentages.indexOf(Math.max(...percentages));
          percentages[maxIndex] += diff;
        }

        setSplitPercentages(percentages);
      } else {
        initializeEqualSplitPercentages(consumptionSites.length);
      }
    } catch (error) {
      console.error('Error in auto allocation:', error);
      enqueueSnackbar('Failed to auto-allocate percentages', { variant: 'error' });
    }
  }, [consumptionSites, calculatePeakTotal, calculateNonPeakTotal, initializeEqualSplitPercentages, enqueueSnackbar]);

  // Function to format month for API
  const formatMonth = (sk) => {
    if (!sk) return "";
    // Extract month and year from sk 
    const month = parseInt(sk.substring(0, 2));
    const year = parseInt(sk.substring(2));
    // Format as "MMYYYY" for API call
    const apiMonth = `${month.toString().padStart(2, '0')}${year}`;
    return {
      display: format(new Date(year, month - 1), "MMMM yyyy"),
      api: apiMonth
    };
  };

  // Function to handle saving allocations
  const handleSaveAllocation = async () => {
    const total = splitPercentages.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 100) > 0.01) {
      setDialogError("Total allocation must equal 100%");
      return;
    }
    
    try {
      setIsProcessing(true);
      const updatePromises = consumptionSites.map((site, index) => {
        const captiveData = {
          generatorCompanyId: 1, // Default generator company
          shareholderCompanyId: site.shareholderCompanyId || Number(site.consumptionSiteId),
          consumptionSiteId: site.consumptionSiteId,
          siteName: site.name,
          effectiveFrom: new Date().toISOString().split('T')[0],
          shareholdingPercentage: splitPercentages[index]
        };

        // Try to update existing record first
        return api.put(
          `/captive/${captiveData.generatorCompanyId}/${captiveData.shareholderCompanyId}`, 
          captiveData
        ).catch(error => {
          if (error.response && error.response.status === 404) {
            // If record doesn't exist, create a new one
            return api.post('/captive', captiveData);
          }
          throw error;
        });
      });

      await Promise.all(updatePromises);
      setAllocationDialog(false);
      setDialogError("");
      enqueueSnackbar('Allocation percentages saved successfully', { variant: 'success' });
      
      if (onAllocationSaved) {
        const allocationPercentages = consumptionSites.map((site, index) => ({
          siteName: site.name,
          consumptionSiteId: site.consumptionSiteId,
          percentage: splitPercentages[index]
        }));
        onAllocationSaved(allocationPercentages);
      }
    } catch (error) {
      console.error('Error saving allocations:', error);
      setDialogError('Failed to save allocation percentages: ' + (error.response?.data?.message || error.message));
      enqueueSnackbar('Failed to save allocation percentages', { variant: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const getAllocationPercentage = (consumptionSiteId) => {
    const index = consumptionSites.findIndex(site => site.consumptionSiteId === consumptionSiteId);
    if (index !== -1) {
      return splitPercentages[index] || 0;
    }
    return 0;
  };

  // Load saved allocations on mount
  useEffect(() => {
    const loadSavedAllocations = async () => {
      try {
        // Load consumption sites
        const sitesResponse = await api.get('/consumption-site/all');
        const sites = sitesResponse.data?.data || [];
        setConsumptionSites(sites);
        
        // Load captive allocations
        const captiveResponse = await api.get('/captive');
        const captiveData = captiveResponse.data || [];
        
        // Map captive data to sites
        if (sites.length > 0 && captiveData.length > 0) {
          const percentages = sites.map(site => {
            const captive = captiveData.find(c => c.consumptionSiteId === site.consumptionSiteId);
            return captive ? captive.shareholdingPercentage : 0;
          });
          setSplitPercentages(percentages);
        } else {
          initializeEqualSplitPercentages(sites.length);
        }
      } catch (error) {
        console.error('Error loading saved allocations:', error);
        enqueueSnackbar('Error loading allocations', { variant: 'error' });
      }
    };

    loadSavedAllocations();
  }, [enqueueSnackbar, initializeEqualSplitPercentages]);

  // Memoize the grouped and sorted data
  const groupedData = useMemo(() => {
    return Object.entries(consumptionData.reduce((acc, row) => {
      const month = row.sk || "";
      if (!acc[month]) acc[month] = [];
      acc[month].push(row);
      return acc;
    }, {})).sort(([a], [b]) => {
      const monthA = parseInt(a.substring(0, 2));
      const monthB = parseInt(b.substring(0, 2));
      const yearA = parseInt(a.substring(2));
      const yearB = parseInt(b.substring(2));
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });
  }, [consumptionData]);

  // Memoize totals calculation
  const totals = useMemo(() => {
    if (!consumptionData.length) return null;
    
    const sums = {
      c1: 0, c2: 0, c3: 0, c4: 0, c5: 0,
      peak: 0,
      nonPeak: 0,
      total: 0
    };

    consumptionData.forEach(row => {
      ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(period => {
        const value = Number(row[period]) || 0;
        sums[period] += value;
      });
      sums.peak += calculatePeakTotal(row);
      sums.nonPeak += calculateNonPeakTotal(row);
      sums.total += calculateTotal(row);
    });

    return sums;
  }, [consumptionData, calculatePeakTotal, calculateNonPeakTotal, calculateTotal]);

  return (
    <>
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(224, 224, 224, 1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingDown color="primary" />
            <Typography variant="h6">Consumption Units Allocation</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isLoading && <CircularProgress size={20} />}
            <Button
              variant="outlined"
              color="primary"
              onClick={handleAllocationClick}
              startIcon={<EditIcon />}
              disabled={isLoading}
            >
              Edit Allocation
            </Button>
          </Box>
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : consumptionData.length === 0 ? (
          <Alert severity="info" sx={{ m: 2 }}>No consumption data available</Alert>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Month</TableCell>
                <TableCell>Site Name</TableCell>
                {['c1', 'c2', 'c3', 'c4', 'c5'].map(period => (
                  <TableCell key={period} align="right">
                    <Tooltip title={PEAK_PERIODS.includes(period) ? "Peak Period" : "Non-Peak Period"}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        {period.toUpperCase()}
                        <InfoIcon 
                          sx={{ 
                            ml: 0.5, 
                            fontSize: '1rem', 
                            color: PEAK_PERIODS.includes(period) ? 'warning.main' : 'primary.main' 
                          }} 
                        />
                      </Box>
                    </Tooltip>
                  </TableCell>
                ))}
                <TableCell align="right">Peak Total</TableCell>
                <TableCell align="right">Non-Peak Total</TableCell>
                <TableCell align="right">Total Units</TableCell>
                <TableCell align="right">
                  <Tooltip title="Percentage of units to be allocated from available production units">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      Allocation %
                      <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: 'primary.main' }} />
                    </Box>
                  </Tooltip>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupedData.map(([month, rows]) => (
                rows.map((row, index) => (
                  <TableRow 
                    key={`${month}-${index}`}
                    sx={{ 
                      '&:nth-of-type(odd)': { backgroundColor: 'rgba(0, 0, 0, 0.02)' },
                      transition: 'background-color 0.2s'
                    }}
                  >
                    {index === 0 && (
                      <TableCell rowSpan={rows.length} sx={{ borderRight: '1px solid rgba(224, 224, 224, 0.4)' }}>
                        {formatMonth(month).display}
                      </TableCell>
                    )}
                    <TableCell>{row.siteName}</TableCell>
                    {['c1', 'c2', 'c3', 'c4', 'c5'].map(period => (
                      <TableCell key={period} align="right">
                        <Typography sx={{ 
                          color: PEAK_PERIODS.includes(period) ? 'warning.main' : 'primary.main',
                          fontWeight: PEAK_PERIODS.includes(period) ? 'bold' : 'normal'
                        }}>
                          {Math.round(Number(row[period]) || 0)}
                        </Typography>
                      </TableCell>
                    ))}
                    <TableCell align="right">
                      <Typography sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                        {calculatePeakTotal(row)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ color: 'primary.main' }}>
                        {calculateNonPeakTotal(row)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {calculateTotal(row)}
                    </TableCell>
                    <TableCell align="right">
                      <Typography color="secondary.main">
                        {getAllocationPercentage(row.consumptionSiteId)}%
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              ))}
              {totals && (
                <TotalRow sx={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.04)', 
                  borderTop: '2px solid rgba(224, 224, 224, 1)'
                }}>
                  <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Total</TableCell>
                  {['c1', 'c2', 'c3', 'c4', 'c5'].map(period => (
                    <TableCell key={period} align="right" sx={{ 
                      fontWeight: 'bold',
                      color: PEAK_PERIODS.includes(period) ? 'warning.main' : 'primary.main'
                    }}>
                      {totals[period]}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                    {totals.peak}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {totals.nonPeak}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {totals.total}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>
                    100%
                  </TableCell>
                </TotalRow>
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      <Dialog 
        open={allocationDialog} 
        onClose={() => !isProcessing && setAllocationDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Split Units Allocation</Typography>
            <Button
              variant="outlined"
              startIcon={<AutorenewIcon />}
              onClick={handleAutoAllocate}
              disabled={isProcessing}
              size="small"
            >
              Auto Split
            </Button>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle2">
                Total Allocation: {splitPercentages.reduce((sum, value) => sum + value, 0)}%
              </Typography>
              <Typography 
                variant="subtitle2" 
                color={Math.abs(splitPercentages.reduce((sum, value) => sum + value, 0) - 100) > 0.01 ? 'error' : 'success'}
              >
                Target: 100%
              </Typography>
            </Box>
            
            {dialogError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {dialogError}
              </Alert>
            )}

            {consumptionSites.map((site, index) => (
              <Box 
                key={site.consumptionSiteId} 
                sx={{ 
                  p: 2, 
                  my: 2, 
                  border: 1, 
                  borderRadius: 1, 
                  borderColor: 'grey.300',
                  backgroundColor: 'grey.50'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1">
                    {site.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Current: {splitPercentages[index] || 0}%
                  </Typography>
                </Box>
                
                <Box sx={{ px: 1 }}>
                  <Slider
                    value={splitPercentages[index] || 0}
                    onChange={(_, value) => {
                      const newSplits = [...splitPercentages];
                      newSplits[index] = value;
                      setSplitPercentages(newSplits);
                    }}
                    valueLabelDisplay="auto"
                    valueLabelFormat={value => `${value}%`}
                    max={100}
                    step={1}
                    disabled={isProcessing}
                  />
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Peak Units: {calculatePeakTotal(site)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Non-Peak Units: {calculateNonPeakTotal(site)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button 
            onClick={() => setAllocationDialog(false)} 
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveAllocation}
            variant="contained"
            color="primary"
            disabled={isProcessing || Math.abs(splitPercentages.reduce((sum, value) => sum + value, 0) - 100) > 0.01}
          >
            {isProcessing ? 'Saving...' : 'Save Allocation'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConsumptionUnitsTable;