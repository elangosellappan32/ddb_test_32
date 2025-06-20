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
import { CheckCircle, Cancel, Info as InfoIcon } from '@mui/icons-material';

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
    <TableContainer component={Paper} sx={{ mb: 4, mt: 2 }}>
      <Typography variant="h6" sx={{ p: 2, borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
        Production Units
      </Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Site Name</TableCell>
            <TableCell>Banking Status</TableCell>
            <TableCell align="right">
              <Tooltip title="Non-Peak Period">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  C1
                  <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: 'primary.main' }} />
                </Box>
              </Tooltip>
            </TableCell>
            <TableCell align="right">
              <Tooltip title="Peak Period">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  C2
                  <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: 'warning.main' }} />
                </Box>
              </Tooltip>
            </TableCell>
            <TableCell align="right">
              <Tooltip title="Peak Period">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  C3
                  <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: 'warning.main' }} />
                </Box>
              </Tooltip>
            </TableCell>
            <TableCell align="right">
              <Tooltip title="Non-Peak Period">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  C4
                  <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: 'primary.main' }} />
                </Box>
              </Tooltip>
            </TableCell>
            <TableCell align="right">
              <Tooltip title="Non-Peak Period">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  C5
                  <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', color: 'primary.main' }} />
                </Box>
              </Tooltip>
            </TableCell>
            <TableCell align="right">Peak Total</TableCell>
            <TableCell align="right">Non-Peak Total</TableCell>
            <TableCell align="right">Total Units</TableCell>
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
                <TableCell align="right">
                  <Typography align="right" sx={{ color: 'primary.main' }}>{c1}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography align="right" sx={{ color: 'warning.main' }}>{c2}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography align="right" sx={{ color: 'warning.main' }}>{c3}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography align="right" sx={{ color: 'primary.main' }}>{c4}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography align="right" sx={{ color: 'primary.main' }}>{c5}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                    {c2 + c3}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography sx={{ color: 'primary.main' }}>
                    {c1 + c4 + c5}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {c1 + c2 + c3 + c4 + c5}
                </TableCell>
              </TableRow>
            );
          })}
          {data && data.length > 0 && (
            <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.04)' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
              <TableCell />
              {['c1', 'c2', 'c3', 'c4', 'c5'].map(period => (
                <TableCell key={period} align="right" sx={{ 
                  fontWeight: 'bold',
                  color: period === 'c2' || period === 'c3' ? 'warning.main' : 'primary.main'
                }}>
                  {data.reduce((sum, row) => sum + (Number(row[period]) || 0), 0)}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                {data.reduce((sum, row) => sum + (Number(row.c2) || 0) + (Number(row.c3) || 0), 0)}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                {data.reduce((sum, row) => sum + (Number(row.c1) || 0) + (Number(row.c4) || 0) + (Number(row.c5) || 0), 0)}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                {data.reduce((sum, row) => sum + (Number(row.c1) || 0) + (Number(row.c2) || 0) + (Number(row.c3) || 0) + (Number(row.c4) || 0) + (Number(row.c5) || 0), 0)}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ProductionUnitsTable;