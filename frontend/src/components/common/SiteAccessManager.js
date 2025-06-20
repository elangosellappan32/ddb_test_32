import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    CircularProgress,
    Grid,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import SiteSelector from './SiteSelector';

const SiteAccessManager = ({ 
    open,
    onClose,
    onSubmit,
    initialSites = {
        production: [],
        consumption: []
    },
    title = "Manage Site Access",
    showProductionSites = true,
    showConsumptionSites = true,
}) => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(false);
    const [selectedSites, setSelectedSites] = useState(initialSites);

    // Reset selected sites when dialog opens/closes or initialSites changes
    useEffect(() => {
        setSelectedSites(initialSites);
    }, [open, initialSites]);

    const handleSubmit = async () => {
        try {
            setLoading(true);
            await onSubmit(selectedSites);
            onClose();
            enqueueSnackbar('Site access updated successfully', { variant: 'success' });
        } catch (error) {
            console.error('Error updating site access:', error);
            enqueueSnackbar(error.message || 'Failed to update site access', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSiteSelectionChange = (siteType, sites) => {
        setSelectedSites(prev => ({
            ...prev,
            [siteType]: sites
        }));
    };

    return (
        <Dialog 
            open={open} 
            onClose={loading ? undefined : onClose}
            maxWidth="md" 
            fullWidth
        >
            <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider' }}>
                {title}
            </DialogTitle>

            <DialogContent>
                <Grid container spacing={3} sx={{ mt: 1 }}>
                    {showProductionSites && (
                        <Grid item xs={12}>
                            <SiteSelector
                                selectedSites={selectedSites.production}
                                onSiteSelectionChange={(sites) => handleSiteSelectionChange('production', sites)}
                                title="Production Sites"
                                siteType="production"
                            />
                        </Grid>
                    )}

                    {showConsumptionSites && (
                        <Grid item xs={12}>
                            <SiteSelector
                                selectedSites={selectedSites.consumption}
                                onSiteSelectionChange={(sites) => handleSiteSelectionChange('consumption', sites)}
                                title="Consumption Sites"
                                siteType="consumption"
                            />
                        </Grid>
                    )}
                </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 2.5, borderTop: 1, borderColor: 'divider' }}>
                <Button 
                    onClick={onClose} 
                    disabled={loading}
                    variant="outlined"
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading}
                    startIcon={loading && <CircularProgress size={20} />}
                >
                    Save Changes
                </Button>
            </DialogActions>
        </Dialog>
    );
};

SiteAccessManager.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    initialSites: PropTypes.shape({
        production: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            location: PropTypes.string,
        })),
        consumption: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            location: PropTypes.string,
        }))
    }),
    title: PropTypes.string,
    showProductionSites: PropTypes.bool,
    showConsumptionSites: PropTypes.bool,
};

export default SiteAccessManager;
