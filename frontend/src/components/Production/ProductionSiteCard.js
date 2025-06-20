import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { alpha, useTheme } from '@mui/material/styles';
import {
    Box,
    Card,
    CardActionArea,
    CardActions,
    Typography,
    Grid,
    IconButton,
    Tooltip,
    LinearProgress,
    Chip,
    Badge
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
    Error as ErrorIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

const ProductionSiteCard = ({ 
    site, 
    onView, 
    onEdit = null, 
    onDelete = null, 
    permissions, 
    onRefresh = null, 
    lastUpdated = new Date() 
}) => {
    const theme = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [localSite, setLocalSite] = useState(site);
    const [lastRefreshed, setLastRefreshed] = useState(lastUpdated || new Date());

    // Effect to update local state when props change
    useEffect(() => {
        setLocalSite(site);
    }, [site]);

    // Handle manual refresh
    const handleRefresh = async (e) => {
        if (e) e.stopPropagation();
        if (isLoading) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            if (onRefresh) {
                await onRefresh();
            }
            setLastRefreshed(new Date());
        } catch (err) {
            console.error('Error refreshing site data:', err);
            setError(err.message || 'Failed to refresh data');
        } finally {
            setIsLoading(false);
        }
    };

    // Data validation with proper formatting for real data
    const safeData = {
        productionSiteId: site?.productionSiteId || '',
        companyId: site?.companyId || '',
        // Replace underscores with spaces in names
        name: (site?.name || 'Unnamed Site').replace(/_/g, ' '),
        // Convert type to lowercase for consistent display
        type: (site?.type || 'Unknown').toLowerCase(),
        status: site?.status || 'Active',
        location: site?.location?.trim() || 'Location not specified',
        // Keep capacity as is (already in MW)
        capacity_MW: site?.capacity_MW != null ? 
            Number(site.capacity_MW).toFixed(2) : '0.00',
        // Use actual HTSC number
        htscNo: site?.htscNo || '69534460069',
        // Standard injection voltage
        injectionVoltage_KV: Number(site?.injectionVoltage_KV || 22),
        banking: Number(site?.banking || 0),
        version: Number(site?.version || 1)
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'success';
            case 'maintenance': return 'warning';
            case 'inactive': return 'error';
            default: return 'default';
        }
    };

    const getTypeIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'wind':
                return <WindIcon sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />;
            case 'solar':
                return <SolarIcon sx={{ mr: 1, fontSize: 20, color: 'warning.main' }} />;
            default:
                return null;
        }
    };

    const getBankingStatus = (bankingValue) => {
        return Number(bankingValue) === 1 ? {
            color: 'success.main',
            text: 'Available',
            icon: <BankIcon sx={{ fontSize: 20, color: 'success.main' }} />
        } : {
            color: 'error.main',
            text: 'Not Available',
            icon: <BankIcon sx={{ fontSize: 20, color: 'error.main' }} />
        };
    };

    const bankingStatus = getBankingStatus(safeData.banking);

    return (
        <Card
            sx={{
                height: '100%',
                borderRadius: 2,
                transition: 'all 0.3s ease',
                border: 1,
                borderColor: 'transparent',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3,
                    bgcolor: (theme) => alpha(
                        theme.palette[safeData.type.toLowerCase() === 'wind' ? 'primary' : 'warning'].main, 
                        0.08
                    )
                }
            }}
        >
            <CardActionArea onClick={onView} sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h6" noWrap>
                            {safeData.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <Typography 
                                variant="caption" 
                                color="text.secondary"
                                component="div"
                                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}
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
                                                color: `${getStatusColor(safeData.status)}.main`
                                            }} 
                                        />
                                        {safeData.status} • Updated {formatDistanceToNow(new Date(lastRefreshed), { addSuffix: true })}
                                    </>
                                )}
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                <Grid container spacing={2}>
                    <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            {getTypeIcon(safeData.type)}
                            <Typography variant="body2" color="text.secondary">Type</Typography>
                        </Box>
                        <Typography variant="body1" color={safeData.type.toLowerCase() === 'wind' ? 'primary.main' : 'warning.main'}>
                            {safeData.type}
                        </Typography>
                    </Grid>

                    <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Speed sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
                            <Typography variant="body2" color="text.secondary">Capacity</Typography>
                        </Box>                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {safeData.capacity_MW} MW
                        </Typography>
                    </Grid>

                    <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <LocationOn sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
                            <Typography variant="body2" color="text.secondary">Location</Typography>
                        </Box>
                        <Typography variant="body1" sx={{ fontWeight: 500 }} noWrap>
                            {safeData.location}
                        </Typography>
                    </Grid>

                    <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <ElectricBolt sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
                            <Typography variant="body2" color="text.secondary">Injection</Typography>
                        </Box>                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {safeData.injectionVoltage_KV} KV
                        </Typography>
                    </Grid>

                    <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            {bankingStatus.icon}
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>Banking Status</Typography>
                        </Box>
                        <Typography variant="body1" sx={{ fontWeight: 500 }} color={bankingStatus.color}>
                            {bankingStatus.text}
                        </Typography>
                    </Grid>

                    <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Engineering sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
                            <Typography variant="body2" color="text.secondary">HTSC No.</Typography>
                        </Box>                        <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                            {safeData.htscNo}
                        </Typography>
                    </Grid>
                </Grid>

                {/* Version indicator */}
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                        Version: {safeData.version}
                    </Typography>
                </Box>
            </CardActionArea>

            <CardActions sx={{ justifyContent: 'space-between', p: 1.5, pt: 0 }}>
                <Box>
                    <Tooltip title="Last refreshed">
                        <Box component="span">
                            <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'inline-flex', alignItems: 'center', ml: 1 }}>
                                {formatDistanceToNow(new Date(lastRefreshed), { addSuffix: true })}
                            </Typography>
                        </Box>
                    </Tooltip>
                </Box>
                <Box>
                    <Tooltip title="Refresh data">
                        <span>
                            <IconButton 
                                size="small"
                                color="primary"
                                onClick={handleRefresh}
                                disabled={isLoading}
                                sx={{
                                    transition: 'transform 0.3s',
                                    '&:hover': {
                                        transform: 'rotate(180deg)',
                                        backgroundColor: alpha(theme.palette.primary.main, 0.1)
                                    },
                                    animation: isLoading ? 'pulse 2s infinite' : 'none',
                                    '@keyframes pulse': {
                                        '0%': { opacity: 0.6 },
                                        '50%': { opacity: 1 },
                                        '100%': { opacity: 0.6 },
                                    },
                                }}
                            >
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    
                    {permissions?.update && onEdit && (
                        <Tooltip title="Edit Site">
                            <IconButton 
                                size="small" 
                                color="info" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit();
                                }}
                                disabled={isLoading}
                                sx={{ ml: 1 }}
                            >
                                <EditIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                    {permissions?.delete && onDelete && (
                        <Tooltip title="Delete Site">
                            <IconButton 
                                size="small" 
                                color="error" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                disabled={isLoading}
                                sx={{ ml: 1 }}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            </CardActions>
            
            {isLoading && (
                <Box sx={{ width: '100%', position: 'absolute', bottom: 0, left: 0 }}>
                    <LinearProgress color="primary" variant="indeterminate" />
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