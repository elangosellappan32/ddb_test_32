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
import { validateProductionData, validateProductionFields } from '../../utils/productionValidation';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';

const ProductionSiteDataForm = ({ 
  type = 'unit', 
  initialData = null, 
  copiedData = null, // New prop for copied data
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

  // Helper function to get next month's date
  const getNextMonthDate = (currentDate) => {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
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
      // For new data, initialize with empty strings for better UX
      const emptyIfNew = (value) => data ? (value ?? '0').toString() : '';
      
      return {
        // Import C values
        import_c1: emptyIfNew(data?.import_c1),
        import_c2: emptyIfNew(data?.import_c2),
        import_c3: emptyIfNew(data?.import_c3),
        import_c4: emptyIfNew(data?.import_c4),
        import_c5: emptyIfNew(data?.import_c5),
        
        // Export C values
        export_c1: emptyIfNew(data?.export_c1),
        export_c2: emptyIfNew(data?.export_c2),
        export_c3: emptyIfNew(data?.export_c3),
        export_c4: emptyIfNew(data?.export_c4),
        export_c5: emptyIfNew(data?.export_c5),
        
        // Net Export C values (calculated, not directly editable)
        net_export_c1: '0',
        net_export_c2: '0',
        net_export_c3: '0',
        net_export_c4: '0',
        net_export_c5: '0',
        
        // Backward compatibility with old data
        ...(data?.c1 && { c1: emptyIfNew(data.c1) }),
        ...(data?.c2 && { c2: emptyIfNew(data.c2) }),
        ...(data?.c3 && { c3: emptyIfNew(data.c3) }),
        ...(data?.c4 && { c4: emptyIfNew(data.c4) }),
        ...(data?.c5 && { c5: emptyIfNew(data.c5) }),
        ...(data?.import && { import: emptyIfNew(data.import) })
      };
    }
    
    // For non-unit types, keep the existing behavior
    return Array.from({ length: 11 }, (_, i) => {
      const key = `c${String(i + 1).padStart(3, '0')}`;
      return { [key]: (data?.[key] ?? '0').toString() };
    }).reduce((acc, curr) => ({ ...acc, ...curr }), {});
  }

  // Initialize form data with default values or existing data
  const [formData, setFormData] = useState(() => {
    // Calculate previous month
    const prevMonthDate = new Date();
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    
    if (initialData) {
      return {
        ...initialData,
        date: initialData.date ? new Date(initialData.date) : new Date()
      };
    }
    
    // For new entries or copied data, use the previous month
    const defaultData = {
      date: prevMonthDate,
      ...generateInitialValues(type, copiedData || null),
      version: 1
    };
    
    if (copiedData) {
      return {
        ...copiedData,
        ...defaultData,
        sk: ''
      };
    }
    
    return defaultData;
  });

  // Initialize with empty errors
  const [errors, setErrors] = useState({});

  const getFields = () => {
    if (type === 'unit') {
      return [
        // Import C values
        { id: 'import_c1', label: 'Import C1', group: 'import' },
        { id: 'import_c2', label: 'Import C2', group: 'import' },
        { id: 'import_c3', label: 'Import C3', group: 'import' },
        { id: 'import_c4', label: 'Import C4', group: 'import' },
        { id: 'import_c5', label: 'Import C5', group: 'import' },
        
        // Export C values
        { id: 'export_c1', label: 'Export C1', group: 'export' },
        { id: 'export_c2', label: 'Export C2', group: 'export' },
        { id: 'export_c3', label: 'Export C3', group: 'export' },
        { id: 'export_c4', label: 'Export C4', group: 'export' },
        { id: 'export_c5', label: 'Export C5', group: 'export' },
        
        // Net Export C values (readonly)
        { id: 'net_export_c1', label: 'Net Export C1', group: 'net_export', readOnly: true },
        { id: 'net_export_c2', label: 'Net Export C2', group: 'net_export', readOnly: true },
        { id: 'net_export_c3', label: 'Net Export C3', group: 'net_export', readOnly: true },
        { id: 'net_export_c4', label: 'Net Export C4', group: 'net_export', readOnly: true },
        { id: 'net_export_c5', label: 'Net Export C5', group: 'net_export', readOnly: true }
      ];
    }

    // For non-unit types, keep the existing behavior
    return Array.from({ length: 11 }, (_, i) => ({
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

      // Recalculate and clamp net export values to be non-negative before submit
      const netExportUpdates = {};
      ['c1','c2','c3','c4','c5'].forEach((c) => {
        const importVal = parseFloat(formData[`import_${c}`] || '0');
        const exportVal = parseFloat(formData[`export_${c}`] || '0');
        const net = Math.max(0, exportVal - importVal);
        netExportUpdates[`net_export_${c}`] = net;
      });

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
        ...netExportUpdates, // ensure net export values are non-negative
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

  // Update handleChange to properly handle numeric inputs and calculate net values
  const handleChange = (field, value) => {
    const inputValue = value?.target?.value ?? value;
    
    // Allow empty string and numeric values (including decimals)
    if (inputValue === '' || /^-?\d*\.?\d*$/.test(inputValue)) {
      // Convert the input value to a number and handle zero properly
      let processedValue;
      if (inputValue === '') {
        processedValue = '';
      } else if (parseFloat(inputValue) === 0) {
        processedValue = '0';
      } else {
        // Remove leading zeros and convert to string
        processedValue = String(parseFloat(inputValue));
      }

      // Update the form data with the new value
      const newFormData = {
        ...formData,
        [field]: processedValue
      };

      // If this is an import or export field, calculate the net export
      if (field.startsWith('import_') || field.startsWith('export_')) {
        const cNum = field.split('_').pop(); // Get the C number (c1, c2, etc.)
        const importValue = parseFloat(newFormData[`import_${cNum}`] || '0');
        const exportValue = parseFloat(newFormData[`export_${cNum}`] || '0');
        const netExport = exportValue - importValue;
        const clampedNetExport = Math.max(0, netExport); // enforce non-negative
        
        newFormData[`net_export_${cNum}`] = clampedNetExport.toString();
      }

      setFormData(newFormData);
      
      // Clear any existing error for this field
      if (errors[field]) {
        setErrors(prev => ({
          ...prev,
          [field]: undefined
        }));
      }
    }
  };

  // Group fields by their group property
  const groupFields = (fields) => {
    const groups = {};
    fields.forEach(field => {
      const group = field.group || 'other';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(field);
    });
    return groups;
  };

  // Render a group of fields with a styled header
  const renderFieldGroup = (groupName, fields) => {
    const groupConfigs = {
      'import': {
        title: 'Import',
        bgColor: '#e3f2fd',
        textColor: '#0d47a1',
        borderColor: '#90caf9'
      },
      'export': {
        title: 'Export',
        bgColor: '#e8f5e9',
        textColor: '#1b5e20',
        borderColor: '#a5d6a7'
      },
      'net_export': {
        title: 'Net Export',
        bgColor: '#e3f2ff',
        textColor: '#0d47a1',
        borderColor: '#90caf9'
      }
    };

    const config = groupConfigs[groupName] || {
      title: groupName,
      bgColor: '#f5f5f5',
      textColor: 'text.primary',
      borderColor: 'divider'
    };

    return (
      <React.Fragment key={groupName}>
        <Grid item xs={12}>
          <Box 
            sx={{
              backgroundColor: config.bgColor,
              color: config.textColor,
              p: 1.5,
              borderRadius: 1,
              borderLeft: `4px solid ${config.borderColor}`,
              display: 'flex',
              alignItems: 'center',
              mb: 2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <Typography 
              variant="subtitle1" 
              sx={{ 
                fontWeight: 600,
                fontSize: '1rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {config.title}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} container spacing={2} sx={{ mb: 3 }}>
          {fields.map(renderField)}
        </Grid>
      </React.Fragment>
    );
  };

  // Render a single field with enhanced styling
  const renderField = (field) => {
    const isNetExport = field.id.startsWith('net_export_');
    const fieldValue = formData[field.id] || '';
    const isNegative = isNetExport && parseFloat(fieldValue) < 0;
    const isReadOnly = field.readOnly || !canEdit;

    // Get field group for styling
    const group = field.group || 'other';
    const isImport = group === 'import';
    const isExport = group === 'export';

    // Determine field styling based on group and state
    const getFieldStyles = () => {
      const baseStyles = {
        '& .MuiOutlinedInput-root': {
          backgroundColor: 'background.paper',
          '&.Mui-focused fieldset': {
            borderWidth: '1px',
          },
        },
        '& .MuiInputBase-input': {
          fontWeight: isNetExport ? '600' : 'normal',
        },
        '& .MuiInputLabel-root': {
          color: 'text.secondary',
          '&.Mui-focused': {
            color: 'primary.main',
          },
        },
      };

      if (isNetExport) {
        return {
          ...baseStyles,
          '& .MuiOutlinedInput-root': {
            ...baseStyles['& .MuiOutlinedInput-root'],
            backgroundColor: isNegative ? 'rgba(211, 47, 47, 0.08)' : 'rgba(46, 125, 50, 0.08)',
            '& fieldset': {
              borderColor: isNegative ? 'rgba(211, 47, 47, 0.5)' : 'rgba(46, 125, 50, 0.5)',
            },
            '&:hover fieldset': {
              borderColor: isNegative ? '#d32f2f' : '#2e7d32',
            },
          },
          '& .MuiInputBase-input': {
            ...baseStyles['& .MuiInputBase-input'],
            color: isNegative ? '#d32f2f' : '#2e7d32',
          },
          '& .MuiInputLabel-root': {
            ...baseStyles['& .MuiInputLabel-root'],
            color: isNegative ? '#d32f2f' : '#2e7d32',
          },
        };
      }

      if (isImport) {
        return {
          ...baseStyles,
          '& .MuiOutlinedInput-root': {
            ...baseStyles['& .MuiOutlinedInput-root'],
            '&:hover fieldset': {
              borderColor: '#1976d2',
            },
          },
        };
      }

      if (isExport) {
        return {
          ...baseStyles,
          '& .MuiOutlinedInput-root': {
            ...baseStyles['& .MuiOutlinedInput-root'],
            '&:hover fieldset': {
              borderColor: '#2e7d32',
            },
          },
        };
      }

      return baseStyles;
    };

    return (
      <Grid item xs={12} sm={6} md={4} lg={2.4} key={field.id}>
        <TextField
          fullWidth
          size="small"
          variant="outlined"
          label={field.label}
          name={field.id}
          value={fieldValue}
          onChange={(e) => handleChange(field.id, e.target.value)}
          onBlur={(e) => {
            const value = e.target.value;
            if (value === '' || isNaN(parseFloat(value))) {
              handleChange(field.id, '0');
            }
          }}
          type={isReadOnly ? 'text' : 'number'}
          required={!field.readOnly}
          inputProps={{
            readOnly: isReadOnly,
            step: '0.01',
            min: field.readOnly ? undefined : '0',
            style: {
              textAlign: 'right',
              fontWeight: isNetExport ? '600' : 'normal',
            },
          }}
          InputProps={{
            // Removed kWh unit from input adornment
          }}
          error={!!errors[field.id]}
          helperText={errors[field.id]}
          disabled={isReadOnly}
          sx={{
            ...getFieldStyles(),
            '& .MuiOutlinedInput-root': {
              ...(isReadOnly && { backgroundColor: 'action.hover' }),
            },
            '& .Mui-disabled': {
              backgroundColor: 'action.hover',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'transparent',
              },
            },
          }}
        />
      </Grid>
    );
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {/* Form Header */}
      <Box 
        sx={{
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
          p: 2,
          mb: 3,
          borderRadius: 1,
          boxShadow: 2,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {type === 'unit' ? 'Production Unit Data' : 'Production Charge Data'}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
          {initialData ? 'Update existing entry' : 'Add new production data'}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Date Picker */}

        <Grid item xs={12} md={4}>
          <DesktopDatePicker
            label="Period"
            inputFormat="MM/yyyy"
            views={['year', 'month']}
            value={formData.date}
            onChange={handleDateChange}
            readOnly={!canEdit || !!initialData}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                size="small"
                required
                error={!!errors.date}
                helperText={errors.date}
                InputProps={{
                  ...params.InputProps,
                  readOnly: !canEdit || !!initialData,
                  sx: {
                    '& input': {
                      cursor: (!canEdit || !!initialData) ? 'not-allowed' : 'text',
                    },
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: (!canEdit || !!initialData) ? 'action.hover' : 'background.paper',
                    '& fieldset': {
                      borderColor: 'divider',
                    },
                    '&:hover fieldset': {
                      borderColor: 'primary.main',
                    },
                  },
                }}
              />
            )}
          />
        </Grid>

        {Object.entries(groupFields(getFields())).map(([group, fields]) => 
          renderFieldGroup(group, fields)
        )}

        <Grid item xs={12}>
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: 2,
              pt: 2,
              mt: 2,
              borderTop: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Button
              type="button"
              variant="outlined"
              onClick={onCancel}
              disabled={loading}
              sx={{
                minWidth: 100,
                textTransform: 'none',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'rgba(25, 118, 210, 0.04)',
                },
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading || !canEdit}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
              sx={{
                minWidth: 120,
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                },
                '&.Mui-disabled': {
                  backgroundColor: 'action.disabledBackground',
                  color: 'action.disabled',
                },
              }}
            >
              {initialData ? 'Update Data' : 'Create Entry'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProductionSiteDataForm;