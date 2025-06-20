import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Box,
  Card,
  CardActionArea,
  CardActions,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  LocationOn,
  Speed,
  Category as CategoryIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  FiberManualRecord as StatusDotIcon,
  Cached as RefreshIcon,
  Error as ErrorIcon,
  Factory as IndustrialIcon,
  ShoppingCart as CommercialIcon,
  Home as HomeIcon,
  LocalLaundryService as TextileIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

// Helper functions
const getStatusColor = (status) => {
  const normalizedStatus = String(status || '').toLowerCase().trim();
  switch (normalizedStatus) {
    case 'active': return 'success';
    case 'inactive': return 'error';
    case 'pending':
    case 'in progress':
      return 'warning';
    default: return 'default';
  }
};

const getStatusLabel = (status) => {
  const normalizedStatus = String(status || '').toLowerCase().trim();
  return normalizedStatus.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

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
  onView,
  onEdit = null,
  onDelete = null,
  permissions = {},
  onRefresh = null,
  lastUpdated = new Date()
}) => {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(lastUpdated);

  // Safely parse and format the site data with defaults
  const safeData = useMemo(() => {
    if (!site) {
      return {
        consumptionSiteId: '',
        companyId: '',
        name: 'Unnamed Site',
        type: 'industrial',
        status: 'inactive',
        location: 'Location not specified',
        annualConsumption: 0,
        formattedConsumption: '0',
        version: 1,
        timetolive: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        displayDate: 'N/A'
      };
    }

    // Handle annual consumption - ensure it's a valid number
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
      type: (site.type || 'industrial').toLowerCase(),
      status: site.status || 'inactive',
      location: site.location?.trim() || 'Location not specified',
      annualConsumption,
      formattedConsumption: annualConsumption.toLocaleString('en-US'),
      version: Number(site?.version || 1),
      timetolive: Number(site?.timetolive || 0),
      createdAt: site?.createdAt || site?.createdat || new Date().toISOString(),
      updatedAt: site?.updatedAt || site?.updatedat || new Date().toISOString(),
      displayDate: formatDisplayDate(site?.updatedAt || site?.updatedat || site?.createdAt || site?.createdat)
    };
  }, [site]);

  const statusColor = getStatusColor(safeData.status);
  const typeColor = getTypeColor(safeData.type);
  
  const cardHoverColor = useMemo(() => {
    return alpha(theme.palette[typeColor]?.main || theme.palette.primary.main, 0.05);
  }, [typeColor, theme.palette]);

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

  const handleView = (e) => {
    e?.stopPropagation();
    if (onView) onView();
  };

  const handleEdit = (e) => {
    e?.stopPropagation();
    if (onEdit) onEdit();
  };

  const handleDelete = (e) => {
    e?.stopPropagation();
    if (onDelete) onDelete();
  };

  const formatConsumption = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 2,
        transition: 'all 0.3s ease',
        border: 1,
        borderColor: 'divider',
        position: 'relative',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3,
          bgcolor: cardHoverColor
        }
      }}
    >
      <CardActionArea
        onClick={handleView}
        sx={{
          p: 2,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start'
        }}
      >
        {/* Header with Type Icon and Site Name */}
        <Box sx={{ display: 'flex', width: '100%', mb: 2, gap: 2 }}>
          <Box className="type-icon" sx={{ display: 'flex' }}>
            {getTypeIcon(safeData.type, 'large', theme)}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
                {safeData.name}
              </Typography>
              <Chip
                label={getStatusLabel(safeData.status)}
                size="small"
                color={statusColor}
                variant="outlined"
                sx={{
                  height: 22,
                  '& .MuiChip-label': { px: 1, fontSize: '0.7rem' },
                }}
              />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'flex',
                alignItems: 'center',
                mt: 0.5
              }}
            >
              {isLoading ? (
                <>
                  <RefreshIcon
                    sx={{
                      fontSize: 12,
                      mr: 0.5,
                      animation: 'spin 2s linear infinite',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' },
                      },
                    }}
                  />
                  Updating...
                </>
              ) : error ? (
                <>
                  <ErrorIcon sx={{ fontSize: 12, color: 'error.main', mr: 0.5 }} />
                  Update failed
                </>
              ) : (
                <>
                  <StatusDotIcon
                    sx={{
                      fontSize: 10,
                      mr: 0.5,
                      color: `${statusColor}.main`
                    }}
                  />
                  {getStatusLabel(safeData.status)} • Updated {formatDistanceToNow(new Date(lastRefreshed), { addSuffix: true })}
                </>
              )}
            </Typography>
          </Box>
        </Box>

        {/* Location Section */}
        <Box sx={{ width: '100%', mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <LocationOn sx={{ fontSize: 16, mr: 0.5, opacity: 0.7 }} />
            Location
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {safeData.location}
          </Typography>
        </Box>

        {/* Annual Consumption */}
        <Box sx={{ width: '100%', mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Speed sx={{ fontSize: 16, mr: 0.5, opacity: 0.7 }} />
            Annual Consumption
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette[typeColor].main }}>
            {formatConsumption(safeData.annualConsumption)} units
          </Typography>
        </Box>
      </CardActionArea>

      {/* Card Actions */}
      <CardActions sx={{
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 2,
        pt: 0,
        borderTop: 1,
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View Details">
            <IconButton size="small" onClick={handleView}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {permissions?.update && onEdit && (
            <Tooltip title="Edit Site">
              <IconButton size="small" onClick={handleEdit}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {permissions?.delete && onDelete && (
            <Tooltip title="Delete Site">
              <IconButton size="small" onClick={handleDelete} color="error">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {onRefresh && (
          <Tooltip title="Refresh Data">
            <IconButton
              size="small"
              onClick={handleRefresh}
              disabled={isLoading}
              sx={{
                transition: 'transform 0.3s',
                '&:hover': {
                  transform: 'rotate(180deg)'
                }
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>

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
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  permissions: PropTypes.shape({
    update: PropTypes.bool,
    delete: PropTypes.bool
  }),
  onRefresh: PropTypes.func,
  lastUpdated: PropTypes.oneOfType([
    PropTypes.instanceOf(Date),
    PropTypes.string,
    PropTypes.number
  ])
};

// Default props removed - using default parameters instead

export default ConsumptionSiteCard;