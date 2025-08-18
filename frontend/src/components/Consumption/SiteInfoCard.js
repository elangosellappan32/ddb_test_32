import React from 'react';
import PropTypes from 'prop-types';
import { Paper, Typography, Box, Divider } from '@mui/material';
import { 
  Factory as FactoryIcon,
  LocationOn as LocationIcon,
  Speed as ConsumptionIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  Store as StoreIcon,
  Apartment as ApartmentIcon,
  Circle as StatusIcon
} from '@mui/icons-material';

const SiteInfoCard = ({ site }) => {
  if (!site) return null;

  const getTypeIcon = (type) => {
    const typeMap = {
      'industrial': <FactoryIcon sx={{ mr: 1, color: 'secondary.main' }} />,
      'residential': <HomeIcon sx={{ mr: 1, color: 'info.main' }} />,
      'commercial': <StoreIcon sx={{ mr: 1, color: 'success.main' }} />,
      'institutional': <ApartmentIcon sx={{ mr: 1, color: 'warning.main' }} />
    };
    return typeMap[type] || <BusinessIcon sx={{ mr: 1, color: 'text.secondary' }} />;
  };

  const siteInfo = {
    name: site.name || 'Unnamed Site',
    type: (site.type || 'unknown').toLowerCase(),
    location: site.location || 'Location not specified',
    annualConsumption: site.annualConsumption != null 
      ? Number(site.annualConsumption).toFixed(2) 
      : '0.00',
    status: (site.status || 'inactive').toLowerCase()
  };

  const getStatusColor = (status) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'active': return 'success.main';
      case 'inactive': return 'error.main';
      case 'pending':
      case 'maintenance':
        return 'warning.main';
      default: return 'text.secondary';
    }
  };

  const renderInfoItem = (label, value, icon, color = 'text.primary') => (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
      {icon}
      <Box sx={{ ml: 2 }}>
        <Typography variant="body1" color={color} sx={{ fontWeight: 500, display: 'flex', alignItems: 'center' }}>
          {label}: <Box component="span" sx={{ ml: 1, fontWeight: 'normal' }}>{value}</Box>
        </Typography>
      </Box>
    </Box>
  );

  const getStatusIcon = (status) => {
    const color = getStatusColor(status);
    return (
      <StatusIcon 
        sx={{ 
          color,
          fontSize: '0.75rem',
          mr: 1
        }} 
      />
    );
  };

  return (
    <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: 2 }}>
      <Box sx={{ mb: 2 }}>
        {renderInfoItem(
          'Name',
          siteInfo.name,
          <BusinessIcon sx={{ color: 'text.secondary', mr: 1 }} />
        )}
        <Divider sx={{ my: 1.5 }} />
        {renderInfoItem(
          'Location',
          siteInfo.location,
          <LocationIcon sx={{ color: 'error.main', mr: 1 }} />
        )}
        <Divider sx={{ my: 1.5 }} />
        {renderInfoItem(
          'Status',
          siteInfo.status.charAt(0).toUpperCase() + siteInfo.status.slice(1),
          getStatusIcon(siteInfo.status),
          getStatusColor(siteInfo.status)
        )}
        <Divider sx={{ my: 1.5 }} />
        {renderInfoItem(
          'Annual Consumption',
          `${siteInfo.annualConsumption} MW`,
          <ConsumptionIcon sx={{ color: 'success.main', mr: 1 }} />
        )}
      </Box>
    </Paper>
  );
};

SiteInfoCard.propTypes = {
  site: PropTypes.shape({
    name: PropTypes.string,
    type: PropTypes.string,
    location: PropTypes.string,
    annualConsumption: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    status: PropTypes.string,
  })
};

export default SiteInfoCard;