import React, { useMemo } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TableSortLabel,
  Box,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Info as InfoIcon } from '@mui/icons-material';

// Styled components for consistent styling
const StyledTableHeader = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: `${theme.palette.common.white} !important`,
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
  '& .MuiTypography-root, & .MuiTableSortLabel-root, & .MuiSvgIcon-root, & .MuiTableSortLabel-icon': {
    color: `${theme.palette.common.white} !important`,
    fontWeight: 'inherit',
  },
  '&:hover': {
    '& .MuiTableSortLabel-root, & .MuiSvgIcon-root, & .MuiTableSortLabel-icon': {
      color: `${theme.palette.common.white} !important`,
      opacity: 0.8,
    }
  }
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  padding: theme.spacing(1.5),
  textAlign: 'right',
  '&.MuiTableCell-root': {
    padding: theme.spacing(1.5),
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: 'rgba(25, 118, 210, 0.04)'
    }
  }
}));

const TotalCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.palette.primary.main,
  backgroundColor: 'rgba(25, 118, 210, 0.08)'
}));

const ALL_CHARGES = Array.from({ length: 11 }, (_, i) => `C${(i + 1).toString().padStart(3, '0')}`);

const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '-';
  const number = typeof num === 'string' ? parseFloat(num) : num;
  return Math.round(number).toString();
};

const ChargeTable = ({
  data = [],
  sortConfig = { order: 'asc', orderBy: 'productionSiteName' },
  onRequestSort = () => {},
  loading = false,
  error = null,
}) => {

  // Calculate column totals and grand total
  const { columnTotals, grandTotal } = useMemo(() => {
    const totals = {};
    ALL_CHARGES.forEach((charge) => {
      totals[charge] = 0;
    });
    let total = 0;

    data.forEach((row) => {
      ALL_CHARGES.forEach((charge) => {
        const val = Number(row.cValues?.[charge]) || 0;
        totals[charge] += val;
        total += val;
      });
    });
    return { 
      columnTotals: totals, 
      grandTotal: total
    };
  }, [data]);

  const handleSort = (property) => {
    const isAsc = sortConfig.orderBy === property && sortConfig.order === 'asc';
    onRequestSort(property, isAsc ? 'desc' : 'asc');
  };

  if (loading) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading charge data...</Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Error loading charge data: {error.message || error}</Alert>;
  }

  if (!data.length) {
    return <Typography sx={{ textAlign: 'center', my: 2 }}>No charge data available</Typography>;
  }

  return (
    <TableContainer component={Paper} sx={{ mb: 4, boxShadow: 2, width: '100%', overflowX: 'auto', '& .MuiTable-root': { borderTop: 'none' } }}>
      <Table sx={{ minWidth: 1800, width: '100%', border: '1px solid black', tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <StyledTableHeader sx={{ minWidth: 300, width: '25%' }}>
              <TableSortLabel
                active={sortConfig.orderBy === 'productionSiteName'}
                direction={sortConfig.orderBy === 'productionSiteName' ? sortConfig.order : 'asc'}
                onClick={() => handleSort('productionSiteName')}
                sx={{ color: 'white' }}
              >
                Production Site
              </TableSortLabel>
            </StyledTableHeader>
            {ALL_CHARGES.map((charge) => (
              <StyledTableHeader key={charge} align="right" sx={{ minWidth: 120, width: '8%' }}>
                <Tooltip title={`Charge ${charge}`}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {charge}
                    <InfoIcon sx={{ ml: 0.5, fontSize: '1rem' }} />
                  </Box>
                </Tooltip>
              </StyledTableHeader>
            ))}
            <StyledTableHeader align="right" sx={{ minWidth: 140, width: '10%' }}>Total</StyledTableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => {
            const rowValues = ALL_CHARGES.map(charge => ({
              charge,
              value: Number(row.cValues?.[charge]) || 0
            }));
            
            const rowTotal = rowValues.reduce((sum, v) => sum + v.value, 0);

            return (
              <TableRow key={row.id || row.productionSiteName}>
                <TableCell>{row.productionSiteName || 'Unknown Site'}</TableCell>
                {rowValues.map(({ charge, value }) => (
                  <StyledTableCell 
                    key={charge} 
                    align="right"
                  >
                    {formatNumber(value)}
                  </StyledTableCell>
                ))}
                <TotalCell align="right">
                  {formatNumber(rowTotal)}
                </TotalCell>
              </TableRow>
            );
          })}
          {data.length > 0 && (
            <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.04)' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
              {ALL_CHARGES.map((charge) => (
                <TotalCell 
                  key={charge} 
                  align="right" 
                >
                  {formatNumber(columnTotals[charge])}
                </TotalCell>
              ))}
              <TotalCell align="right">
                {formatNumber(grandTotal)}
              </TotalCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ChargeTable;
