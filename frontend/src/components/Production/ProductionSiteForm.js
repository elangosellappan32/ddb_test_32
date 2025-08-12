import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Box, TextField, Button, Grid, MenuItem, FormControl, InputLabel, Select, CircularProgress,
  Switch, FormControlLabel, InputAdornment, FormHelperText, Typography, Paper, Card,
  CardHeader, CardContent, CardActions, Divider, Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  LocationOn as LocationIcon,
  Speed as CapacityIcon,
  ElectricBolt as VoltageIcon,
  Assignment as HtscIcon,
  Factory as TypeIcon,
  Assessment as AnnualProductionIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

// Constants
const SITE_TYPES = ['Wind', 'Solar'];
const SITE_STATUS = ['Active', 'Inactive', 'Maintenance'];
const INACTIVE_STATUSES = ['Inactive', 'Maintenance'];

// Initial form state
const INITIAL_FORM_STATE = {
  name: '',
  location: '',
  capacity_MW: '',
  injectionVoltage_KV: '',
  htscNo: '',
  type: '',
  status: '',
  banking: 0,
  annualProduction_L: ''
};

const ProductionSiteForm = ({ initialData, onSubmit, onCancel, loading, site }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isValid, setIsValid] = useState(false);
  const [formError, setFormError] = useState('');

  // Load site data when editing
  useEffect(() => {
    if (site) {
      try {
        // Normalize type
        const normalizedType = site.type
          ? site.type.charAt(0).toUpperCase() + site.type.slice(1).toLowerCase()
          : '';

        // Get the status directly from the site object without defaulting to 'Inactive'
        let normalizedStatus = '';
        if (site.status && typeof site.status === 'string') {
          const trimmedStatus = site.status.trim();
          const matchedStatus = SITE_STATUS.find(status => 
            status.toLowerCase() === trimmedStatus.toLowerCase()
          );
          normalizedStatus = matchedStatus || '';
        }

        const validType = SITE_TYPES.includes(normalizedType) ? normalizedType : '';
        
        // Only validate status if it exists, don't default to 'Inactive'
        const validStatus = normalizedStatus && SITE_STATUS.includes(normalizedStatus) 
          ? normalizedStatus 
          : '';

        const newFormData = {
          name: site.name || '',
          type: validType,
          location: site.location || '',
          capacity_MW: site.capacity_MW ?? '',
          injectionVoltage_KV: site.injectionVoltage_KV ?? '',
          htscNo: site.htscNo || '',
          annualProduction_L: site.annualProduction_L ?? '',
          status: validStatus, // This will be empty if status is invalid or missing
          banking: validStatus && INACTIVE_STATUSES.includes(validStatus) ? 0 : (site.banking || 0),
        };

        setFormData(newFormData);
        validateForm(newFormData);
      } catch (error) {
        setFormError('Failed to load site data.');
      }
    } else {
      // For new sites - preset status as Active
      setFormData({ ...INITIAL_FORM_STATE, status: 'Active' });
    }

    setTouched({});
    setErrors({});
    setFormError('');
  }, [site]);

  // Validate form
  const validateForm = useCallback((data = formData) => {
    const newErrors = {};
    const requiredFields = ['name', 'location', 'capacity_MW', 'injectionVoltage_KV', 'type', 'status'];

    requiredFields.forEach(field => {
      if (!data[field]) {
        newErrors[field] = 'This field is required';
      }
    });

    if (data.name && data.name.length < 3) newErrors.name = 'Name must be at least 3 characters';
    if (data.capacity_MW && (isNaN(data.capacity_MW) || data.capacity_MW <= 0))
      newErrors.capacity_MW = 'Capacity must be greater than 0';
    if (data.injectionVoltage_KV && (isNaN(data.injectionVoltage_KV) || data.injectionVoltage_KV <= 0))
      newErrors.injectionVoltage_KV = 'Voltage must be greater than 0';
    if (data.annualProduction_L && (isNaN(data.annualProduction_L) || data.annualProduction_L < 0))
      newErrors.annualProduction_L = 'Annual production cannot be negative';

    setErrors(newErrors);
    setIsValid(Object.keys(newErrors).length === 0);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  useEffect(() => {
    validateForm();
  }, [formData, validateForm]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let processedValue = value;
    if (type === 'number') processedValue = value === '' ? '' : Number(value);
    if (type === 'checkbox') processedValue = checked ? 1 : 0;

    const updatedData = { ...formData, [name]: processedValue };
    if (name === 'status' && INACTIVE_STATUSES.includes(processedValue)) {
      updatedData.banking = 0;
    }

    setFormData(updatedData);
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, processedValue) }));
  };

  const validateField = (name, value) => {
    if (!touched[name]) return '';
    switch (name) {
      case 'name':
        return !value ? 'Site Name is required' : value.length < 3 ? 'Minimum 3 characters' : '';
      case 'type':
        return !value ? 'Site Type is required' : '';
      case 'location':
        return !value ? 'Location is required' : '';
      case 'capacity_MW':
        return (!value || value <= 0) ? 'Capacity must be greater than 0' : '';
      case 'injectionVoltage_KV':
        return (!value || value <= 0) ? 'Injection Voltage must be greater than 0' : '';
      case 'status':
        return !value ? 'Status is required' : '';
      default:
        return '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const allTouched = {};
    Object.keys(formData).forEach(f => allTouched[f] = true);
    setTouched(allTouched);

    if (validateForm()) {
      try {
        const submitData = {
          ...formData,
          version: initialData?.version,
          banking: INACTIVE_STATUSES.includes(formData.status) ? 0 : (formData.banking ? 1 : 0)
        };
        await onSubmit(submitData);
      } catch (error) {
        setFormError(error.message || 'Failed to save site.');
      }
    }
  };

  const handleCancel = () => onCancel ? onCancel() : navigate(-1);

  if (loading) {
    return <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>;
  }

  return (
    <Paper sx={{ maxWidth: 800, mx: 'auto', p: 3, mt: 3 }}>
      <Box component="form" onSubmit={handleSubmit}>
        <Card>
          <CardHeader title={site ? 'Edit Production Site' : 'Add Production Site'} />
          <CardContent>
            {formError && <Alert severity="error" sx={{ mb: 3 }} icon={<WarningIcon />}>{formError}</Alert>}
            {INACTIVE_STATUSES.includes(formData.status) && (
              <Alert severity="info" sx={{ mb: 3 }}>{`This site is ${formData.status}`}</Alert>
            )}
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth name="name" label="Site Name"
                  value={formData.name} onChange={handleChange}
                  error={touched.name && !!errors.name} helperText={touched.name && errors.name}
                  required InputProps={{ startAdornment: <InputAdornment position="start"><TypeIcon /></InputAdornment> }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={touched.type && !!errors.type}>
                  <InputLabel>Type *</InputLabel>
                  <Select name="type" value={formData.type} onChange={handleChange}>
                    <MenuItem value=""><em>Select a type</em></MenuItem>
                    {SITE_TYPES.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                  </Select>
                  {touched.type && errors.type && <FormHelperText>{errors.type}</FormHelperText>}
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth name="location" label="Location" value={formData.location} onChange={handleChange}
                  error={touched.location && !!errors.location} helperText={touched.location && errors.location} required
                  InputProps={{ startAdornment: <InputAdornment position="start"><LocationIcon /></InputAdornment> }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth type="number" name="capacity_MW" label="Capacity (MW)" value={formData.capacity_MW}
                  onChange={handleChange} error={touched.capacity_MW && !!errors.capacity_MW}
                  helperText={touched.capacity_MW && errors.capacity_MW}
                  InputProps={{ startAdornment: <InputAdornment position="start"><CapacityIcon /></InputAdornment>, endAdornment: <InputAdornment position="end">MW</InputAdornment> }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth type="number" name="injectionVoltage_KV" label="Injection Voltage (KV)"
                  value={formData.injectionVoltage_KV} onChange={handleChange} error={touched.injectionVoltage_KV && !!errors.injectionVoltage_KV}
                  helperText={touched.injectionVoltage_KV && errors.injectionVoltage_KV}
                  InputProps={{ startAdornment: <InputAdornment position="start"><VoltageIcon /></InputAdornment>, endAdornment: <InputAdornment position="end">KV</InputAdornment> }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth name="htscNo" label="HTSC No" value={formData.htscNo} onChange={handleChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><HtscIcon /></InputAdornment> }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={touched.status && !!errors.status}>
                  <InputLabel>Status *</InputLabel>
                  <Select name="status" value={formData.status} onChange={handleChange}>
                    {SITE_STATUS.map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}
                  </Select>
                  {touched.status && errors.status && <FormHelperText>{errors.status}</FormHelperText>}
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch checked={!!formData.banking} onChange={handleChange} name="banking"
                      disabled={INACTIVE_STATUSES.includes(formData.status)} />
                  }
                  label="Enable Banking"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth type="number" name="annualProduction_L" label="Annual Production (L)"
                  value={formData.annualProduction_L} onChange={handleChange}
                  InputProps={{ startAdornment: <InputAdornment position="start"><AnnualProductionIcon /></InputAdornment>, endAdornment: <InputAdornment position="end">L</InputAdornment> }}
                />
              </Grid>
            </Grid>
          </CardContent>
          <Divider />
          <CardActions sx={{ justifyContent: 'flex-end' }}>
            <Button onClick={handleCancel} variant="outlined">Cancel</Button>
            <Button type="submit" variant="contained" color="primary" disabled={!isValid || loading}>
              {site ? 'Update' : 'Create'}
            </Button>
          </CardActions>
        </Card>
      </Box>
    </Paper>
  );
};

ProductionSiteForm.propTypes = {
  initialData: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  site: PropTypes.object
};

export default ProductionSiteForm;
