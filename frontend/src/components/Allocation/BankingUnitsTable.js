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
import {
  AccountBalance as BankingIcon,
  Info as InfoIcon
} from '@mui/icons-material';

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
    <TableContainer component={Paper} sx={{ mb: 4 }}>
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(224, 224, 224, 1)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <BankingIcon color="primary" />
        <Typography variant="h6">Banking Units</Typography>
      </Box>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Site Name</TableCell>
            {ALL_PERIODS.map(period => (
              <TableCell key={period} align="right">
                <Tooltip title={PEAK_PERIODS.includes(period) ? "Peak Period" : "Non-Peak Period"}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {period.toUpperCase()}
                    <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: PEAK_PERIODS.includes(period) ? 'warning.main' : 'primary.main' }} />
                  </Box>
                </Tooltip>
              </TableCell>
            ))}
            <TableCell align="right">Previous Balance</TableCell>
            <TableCell align="right">Current Balance</TableCell>
            <TableCell align="right">Net Balance</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {bankingData.map((row, index) => {
            const netValues = calculateNetBanking(row);
            return (
              <TableRow key={`${row.productionSiteId}-${index}`} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {row.siteName}
                  </Box>
                </TableCell>
                {ALL_PERIODS.map(period => {
                  const value = formatValue(netValues[period]);
                  const total = calculatePeriodTotal(row, [period]);
                  return (
                    <TableCell key={period} align="right">
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <Typography sx={{
                          color: PEAK_PERIODS.includes(period) ? 'warning.main' : 'primary.main',
                          fontWeight: PEAK_PERIODS.includes(period) ? 'bold' : 'normal'
                        }}>
                          {value}
                        </Typography>
                        <Typography variant="caption" sx={{
                          color: 'text.secondary',
                          fontSize: '0.75rem'
                        }}>
                          Total: {total}
                        </Typography>
                      </Box>
                    </TableCell>
                  );
                })}
                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                  <Typography variant="caption" sx={{
                    color: 'text.secondary',
                    fontSize: '0.75rem'
                  }}>
                    Previous Total: {calculatePeriodTotal(row.previousBalance, ALL_PERIODS)}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  <Typography variant="caption" sx={{
                    color: 'primary.main',
                    fontSize: '0.75rem'
                  }}>
                    Current Total: {calculatePeriodTotal(row, ALL_PERIODS)}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ 
                  fontWeight: 'bold', 
                  color: calculateNetBalance(row) > 0 ? 'success.main' : 'error.main'
                }}>
                  <Typography variant="caption" sx={{
                    fontSize: '0.75rem'
                  }}>
                    Net Total: {calculateNetBalance(row)}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default BankingUnitsTable;