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
import { CheckCircle, Cancel, Info as InfoIcon, Factory as FactoryIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

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

const ProductionUnitsTable = ({ data = [] }) => {
  const PEAK_PERIODS = ['c2', 'c3'];
  const NON_PEAK_PERIODS = ['c1', 'c4', 'c5'];
  const ALL_PERIODS = ['c1', 'c2', 'c3', 'c4', 'c5'];  // Ordered from c1 to c5

  const calculateTotal = (row) => {
    return ALL_PERIODS.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
  };

  const calculatePeakTotal = (row) => {
    return PEAK_PERIODS.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
  };

  const calculateNonPeakTotal = (row) => {
    return NON_PEAK_PERIODS.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
  };

  return (
    <TableContainer component={Paper} sx={{ mb: 4, mt: 2, boxShadow: 2 }}>
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(224, 224, 224, 1)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <FactoryIcon color="primary" />
        <Typography variant="h6">Production Units</Typography>
      </Box>
      <Table>
        <TableHead>
          <TableRow>
            <StyledTableHeader>Site Name</StyledTableHeader>
            <StyledTableHeader>Banking Status</StyledTableHeader>
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
          {data && data.length > 0 && data.map((row, index) => {
            const c1 = Number(row.c1) || 0;
            const c2 = Number(row.c2) || 0;
            const c3 = Number(row.c3) || 0;
            const c4 = Number(row.c4) || 0;
            const c5 = Number(row.c5) || 0;
            
            return (
              <TableRow key={index}>
                <TableCell>{row.siteName || row.productionSite}</TableCell>
                <TableCell>
                  <Chip
                    icon={row.banking === 1 ? <CheckCircle /> : <Cancel />}
                    label={row.banking === 1 ? 'Available' : 'Not Available'}
                    color={row.banking === 1 ? 'success' : 'error'}
                    variant="outlined"
                    size="small"
                  />
                </TableCell>
                <StyledTableCell align="right" isPeak={false}>
                  {c1}
                </StyledTableCell>
                <StyledTableCell align="right" isPeak={true}>
                  {c2}
                </StyledTableCell>
                <StyledTableCell align="right" isPeak={true}>
                  {c3}
                </StyledTableCell>
                <StyledTableCell align="right" isPeak={false}>
                  {c4}
                </StyledTableCell>
                <StyledTableCell align="right" isPeak={false}>
                  {c5}
                </StyledTableCell>
                <TotalCell align="right" className="peak">
                  {c2 + c3}
                </TotalCell>
                <TotalCell align="right" className="non-peak">
                  {c1 + c4 + c5}
                </TotalCell>
                <TotalCell align="right">
                  {c1 + c2 + c3 + c4 + c5}
                </TotalCell>
              </TableRow>
            );
          })}
          {data && data.length > 0 && (
            <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.04)' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
              <TableCell />
              <TotalCell align="right">
                {data.reduce((sum, row) => sum + (Number(row.c1) || 0), 0)}
              </TotalCell>
              <TotalCell align="right" className="peak">
                {data.reduce((sum, row) => sum + (Number(row.c2) || 0), 0)}
              </TotalCell>
              <TotalCell align="right" className="peak">
                {data.reduce((sum, row) => sum + (Number(row.c3) || 0), 0)}
              </TotalCell>
              <TotalCell align="right">
                {data.reduce((sum, row) => sum + (Number(row.c4) || 0), 0)}
              </TotalCell>
              <TotalCell align="right">
                {data.reduce((sum, row) => sum + (Number(row.c5) || 0), 0)}
              </TotalCell>
              <TotalCell align="right" className="peak">
                {data.reduce((sum, row) => sum + (Number(row.c2) || 0) + (Number(row.c3) || 0), 0)}
              </TotalCell>
              <TotalCell align="right">
                {data.reduce((sum, row) => sum + (Number(row.c1) || 0) + (Number(row.c4) || 0) + (Number(row.c5) || 0), 0)}
              </TotalCell>
              <TotalCell align="right">
                {data.reduce((sum, row) => sum + (Number(row.c1) || 0) + (Number(row.c2) || 0) + (Number(row.c3) || 0) + (Number(row.c4) || 0) + (Number(row.c5) || 0), 0)}
              </TotalCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ProductionUnitsTable;