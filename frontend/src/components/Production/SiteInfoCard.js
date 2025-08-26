import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { Factory, LocationOn as LocationIcon, Power as PowerIcon, AccountBalance as BankIcon, Receipt as HtscIcon, AttachMoney as MoneyIcon } from '@mui/icons-material';

const SiteInfoCard = ({ site }) => {
  if (!site) return null;

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '0.00';
    const num = parseFloat(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const siteInfo = {
    name: site.name || 'Unnamed Site',
    location: site.location || 'Location not specified',
    capacity: site.capacity_MW || 0,
    voltage: site.injectionVoltage_KV || 0,
    type: site.type || 'Unknown',
    htscNo: site.htscNo || 'N/A',
    banking: Number(site.banking) === 1 ? 'Available' : 'Not Available',
    revenuePerUnit: site.revenuePerUnit != null ? formatNumber(site.revenuePerUnit) : '0.00'
  };

  const renderInfoItem = (Icon, label, value, color = 'primary.main') => (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
      <Icon sx={{ mr: 1, color }} />
      <Typography>
        <strong>{label}:</strong> {value}
      </Typography>
    </Box>
  );

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          {renderInfoItem(Factory, 'Name', siteInfo.name)}
          {renderInfoItem(LocationIcon, 'Location', siteInfo.location, 'error.main')}
          {renderInfoItem(PowerIcon, 'Type', siteInfo.type, 'warning.main')}
          {renderInfoItem(HtscIcon, 'HTSC No', siteInfo.htscNo)}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderInfoItem(PowerIcon, 'Capacity', `${siteInfo.capacity} MW`, 'success.main')}
          {renderInfoItem(PowerIcon, 'Injection Voltage', `${siteInfo.voltage} KV`, 'warning.main')}
          {renderInfoItem(MoneyIcon, 'Revenue per Unit', `₹${siteInfo.revenuePerUnit}/unit`, 'success.dark')}
          {renderInfoItem(BankIcon, 'Banking Status', siteInfo.banking, siteInfo.banking === 'Available' ? 'success.main' : 'error.main')}
        </Grid>
      </Grid>
    </Paper>
  );
};

export default SiteInfoCard;