import React, { useState, useCallback } from 'react';
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
  Box,
  TableSortLabel
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { CheckCircle, Cancel, Info as InfoIcon, Bolt as BoltIcon, ArrowUpward, ArrowDownward } from '@mui/icons-material';

// Styled components for consistent styling
const StyledTableHeader = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: 'white !important',
  fontWeight: 'bold',
  '& .MuiTypography-root, & .MuiTableSortLabel-root, & .MuiSvgIcon-root': {
    color: 'white !important',
    fontWeight: 'inherit',
  },
  '&:hover': {
    '& .MuiTableSortLabel-root': {
      color: 'white !important',
    },
    '& .MuiSvgIcon-root': {
      color: 'white !important',
    }
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
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('productionSiteName');

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedData = useCallback(() => {
    return [...data].sort((a, b) => {
      const aValue = a[orderBy] || '';
      const bValue = b[orderBy] || '';
      return order === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });
  }, [data, order, orderBy]);

  const renderSortLabel = (label, columnId) => {
    return (
      <TableSortLabel
        active={orderBy === columnId}
        direction={orderBy === columnId ? order : 'asc'}
        onClick={() => handleRequestSort(columnId)}
        IconComponent={orderBy === columnId ? (order === 'asc' ? ArrowUpward : ArrowDownward) : ArrowUpward}
        sx={{ 
          '& .MuiTableSortLabel-icon': { 
            opacity: orderBy === columnId ? 1 : 0.5 
          } 
        }}
      >
        {label}
      </TableSortLabel>
    );
  };
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
        color={isCharging ? 'success' : 'error'}
        size="small"
        icon={isCharging ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
        sx={{
          '&.MuiChip-colorError': {
            backgroundColor: '#ffebee',
            color: '#d32f2f',
            '& .MuiSvgIcon-root': {
              color: '#d32f2f'
            }
          }
        }}
      />
    );
  };

  // Format number with 2 decimal places
  const formatNumber = (num) => {
    const n = typeof num === 'number' ? num : parseFloat(num) || 0;
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <TableContainer component={Paper} sx={{ mb: 4, boxShadow: 2, width: '100%', overflowX: 'auto' }}>
      <Table sx={{ border: '1px solid black', borderTop: 'none', width: '100%' }}>
        <TableHead>
          <TableRow>
            <StyledTableHeader>
              {renderSortLabel('Production Site', 'productionSiteName')}
            </StyledTableHeader>
            <StyledTableHeader>
              {renderSortLabel('Consumption Site', 'consumptionSiteName')}
            </StyledTableHeader>
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
            <StyledTableHeader align="right">Non-Peak Total</StyledTableHeader>
            <StyledTableHeader align="right">Total</StyledTableHeader>
          </TableRow>
        </TableHead>
        
        <TableBody>
          {sortedData().map((row, index) => {
            const rowTotal = calculateRowTotal(row);
            const peakTotal = calculatePeakTotal(row);
            const nonPeakTotal = calculateNonPeakTotal(row);
            
            return (
              <TableRow key={index} hover>
                <TableCell>
                  <Box sx={{ fontWeight: 'medium' }}>{row.productionSiteName || 'N/A'}</Box>
                </TableCell>
                
                <TableCell>
                  <Box sx={{ fontWeight: 'medium' }}>{row.consumptionSiteName || 'N/A'}</Box>
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
