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
  Box,
  Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  AccountBalance as BankingIcon,
  Info as InfoIcon
} from '@mui/icons-material';

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
  shouldForwardProp: (prop) => prop !== 'isPeak' && prop !== 'isTotal'
})(({ theme, isPeak, isTotal }) => ({
  '&.MuiTableCell-root': {
    padding: theme.spacing(1.5),
    transition: 'background-color 0.2s',
    ...(isTotal ? {
      fontWeight: 'bold',
      color: theme.palette.primary.main,
      backgroundColor: 'rgba(25, 118, 210, 0.08)',
    } : isPeak ? {
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

const BankingUnitsTable = ({ bankingData = [], selectedYear }) => {
  const PEAK_PERIODS = ['c2', 'c3'];
  const NON_PEAK_PERIODS = ['c1', 'c4', 'c5'];
  const ALL_PERIODS = ['c1', 'c2', 'c3', 'c4', 'c5'];  // Ordered from c1 to c5

  const calculateNetBanking = (row) => {
    const periods = ['c1', 'c2', 'c3', 'c4', 'c5'];
    return periods.reduce((acc, period) => {
      const oldValue = Number(row?.previousBalance?.[period] || 0);
      const newValue = Number(row?.allocated?.[period] || row?.[period] || 0);
      return {
        ...acc,
        [period]: newValue + oldValue  // Add because banking values are stored as negatives
      };
    }, {});
  };

  // Calculate totals for a given row and periods
  const calculatePeriodTotal = (row, periods) => {
    if (!row) return 0;
    return periods.reduce((sum, period) => {
      const value = Math.round(Number(row?.allocated?.[period] || row?.[period] || 0));
      return sum + value;
    }, 0);
  };

  // Calculate net balance (difference between new production and used banking)
  const calculateNetBalance = (row) => {
    if (!row) return 0;
    const netValues = calculateNetBanking(row);
    return Object.values(netValues).reduce((sum, val) => sum + val, 0);
  };

  // Ensure values are properly rounded numbers and can be negative
  const formatValue = (value) => {
    const num = Math.round(Number(value || 0));
    return isNaN(num) ? 0 : num;
  };

  // Show net balance in the UI
  return (
    <TableContainer component={Paper} sx={{ mb: 6, mt: 2, boxShadow: 2 }}>
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(224, 224, 224, 1)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <BankingIcon color="primary" />
        <Typography variant="h6">Banking Units</Typography>
      </Box>
      <Table>
        <TableHead>
          <TableRow>
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
            <StyledTableHeader align="right">Previous Balance</StyledTableHeader>
            <StyledTableHeader align="right">Current Balance</StyledTableHeader>
            <StyledTableHeader align="right">Net Balance</StyledTableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {bankingData.length > 0 ? bankingData.map((row, index) => {
            const netValues = calculateNetBanking(row);
            return (
              <TableRow 
                key={`${row.productionSiteId}-${index}`}
                sx={{ 
                  '&:nth-of-type(odd)': { backgroundColor: 'rgba(0, 0, 0, 0.02)' },
                  transition: 'background-color 0.2s'
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {row.siteName}
                  </Box>
                </TableCell>
                <StyledTableCell align="right" isPeak={false}>
                  {formatValue(netValues.c1)}
                </StyledTableCell>
                <StyledTableCell align="right" isPeak={true}>
                  {formatValue(netValues.c2)}
                </StyledTableCell>
                <StyledTableCell align="right" isPeak={true}>
                  {formatValue(netValues.c3)}
                </StyledTableCell>
                <StyledTableCell align="right" isPeak={false}>
                  {formatValue(netValues.c4)}
                </StyledTableCell>
                <StyledTableCell align="right" isPeak={false}>
                  {formatValue(netValues.c5)}
                </StyledTableCell>
                <TotalCell align="right" className="non-peak">
                  {calculatePeriodTotal(row.previousBalance, ALL_PERIODS)}
                </TotalCell>
                <TotalCell align="right" className="allocation">
                  {calculatePeriodTotal(row, ALL_PERIODS)}
                </TotalCell>
                <TotalCell align="right" sx={{ 
                  color: calculateNetBalance(row) > 0 ? 'success.main' : 'error.main'
                }}>
                  {calculateNetBalance(row)}
                </TotalCell>
              </TableRow>
            );
          }) : (
            <TableRow>
              <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                <Typography color="textSecondary">No banking data available</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default BankingUnitsTable;