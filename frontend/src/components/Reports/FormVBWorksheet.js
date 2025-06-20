import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

// Styled components
const StyledTableCell = styled(TableCell)(({ theme, isheader }) => ({
  padding: theme.spacing(1),
  ...(isheader === 'true' && {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.common.white,
    fontWeight: 'bold',
  }),
}));

const StatusBadge = styled(Box)(({ theme, status }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.shape.borderRadius,
  color: status === 'Yes' ? theme.palette.success.main : theme.palette.error.main,
  backgroundColor: status === 'Yes' ? theme.palette.success.lighter : theme.palette.error.lighter,
  fontSize: '0.875rem',
}));

const FormVBWorksheet = ({ data }) => {
  if (!data || !data.siteMetrics) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>No data available</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ mb: 4, mt: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>            <StyledTableCell isheader="true" rowSpan={2} align="center">Sl. No.</StyledTableCell>
            <StyledTableCell isheader="true" rowSpan={2} align="center">Name of the Consumption Site</StyledTableCell>
            <StyledTableCell isheader="true" colSpan={2} align="center">Equity Pattern</StyledTableCell>
            <StyledTableCell isheader="true" rowSpan={2} align="center">% of annual generation to be consumed</StyledTableCell>
            <StyledTableCell isheader="true" rowSpan={2} align="center">100% annual generation in MUs (x)</StyledTableCell>
            <StyledTableCell isheader="true" rowSpan={2} align="center">
              <Box>Annual Auxiliary</Box>
              <Box>consumption in MUs (y)</Box>
            </StyledTableCell>
            <StyledTableCell isheader="true" rowSpan={2} align="center">
              <Box>Generation considered to verify</Box>
              <Box>consumption criteria in MUs (x-y)*51%</Box>
            </StyledTableCell>
            <StyledTableCell isheader="true" colSpan={3} align="center" sx={{ backgroundColor: '#f0f4f8' }}>
              Permitted consumption as per norms in MUs
            </StyledTableCell>
            <StyledTableCell isheader="true" rowSpan={2} align="center">
              <Box>Actual</Box>
              <Box>consumption in MUs</Box>
            </StyledTableCell>
            <StyledTableCell isheader="true" rowSpan={2} align="center">
              <Box>Whether</Box>
              <Box>consumption</Box>
              <Box>norms met</Box>
            </StyledTableCell>
          </TableRow>
          <TableRow>            <StyledTableCell isheader="true" align="center">As per share certificates as on 31st March</StyledTableCell>
            <StyledTableCell isheader="true" align="center">% of ownership through shares in Company/unit of CGP</StyledTableCell>
            <StyledTableCell isheader="true" align="center">with 0% variation</StyledTableCell>
            <StyledTableCell isheader="true" align="center">-10%</StyledTableCell>
            <StyledTableCell isheader="true" align="center">+10%</StyledTableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.siteMetrics.map((row, index) => (
            <TableRow key={row.consumptionSiteId || index}>
              <StyledTableCell align="center">{index + 1}</StyledTableCell>
              <StyledTableCell>{row.consumptionSite || row.siteName}</StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace' }}>
                {Math.round(row.equityShares || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace' }}>
                {(row.ownershipPercentage || 0).toFixed(2)}%
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace' }}>
                {(row.requiredConsumptionPercentage || 0).toFixed(2)}%
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace' }}>
                {Math.round(row.annualGeneration || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace' }}>
                {(row.auxiliaryConsumption || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace' }}>
                {Math.round(row.generationForConsumption || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace' }}>
                {Math.round(row.permittedConsumption?.withZero || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace' }}>
                {Math.round(row.permittedConsumption?.minus10 || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace' }}>
                {Math.round(row.permittedConsumption?.plus10 || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ 
                fontFamily: 'monospace',
                fontWeight: 500,
                color: 'primary.main'
              }}>
                {Math.round(row.actualConsumption || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="center">
                <StatusBadge status={row.consumptionNormsMet ? 'Yes' : 'No'}>
                  {row.consumptionNormsMet ? 
                    <CheckCircleIcon fontSize="inherit" /> : 
                    <ErrorIcon fontSize="inherit" />
                  }
                  {row.consumptionNormsMet ? 'Yes' : 'No'}
                </StatusBadge>
              </StyledTableCell>
            </TableRow>
          ))}
          
          {/* Totals Row */}
          {data.totals && (
            <TableRow sx={{ 
              backgroundColor: 'rgba(0, 0, 0, 0.04)', 
              borderTop: '2px solid rgba(224, 224, 224, 1)'
            }}>
              <StyledTableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Total</StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {Math.round(data.totals.totalEquityShares || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {(data.totals.totalOwnershipPercentage || 0).toFixed(2)}%
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {(data.totals.totalRequiredConsumptionPercentage || 0).toFixed(2)}%
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {Math.round(data.totals.annualGeneration || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {(data.totals.auxiliaryConsumption || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {Math.round(data.totals.generationForConsumption || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {Math.round(data.totals.permittedConsumption?.withZero || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {Math.round(data.totals.permittedConsumption?.minus10 || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {Math.round(data.totals.permittedConsumption?.plus10 || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {Math.round(data.totals.actualConsumption || 0).toLocaleString()}
              </StyledTableCell>
              <StyledTableCell></StyledTableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default FormVBWorksheet;