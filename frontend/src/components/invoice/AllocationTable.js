import React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Tooltip,
  Box
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { CheckCircle, Cancel, Info as InfoIcon, Bolt as BoltIcon } from '@mui/icons-material';

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
  }
}));

const PERIODS = ['c1', 'c2', 'c3', 'c4', 'c5'];
const PEAK_PERIODS = ['c2', 'c3'];
const NON_PEAK_PERIODS = ['c1', 'c4', 'c5'];

const getPeriodLabel = (period) => {
  const periodMap = {
    c1: { 
      label: 'C1', 
      tooltip: 'Non-Peak Period', 
      color: 'success.light',
      isPeak: false 
    },
    c2: { 
      label: 'C2', 
      tooltip: 'Peak Period', 
      color: 'warning.light',
      isPeak: true 
    },
    c3: { 
      label: 'C3', 
      tooltip: 'Peak Period', 
      color: 'warning.light',
      isPeak: true 
    },
    c4: { 
      label: 'C4', 
      tooltip: 'Non-Peak Period', 
      color: 'success.light',
      isPeak: false 
    },
    c5: { 
      label: 'C5', 
      tooltip: 'Non-Peak Period',
      color: 'success.light',
      isPeak: false 
    },
  };
  return periodMap[period] || { 
    label: period.toUpperCase(), 
    tooltip: '', 
    color: 'inherit',
    isPeak: false 
  };
};

const AllocationTable = ({ data = [] }) => {
  // Calculate column totals
  const calculateColumnTotal = (period) => {
    return data.reduce((sum, row) => {
      const value = row.cValues?.[period] || 0;
      return sum + (typeof value === 'number' ? value : parseFloat(value) || 0);
    }, 0);
  };

  // Calculate row total
  const calculateRowTotal = (row) => {
    return PERIODS.reduce((sum, period) => {
      const value = row.cValues?.[period] || 0;
      return sum + (typeof value === 'number' ? value : parseFloat(value) || 0);
    }, 0);
  };

  // Calculate peak total
  const calculatePeakTotal = (row) => {
    return PEAK_PERIODS.reduce((sum, period) => {
      const value = row.cValues?.[period] || 0;
      return sum + (typeof value === 'number' ? value : parseFloat(value) || 0);
    }, 0);
  };

  // Calculate non-peak total
  const calculateNonPeakTotal = (row) => {
    return NON_PEAK_PERIODS.reduce((sum, period) => {
      const value = row.cValues?.[period] || 0;
      return sum + (typeof value === 'number' ? value : parseFloat(value) || 0);
    }, 0);
  };

  // Calculate grand totals
  const grandTotal = data.reduce((sum, row) => sum + calculateRowTotal(row), 0);
  const grandPeakTotal = data.reduce((sum, row) => sum + calculatePeakTotal(row), 0);
  const grandNonPeakTotal = data.reduce((sum, row) => sum + calculateNonPeakTotal(row), 0);

  // Helper to check if a period is peak
  const isPeakPeriod = (period) => PEAK_PERIODS.includes(period);

  // Render charge status chip
  const renderChargeStatus = (row) => {
    const isCharging = row.charge || row.cValues?.charge === 1 || row.cValues?.charge === true;
    return (
      <Chip
        label={isCharging ? 'Charging' : 'Not Charging'}
        color={isCharging ? 'success' : 'default'}
        size="small"
        icon={isCharging ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
      />
    );
  };

  // Format number with 2 decimal places
  const formatNumber = (num) => {
    const n = typeof num === 'number' ? num : parseFloat(num) || 0;
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <TableContainer component={Paper} sx={{ mb: 4, mt: 2, boxShadow: 2, width: '100%', overflowX: 'auto' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <BoltIcon color="primary" />
        <Typography variant="h6">Allocation Details</Typography>
      </Box>
      <Table sx={{ border: '1px solid black', borderTop: 'none', width: '100%' }}>
        <TableHead>
          <TableRow>
            <StyledTableHeader>Production Site</StyledTableHeader>
            <StyledTableHeader>Consumption Site</StyledTableHeader>
            <StyledTableHeader>Status</StyledTableHeader>
            
            {PERIODS.map((period) => {
              const { label, tooltip, color, isPeak } = getPeriodLabel(period);
              return (
                <StyledTableHeader key={period} align="right">
                  <Tooltip title={tooltip}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {label}
                      <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color }} />
                    </Box>
                  </Tooltip>
                </StyledTableHeader>
              );
            })}
            
            <StyledTableHeader align="right">Peak Total</StyledTableHeader>
            <StyledTableHeader align="right">Off-Peak Total</StyledTableHeader>
            <StyledTableHeader align="right">Total</StyledTableHeader>
          </TableRow>
        </TableHead>
        
        <TableBody>
          {data.map((row, index) => {
            const rowTotal = calculateRowTotal(row);
            const peakTotal = calculatePeakTotal(row);
            const nonPeakTotal = calculateNonPeakTotal(row);
            
            return (
              <TableRow key={index} hover>
                <TableCell>
                  <Box sx={{ fontWeight: 'medium' }}>{row.productionSiteName || 'N/A'}</Box>
                  <Typography variant="caption" color="text.secondary">
                    ID: {row.productionSiteId || 'N/A'}
                  </Typography>
                </TableCell>
                
                <TableCell>
                  <Box sx={{ fontWeight: 'medium' }}>{row.consumptionSiteName || 'N/A'}</Box>
                  <Typography variant="caption" color="text.secondary">
                    ID: {row.consumptionSiteId || 'N/A'}
                  </Typography>
                </TableCell>
                
                <TableCell>{renderChargeStatus(row)}</TableCell>
                
                {PERIODS.map((period) => {
                  const value = row.cValues?.[period] || 0;
                  const { isPeak } = getPeriodLabel(period);
                  return (
                    <StyledTableCell key={period} align="right" isPeak={isPeak}>
                      {formatNumber(value)}
                    </StyledTableCell>
                  );
                })}
                
                <TotalCell align="right" className="peak">
                  {formatNumber(peakTotal)}
                </TotalCell>
                
                <TotalCell align="right" className="non-peak">
                  {formatNumber(nonPeakTotal)}
                </TotalCell>
                
                <TotalCell align="right">
                  {formatNumber(rowTotal)}
                </TotalCell>
              </TableRow>
            );
          })}
          
          {/* Grand Total Row */}
          <TableRow>
            <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>Grand Total:</TableCell>
            
            {PERIODS.map((period) => (
              <TotalCell key={`total-${period}`} align="right">
                {formatNumber(calculateColumnTotal(period))}
              </TotalCell>
            ))}
            
            <TotalCell align="right" className="peak">
              {formatNumber(grandPeakTotal)}
            </TotalCell>
            
            <TotalCell align="right" className="non-peak">
              {formatNumber(grandNonPeakTotal)}
            </TotalCell>
            
            <TotalCell align="right">
              {formatNumber(grandTotal)}
            </TotalCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default AllocationTable;
