import React, { useState, useMemo } from 'react';
import { useSnackbar } from 'notistack';
import {
  Box,
  TextField,
  Button,
  Grid,
  Typography,
  CircularProgress
} from '@mui/material';
import { DesktopDatePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';
import { validateProductionData } from './ProductionDataTable';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';

const ProductionSiteDataForm = ({ 
  type = 'unit', 
  initialData = null, 
  onSubmit, 
  onCancel, 
  loading = false,
  existingData = [], 
  companyId,
  productionSiteId
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  
  // Update permission check to use correct module name
  const canEdit = useMemo(() => {
    const moduleType = type === 'unit' ? 'production-units' : 'production-charges';
    const action = initialData ? 'UPDATE' : 'CREATE';
    return hasPermission(user, moduleType, action);
  }, [user, type, initialData]);

  // Add near the top of the component
  console.log('User permissions:', {
    role: user?.role,
    type,
    canEdit,
    moduleType: type === 'unit' ? 'production-units' : 'production-charges'
  });

  // Update the generateSK function to handle dates properly
  const generateSK = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return null;
    }
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}${year}`;
  };

  // Function to parse sk (mmyyyy) into a Date object
  const parseSKToDate = (sk) => {
    if (!sk || sk.length !== 6) return null;
    const month = parseInt(sk.slice(0, 2), 10) - 1; // Convert to zero-based month
    const year = parseInt(sk.slice(2), 10);
    return new Date(year, month);
  };

  const handleDateChange = (newDate) => {
    if (!newDate || isNaN(newDate.getTime())) {
      setErrors((prev) => ({ ...prev, date: 'Please select a valid date' }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      date: newDate,
    }));
    setErrors((prev) => ({ ...prev, date: undefined }));
  };

  const formatDateForDisplay = (date) => {
    if (!date || isNaN(date.getTime())) {
      return '';
    }
    return format(date, 'MMMM yyyy'); // Display as "March 2024"
  };

  // Generate initial values based on type
  function generateInitialValues(type, data) {
    if (type === 'unit') {
      return {
        c1: (data?.c1 ?? '0').toString(),
        c2: (data?.c2 ?? '0').toString(),
        c3: (data?.c3 ?? '0').toString(),
        c4: (data?.c4 ?? '0').toString(),
        c5: (data?.c5 ?? '0').toString()
      };
    }
    
    return Array.from({ length: 10 }, (_, i) => {
      const key = `c${String(i + 1).padStart(3, '0')}`;
      return { [key]: (data?.[key] ?? '0').toString() };
    }).reduce((acc, curr) => ({ ...acc, ...curr }), {});
  }

  // Initialize form data with proper date handling
  const [formData, setFormData] = useState(() => {
    const initialDate = initialData?.sk ? parseSKToDate(initialData.sk) : new Date();
    return {
      date: initialDate,
      version: initialData?.version || 1,
      ...generateInitialValues(type, initialData),
    };
  });

  // Initialize with empty errors
  const [errors, setErrors] = useState({});

  const getFields = () => {
    if (type === 'unit') {
      return [
        { id: 'c1', label: 'C1 Value' },
        { id: 'c2', label: 'C2 Value' },
        { id: 'c3', label: 'C3 Value' },
        { id: 'c4', label: 'C4 Value' },
        { id: 'c5', label: 'C5 Value' }
      ];
    }

    return Array.from({ length: 10 }, (_, i) => ({
      id: `c${String(i + 1).padStart(3, '0')}`,
      label: `C${String(i + 1).padStart(3, '0')} Value`
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.date || isNaN(formData.date.getTime())) {
      newErrors.date = 'Valid date is required';
    }

    // Validate fields based on type
    getFields().forEach(field => {
      const value = parseFloat(formData[field.id]);
      if (isNaN(value)) {
        newErrors[field.id] = 'Must be a valid number';
      }
      if (value < 0) {
        newErrors[field.id] = 'Must be non-negative';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all fields before submission
    const newErrors = {};
    
    if (!formData.date || isNaN(formData.date.getTime())) {
      newErrors.date = 'Valid date is required';
    }

    getFields().forEach(field => {
      const value = parseFloat(formData[field.id]);
      if (isNaN(value)) {
        newErrors[field.id] = 'Must be a valid number';
      }
      if (value < 0) {
        newErrors[field.id] = 'Must be non-negative';
      }
    });

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      enqueueSnackbar('Please correct the errors before submitting', { 
        variant: 'error' 
      });
      return;
    }

    try {
      const sk = generateSK(formData.date);
      
      const submitData = {
        ...formData,
        sk,
        pk: `${companyId}_${productionSiteId}`,
        companyId,
        productionSiteId,
        date: format(formData.date, 'yyyy-MM-dd'),
        type: type.toUpperCase(),
        ...getFields().reduce((acc, field) => ({
          ...acc,
          [field.id]: parseFloat(formData[field.id]) || 0
        }), {}),
        version: parseInt(formData.version) || 1
      };

      await onSubmit(submitData);
      enqueueSnackbar('Data saved successfully', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.message || 'Failed to save data', { 
        variant: 'error' 
      });
    }
  };

  // Update handleChange to properly handle numeric inputs
  const handleChange = (field, value) => {
    const inputValue = value?.target?.value ?? value;
    
    // Allow empty string and numeric values (including decimals)
    if (inputValue === '' || /^-?\d*\.?\d*$/.test(inputValue)) {
      setFormData(prev => ({
        ...prev,
        [field]: inputValue === '' ? '0' : inputValue
      }));
      
      if (errors[field]) {
        setErrors(prev => ({
          ...prev,
          [field]: undefined
        }));
      }
    }
  };

  // Update TextField rendering
  const renderField = (field) => (
    <Grid item xs={12} sm={6} key={field.id}>
      <TextField
        fullWidth
        label={field.label}
        name={field.id}
        value={formData[field.id]}
        onChange={(e) => handleChange(field.id, e.target.value)}
        onBlur={() => {
          const value = formData[field.id];
          if (value === '' || isNaN(parseFloat(value))) {
            handleChange(field.id, '0');
          }
        }}
        type="text"
        required
        inputProps={{ 
          pattern: "^-?\\d*\\.?\\d*$"
        }}
        error={!!errors[field.id]}
        helperText={errors[field.id]}
        disabled={!canEdit}
      />
    </Grid>
  );

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h6">
            {type === 'unit' ? 'Production Unit Data' : 'Production Charge Data'}
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <DesktopDatePicker
            label="Period"
            inputFormat="MM/yyyy"
            views={['year', 'month']}
            value={formData.date}
            onChange={handleDateChange}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                required
                error={!!errors.date}
                helperText={errors.date}
                disabled={!canEdit}
              />
            )}
          />
        </Grid>

        {getFields().map(field => renderField(field))}

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              type="button"
              variant="outlined"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading || !canEdit}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {initialData ? 'Update' : 'Create'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProductionSiteDataForm;