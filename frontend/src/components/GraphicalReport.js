import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const GraphicalReport = () => {
  return (
    <Box p={3}>
      <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Graphical Reports
        </Typography>
        <Typography variant="body1">
          This is a placeholder for the Graphical Reports component.
        </Typography>
      </Paper>
    </Box>
  );
};

export default GraphicalReport;