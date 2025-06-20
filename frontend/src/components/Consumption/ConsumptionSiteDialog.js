import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  Grid,
  CircularProgress,
  FormControlLabel,
  Switch,
  InputAdornment
} from '@mui/material';
import {
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Speed as ConsumptionIcon,
  PowerSettingsNew as StatusIcon,
  Label as NameIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

const ConsumptionSiteDialog = ({ 
  open, 
  onClose, 
  onSubmit, 
  initialData, 
  loading: externalLoading,
  permissions,
  totalSites 
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'industrial',
    location: '',
    annualConsumption: '',
    status: 'active',
    timetolive: 0
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      // Ensure type value matches available options
      const validTypes = ['industrial', 'textile', 'other'];
      const sanitizedType = validTypes.includes(initialData.type?.toLowerCase())
        ? initialData.type.toLowerCase()
        : 'other';

      // Ensure status value is normalized
      const validStatuses = ['active', 'inactive', 'pending'];
      const sanitizedStatus = validStatuses.includes(initialData.status?.toLowerCase())
        ? initialData.status.toLowerCase()
        : 'inactive';

      setFormData({
        name: initialData.name || '',
        type: sanitizedType,
        location: initialData.location || '',
        annualConsumption: initialData.annualConsumption || '',
        status: sanitizedStatus,
        timetolive: initialData.timetolive || 0,
        version: initialData.version || 1
      });
    } else {
      setFormData({
        name: '',
        type: 'industrial',
        location: '',
        annualConsumption: '',
        status: 'active',
        timetolive: 0
      });
    }
    setErrors({});
  }, [initialData, open]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.location) newErrors.location = 'Location is required';
    if (!formData.annualConsumption) {
      newErrors.annualConsumption = 'Annual consumption is required';
    } else if (isNaN(formData.annualConsumption) || Number(formData.annualConsumption) <= 0) {
      newErrors.annualConsumption = 'Annual consumption must be a positive number';
    }
    if (formData.timetolive < 0) {
      newErrors.timetolive = 'Time to live must be a non-negative number';
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!permissions?.create && !permissions?.update) {
      enqueueSnackbar('You do not have permission to perform this action', { 
        variant: 'error' 
      });
      return;
    }

    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      // Format the data before submission
      const submissionData = {
        ...formData,
        type: formData.type.toLowerCase(), // Ensure type is lowercase
        annualConsumption: Number(formData.annualConsumption),
        version: initialData?.version || 1,
        timetolive: Number(formData.timetolive || 0),
        status: formData.status.toLowerCase(), // Ensure status is lowercase
        // Add consumptionSiteId for new sites
        ...(initialData ? {} : { consumptionSiteId: String(totalSites + 1) })
      };
      
      // Make sure all required fields are present
      if (!submissionData.type || !submissionData.name || !submissionData.location) {
        throw new Error('Missing required fields');
      }

      await onSubmit(submissionData);
      onClose();
    } catch (error) {
      console.error('[ConsumptionSiteDialog] Submit error:', error);
      enqueueSnackbar(error.message || 'Failed to save site', { 
        variant: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={loading ? undefined : onClose}
      maxWidth="md" 
      fullWidth
    >
      <DialogTitle sx={{ 
        borderBottom: '2px solid #1976d2',
        mb: 2
      }}>
        {initialData ? 'Edit Consumption Site' : 'Add Consumption Site'}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Grid container spacing={3}>
            {/* Basic Info Section */}
            <Grid item xs={12}>
              <TextField
                name="name"
                label="Site Name"
                fullWidth
                required
                value={formData.name}
                onChange={handleChange}
                disabled={loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <NameIcon />
                    </InputAdornment>
                  ),
                }}
                error={!!errors.name}
                helperText={errors.name}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="type"
                label="Type"
                select
                fullWidth
                value={formData.type}
                onChange={handleChange}
                disabled={loading}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BusinessIcon />
                    </InputAdornment>
                  ),
                }}
              >
                <MenuItem value="industrial">Industrial</MenuItem>
                <MenuItem value="textile">Textile</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="location"
                label="Location"
                fullWidth
                value={formData.location}
                onChange={handleChange}
                error={!!errors.location}
                helperText={errors.location}
                disabled={loading}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="annualConsumption"
                label="Annual Consumption (MW)"
                type="number"
                fullWidth
                value={formData.annualConsumption}
                onChange={handleChange}
                error={!!errors.annualConsumption}
                helperText={errors.annualConsumption}
                disabled={loading}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ConsumptionIcon />
                    </InputAdornment>
                  ),
                  inputProps: { 
                    min: 0,
                    step: "0.01" // Allow decimal values
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="timetolive"
                label="Time to Live (days)"
                type="number"
                fullWidth
                value={formData.timetolive}
                onChange={handleChange}
                error={!!errors.timetolive}
                helperText={errors.timetolive}
                disabled={loading}
                InputProps={{
                  inputProps: { 
                    min: 0,
                    step: "1" // Allow integer values
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.status === 'active'}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        status: e.target.checked ? 'active' : 'inactive'
                      }));
                    }}
                    disabled={loading}
                  />
                }
                label={
                  <Grid container alignItems="center" spacing={1}>
                    <Grid item>
                      <StatusIcon />
                    </Grid>
                    <Grid item>
                      Status ({formData.status})
                    </Grid>
                  </Grid>
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid rgba(0, 0, 0, 0.12)' }}>
          <Button 
            onClick={onClose} 
            disabled={loading}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            variant="contained" 
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {initialData ? 'Update Site' : 'Create Site'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

ConsumptionSiteDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  loading: PropTypes.bool,
  permissions: PropTypes.shape({
    create: PropTypes.bool,
    update: PropTypes.bool,
    delete: PropTypes.bool
  }).isRequired,
  totalSites: PropTypes.number.isRequired
};

export default ConsumptionSiteDialog;