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
  CircularProgress,
  Switch,
  FormControlLabel,
  InputAdornment,
  FormHelperText,
  Typography,
  Paper,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Divider
} from '@mui/material'; 
import { useNavigate } from 'react-router-dom';
import {
  LocationOn as LocationIcon,
  Speed as CapacityIcon,
  ElectricBolt as VoltageIcon,
  Assignment as HtscIcon,
  Factory as TypeIcon,
  Assessment as AnnualProductionIcon
} from '@mui/icons-material';

const SITE_TYPES = ['Wind', 'Solar'];
const SITE_STATUS = ['Active', 'Inactive', 'Maintenance'];

const INITIAL_FORM_STATE = {
  name: '',
  location: '',
  capacity_MW: '',
  injectionVoltage_KV: '',
  htscNo: '',
  type: '',
  status: 'Active',
  banking: 0,
  annualProduction_L: ''  // Changed from annualProduction
};

const ProductionSiteForm = ({ initialData, onSubmit, onCancel, loading, site }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    if (site) {
      // Normalize type to match SITE_TYPES (capitalized first letter)
      const normalizedType = site.type 
        ? site.type.charAt(0).toUpperCase() + site.type.slice(1).toLowerCase()
        : '';
      
      // Normalize status to match SITE_STATUS (capitalized first letter)
      const normalizedStatus = site.status 
        ? site.status.charAt(0).toUpperCase() + site.status.slice(1).toLowerCase()
        : 'Active';
      
      // Ensure the normalized values exist in our allowed values
      const validType = SITE_TYPES.includes(normalizedType) ? normalizedType : '';
      const validStatus = SITE_STATUS.includes(normalizedStatus) ? normalizedStatus : 'Active';
      
      setFormData({
        name: site.name || '',
        type: validType,
        location: site.location || '',
        capacity_MW: site.capacity_MW != null ? site.capacity_MW : '',
        injectionVoltage_KV: site.injectionVoltage_KV != null ? site.injectionVoltage_KV : '',
        htscNo: site.htscNo || '',
        annualProduction_L: site.annualProduction_L != null ? site.annualProduction_L : '',
        status: validStatus,
        banking: site.banking || 0,
      });
    } else {
      setFormData({
        name: '',
        type: '',
        location: '',
        capacity_MW: '',
        injectionVoltage_KV: '',
        htscNo: '',
        annualProduction_L: '',
        status: 'Active',
        banking: 0,
      });
    }
    setTouched({});
    setErrors({});
  }, [site]);

  useEffect(() => {
    const requiredFields = ['name', 'location', 'capacity_MW', 'injectionVoltage_KV'];
    const allFieldsFilled = requiredFields.every(field => {
      const value = formData[field];
      return value !== '' && value !== null && value !== undefined && value !== 0;
    });
    const hasErrors = Object.values(errors).some(error => error && error !== '');
    setIsValid(allFieldsFilled && !hasErrors);
  }, [formData, errors]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let processedValue = value;
    if (type === 'number') {
      processedValue = value === '' ? '' : Number(value);
    } else if (type === 'checkbox') {
      processedValue = checked ? 1 : 0;
    }
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    setTouched(prev => ({ ...prev, [name]: true }));
    const fieldError = validateField(name, processedValue);
    setErrors(prev => ({ ...prev, [name]: fieldError }));
  };

  const validateField = (name, value) => {
    if (!touched[name]) return '';
    switch (name) {
      case 'name':
        if (!value) return 'Site Name is required';
        if (value.length < 3) return 'Site Name must be at least 3 characters';
        return '';
      case 'type':
        if (!value) return 'Site Type is required';
        if (!SITE_TYPES.includes(value)) return 'Invalid Site Type';
        return '';
      case 'location':
        if (!value) return 'Location is required';
        if (value.length < 2) return 'Location must be at least 2 characters';
        return '';
      case 'capacity_MW':
        if (value === '' || value === null || value === undefined) return 'Capacity is required';
        const capacityValue = Number(value);
        if (isNaN(capacityValue) || capacityValue <= 0) return 'Capacity must be greater than 0';
        return '';
      case 'injectionVoltage_KV':
        if (value === '' || value === null || value === undefined) return 'Injection Voltage is required';
        const voltageValue = Number(value);
        if (isNaN(voltageValue) || voltageValue <= 0) return 'Injection Voltage must be greater than 0';
        return '';
      case 'htscNo':
        if (!value) return 'HTSC No is required';
        if (value.length < 4) return 'HTSC No must be at least 4 characters';
        return '';
      case 'annualProduction_L':
        if (value === '' || value === null || value === undefined) return 'Annual Production is required';
        const productionValue = Number(value);
        if (isNaN(productionValue) || productionValue < 0) return 'Annual Production must be a positive number';
        return '';
      case 'status':
        if (!value) return 'Status is required';
        if (!SITE_STATUS.includes(value)) return 'Invalid Status';
        return '';
      default:
        return '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newTouched = {};
    Object.keys(formData).forEach(field => {
      newTouched[field] = true;
    });
    setTouched(newTouched);
    const newErrors = {};
    Object.keys(formData).forEach(field => {
      newErrors[field] = validateField(field, formData[field]);
    });
    setErrors(newErrors);
    const hasErrors = Object.values(newErrors).some(error => error && error !== '');
    if (!hasErrors) {
      const submitData = {
        ...formData,
        capacity_MW: formData.capacity_MW !== '' ? Number(formData.capacity_MW) : null,
        injectionVoltage_KV: formData.injectionVoltage_KV !== '' ? Number(formData.injectionVoltage_KV) : null,
        annualProduction_L: formData.annualProduction_L !== '' ? Number(formData.annualProduction_L) : 0,
        banking: formData.banking ? 1 : 0,
        htscNo: formData.htscNo || null,
        type: formData.type || null,
      };
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === undefined) {
          delete submitData[key];
        }
      });
      console.log('Submitting form data:', submitData);
      onSubmit(submitData);
    } else {
      const firstError = Object.keys(newErrors).find(field => newErrors[field]);
      if (firstError) {
        const element = document.getElementById(firstError);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus({ preventScroll: true });
        }
      }
      const firstErrorField = Object.keys(newErrors).find(field => newErrors[field]);
      if (firstErrorField) {
        // enqueueSnackbar(`Please fix the error in ${firstErrorField.replace(/_/g, ' ')}`, {
        //   variant: 'error',
        //   anchorOrigin: { vertical: 'top', horizontal: 'center' },
        // });
      }
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1); // Go back if no onCancel handler provided
    }
  };

  return (
    <Paper elevation={3} sx={{ maxWidth: 800, mx: 'auto', p: 3, mt: 3 }}>
      <Box component="form" onSubmit={handleSubmit} noValidate id="production-site-form">
        <Card>
          <CardHeader
            title={site ? 'Edit Production Site' : 'Add Production Site'}
            titleTypographyProps={{ variant: 'h5', fontWeight: 'bold' }}
            sx={{ borderBottom: '1px solid rgba(0,0,0,0.12)' }}
          />
          <CardContent>
            <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              id="name"
              name="name"
              label="Site Name"
              value={formData.name}
              onChange={handleChange}
              onBlur={(e) => {
                setTouched(prev => ({ ...prev, name: true }));
                setErrors(prev => ({
                  ...prev,
                  name: validateField('name', e.target.value)
                }));
              }}
              error={touched.name && !!errors.name}
              helperText={touched.name && errors.name}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <TypeIcon color={touched.name && errors.name ? 'error' : 'primary'} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={touched.type && !!errors.type}>
              <InputLabel>Type *</InputLabel>
              <Select
                name="type"
                value={formData.type || ''}
                onChange={handleChange}
                onBlur={() => {
                  setTouched(prev => ({ ...prev, type: true }));
                  setErrors(prev => ({
                    ...prev,
                    type: validateField('type', formData.type)
                  }));
                }}
                label="Type *"
              >
                <MenuItem value="">
                  <em>Select a type</em>
                </MenuItem>
                {SITE_TYPES.map(type => (
                  <MenuItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </MenuItem>
                ))}
              </Select>
              {touched.type && errors.type && (
                <FormHelperText error>{errors.type}</FormHelperText>
              )}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="location"
              name="location"
              label="Location *"
              value={formData.location}
              onChange={handleChange}
              onBlur={(e) => {
                setTouched(prev => ({ ...prev, location: true }));
                setErrors(prev => ({
                  ...prev,
                  location: validateField('location', e.target.value)
                }));
              }}
              error={touched.location && !!errors.location}
              helperText={touched.location && errors.location}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LocationIcon color={touched.location && errors.location ? 'error' : 'primary'} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="capacity_MW"
              name="capacity_MW"
              label="Capacity (MW) *"
              type="number"
              value={formData.capacity_MW}
              onChange={handleChange}
              onBlur={(e) => {
                setTouched(prev => ({ ...prev, capacity_MW: true }));
                setErrors(prev => ({
                  ...prev,
                  capacity_MW: validateField('capacity_MW', e.target.value)
                }));
              }}
              error={touched.capacity_MW && !!errors.capacity_MW}
              helperText={touched.capacity_MW ? (errors.capacity_MW || 'Enter capacity in MW') : ' '}
              required
              inputProps={{ min: 0, step: '0.01' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CapacityIcon color={touched.capacity_MW && errors.capacity_MW ? 'error' : 'primary'} />
                  </InputAdornment>
                ),
                endAdornment: <InputAdornment position="end">MW</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="injectionVoltage_KV"
              name="injectionVoltage_KV"
              label="Injection Voltage (KV) *"
              type="number"
              value={formData.injectionVoltage_KV}
              onChange={handleChange}
              onBlur={(e) => {
                setTouched(prev => ({ ...prev, injectionVoltage_KV: true }));
                setErrors(prev => ({
                  ...prev,
                  injectionVoltage_KV: validateField('injectionVoltage_KV', e.target.value)
                }));
              }}
              error={touched.injectionVoltage_KV && !!errors.injectionVoltage_KV}
              helperText={touched.injectionVoltage_KV ? (errors.injectionVoltage_KV || 'Enter voltage in KV') : ' '}
              required
              inputProps={{ min: 0, step: '0.1' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <VoltageIcon color={touched.injectionVoltage_KV && errors.injectionVoltage_KV ? 'error' : 'primary'} />
                  </InputAdornment>
                ),
                endAdornment: <InputAdornment position="end">KV</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="htscNo"
              name="htscNo"
              label="HTSC No"
              value={formData.htscNo}
              onChange={handleChange}
              onBlur={(e) => {
                setTouched(prev => ({ ...prev, htscNo: true }));
                setErrors(prev => ({
                  ...prev,
                  htscNo: validateField('htscNo', e.target.value)
                }));
              }}
              error={touched.htscNo && !!errors.htscNo}
              helperText={touched.htscNo ? errors.htscNo || 'HTSC number (if applicable)' : ' '}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <HtscIcon color={touched.htscNo && errors.htscNo ? 'error' : 'primary'} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={touched.status && !!errors.status}>
              <InputLabel>Status *</InputLabel>
              <Select
                name="status"
                value={formData.status}
                onChange={handleChange}
                onBlur={() => {
                  setTouched(prev => ({ ...prev, status: true }));
                  setErrors(prev => ({
                    ...prev,
                    status: validateField('status', formData.status)
                  }));
                }}
                label="Status *"
              >
                {SITE_STATUS.map(status => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
              {touched.status && errors.status && (
                <FormHelperText error>{errors.status}</FormHelperText>
              )}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={!!formData.banking}
                  onChange={handleChange}
                  name="banking"
                  color="primary"
                  disabled={formData.status === 'Inactive' || formData.status === 'Maintenance'}
                />
              }
              label={
                <Box display="flex" alignItems="center">
                  <span>Enable Banking</span>
                  {(formData.status === 'Inactive' || formData.status === 'Maintenance') && (
                    <Typography variant="caption" color="textSecondary" sx={{ ml: 1, fontStyle: 'italic' }}>
                      (Disabled for {formData.status?.toLowerCase()} status)
                    </Typography>
                  )}
                </Box>
              }
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              id="annualProduction_L"
              name="annualProduction_L"
              label="Annual Production (L)"
              type="number"
              value={formData.annualProduction_L}
              onChange={handleChange}
              onBlur={(e) => {
                setTouched(prev => ({ ...prev, annualProduction_L: true }));
                setErrors(prev => ({
                  ...prev,
                  annualProduction_L: validateField('annualProduction_L', e.target.value)
                }));
              }}
              error={touched.annualProduction_L && !!errors.annualProduction_L}
              helperText={touched.annualProduction_L ? (errors.annualProduction_L || 'Enter annual production in liters') : ' '}
              inputProps={{ min: 0, step: '0.01' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <AnnualProductionIcon color={touched.annualProduction_L && errors.annualProduction_L ? 'error' : 'primary'} />
                  </InputAdornment>
                ),
                endAdornment: <InputAdornment position="end">L</InputAdornment>,
              }}
            />
          </Grid>
            </Grid>
          </CardContent>
          <Divider />
          <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
            <Button 
              onClick={handleCancel}
              variant="outlined"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              disabled={!isValid || loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
              sx={{ minWidth: 120, ml: 2 }}
            >
              {loading ? 'Saving...' : (site?.productionSiteId ? 'Update' : 'Create')}
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