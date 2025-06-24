import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  TextField,
  Button,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  FormControlLabel,
  Switch,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  Category as CategoryIcon,
  BarChart as ChartIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

const SITE_TYPES = ['Industrial', 'Commercial', 'Residential'];
const SITE_STATUS = ['Active', 'Inactive', 'Maintenance'];

const INITIAL_FORM_STATE = {
  name: '',
  location: '',
  type: 'Industrial',
  status: 'Active',
  annualConsumption: '',
  timetolive: 0
};

const ConsumptionSiteForm = ({ 
  initialData, 
  onSubmit, 
  onCancel, 
  loading = false, 
  permissions = {},
  isEditing = false
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Initialize form data when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        type: initialData.type || 'Industrial',
        location: initialData.location || '',
        annualConsumption: initialData.annualConsumption || '',
        status: initialData.status || 'Active',
        timetolive: initialData.timetolive || 0,
      });
    } else {
      setFormData(INITIAL_FORM_STATE);
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }
    
    if (!formData.annualConsumption) {
      newErrors.annualConsumption = 'Annual consumption is required';
    } else if (isNaN(Number(formData.annualConsumption)) || Number(formData.annualConsumption) <= 0) {
      newErrors.annualConsumption = 'Please enter a valid positive number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      enqueueSnackbar('Please fix the form errors', { variant: 'error' });
      return;
    }
    
    const submissionData = {
      ...formData,
      annualConsumption: Number(formData.annualConsumption),
      timetolive: formData.timetolive ? 1 : 0,
    };
    
    onSubmit(submissionData);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Site Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            error={!!errors.name}
            helperText={errors.name}
            margin="normal"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <BusinessIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth margin="normal" error={!!errors.type}>
            <InputLabel>Type</InputLabel>
            <Select
              name="type"
              value={formData.type}
              onChange={handleChange}
              label="Type"
              required
            >
              {SITE_TYPES.map(type => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
            {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            error={!!errors.location}
            helperText={errors.location}
            margin="normal"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LocationIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="number"
            label="Annual Consumption (MWh)"
            name="annualConsumption"
            value={formData.annualConsumption}
            onChange={handleChange}
            error={!!errors.annualConsumption}
            helperText={errors.annualConsumption}
            margin="normal"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <ChartIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: <InputAdornment position="end">MWh</InputAdornment>,
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              name="status"
              value={formData.status}
              onChange={handleChange}
              label="Status"
              required
            >
              {SITE_STATUS.map(status => (
                <MenuItem key={status} value={status}>{status}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                name="timetolive"
                checked={!!formData.timetolive}
                onChange={(e) => {
                  setFormData(prev => ({
                    ...prev,
                    timetolive: e.target.checked ? 1 : 0
                  }));
                }}
              />
            }
            label="Enable Time to Live"
          />
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button 
          onClick={onCancel} 
          disabled={loading}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="contained" 
          color="primary"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {isEditing ? 'Update' : 'Create'} Site
        </Button>
      </Box>
    </Box>
  );
};

ConsumptionSiteForm.propTypes = {
  initialData: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  permissions: PropTypes.object,
  isEditing: PropTypes.bool
};

export default ConsumptionSiteForm;
