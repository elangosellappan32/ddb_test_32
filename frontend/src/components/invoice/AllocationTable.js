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
  Tooltip,
  Box
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Info as InfoIcon } from '@mui/icons-material';

// Styled components for consistent styling
const StyledTableHeader = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.common.white,
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
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

const ALLOCATION_PERIODS = ['c1', 'c2', 'c3', 'c4', 'c5'];
const PEAK_PERIODS = ['c2', 'c3'];
const NON_PEAK_PERIODS = ['c1', 'c4', 'c5'];

const AllocationTable = ({ data = [] }) => {
  const calculateColumnTotal = (period) =>
    data.reduce((sum, row) => sum + (parseFloat(row.cValues?.[period]) || 0), 0);

  const grandTotal = ALLOCATION_PERIODS.reduce(
    (sum, period) => sum + calculateColumnTotal(period),
    0
  );

  const isPeakPeriod = (period) => PEAK_PERIODS.includes(period);
  const getPeriodLabel = (period) => {
    const periodMap = {
      c1: { label: 'C1', tooltip: 'Non-Peak Period' },
      c2: { label: 'C2', tooltip: 'Peak Period' },
      c3: { label: 'C3', tooltip: 'Peak Period' },
      c4: { label: 'C4', tooltip: 'Non-Peak Period' },
      c5: { label: 'C5', tooltip: 'Non-Peak Period' },
    };
    return periodMap[period] || { label: period.toUpperCase(), tooltip: '' };
  };

  return (
    <TableContainer component={Paper} sx={{ mb: 4, boxShadow: 2, width: '100%', overflowX: 'auto', '& .MuiTable-root': { borderTop: 'none' } }}>
      <Table sx={{ minWidth: 1500, width: '100%', border: '1px solid black', tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <StyledTableHeader sx={{ minWidth: 250, width: '20%' }}>Production Site</StyledTableHeader>
            <StyledTableHeader sx={{ minWidth: 250, width: '20%' }}>Consumption Site</StyledTableHeader>
            {ALLOCATION_PERIODS.map((period) => {
              const { label, tooltip } = getPeriodLabel(period);
              return (
                <StyledTableHeader key={period} align="right" sx={{ minWidth: 120, width: '8%' }}>
                  <Tooltip title={tooltip}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {label}
                      <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: isPeakPeriod(period) ? 'warning.light' : 'success.light' }} />
                    </Box>
                  </Tooltip>
                </StyledTableHeader>
              );
            })}
            <StyledTableHeader align="right" sx={{ minWidth: 140, width: '10%' }}>Peak Total</StyledTableHeader>
            <StyledTableHeader align="right" sx={{ minWidth: 160, width: '12%' }}>Non-Peak Total</StyledTableHeader>
            <StyledTableHeader align="right" sx={{ minWidth: 140, width: '10%' }}>Total Units</StyledTableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => {
            const rowValues = ALLOCATION_PERIODS.map(period => ({
              period,
              value: parseFloat(row.cValues?.[period]) || 0
            }));
            
            const peakTotal = rowValues
              .filter(v => isPeakPeriod(v.period))
              .reduce((sum, v) => sum + v.value, 0);
              
            const nonPeakTotal = rowValues
              .filter(v => !isPeakPeriod(v.period))
              .reduce((sum, v) => sum + v.value, 0);
              
            const rowTotal = rowValues.reduce((sum, v) => sum + v.value, 0);

            return (
              <TableRow key={`${row.productionSiteId}-${row.consumptionSiteId}`}>
                <TableCell>{row.productionSiteName || row.productionSiteId}</TableCell>
                <TableCell>{row.consumptionSiteName || row.consumptionSiteId}</TableCell>
                {rowValues.map(({ period, value }) => (
                  <StyledTableCell 
                    key={period} 
                    align="right"
                    isPeak={isPeakPeriod(period)}
                  >
                    {value.toFixed(2)}
                  </StyledTableCell>
                ))}
                <TotalCell align="right" className="peak">
                  {peakTotal.toFixed(2)}
                </TotalCell>
                <TotalCell align="right" className="non-peak">
                  {nonPeakTotal.toFixed(2)}
                </TotalCell>
                <TotalCell align="right">
                  {rowTotal.toFixed(2)}
                </TotalCell>
              </TableRow>
            );
          })}
          {data.length > 0 && (
            <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.04)' }}>
              <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Total</TableCell>
              {ALLOCATION_PERIODS.map((period) => (
                <TotalCell key={period} align="right" className={isPeakPeriod(period) ? 'peak' : ''}>
                  {calculateColumnTotal(period).toFixed(2)}
                </TotalCell>
              ))}
              <TotalCell align="right" className="peak">
                {data.reduce((sum, row) => {
                  return sum + PEAK_PERIODS.reduce((s, p) => s + (parseFloat(row.cValues?.[p]) || 0), 0);
                }, 0).toFixed(2)}
              </TotalCell>
              <TotalCell align="right" className="non-peak">
                {data.reduce((sum, row) => {
                  return sum + NON_PEAK_PERIODS.reduce((s, p) => s + (parseFloat(row.cValues?.[p]) || 0), 0);
                }, 0).toFixed(2)}
              </TotalCell>
              <TotalCell align="right">
                {grandTotal.toFixed(2)}
              </TotalCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default AllocationTable;
