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
import companyApi from '../../services/companyApi';

// Site type configuration with display text and icons
const SITE_TYPES = [
  { value: 'textile', label: 'Textile' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'commercial', label: 'Commercial' }
];
// Status configuration with display text and colors
const STATUS_CONFIG = {
  active: { label: 'Active', color: 'success.main' },
  inactive: { label: 'Inactive', color: 'text.secondary' },
  maintenance: { label: 'Maintenance', color: 'warning.main' }
};

const SITE_STATUS = Object.keys(STATUS_CONFIG);

const INITIAL_FORM_STATE = {
  name: '',
  location: '',
  type: 'textile',
  status: 'active',
  annualConsumption: '',
  annualConsumption_L: '',
  timetolive: 0,
  version: 1,
  companyId: ''
};

const ConsumptionSiteForm = ({ 
  initialData, 
  onSubmit, 
  onCancel, 
  loading = false, 
  permissions = {},
  isEditing = false,
  companyId: propCompanyId,
  user
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState({});
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState('');
  
  // Get companyId from props or user context
  const companyId = propCompanyId || user?.companyId || '1';

  // Normalize site type to ensure it's one of the valid types
  const normalizeType = (type) => {
    if (!type) return 'textile';
    const normalized = String(type).trim().toLowerCase();
    return SITE_TYPES.some(t => t.value === normalized) 
      ? normalized 
      : 'textile'; // Default to textile if invalid
  };

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setCompaniesLoading(true);
        setCompaniesError('');
        const response = await companyApi.getAll();

        // Backend getAllCompanies returns { success, data: companies }
        const list = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
          ? response
          : [];

        const normalized = list.map((c) => ({
          companyId: c.companyId,
          companyName: c.companyName || c.name || `Company ${c.companyId}`,
        }));

        setCompanies(normalized);
      } catch (error) {
        console.error('Failed to load companies for ConsumptionSiteForm:', error);
        setCompaniesError('Failed to load companies');
      } finally {
        setCompaniesLoading(false);
      }
    };

    loadCompanies();

    if (initialData) {
      // Create a clean submission object with only the fields we need
      const cleanData = {
        name: initialData.name || '',
        type: normalizeType(initialData.type),
        location: initialData.location || '',
        status: initialData.status ? initialData.status.toLowerCase() : 'active',
        annualConsumption: initialData.annualConsumption || initialData.annualConsumption_L || '',
        timetolive: Number(initialData.timetolive || 0),
        // Important: Always include these fields for version control
        version: initialData.version || 1,
        createdat: initialData.createdat || new Date().toISOString(),
        updatedat: initialData.updatedat || new Date().toISOString(),
        // Include IDs if they exist
        companyId: initialData.companyId || companyId,
        consumptionSiteId: initialData.consumptionSiteId
      };
      setFormData(cleanData);
    } else {
      setFormData({ ...INITIAL_FORM_STATE, companyId });
    }
  }, [initialData, companyId]);

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
    
    if (!formData.status || !SITE_STATUS.includes(formData.status.toLowerCase())) {
      newErrors.status = 'Please select a valid status';
    }
    
    if (!formData.annualConsumption) {
      newErrors.annualConsumption = 'Annual consumption is required';
    } else if (isNaN(Number(formData.annualConsumption)) || Number(formData.annualConsumption) <= 0) {
      newErrors.annualConsumption = 'Please enter a valid positive number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

    const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      enqueueSnackbar('Please fix the form errors', { variant: 'error' });
      return;
    }
    
    try {
      // Create a clean submission object with only the fields we need
      const submissionData = {
        // If we have IDs from initialData, include them
        ...(formData.companyId && { companyId: formData.companyId }),
        ...(formData.consumptionSiteId && { consumptionSiteId: formData.consumptionSiteId }),
        
        // Core fields with proper formatting
        name: formData.name.trim(),
        type: normalizeType(formData.type),
        location: formData.location.trim(),
        status: formData.status,
        
        // Numeric fields
        annualConsumption: Number(formData.annualConsumption),
        annualConsumption_L: Number(formData.annualConsumption),
        timetolive: formData.timetolive ? 1 : 0,
        
        // Version control fields
        version: Number(formData.version || 1),
        createdat: formData.createdat || new Date().toISOString(),
        updatedat: new Date().toISOString()
      };

      await onSubmit(submissionData);
    } catch (error) {
      // Handle version conflict (409 Conflict)
      if (error.response?.status === 409 || error.message?.includes('Version')) {
        enqueueSnackbar(
          'This record has been modified by another user. The form will refresh with the latest data.',
          { 
            variant: 'warning',
            autoHideDuration: 5000,
            action: (key) => (
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => {
                  if (onCancel) {
                    // This will trigger a refresh in the parent component
                    onCancel();
                  }
                }}
              >
                Refresh Now
              </Button>
            )
          }
        );
      } else {
        // Handle other errors
        enqueueSnackbar(
          'Error saving site: ' + (error.response?.data?.message || error.message || 'Unknown error'),
          { variant: 'error' }
        );
      }
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth margin="normal">
            <InputLabel>Company</InputLabel>
            <Select
              name="companyId"
              value={formData.companyId || ''}
              label="Company"
              onChange={handleChange}
              disabled={companiesLoading}
            >
              <MenuItem value="">
                <em>Select a company</em>
              </MenuItem>
              {companies.map((company) => (
                <MenuItem key={company.companyId} value={company.companyId}>
                  {company.companyName} ({company.companyId})
                </MenuItem>
              ))}
            </Select>
            {companiesLoading && (
              <FormHelperText>Loading companies...</FormHelperText>
            )}
            {companiesError && !companiesLoading && (
              <FormHelperText error>{companiesError}</FormHelperText>
            )}
            {!companiesLoading && !companiesError && !formData.companyId && (
              <FormHelperText>Select the company for this consumption site</FormHelperText>
            )}
          </FormControl>
        </Grid>

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
            <InputLabel>Site Type</InputLabel>
            <Select
              name="type"
              value={formData.type}
              onChange={handleChange}
              label="Site Type"
              required
              startAdornment={
                <InputAdornment position="start">
                  <CategoryIcon color="action" />
                </InputAdornment>
              }
            >
              {SITE_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
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
          <FormControl fullWidth margin="normal" error={!!errors.status}>
            <InputLabel>Status</InputLabel>
            <Select
              name="status"
              value={formData.status}
              onChange={handleChange}
              label="Status"
              required
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box 
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: STATUS_CONFIG[selected]?.color || 'grey.500'
                    }}
                  />
                  {STATUS_CONFIG[selected]?.label || selected}
                </Box>
              )}
            >
              {SITE_STATUS.map((status) => (
                <MenuItem key={status} value={status}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box 
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: STATUS_CONFIG[status]?.color || 'grey.500'
                      }}
                    />
                    {STATUS_CONFIG[status]?.label || status}
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {errors.status && <FormHelperText>{errors.status}</FormHelperText>}
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
  isEditing: PropTypes.bool,
  companyId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  user: PropTypes.object
};

export default ConsumptionSiteForm;
