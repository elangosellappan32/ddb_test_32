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
const ALL_PERIODS = ['c1', 'c2', 'c3', 'c4', 'c5'];

// Styled components for consistent styling
const StyledTableHeader = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.common.white,
  fontWeight: 'bold',
  '& .MuiTypography-root': {
    color: 'inherit',
    fontWeight: 'inherit',
  }
}));

const StyledTableCell = styled(TableCell, {
  shouldForwardProp: (prop) => prop !== 'isPeak'
})(({ theme, isPeak }) => ({
  '&.MuiTableCell-root': {
    padding: theme.spacing(1.5),
    transition: 'background-color 0.2s',
    ...(isPeak ? {
      color: theme.palette.warning.dark,
      backgroundColor: 'rgba(255, 152, 0, 0.08)',
      '&:hover': {
        backgroundColor: 'rgba(255, 152, 0, 0.12)',
      }
    } : {
      color: theme.palette.success.main,
      backgroundColor: 'rgba(76, 175, 80, 0.08)',
      '&:hover': {
        backgroundColor: 'rgba(76, 175, 80, 0.12)',
      }
    })
  }
}));

const TotalCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.palette.primary.main,
  backgroundColor: 'rgba(25, 118, 210, 0.08)',
  '&.peak': {
    color: theme.palette.warning.dark,
  },
  '&.non-peak': {
    color: theme.palette.success.main,
  },
  '&.allocation': {
    color: theme.palette.primary.main,
  }
}));

const AllocationCell = styled(TableCell)(({ theme }) => ({
  textAlign: 'right',
  fontWeight: 'bold',
  color: theme.palette.primary.main,
  backgroundColor: 'rgba(25, 118, 210, 0.04)',
  '&:hover': {
    backgroundColor: 'rgba(25, 118, 210, 0.08)',
  }
}));

const MonthGroupCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.grey[100],
  fontWeight: 'bold',
  padding: theme.spacing(1),
}));

const TotalRow = styled(TableRow)(({ theme }) => ({
  backgroundColor: 'rgba(0, 0, 0, 0.04)',
  borderTop: '2px solid rgba(224, 224, 224, 1)',
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

const ConsumptionUnitsTable = ({ 
  consumptionData, 
  isLoading, 
  error, 
  onAllocationSaved, 
  companyId, 
  shareholdings = [] 
}) => {
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

  const handleAllocationClick = useCallback(async () => {
    try {
      setIsProcessing(true);
      
      // Fetch consumption sites
      const sitesResponse = await api.get('/consumption-site/all');
      const sites = sitesResponse.data?.data || [];
      
      // Filter shareholdings by the current company ID
      const filteredShareholdings = shareholdings.filter(
        sh => sh.generatorCompanyId === Number(companyId)
      );
      
      setConsumptionSites(sites);
      
      if (sites.length > 0) {
        if (filteredShareholdings.length > 0) {
          // Map shareholding percentages to sites
          const percentages = sites.map(site => {
            const share = filteredShareholdings.find(
              sh => sh.consumptionSiteId === site.consumptionSiteId
            );
            return share ? share.shareholdingPercentage : 0;
          });
          setSplitPercentages(percentages);
        } else {
          initializeEqualSplitPercentages(sites.length);
          enqueueSnackbar('No shareholding data found for this company', { variant: 'warning' });
        }
        setAllocationDialog(true);
      } else {
        enqueueSnackbar('No consumption sites available', { variant: 'warning' });
      }
    } catch (error) {
      console.error('Error loading allocation data:', error);
      enqueueSnackbar('Failed to load allocation data', { variant: 'error' });
    } finally {
      setIsProcessing(false);
    }
  }, [companyId, shareholdings, enqueueSnackbar, initializeEqualSplitPercentages]);


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
  const handleSaveAllocation = useCallback(async () => {
    const total = splitPercentages.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 100) > 0.01) {
      setDialogError("Total allocation must equal 100%");
      return;
    }
    
    try {
      setIsProcessing(true);
      const updatePromises = consumptionSites.map((site, index) => {
        const shareholding = shareholdings.find(
          sh => sh.consumptionSiteId === site.consumptionSiteId && 
                sh.generatorCompanyId === Number(companyId)
        );
        
        const captiveData = {
          generatorCompanyId: Number(companyId),
          shareholderCompanyId: shareholding?.shareholderCompanyId || Number(site.consumptionSiteId),
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
  }, [companyId, consumptionSites, enqueueSnackbar, onAllocationSaved, shareholdings, splitPercentages]);

  const getAllocationPercentage = useCallback((consumptionSiteId) => {
    const index = consumptionSites.findIndex(site => site.consumptionSiteId === consumptionSiteId);
    if (index !== -1) {
      return splitPercentages[index] || 0;
    }
    return 0;
  }, [consumptionSites, splitPercentages]);

  // Load saved allocations on mount and when shareholdings change
  useEffect(() => {
    const loadSavedAllocations = async () => {
      if (!companyId) return;
      
      try {
        setIsProcessing(true);
        
        // Load consumption sites
        const sitesResponse = await api.get('/consumption-site/all');
        const sites = sitesResponse.data?.data || [];
        setConsumptionSites(sites);
        
        if (sites.length === 0) {
          enqueueSnackbar('No consumption sites available', { variant: 'warning' });
          return;
        }
        
        // Use the shareholdings passed as props, which are already filtered by companyId
        if (shareholdings && shareholdings.length > 0) {
          // Map shareholding percentages to sites for the current company
          const percentages = sites.map(site => {
            const share = shareholdings.find(
              sh => sh.consumptionSiteId === site.consumptionSiteId && 
                    sh.generatorCompanyId === Number(companyId)
            );
            return share ? share.shareholdingPercentage : 0;
          });
          setSplitPercentages(percentages);
        } else {
          // Fallback to equal split if no shareholdings found
          
          initializeEqualSplitPercentages(sites.length);
        }
      } catch (error) {
        console.error('Error loading saved allocations:', error);
        enqueueSnackbar('Error loading allocations', { variant: 'error' });
      } finally {
        setIsProcessing(false);
      }
    };

    loadSavedAllocations();
  }, [companyId, enqueueSnackbar, initializeEqualSplitPercentages, shareholdings, setIsProcessing]);

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
      <TableContainer component={Paper} sx={{ mb: 4, mt: 2, boxShadow: 2 }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingDown color="primary" />
            <Typography variant="h6">Consumption Units</Typography>
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
              Edit
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
          <Table sx={{ border: '1px solid black', borderTop: 'none' }}>
            <TableHead>
              <TableRow>
                <StyledTableHeader>Month</StyledTableHeader>
                <StyledTableHeader>Site Name</StyledTableHeader>
                <StyledTableHeader align="right">
                  <Tooltip title="Non-Peak Period">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      C1
                      <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: 'success.light' }} />
                    </Box>
                  </Tooltip>
                </StyledTableHeader>
                <StyledTableHeader align="right">
                  <Tooltip title="Peak Period">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      C2
                      <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: 'warning.light' }} />
                    </Box>
                  </Tooltip>
                </StyledTableHeader>
                <StyledTableHeader align="right">
                  <Tooltip title="Peak Period">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      C3
                      <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: 'warning.light' }} />
                    </Box>
                  </Tooltip>
                </StyledTableHeader>
                <StyledTableHeader align="right">
                  <Tooltip title="Non-Peak Period">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      C4
                      <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: 'success.light' }} />
                    </Box>
                  </Tooltip>
                </StyledTableHeader>
                <StyledTableHeader align="right">
                  <Tooltip title="Non-Peak Period">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      C5
                      <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: 'success.light' }} />
                    </Box>
                  </Tooltip>
                </StyledTableHeader>
                <StyledTableHeader align="right">Peak Total</StyledTableHeader>
                <StyledTableHeader align="right">Non-Peak Total</StyledTableHeader>
                <StyledTableHeader align="right">Total Units</StyledTableHeader>
                <StyledTableHeader align="right">
                  <Tooltip title="Percentage of units to be allocated from available production units">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      Allocation %
                      <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: 'primary.light' }} />
                    </Box>
                  </Tooltip>
                </StyledTableHeader>
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
                    <StyledTableCell align="right" isPeak={false}>
                      {Math.round(Number(row.c1) || 0)}
                    </StyledTableCell>
                    <StyledTableCell align="right" isPeak={true}>
                      {Math.round(Number(row.c2) || 0)}
                    </StyledTableCell>
                    <StyledTableCell align="right" isPeak={true}>
                      {Math.round(Number(row.c3) || 0)}
                    </StyledTableCell>
                    <StyledTableCell align="right" isPeak={false}>
                      {Math.round(Number(row.c4) || 0)}
                    </StyledTableCell>
                    <StyledTableCell align="right" isPeak={false}>
                      {Math.round(Number(row.c5) || 0)}
                    </StyledTableCell>
                    <TotalCell align="right" className="peak">
                      {calculatePeakTotal(row)}
                    </TotalCell>
                    <TotalCell align="right" className="non-peak">
                      {calculateNonPeakTotal(row)}
                    </TotalCell>
                    <TotalCell align="right">
                      {calculateTotal(row)}
                    </TotalCell>
                    <AllocationCell>
                      {getAllocationPercentage(row.consumptionSiteId)}%
                    </AllocationCell>
                  </TableRow>
                ))
              ))}
              {totals && (
                <TableRow sx={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.04)', 
                  borderTop: '2px solid rgba(224, 224, 224, 1)'
                }}>
                  <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Total</TableCell>
                  <TotalCell align="right">
                    {totals.c1}
                  </TotalCell>
                  <TotalCell align="right" className="peak">
                    {totals.c2}
                  </TotalCell>
                  <TotalCell align="right" className="peak">
                    {totals.c3}
                  </TotalCell>
                  <TotalCell align="right">
                    {totals.c4}
                  </TotalCell>
                  <TotalCell align="right">
                    {totals.c5}
                  </TotalCell>
                  <TotalCell align="right" className="peak">
                    {totals.peak}
                  </TotalCell>
                  <TotalCell align="right" className="non-peak">
                    {totals.nonPeak}
                  </TotalCell>
                  <TotalCell align="right">
                    {totals.total}
                  </TotalCell>
                  <AllocationCell>
                    100%
                  </AllocationCell>
                </TableRow>
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