import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Box,
  Card,
  CardActionArea,
  CardActions,
  Grid,
  Typography,
  Tooltip,
  IconButton,
  LinearProgress
} from '@mui/material';
import {
  LocationOn,
  Speed,
  ElectricBolt,
  Engineering,
  Delete as DeleteIcon,
  Edit as EditIcon,
  AccountBalance as BankIcon,
  WindPower as WindIcon,
  WbSunny as SolarIcon,
  FiberManualRecord as StatusDotIcon,
  Cached as RefreshIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

// --- Helpers ---
const getStatusColor = (status) => {
  if (!status) return 'default'; // Default to default color for unknown status
  
  try {
    // Convert to string, trim whitespace, and convert to lowercase for comparison
    const normalizedStatus = String(status).trim().toLowerCase();
    
    // Map status to appropriate color (case-insensitive)
    const statusColorMap = {
      'active': 'success',
      'inactive': 'error',
      'maintenance': 'warning'
    };
    
    // Only return a color for known statuses, otherwise return undefined
    return statusColorMap[normalizedStatus];
  } catch (error) {
    console.error('Error determining status color:', error, 'Status:', status);
    return 'default';
  }
};

// Function to normalize status for display
const normalizeStatus = (status) => {
  if (!status) return 'Inactive'; // Default to Inactive for missing status
  
  const statusStr = String(status).trim().toLowerCase();
  
  // Direct mapping of known status values
  const statusMap = {
    'active': 'Active',
    'inactive': 'Inactive',
    'maintenance': 'Maintenance',
    'maintain': 'Maintenance',
    'maint': 'Maintenance'
  };
  
  // Check for exact match first
  if (statusMap[statusStr]) { 
    return statusMap[statusStr];
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(statusMap)) {
    if (statusStr.includes(key)) {
      return value;
    }
  }
  
  // Default to Inactive for unknown statuses
  console.warn(`[ProductionSiteCard] Unknown status value: "${status}" - Defaulting to Inactive`);
  return 'Inactive';
};

const getTypeIcon = (type) => {
  switch (type) {
    case 'wind':
      return <WindIcon sx={{ mr: 0.5, fontSize: 20, color: 'primary.main' }} />;
    case 'solar':
      return <SolarIcon sx={{ mr: 0.5, fontSize: 20, color: 'warning.main' }} />;
    default:
      return null;
  }
};

const getBankingStatus = (bankingValue) => {
  return Number(bankingValue) === 1
    ? { color: 'success.main', text: 'Available', icon: <BankIcon sx={{ fontSize: 20, color: 'success.main' }} /> }
    : { color: 'error.main', text: 'Not Available', icon: <BankIcon sx={{ fontSize: 20, color: 'error.main' }} /> };
};

// --- Component ---
const ProductionSiteCard = ({
  site,
  onView,
  onEdit,
  onDelete,
  onRefresh,
  permissions,
  lastUpdated = new Date()
}) => {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [localSite, setLocalSite] = useState(site);
  const [lastRefreshed, setLastRefreshed] = useState(lastUpdated);

  // Keep card updated when site changes
  useEffect(() => {
    setLocalSite(site);
  }, [site]);

  const handleRefresh = async (e) => {
    e.stopPropagation();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      if (onRefresh) await onRefresh();
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.message || 'Failed to refresh data');
    } finally {
      setIsLoading(false);
    }
  };

  // Get the raw status from the site data
  const rawStatus = localSite?.status;
  
  // Log the raw status for debugging
  
  // Normalize and protect site data
  const safeData = {
    name: (localSite?.name || 'Unnamed Site').replace(/_/g, ' '),
    type: (localSite?.type || 'Unknown').toLowerCase(),
    status: rawStatus, // Store the raw status
    normalizedStatus: normalizeStatus(rawStatus), // Store the normalized status
    location: localSite?.location?.trim() || 'Location not specified',
    capacity_MW: localSite?.capacity_MW != null ? Number(localSite.capacity_MW).toFixed(2) : '0.00',
    htscNo: localSite?.htscNo || '',
    injectionVoltage_KV: Number(localSite?.injectionVoltage_KV || 0),
    banking: Number(localSite?.banking || 0),
    version: Number(localSite?.version || 1)
  };
  


  const bankingStatus = getBankingStatus(safeData.banking);

  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 2,
        transition: 'all 0.3s ease',
        position: 'relative',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3,
          bgcolor: alpha(
            theme.palette[
              safeData.type === 'wind' ? 'primary' : 'warning'
            ].main,
            0.06
          )
        }
      }}
    >
      <CardActionArea onClick={onView} sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Tooltip title={safeData.name}>
              <Typography variant="h6" noWrap>{safeData.name}</Typography>
            </Tooltip>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}
            >
              {isLoading ? (
                <>
                  <RefreshIcon
                    fontSize="inherit"
                    sx={{
                      animation: 'spin 1.5s linear infinite',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0)' },
                        '100%': { transform: 'rotate(360deg)' }
                      }
                    }}
                  />
                  Updating...
                </>
              ) : error ? (
                <>
                  <ErrorIcon fontSize="inherit" color="error" />
                  Update failed
                </>
              ) : (
                <>
                  {safeData.normalizedStatus && (
                    <>
                      <StatusDotIcon
                        sx={{
                          fontSize: 10,
                          color: `${getStatusColor(safeData.normalizedStatus)}.main`
                        }}
                      />
                      {safeData.normalizedStatus} • 
                    </>
                  )}
                  Updated {formatDistanceToNow(new Date(lastRefreshed), { addSuffix: true })}
                </>
              )}
            </Typography>
          </Box>
        </Box>

        {/* Details Grid */}
        <Grid container spacing={1} mt={1}>
          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {getTypeIcon(safeData.type)}
              <Typography variant="body2" color="text.secondary">Type</Typography>
            </Box>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {safeData.type}
            </Typography>
          </Grid>

          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Speed sx={{ mr: 0.5, fontSize: 20, color: 'primary.main' }} />
              <Typography variant="body2" color="text.secondary">Capacity</Typography>
            </Box>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {safeData.capacity_MW} MW
            </Typography>
          </Grid>

          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <LocationOn sx={{ mr: 0.5, fontSize: 20, color: 'primary.main' }} />
              <Typography variant="body2" color="text.secondary">Location</Typography>
            </Box>
            <Tooltip title={safeData.location}>
              <Typography variant="body1" noWrap sx={{ fontWeight: 500 }}>
                {safeData.location}
              </Typography>
            </Tooltip>
          </Grid>

          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ElectricBolt sx={{ mr: 0.5, fontSize: 20, color: 'primary.main' }} />
              <Typography variant="body2" color="text.secondary">Injection</Typography>
            </Box>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {safeData.injectionVoltage_KV} KV
            </Typography>
          </Grid>

          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {bankingStatus.icon}
              <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                Banking
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ fontWeight: 500 }} color={bankingStatus.color}>
              {bankingStatus.text}
            </Typography>
          </Grid>

          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Engineering sx={{ mr: 0.5, fontSize: 20, color: 'primary.main' }} />
              <Typography variant="body2" color="text.secondary">HTSC No.</Typography>
            </Box>
            <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
              {safeData.htscNo}
            </Typography>
          </Grid>
        </Grid>

        {/* Footer Info */}
        <Box sx={{ mt: 2, textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary">
            Version: {safeData.version}
          </Typography>
        </Box>
      </CardActionArea>

      {/* Actions */}
      <CardActions sx={{ justifyContent: 'flex-end', p: 1.5 }}>
        <Tooltip title="Refresh data">
          <span>
            <IconButton
              size="small"
              onClick={handleRefresh}
              disabled={isLoading}
              color="primary"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {permissions?.update && (
          <Tooltip title="Edit Site">
            <IconButton
              size="small"
              color="info"
              onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
        )}
        {permissions?.delete && (
          <Tooltip title="Delete Site">
            <IconButton
              size="small"
              color="error"
              onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>

      {/* Loading bar */}
      {isLoading && (
        <Box sx={{ width: '100%', position: 'absolute', bottom: 0 }}>
          <LinearProgress color="primary" />
        </Box>
      )}
    </Card>
  );
};

ProductionSiteCard.propTypes = {
  site: PropTypes.object.isRequired,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onRefresh: PropTypes.func,
  permissions: PropTypes.object.isRequired,
  lastUpdated: PropTypes.oneOfType([
    PropTypes.instanceOf(Date),
    PropTypes.string,
    PropTypes.number
  ])
};

export default ProductionSiteCard;
