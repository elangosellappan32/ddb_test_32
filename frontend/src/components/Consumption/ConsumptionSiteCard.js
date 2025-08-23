import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Box,
  Card,
  CardActionArea,
  Grid,
  Typography,
  IconButton,
  Tooltip, 
  LinearProgress
} from '@mui/material';
import {
  LocationOn,
  Speed,
  Category as CategoryIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Cached as RefreshIcon,
  Factory as IndustrialIcon,
  ShoppingCart as CommercialIcon,
  Home as HomeIcon,
  LocalLaundryService as TextileIcon,
  Error as ErrorIcon,
  FiberManualRecord as StatusDotIcon
} from '@mui/icons-material';
import { formatDistanceToNowStrict } from 'date-fns';

const getStatusDotColor = (status, theme) => {
  const normalized = String(status || '').toLowerCase().trim();
  switch (normalized) {
    case 'active':
      return theme.palette.success.main;
    case 'maintenance':
    case 'in progress':
    case 'pending':
      return theme.palette.warning.main;
    case 'inactive':
    default:
      return theme.palette.error.main;
  }
};

const getStatusLabel = (status) => {
  const normalizedStatus = String(status || '').toLowerCase().trim();
  return normalizedStatus.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const normalizeType = (type) =>
  String(type || '')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const getTypeColor = (type) => {
  const normalizedType = String(type || '').toLowerCase().trim();
  switch (normalizedType) {
    case 'industrial': return 'primary';
    case 'commercial': return 'secondary';
    case 'residential': return 'success';
    case 'textile': return 'info';
    default: return 'primary';
  }
};

const getTypeIcon = (type, size = 'medium', theme) => {
  const normalizedType = String(type || '').toLowerCase().trim();
  const color = getTypeColor(normalizedType);
  const iconProps = {
    fontSize: size === 'large' ? 'large' : 'medium',
    sx: {
      color: theme.palette[color]?.main || theme.palette.primary.main,
      bgcolor: alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.1),
      p: size === 'large' ? 1.5 : 1,
      borderRadius: '50%',
      mr: 1,
      flexShrink: 0
    }
  };
  switch (normalizedType) {
    case 'industrial':
      return <IndustrialIcon {...iconProps} />;
    case 'commercial':
      return <CommercialIcon {...iconProps} />;
    case 'residential':
      return <HomeIcon {...iconProps} />;
    case 'textile':
      return <TextileIcon {...iconProps} />;
    default:
      return <CategoryIcon {...iconProps} />;
  }
};

const formatDisplayDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return 'N/A';
  }
};

const ConsumptionSiteCard = ({
  site,
  onEdit = null,
  onDelete = null,
  permissions = {},
  onRefresh = null,
  lastUpdated = new Date(),
  onClick
}) => {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(lastUpdated);

  const safeData = useMemo(() => {
    if (!site) {
      return {
        consumptionSiteId: '',
        companyId: '',
        name: 'Unnamed Site',
        type: 'Industrial',
        status: 'inactive',
        location: 'Location not specified',
        annualConsumption: 0,
        formattedConsumption: '0',
        version: 1,
        timetolive: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        displayDate: 'N/A',
      };
    }
    let annualConsumption = 0;
    const rawValue = site.annualConsumption ?? site.annualConsumption_L;
    if (rawValue !== undefined && rawValue !== null) {
      if (typeof rawValue === 'number') {
        annualConsumption = Math.round(rawValue);
      } else if (typeof rawValue === 'string') {
        const cleanValue = rawValue.trim() === '' ? '0' : rawValue.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleanValue);
        annualConsumption = isNaN(num) ? 0 : Math.round(num);
      } else if (typeof rawValue === 'object' && rawValue.N) {
        const num = parseFloat(rawValue.N);
        annualConsumption = isNaN(num) ? 0 : Math.round(num);
      }
    }
    return {
      consumptionSiteId: site.consumptionSiteId || '',
      companyId: site.companyId || '',
      name: (site.name || 'Unnamed Site').replace(/_/g, ' '),
      type: normalizeType(site.type || 'Industrial'),
      status: site.status || 'inactive',
      location: site.location?.trim() || 'Location not specified',
      annualConsumption,
      formattedConsumption: annualConsumption.toLocaleString('en-US'),
      version: Number(site?.version || 1),
      timetolive: Number(site?.timetolive || 0),
      createdAt: site?.createdAt || site?.createdat || new Date().toISOString(),
      updatedAt: site?.updatedAt || site?.updatedat || new Date().toISOString(),
      displayDate: formatDisplayDate(site?.updatedAt || site?.updatedat || site?.createdAt || site?.createdat),
    };
  }, [site]);

  const typeColor = getTypeColor(safeData.type);

  const handleRefresh = async (e) => {
    if (e) e.stopPropagation();
    if (onRefresh) {
      setIsLoading(true);
      setError(null);
      try {
        await onRefresh();
        setLastRefreshed(new Date());
      } catch (err) {
        setError(err.message || 'Failed to refresh data');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const formatConsumption = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  const handleEdit = (e) => {
    e?.stopPropagation();
    if (onEdit) onEdit();
  };

  const handleDelete = (e) => {
    e?.stopPropagation();
    if (onDelete) onDelete();
  };

  // Update time text: 'less than a minute ago' if under 1 min
  const renderUpdateTime = () => {
    const now = new Date();
    const date = new Date(lastRefreshed);
    const diffMs = now - date;
    if (diffMs < 60 * 1000) {
      return 'less than a minute ago';
    }
    return formatDistanceToNowStrict(date, { addSuffix: true });
  };

  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 2,
        transition: 'all 0.3s ease',
        border: 1,
        borderColor: 'transparent',
        position: 'relative',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3,
          bgcolor: (theme) => alpha(theme.palette[typeColor].main, 0.08),
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <CardActionArea 
          component="div" 
          onClick={onClick}
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            p: 2,
            pb: 1,
            position: 'relative', 
            '&:hover': {
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
            },
          }}
        >
          {/* Site Name */}
          <Typography variant="h6" noWrap sx={{ width: '100%', mb: 0.5 }}>
            {safeData.name}
          </Typography>

          {/* Tiny Status Dot + Status Label + Update Time */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 2,
              fontWeight: 500,
              fontSize: '0.625rem', // 10px
              gap: 0.5,
              width: '100%',
              lineHeight: 1,
              minHeight: 16,
            }}
          >
            <StatusDotIcon sx={{ fontSize: 10, color: getStatusDotColor(safeData.status, theme) }} />
            <Typography sx={{ color: 'text.primary', fontSize: '0.625rem' }}>
              {getStatusLabel(safeData.status)}
            </Typography>
            {/* Smallest separator dot */}
            <Box sx={{ width: 3, height: 3, bgcolor: 'text.secondary', borderRadius: '50%', mx: 0.5 }} />
            <Typography sx={{ color: 'text.secondary', fontSize: '0.625rem' }}>
              {isLoading ? 'Updating...' : error ? 'Update failed' : renderUpdateTime()}
            </Typography>
          </Box>

          {/* Details Grid */}
          <Grid container spacing={2} sx={{ mt: 0, mb: 1 }}>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                {getTypeIcon(safeData.type, 'small', theme)}
                <Typography variant="body2" color="text.secondary">
                  Type
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 500 }} color={`${typeColor}.main`} variant="body1">
                {safeData.type}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Speed sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary">
                  Consumption
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {formatConsumption(safeData.annualConsumption)} MWh
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LocationOn sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary">
                  Location
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }} noWrap>
                {safeData.location}
              </Typography>
            </Grid>
          </Grid>
          
          {/* Version Info - positioned on the right side */}
          <Box sx={{ 
            position: 'absolute',
            right: 16,
            bottom: 8
          }}>
            <Typography variant="caption" color="text.secondary">
              Version: {safeData.version || '1.0.0'}
            </Typography>
          </Box>
        </CardActionArea>

        {/* Footer - only action icons on right */}
        <Box
          sx={{
            mt: 'auto',
            p: 2,
            pt: 0,
            width: '100%',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onRefresh && (
            <Tooltip title="Refresh Data">
              <span>
                <IconButton
                  size="small"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  sx={{
                    color: 'primary.main',
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                    '&:hover': {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
                    },
                  }}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {permissions?.update && onEdit && (
            <Tooltip title="Edit Site">
              <span>
                <IconButton
                  size="small"
                  onClick={handleEdit}
                  sx={{
                    color: 'info.main',
                    bgcolor: (theme) => alpha(theme.palette.info.main, 0.1),
                    '&:hover': {
                      bgcolor: (theme) => alpha(theme.palette.info.main, 0.2),
                    },
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {permissions?.delete && onDelete && (
            <Tooltip title="Delete Site">
              <span>
                <IconButton
                  size="small"
                  onClick={handleDelete}
                  sx={{
                    color: 'error.main',
                    bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
                    '&:hover': {
                      bgcolor: (theme) => alpha(theme.palette.error.main, 0.2),
                    },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>
      {isLoading && (
        <Box sx={{ width: '100%', position: 'absolute', bottom: 0, left: 0 }}>
          <LinearProgress color="primary" variant="indeterminate" />
        </Box>
      )}
    </Card>
  );
};

ConsumptionSiteCard.propTypes = {
  site: PropTypes.object.isRequired,
  onClick: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  permissions: PropTypes.shape({
    update: PropTypes.bool,
    delete: PropTypes.bool,
  }),
  onRefresh: PropTypes.func,
  lastUpdated: PropTypes.oneOfType([
    PropTypes.instanceOf(Date),
    PropTypes.string,
    PropTypes.number,
  ]),
};

export default ConsumptionSiteCard;
