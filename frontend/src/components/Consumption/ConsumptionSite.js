import React from 'react';
import { Box, Typography, Grid, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';

// ...existing code...

const calculatePercentages = (site) => {
  const total = ['c1', 'c2', 'c3', 'c4', 'c5'].reduce((sum, period) => 
    sum + (Number(site[period]) || 0), 0);
    
  return {
    c1: total ? ((Number(site.c1) || 0) / total * 100).toFixed(1) : '0',
    c2: total ? ((Number(site.c2) || 0) / total * 100).toFixed(1) : '0',
    c3: total ? ((Number(site.c3) || 0) / total * 100).toFixed(1) : '0',
    c4: total ? ((Number(site.c4) || 0) / total * 100).toFixed(1) : '0',
    c5: total ? ((Number(site.c5) || 0) / total * 100).toFixed(1) : '0'
  };
};

const ConsumptionSiteDetails = ({ site, allocations }) => {
  const percentages = calculatePercentages(site);
  
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>Site Details</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Period</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Percentage</TableCell>
                  <TableCell align="right">Allocated</TableCell>
                  <TableCell align="right">Remaining</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {['c1', 'c2', 'c3', 'c4', 'c5'].map(period => {
                  const allocated = allocations
                    .filter(a => a.period === period.toUpperCase())
                    .reduce((sum, a) => sum + Number(a.amount), 0);
                  
                  const amount = Number(site[period]) || 0;
                  const remaining = amount - allocated;
                  
                  return (
                    <TableRow key={period}>
                      <TableCell>{period.toUpperCase()}</TableCell>
                      <TableCell align="right">{amount}</TableCell>
                      <TableCell align="right">{percentages[period]}%</TableCell>
                      <TableCell align="right">{allocated}</TableCell>
                      <TableCell align="right" 
                        sx={{ color: remaining > 0 ? 'error.main' : 'success.main' }}>
                        {remaining}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </Box>
  );
};

// ...existing code...