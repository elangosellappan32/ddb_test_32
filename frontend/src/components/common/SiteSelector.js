import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Grid,
    Alert,
    Skeleton,
    LinearProgress,
    Button
} from '@mui/material';
import { useSnackbar } from 'notistack';
import siteAccessService from '../../services/siteAccessService';

const SiteSelector = ({ 
    selectedSites,
    onSiteSelectionChange,
    title = "Select Sites",
    siteType = "production"
}) => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [availableSites, setAvailableSites] = useState([]);
    const [initialLoad, setInitialLoad] = useState(true);

    // Fetch available sites
    useEffect(() => {
        const fetchSites = async () => {
            try {
                setLoading(true);
                setError(null);
                const sites = await siteAccessService.getAvailableSites(siteType);
                setAvailableSites(sites);
            } catch (error) {
                console.error('Error fetching available sites:', error);
                setError(error.message || 'Failed to load available sites');
                enqueueSnackbar(error.message || 'Failed to load available sites', { 
                    variant: 'error',
                    action: (key) => (
                        <Button color="inherit" size="small" onClick={() => {
                            fetchSites();
                            enqueueSnackbar.close(key);
                        }}>
                            Retry
                        </Button>
                    )
                });
            } finally {
                setLoading(false);
                setInitialLoad(false);
            }
        };

        fetchSites();
    }, [siteType, enqueueSnackbar]);

    // Filter out already selected sites
    const filteredAvailableSites = availableSites.filter(site => 
        !selectedSites.some(selected => selected.id === site.id)
    );

    const handleSiteAdd = (event) => {
        const siteId = event.target.value;
        const site = availableSites.find(s => s.id === siteId);
        if (site) {
            onSiteSelectionChange([...selectedSites, site]);
            enqueueSnackbar(`Added ${site.name}`, { variant: 'success' });
        }
    };

    const handleSiteRemove = (siteToRemove) => {
        onSiteSelectionChange(selectedSites.filter(site => site.id !== siteToRemove.id));
        enqueueSnackbar(`Removed ${siteToRemove.name}`, { variant: 'info' });
    };

    if (initialLoad) {
        return (
            <Box sx={{ width: '100%', mt: 2 }}>
                <Skeleton variant="text" width="200px" />
                <Skeleton variant="rectangular" height={56} sx={{ mt: 2 }} />
                <Box sx={{ mt: 2 }}>
                    <Skeleton variant="rectangular" width="120px" height={32} sx={{ borderRadius: 16 }} />
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
                {title}
            </Typography>
            
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            
            <Box sx={{ mb: 2 }}>
                <FormControl fullWidth disabled={loading}>
                    <InputLabel>{`Add ${siteType.charAt(0).toUpperCase() + siteType.slice(1)} Site`}</InputLabel>
                    <Select
                        value=""
                        onChange={handleSiteAdd}
                        label={`Add ${siteType.charAt(0).toUpperCase() + siteType.slice(1)} Site`}
                    >
                        {filteredAvailableSites.length === 0 ? (
                            <MenuItem disabled>
                                {loading ? 'Loading sites...' : 'No available sites'}
                            </MenuItem>
                        ) : (
                            filteredAvailableSites.map((site) => (
                                <MenuItem key={site.id} value={site.id}>
                                    {site.name} ({site.location})
                                </MenuItem>
                            ))
                        )}
                    </Select>
                </FormControl>

                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {selectedSites.map((site) => (
                        <Chip
                            key={site.id}
                            label={`${site.name} (${site.location})`}
                            onDelete={() => handleSiteRemove(site)}
                            disabled={loading}
                        />
                    ))}
                </Box>
            </Box>

            {loading && <LinearProgress sx={{ mt: -2, mb: 2 }} />}
        </Box>
    );
};

SiteSelector.propTypes = {
    selectedSites: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        location: PropTypes.string,
    })).isRequired,
    onSiteSelectionChange: PropTypes.func.isRequired,
    title: PropTypes.string,
    siteType: PropTypes.oneOf(['production', 'consumption']).isRequired,
};

export default SiteSelector;
