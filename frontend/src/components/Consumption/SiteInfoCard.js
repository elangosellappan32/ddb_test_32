import React from 'react';
import PropTypes from 'prop-types';
import { Paper, Typography, Grid, Box, Divider, Chip } from '@mui/material';
import { 
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Speed as ConsumptionIcon,
  PowerSettingsNew as StatusIcon,
  Info as InfoIcon,
  Update as UpdateIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';

const SiteInfoCard = ({ site }) => {
  if (!site) return null;

  const siteInfo = {
    name: site.name || 'Unnamed Site',
    type: (site.type || 'unknown').toLowerCase(),
    location: site.location || 'Location not specified',
    annualConsumption: Number(site.annualConsumption || 0).toFixed(2),
    status: (site.status || 'inactive').toLowerCase(),
    createdat: site.createdat ? new Date(site.createdat).toLocaleDateString() : 'N/A',
    updatedat: site.updatedat ? new Date(site.updatedat).toLocaleDateString() : 'N/A'
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'industrial': return 'warning';
      case 'textile': return 'info';
      default: return 'default';
    }
  };

  const renderInfoItem = (Icon, label, value, color = 'primary.main') => (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      mb: 2,
      p: 2,
      bgcolor: 'background.paper',
      borderRadius: 2,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      transition: 'transform 0.2s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }
    }}>
      <Icon sx={{ mr: 2, color, fontSize: 24 }} />
      <Box>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 500 }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Paper sx={{ 
      p: 3, 
      mb: 3,
      borderRadius: 2,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <BusinessIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
        <Box>
          <Typography variant="h5" gutterBottom color="primary.main">
            {siteInfo.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              size="small"
              label={siteInfo.type}
              color={getTypeColor(siteInfo.type)}
              icon={<InfoIcon />}
              sx={{ textTransform: 'capitalize' }}
            />
            <Chip
              size="small"
              label={siteInfo.status}
              color={getStatusColor(siteInfo.status)}
              icon={<StatusIcon />}
              sx={{ textTransform: 'capitalize' }}
            />
          </Box>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          {renderInfoItem(LocationIcon, 'Location', siteInfo.location, 'error.main')}
          {renderInfoItem(ConsumptionIcon, 'Annual Consumption', `${siteInfo.annualConsumption} MW`, 'success.main')}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderInfoItem(CalendarIcon, 'Created Date', siteInfo.createdat, 'info.main')}
          {renderInfoItem(UpdateIcon, 'Last Updated', siteInfo.updatedat, 'warning.main')}
        </Grid>
      </Grid>
    </Paper>
  );
};

SiteInfoCard.propTypes = {
  site: PropTypes.shape({
    name: PropTypes.string,
    type: PropTypes.string,
    location: PropTypes.string,
    annualConsumption: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    status: PropTypes.string,
    timetolive: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    createdat: PropTypes.string,
    updatedat: PropTypes.string
  })
};

export default SiteInfoCard;