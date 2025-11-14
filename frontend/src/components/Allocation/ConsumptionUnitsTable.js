import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useSnackbar } from 'notistack';
import { useAuth } from '../../context/AuthContext';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
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
import { Edit as EditIcon, Info as InfoIcon, TrendingDown } from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import { format } from "date-fns";
import AllocationPercentageDialog from "./AllocationPercentageDialog";

// Constants
const PEAK_PERIODS = ['c2', 'c3'];
const NON_PEAK_PERIODS = ['c1', 'c4', 'c5'];

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
  const { user } = useAuth();
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  
  // Handle dialog open
  const handleOpenAllocationDialog = useCallback(() => {
    console.log('Opening allocation dialog');
    setAllocationDialogOpen(true);
  }, []);

  const handleCloseAllocationDialog = useCallback(() => {
    console.log('Closing allocation dialog');
    setAllocationDialogOpen(false);
  }, []);

  // Debug effect to track dialog state
  useEffect(() => {
    console.log('Dialog open state:', allocationDialogOpen);
  }, [allocationDialogOpen]);

  const calculateTotal = useCallback((row, periods = ['c1', 'c2', 'c3', 'c4', 'c5']) => {
    return periods.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
  }, []);

  const calculatePeakTotal = useCallback((row) => 
    calculateTotal(row, PEAK_PERIODS), 
    [calculateTotal]
  );

  const calculateNonPeakTotal = useCallback((row) => 
    calculateTotal(row, NON_PEAK_PERIODS), 
    [calculateTotal]
  );

  const handleAllocationClick = useCallback(() => {
    setAllocationDialogOpen(true);
  }, []);

  const handleAllocationSave = useCallback(async () => {
    try {
      if (onAllocationSaved) {
        await onAllocationSaved();
      }
      setAllocationDialogOpen(false);
      enqueueSnackbar('Allocations saved successfully', { variant: 'success' });
    } catch (error) {
      console.error('Error saving allocations:', error);
      enqueueSnackbar(error.message || 'Failed to save allocations', { variant: 'error' });
    }
  }, [onAllocationSaved, enqueueSnackbar]);

  // Format month for display
  const formatMonth = (sk) => {
    if (!sk) return { display: "", api: "" };
    const month = parseInt(sk.substring(0, 2));
    const year = parseInt(sk.substring(2));
    return {
      display: format(new Date(year, month - 1), "MMMM yyyy"),
      api: `${month.toString().padStart(2, '0')}${year}`
    };
  };

  // Group data by month
  const groupedData = useMemo(() => {
    if (!consumptionData) return [];
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

  // Calculate totals
  const totals = useMemo(() => {
    if (!consumptionData || consumptionData.length === 0) return null;
    
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
              variant="contained"
              color="primary"
              onClick={handleOpenAllocationDialog}
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
                      {calculatePeakTotal(row).toLocaleString()}
                    </TotalCell>
                    <TotalCell align="right" className="non-peak">
                      {calculateNonPeakTotal(row).toLocaleString()}
                    </TotalCell>
                    <TotalCell align="right">
                      {calculateTotal(row).toLocaleString()}
                    </TotalCell>
                  </TableRow>
                ))
              ))}
              {totals && (
                <TotalRow>
                  <TableCell colSpan={2}><strong>Total</strong></TableCell>
                  <TotalCell align="right">{totals.c1.toLocaleString()}</TotalCell>
                  <TotalCell align="right" className="peak">{totals.c2.toLocaleString()}</TotalCell>
                  <TotalCell align="right" className="peak">{totals.c3.toLocaleString()}</TotalCell>
                  <TotalCell align="right">{totals.c4.toLocaleString()}</TotalCell>
                  <TotalCell align="right">{totals.c5.toLocaleString()}</TotalCell>
                  <TotalCell align="right" className="peak">{totals.peak.toLocaleString()}</TotalCell>
                  <TotalCell align="right" className="non-peak">{totals.nonPeak.toLocaleString()}</TotalCell>
                  <TotalCell align="right">{totals.total.toLocaleString()}</TotalCell>
                </TotalRow>
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

<AllocationPercentageDialog
        open={allocationDialogOpen}
        onClose={handleCloseAllocationDialog}
        onSave={handleAllocationSave}
        companyId={companyId}
        currentUser={user}
        shareholdings={shareholdings}
      />
    </>
  );
};

export default ConsumptionUnitsTable;