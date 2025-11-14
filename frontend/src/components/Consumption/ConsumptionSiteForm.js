import React, { useState, useEffect, useCallback } from 'react';
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
  CircularProgress,
  Typography,
  Paper,
  Alert
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  Category as CategoryIcon,
  BarChart as ChartIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
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
const INACTIVE_STATUSES = ['inactive', 'maintenance'];

// Initial form state
const INITIAL_FORM_STATE = {
  name: '',
  location: '',
  type: 'textile',
  status: 'active',
  annualConsumption: '',
  annualConsumption_L: '',
  timetolive: 0,
  version: 1,
  companyId: '',
  companyName: ''
};

const ConsumptionSiteForm = ({ 
  initialData, 
  onSubmit, 
  onCancel, 
  loading = false, 
  permissions = {},
  isEditing = false,
  companyId: propCompanyId,
  user,
  site // Alias for initialData for consistency with ProductionSiteForm
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formError, setFormError] = useState('');
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState('');
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  
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

  // Load companies when component mounts
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setCompaniesLoading(true);
        setCompaniesError('');
        const response = await companyApi.getShareholderCompanies();

        // Support both wrapped and direct array responses
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
        setCompaniesLoaded(true);
      } catch (error) {
        console.error('Failed to load companies for ConsumptionSiteForm:', error);
        setCompaniesError('Failed to load companies. Please try again later.');
        setCompaniesLoaded(true);
      } finally {
        setCompaniesLoading(false);
      }
    };

    loadCompanies();
  }, [companyId]);

  // Handle initial data after companies are loaded
  useEffect(() => {
    if (!companiesLoaded) return;

    const updateFormData = () => {
      try {
        const dataSource = initialData || site; // Support both initialData and site props
        
        if (dataSource) {
          // Get the company ID from dataSource or use the provided companyId
          const siteCompanyId = dataSource.companyId || companyId;
          
          // Find the company in the loaded companies list using string comparison
          let company = companies.find(c => String(c.companyId) === String(siteCompanyId));
          
          // If not found in list, create a fallback company object using site data
          if (!company) {
            company = {
              companyId: siteCompanyId,
              companyName: dataSource.companyName || `Company ${siteCompanyId}`
            };
          }
          
          // Normalize status
          let normalizedStatus = 'active';
          if (dataSource.status && typeof dataSource.status === 'string') {
            const trimmedStatus = dataSource.status.trim().toLowerCase();
            normalizedStatus = SITE_STATUS.includes(trimmedStatus) ? trimmedStatus : 'active';
          }

          const cleanData = {
            name: dataSource.name || '',
            type: normalizeType(dataSource.type),
            location: dataSource.location || '',
            status: normalizedStatus,
            annualConsumption: dataSource.annualConsumption || dataSource.annualConsumption_L || '',
            annualConsumption_L: dataSource.annualConsumption_L || dataSource.annualConsumption || '',
            timetolive: Number(dataSource.timetolive || 0),
            version: dataSource.version || 1,
            createdat: dataSource.createdat || new Date().toISOString(),
            updatedat: dataSource.updatedat || new Date().toISOString(),
            companyId: siteCompanyId,
            companyName: company.companyName,
            consumptionSiteId: dataSource.consumptionSiteId
          };
          
          setFormData(cleanData);
        } else {
          // For new sites
          const company = companies.find(c => String(c.companyId) === String(companyId));
          setFormData({ 
            ...INITIAL_FORM_STATE, 
            companyId,
            companyName: company ? company.companyName : `Company ${companyId}`,
            status: 'active', // Default status for new sites
            timetolive: 0 // Default timetolive for new sites
          });
        }
        
        setFormError('');
      } catch (error) {
        console.error('Error initializing form data:', error);
        setFormError('Failed to initialize form data. Please refresh the page.');
      }
    };

    updateFormData();
    setTouched({});
  }, [initialData, site, companyId, companies, companiesLoaded]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => {
      const newValue = type === 'checkbox' ? checked : value;
      
      // Special handling for numeric fields
      if ((name === 'annualConsumption' || name === 'timetolive') && newValue !== '') {
        const numValue = parseFloat(newValue);
        if (isNaN(numValue)) return prev;
        
        return {
          ...prev,
          [name]: numValue,
          ...(name === 'annualConsumption' && { annualConsumption_L: numValue }) // Keep both fields in sync
        };
      }
      
      return {
        ...prev,
        [name]: newValue
      };
    });
    
    // Mark field as touched
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  // Validate form fields
  const validateForm = useCallback((data = formData) => {
    const newErrors = {};
    
    // Required fields validation
    const requiredFields = ['name', 'location', 'annualConsumption', 'status'];
    requiredFields.forEach(field => {
      if (!data[field] && data[field] !== 0) {
        newErrors[field] = 'This field is required';
      }
    });
    
    // Type-specific validations
    if (data.annualConsumption && (isNaN(Number(data.annualConsumption)) || Number(data.annualConsumption) < 0)) {
      newErrors.annualConsumption = 'Must be a positive number';
    }
    
    // Status validation
    if (data.status && !SITE_STATUS.includes(data.status.toLowerCase())) {
      newErrors.status = 'Invalid status';
    }
    
    // Type validation
    if (data.type && !SITE_TYPES.some(t => t.value === data.type.toLowerCase())) {
      newErrors.type = 'Invalid site type';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);
  
  // Validate on form data change
  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      validateForm();
    }
  }, [formData, touched, validateForm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Mark all fields as touched to show validation errors
    const allTouched = {};
    Object.keys(formData).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);
    
    // Validate form
    const isValid = validateForm();
    if (!isValid) {
      enqueueSnackbar('Please fix the form errors before submitting', { 
        variant: 'error',
        autoHideDuration: 3000
      });
      return;
    }
    
    try {
      // Create a clean submission object with only the fields we need
      const submissionData = {
        // Include IDs if they exist
        ...(formData.companyId && { companyId: formData.companyId }),
        ...(formData.consumptionSiteId && { consumptionSiteId: formData.consumptionSiteId }),
        
        // Core fields with proper formatting
        name: formData.name.trim(),
        type: normalizeType(formData.type),
        location: formData.location.trim(),
        status: formData.status.toLowerCase(),
        
        // Numeric fields with proper formatting
        annualConsumption: parseFloat(formData.annualConsumption),
        annualConsumption_L: parseFloat(formData.annualConsumption_L || formData.annualConsumption),
        timetolive: formData.timetolive ? 1 : 0,
        
        // Version control
        version: isEditing ? (parseInt(formData.version || 1, 10) + 1) : 1,
        createdat: isEditing ? formData.createdat : new Date().toISOString(),
        updatedat: new Date().toISOString()
      };

      await onSubmit(submissionData);
      
    } catch (error) {
      console.error('Error saving consumption site:', error);
      
      // Handle version conflict (409 Conflict)
      if (error.response?.status === 409 || error.message?.includes('Version')) {
        enqueueSnackbar(
          'This record has been modified by another user. Please refresh the page to get the latest data.',
          { 
            variant: 'warning',
            persist: true,
            action: (key) => (
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => {
                  enqueueSnackbar.dismiss(key);
                  if (onCancel) onCancel();
                }}
              >
                Refresh Now
              </Button>
            )
          }
        );
      } else {
        // Handle other errors
        const errorMessage = error.response?.data?.message || error.message || 'Failed to save consumption site';
        enqueueSnackbar(errorMessage, { 
          variant: 'error',
          autoHideDuration: 5000
        });
      }
      
      // Rethrow the error to be handled by the parent component if needed
      throw error;
    }
  };

  if (companiesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Box ml={2}>Loading form data...</Box>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      {formError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {formError}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
            <Typography variant="h6" gutterBottom>
              {isEditing ? 'Edit Consumption Site' : 'New Consumption Site'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isEditing 
                ? 'Update the consumption site details below.'
                : 'Fill in the details below to create a new consumption site.'}
            </Typography>
          </Paper>
        </Grid>
        
        {isEditing && (
          <Grid item xs={12}>
            <Box sx={{ 
              p: 2, 
              bgcolor: 'action.hover', 
              borderRadius: 1, 
              border: '1px solid',
              borderColor: 'divider'
            }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Company Information (Cannot be changed)
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {formData.companyName}
              </Typography>
            </Box>
          </Grid>
        )}
        {!isEditing && (
          <Grid item xs={12} sm={6}>
            <FormControl 
              fullWidth 
              margin="normal" 
              error={companiesError && !companiesLoading ? true : false}
            >
              <InputLabel>Company</InputLabel>
              <Select
                name="companyId"
                value={formData.companyId || ''}
                label="Company"
                onChange={handleChange}
                disabled={companiesLoading}
                renderValue={(value) => {
                  if (!value) return <em>Select a company</em>;
                  // Try to find company in the list
                  const company = companies.find(c => String(c.companyId) === String(value));
                  return company 
                    ? `${company.companyName}` 
                    : formData.companyName 
                      ? `${formData.companyName}`
                      : `Company`;
                }}
              >
                <MenuItem value="">
                  <em>Select a company</em>
                </MenuItem>
                {companies.map((company) => (
                  <MenuItem key={company.companyId} value={company.companyId}>
                    {company.companyName}
                  </MenuItem>
                ))}
                {!companies.some(c => c.companyId === formData.companyId) && formData.companyId && (
                  <MenuItem key={formData.companyId} value={formData.companyId}>
                    {formData.companyName || `Company`}
                  </MenuItem>
                )}
              </Select>
              {companiesLoading && (
                <FormHelperText>Loading companies...</FormHelperText>
              )}
              {companiesError && !companiesLoading && (
                <FormHelperText error>{companiesError}</FormHelperText>
              )}
              {!companiesLoading && !companiesError && !formData.companyId && (
                <FormHelperText>
                  Select the company for this consumption site
                </FormHelperText>
              )}
            </FormControl>
          </Grid>
        )}

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Site Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
            error={touched.name && !!errors.name}
            helperText={touched.name ? errors.name || ' ' : ' '}
            margin="normal"
            required
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <BusinessIcon color={touched.name && errors.name ? 'error' : 'action'} />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <FormControl 
            fullWidth 
            margin="normal" 
            error={touched.type && !!errors.type}
            disabled={loading}
          >
            <InputLabel>Site Type</InputLabel>
            <Select
              name="type"
              value={formData.type}
              onChange={handleChange}
              onBlur={() => setTouched(prev => ({ ...prev, type: true }))}
              label="Site Type"
              required
              startAdornment={
                <InputAdornment position="start">
                  <CategoryIcon color={touched.type && errors.type ? 'error' : 'action'} />
                </InputAdornment>
              }
            >
              {SITE_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText error={touched.type && !!errors.type}>
              {touched.type ? errors.type || ' ' : ' '}
            </FormHelperText>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            onBlur={() => setTouched(prev => ({ ...prev, location: true }))}
            error={touched.location && !!errors.location}
            helperText={touched.location ? errors.location || ' ' : ' '}
            margin="normal"
            required
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LocationIcon color={touched.location && errors.location ? 'error' : 'action'} />
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
            onBlur={() => setTouched(prev => ({ ...prev, annualConsumption: true }))}
            error={touched.annualConsumption && !!errors.annualConsumption}
            helperText={touched.annualConsumption ? errors.annualConsumption || ' ' : ' '}
            margin="normal"
            required
            disabled={loading}
            inputProps={{
              min: 0,
              step: 0.01,
              inputMode: 'decimal'
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <ChartIcon color={touched.annualConsumption && errors.annualConsumption ? 'error' : 'action'} />
                </InputAdornment>
              ),
              endAdornment: <InputAdornment position="end">MWh</InputAdornment>,
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <FormControl 
            fullWidth 
            margin="normal" 
            error={touched.status && !!errors.status}
            disabled={loading}
          >
            <InputLabel>Status</InputLabel>
            <Select
              name="status"
              value={formData.status}
              onChange={handleChange}
              onBlur={() => setTouched(prev => ({ ...prev, status: true }))}
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
            <FormHelperText error={touched.status && !!errors.status}>
              {touched.status ? errors.status || ' ' : ' '}
            </FormHelperText>
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
                  
                  setTouched(prev => ({
                    ...prev,
                    timetolive: true
                  }));
                }}
                color="primary"
                disabled={loading}
              />
            }
            label={
              <Box>
                <Box>Enable Time to Live</Box>
                <Box component="span" variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {formData.timetolive 
                    ? 'Time to live is enabled for this site.'
                    : 'Time to live is disabled for this site.'}
                </Box>
              </Box>
            }
          />
        </Grid>
      </Grid>
      
      <Box sx={{ 
        mt: 4, 
        pt: 2, 
        borderTop: '1px solid',
        borderColor: 'divider',
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2 
      }}>
        <Box>
          {isEditing && formData.version && (
            <Typography variant="caption" color="text.secondary">
              Version: {formData.version} • Last updated: {new Date(formData.updatedat).toLocaleString()}
            </Typography>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            onClick={onCancel} 
            disabled={loading}
            variant="outlined"
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            color="primary"
            disabled={loading || Object.keys(errors).length > 0}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {isEditing ? 'Update Site' : 'Create Site'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

ConsumptionSiteForm.propTypes = {
  /** Initial form data for editing an existing site */
  initialData: PropTypes.object,
  /** Alias for initialData for consistency with other components */
  site: PropTypes.object,
  /** Callback when form is submitted */
  onSubmit: PropTypes.func.isRequired,
  /** Callback when cancel button is clicked */
  onCancel: PropTypes.func.isRequired,
  /** Whether the form is in a loading state */
  loading: PropTypes.bool,
  /** User permissions object */
  permissions: PropTypes.object,
  /** Whether the form is in edit mode */
  isEditing: PropTypes.bool,
  /** Company ID (overrides user's company if provided) */
  companyId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** Current user object */
  user: PropTypes.shape({
    companyId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    // Add other user properties as needed
  })
};

ConsumptionSiteForm.defaultProps = {
  loading: false,
  permissions: {},
  isEditing: false,
  initialData: null,
  site: null,
  user: null,
  companyId: ''
};

export default ConsumptionSiteForm;
