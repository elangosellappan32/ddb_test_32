import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  LinearProgress
} from '@mui/material';
import siteAccessService from '../../services/siteAccessService';
import { useSnackbar } from 'notistack';

const SiteAccessDialog = ({ 
  open, 
  onClose, 
  onSubmit, 
  initialData = {
    productionSites: [],
    consumptionSites: []
  },
  title = "Manage Site Access"
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [availableSites, setAvailableSites] = useState({
    production: [],
    consumption: []
  });
  const [selectedSites, setSelectedSites] = useState(initialData);

  // Fetch available sites when dialog opens
  useEffect(() => {
    if (open) {
      const fetchSites = async () => {
        try {
          setLoading(true);
          setError(null);
          const [productionSites, consumptionSites] = await Promise.all([
            siteAccessService.getAvailableSites('production'),
            siteAccessService.getAvailableSites('consumption')
          ]);

          setAvailableSites({
            production: productionSites,
            consumption: consumptionSites
          });
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
        }
      };

      fetchSites();
    }
  }, [open, enqueueSnackbar]);

  // Initialize selected sites from initial data
  useEffect(() => {
    setSelectedSites({
      productionSites: initialData.productionSites || [],
      consumptionSites: initialData.consumptionSites || []
    });
  }, [initialData]);

  // Memoize filtered available sites to exclude already selected ones
  const filteredAvailableSites = useMemo(() => ({
    production: availableSites.production.filter(site => 
      !selectedSites.productionSites.some(selected => selected.id === site.id)
    ),
    consumption: availableSites.consumption.filter(site => 
      !selectedSites.consumptionSites.some(selected => selected.id === site.id)
    )
  }), [availableSites, selectedSites]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await onSubmit({
        productionSites: selectedSites.productionSites,
        consumptionSites: selectedSites.consumptionSites
      });
      enqueueSnackbar('Site access updated successfully', { variant: 'success' });
      onClose();
    } catch (error) {
      console.error('Error updating site access:', error);
      setError(error.message || 'Failed to update site access');
      enqueueSnackbar(error.message || 'Failed to update site access', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSite = (siteType, site) => {
    setSelectedSites(prev => ({
      ...prev,
      [`${siteType}Sites`]: [...prev[`${siteType}Sites`], site]
    }));
    enqueueSnackbar(`Added ${site.name} to ${siteType} sites`, { variant: 'success' });
  };

  const handleRemoveSite = (siteType, siteId) => {
    const site = selectedSites[`${siteType}Sites`].find(s => s.id === siteId);
    setSelectedSites(prev => ({
      ...prev,
      [`${siteType}Sites`]: prev[`${siteType}Sites`].filter(s => s.id !== siteId)
    }));
    if (site) {
      enqueueSnackbar(`Removed ${site.name} from ${siteType} sites`, { variant: 'info' });
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={(loading || submitting) ? undefined : onClose}
      maxWidth="md" 
      fullWidth
    >
      <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider' }}>
        {title}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 1 }}>
            {error}
          </Alert>
        )}
        
        {loading && <LinearProgress sx={{ mt: -1, mb: 2 }} />}

        <Grid container spacing={3} sx={{ mt: 1 }}>
          {/* Production Sites */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Production Sites
            </Typography>
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth disabled={loading || submitting}>
                <InputLabel>Add Production Site</InputLabel>
                <Select
                  value=""
                  onChange={(e) => {
                    const site = availableSites.production.find(s => s.id === e.target.value);
                    if (site) handleAddSite('production', site);
                  }}
                  label="Add Production Site"
                >
                  {filteredAvailableSites.production.length === 0 ? (
                    <MenuItem disabled>
                      {loading ? 'Loading sites...' : 'No available sites'}
                    </MenuItem>
                  ) : (
                    filteredAvailableSites.production.map((site) => (
                      <MenuItem key={site.id} value={site.id}>
                        {site.name} ({site.location})
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedSites.productionSites.map((site) => (
                  <Chip
                    key={site.id}
                    label={`${site.name} (${site.location})`}
                    onDelete={() => handleRemoveSite('production', site.id)}
                    disabled={loading || submitting}
                  />
                ))}
              </Box>
            </Box>
          </Grid>

          {/* Consumption Sites */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Consumption Sites
            </Typography>
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth disabled={loading || submitting}>
                <InputLabel>Add Consumption Site</InputLabel>
                <Select
                  value=""
                  onChange={(e) => {
                    const site = availableSites.consumption.find(s => s.id === e.target.value);
                    if (site) handleAddSite('consumption', site);
                  }}
                  label="Add Consumption Site"
                >
                  {filteredAvailableSites.consumption.length === 0 ? (
                    <MenuItem disabled>
                      {loading ? 'Loading sites...' : 'No available sites'}
                    </MenuItem>
                  ) : (
                    filteredAvailableSites.consumption.map((site) => (
                      <MenuItem key={site.id} value={site.id}>
                        {site.name} ({site.location})
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedSites.consumptionSites.map((site) => (
                  <Chip
                    key={site.id}
                    label={`${site.name} (${site.location})`}
                    onDelete={() => handleRemoveSite('consumption', site.id)}
                    disabled={loading || submitting}
                  />
                ))}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, borderTop: 1, borderColor: 'divider' }}>
        <Button 
          onClick={onClose} 
          disabled={loading || submitting}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || submitting}
          startIcon={submitting && <CircularProgress size={20} />}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

SiteAccessDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.shape({
    productionSites: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      location: PropTypes.string.isRequired
    })),
    consumptionSites: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      location: PropTypes.string.isRequired
    }))
  }),
  title: PropTypes.string
};

export default SiteAccessDialog;
