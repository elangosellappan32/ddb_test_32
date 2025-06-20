import React from 'react';
import { Paper, Typography, Grid, Box } from '@mui/material';
import { 
  Factory as FactoryIcon, 
  LocationOn as LocationIcon,
  Power as PowerIcon,
  BatteryChargingFull as VoltageIcon,
  Engineering as HtscIcon,
  AccountBalance as BankIcon
} from '@mui/icons-material';

const SiteInfoCard = ({ site }) => {
  if (!site) return null;

  const siteInfo = {
    name: site.name || 'Unnamed Site',
    location: site.location || 'Location not specified',
    capacity: site.capacity_MW || 0,
    voltage: site.injectionVoltage_KV || 0,
    type: site.type || 'Unknown',
    htscNo: site.htscNo || 'N/A',
    banking: Number(site.banking) === 1 ? 'Available' : 'Not Available'
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
      <Typography variant="h5" gutterBottom color="primary.main">
        Site Information
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          {renderInfoItem(FactoryIcon, 'Name', siteInfo.name)}
          {renderInfoItem(LocationIcon, 'Location', siteInfo.location, 'error.main')}
          {renderInfoItem(PowerIcon, 'Type', siteInfo.type, 'warning.main')}
          {renderInfoItem(HtscIcon, 'HTSC No', siteInfo.htscNo)}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderInfoItem(PowerIcon, 'Capacity', `${siteInfo.capacity} MW`, 'success.main')}
          {renderInfoItem(VoltageIcon, 'Injection Voltage', `${siteInfo.voltage} KV`, 'warning.main')}
          {renderInfoItem(BankIcon, 'Banking Status', siteInfo.banking, siteInfo.banking === 'Available' ? 'success.main' : 'error.main')}
        </Grid>
      </Grid>
    </Paper>
  );
};

export default SiteInfoCard;