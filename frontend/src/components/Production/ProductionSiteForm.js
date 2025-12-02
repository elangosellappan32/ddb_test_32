import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Box, TextField, Button, Grid, MenuItem, FormControl, InputLabel, Select, CircularProgress,
  Switch, FormControlLabel, InputAdornment, FormHelperText, Typography, Paper, Card,
  CardHeader, CardContent, CardActions, Divider, Alert
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
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
import companyApi from '../../services/companyApi';

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
  annualProduction_L: '',
  revenuePerUnit: '',
  dateOfCommission: null,
  companyId: ''
};

const ProductionSiteForm = ({ initialData, onSubmit, onCancel, loading, site, companyId: propCompanyId, user }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isValid, setIsValid] = useState(false);
  const [formError, setFormError] = useState('');
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState('');
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  
  // Get companyId from props or user context
  const companyId = propCompanyId || user?.companyId || '1';

  // Load companies when component mounts
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setCompaniesLoading(true);
        setCompaniesError('');
        const response = await companyApi.getGeneratorCompanies();

        // Support both wrapped and direct array responses
        const list = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];

        const normalized = list.map((c) => ({
          companyId: c.companyId,
          companyName: c.companyName || c.name || `Company ${c.companyId}`,
        }));

        setCompanies(normalized);
        setCompaniesLoaded(true);
      } catch (error) {
        console.error('Failed to load generator companies for ProductionSiteForm:', error);
        setCompaniesError('Failed to load generator companies');
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
      if (site) {
        try {
          // Get the company ID from site or use the provided companyId
          const siteCompanyId = site.companyId || companyId;
          
          // Find the company in the loaded companies list
          let company = companies.find(c => String(c.companyId) === String(siteCompanyId));
          
          // If not found in list, create a fallback company object using site data
          if (!company) {
            company = {
              companyId: siteCompanyId,
              companyName: site.companyName || `Company ${siteCompanyId}`
            };
          }
          
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

          // Parse date of commission - handle various input formats
          let parsedDateOfCommission = null;
          if (site.dateOfCommission) {
            try {
              // Handle both string and Date objects
              const date = site.dateOfCommission instanceof Date 
                ? site.dateOfCommission 
                : new Date(site.dateOfCommission);
                
              if (!isNaN(date.getTime())) {
                // Ensure it's a valid date and not in the future
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                if (date <= today) {
                  parsedDateOfCommission = date;
                } else {
                  console.warn('Date of commission is in the future, ignoring');
                }
              }
            } catch (error) {
              console.error('Error parsing dateOfCommission:', error);
            }
          }

          // Parse numeric values, ensuring proper handling of null/undefined
          const newFormData = {
            name: site.name || '',
            type: validType,
            location: site.location || '',
            capacity_MW: site.capacity_MW != null ? parseFloat(site.capacity_MW) : '',
            injectionVoltage_KV: site.injectionVoltage_KV != null ? parseFloat(site.injectionVoltage_KV) : '',
            htscNo: site.htscNo || '',
            annualProduction_L: site.annualProduction_L != null ? parseFloat(site.annualProduction_L) : '',
            revenuePerUnit: site.revenuePerUnit != null ? parseFloat(site.revenuePerUnit) : '',
            status: validStatus,
            banking: validStatus && INACTIVE_STATUSES.includes(validStatus) ? 0 : (site.banking ? 1 : 0),
            dateOfCommission: parsedDateOfCommission,
            companyId: siteCompanyId,
            companyName: company.companyName,
            productionSiteId: site.productionSiteId,
            version: site.version || 1
          };

          setFormData(newFormData);
          validateForm(newFormData);
        } catch (error) {
          console.error('Error initializing form data:', error);
          setFormError('Failed to load site data.');
        }
      } else {
        // For new sites - preset status as Active and set companyId (if available)
        const company = companies.find(c => String(c.companyId) === String(companyId));
        const newFormData = { 
          ...INITIAL_FORM_STATE, 
          status: 'Active', 
          companyId,
          companyName: company ? company.companyName : `Company ${companyId}`
        };
        setFormData(newFormData);
      }
    };

    updateFormData();
    setTouched({});
    setErrors({});
    setFormError('');
  }, [site, companyId, companiesLoaded, companies]);

  // Validate form
  const validateForm = useCallback((data = formData) => {
    const newErrors = {};
    const requiredFields = ['name', 'location', 'capacity_MW', 'injectionVoltage_KV', 'type', 'status', 'dateOfCommission'];

    requiredFields.forEach(field => {
      if (field === 'dateOfCommission') {
        if (!data[field] || (data[field] instanceof Date && isNaN(data[field].getTime()))) {
          newErrors[field] = 'This field is required';
        }
      } else if ((!data[field] && data[field] !== 0)) {
        newErrors[field] = 'This field is required';
      }
    });

    if (data.name && data.name.length < 3) newErrors.name = 'Name must be at least 3 characters';
    if (data.capacity_MW !== undefined && (isNaN(data.capacity_MW) || data.capacity_MW <= 0))
      newErrors.capacity_MW = 'Capacity must be greater than 0';
    if (data.injectionVoltage_KV !== undefined && (isNaN(data.injectionVoltage_KV) || data.injectionVoltage_KV <= 0))
      newErrors.injectionVoltage_KV = 'Voltage must be greater than 0';
    if (data.annualProduction_L !== undefined && data.annualProduction_L !== '' && (isNaN(data.annualProduction_L) || data.annualProduction_L < 0))
      newErrors.annualProduction_L = 'Annual production cannot be negative';
    if (data.revenuePerUnit !== undefined && data.revenuePerUnit !== '' && (isNaN(data.revenuePerUnit) || data.revenuePerUnit < 0))
      newErrors.revenuePerUnit = 'Revenue per unit cannot be negative';
    if (data.dateOfCommission && new Date(data.dateOfCommission) > new Date())
      newErrors.dateOfCommission = 'Date of commission cannot be in the future';

    setErrors(newErrors);
    setIsValid(Object.keys(newErrors).length === 0);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  useEffect(() => {
    validateForm();
  }, [formData, validateForm]);

  const handleChange = (e, value) => {
    // Handle date picker changes (value is the second argument when coming from DatePicker)
    if (value instanceof Date) {
      const newFormData = { ...formData, dateOfCommission: value };
      const newErrors = { ...errors, dateOfCommission: validateField('dateOfCommission', value) };
      
      setFormData(newFormData);
      setTouched(prev => ({ ...prev, dateOfCommission: true }));
      setErrors(newErrors);
      setIsValid(Object.keys(newErrors).length === 0);
      return;
    }
    
    // If we get here, it's a regular input change
    if (!e || !e.target) return;
    
    const { name, type, checked } = e.target;
    let processedValue = e.target.value;
    
    // Special handling for revenuePerUnit to ensure proper decimal handling
    if (name === 'revenuePerUnit') {
      // Use e.target.value directly and handle empty string case
      processedValue = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
      // If it's a valid number, round to 2 decimal places
      if (processedValue !== '' && !isNaN(processedValue)) {
        processedValue = parseFloat(processedValue.toFixed(2));
      }
    } else if (type === 'number') {
      processedValue = e.target.value === '' ? '' : Number(e.target.value);
    } else if (type === 'checkbox') {
      processedValue = checked ? 1 : 0;
    }

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
      case 'dateOfCommission':
        if (!value) return 'Date of Commission is required';
        if (new Date(value) > new Date()) return 'Date of commission cannot be in the future';
        return '';
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
        const formDataToSubmit = {
          ...formData,
          dateOfCommission: formData.dateOfCommission 
            ? new Date(formData.dateOfCommission).toISOString()
            : null
        };
        await onSubmit(formDataToSubmit);
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
              {site && (
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
              {!site && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth error={companiesError && !companiesLoading ? true : false}>
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
                        Select the company for this production site
                      </FormHelperText>
                    )}
                  </FormControl>
                </Grid>
              )}
              

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

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth 
                  type="number"
                  inputProps={{
                    step: '0.01',
                    min: '0',
                    inputMode: 'decimal'
                  }}
                  name="revenuePerUnit"
                  label="Revenue per Unit (₹)" 
                  value={formData.revenuePerUnit === '' ? '' : formData.revenuePerUnit}
                  onChange={handleChange}
                  onBlur={(e) => {
                    // Format the value to 2 decimal places on blur
                    if (e.target.value !== '') {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        const roundedValue = parseFloat(value.toFixed(2));
                        setFormData(prev => ({
                          ...prev,
                          revenuePerUnit: roundedValue
                        }));
                      }
                    }
                  }}
                  error={touched.revenuePerUnit && !!errors.revenuePerUnit}
                  helperText={touched.revenuePerUnit && errors.revenuePerUnit}
                  InputProps={{ 
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                    endAdornment: <InputAdornment position="end">/unit</InputAdornment> 
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Date of Commission *"
                    value={formData.dateOfCommission}
                    onChange={(newValue) => {
                      if (newValue && !isNaN(new Date(newValue).getTime())) {
                        handleChange(undefined, newValue);
                      } else {
                        handleChange(undefined, null);
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        error={touched.dateOfCommission && !!errors.dateOfCommission}
                        helperText={touched.dateOfCommission && errors.dateOfCommission || ' '}
                      />
                    )}
                    maxDate={new Date()}
                    inputFormat="dd/MM/yyyy"
                    disableFuture
                  />
                </LocalizationProvider>
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
  site: PropTypes.object,
  companyId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  user: PropTypes.object
};

export default ProductionSiteForm;