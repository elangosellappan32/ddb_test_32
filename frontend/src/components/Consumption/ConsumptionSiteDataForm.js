import React, { useState, useMemo } from 'react';
import { useSnackbar } from 'notistack';
import {
  Box,
  TextField,
  Button,
  Grid,
  Typography,
  CircularProgress,
  Paper,
  Tooltip,
  IconButton
} from '@mui/material';
import { DesktopDatePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

const ConsumptionSiteDataForm = ({ 
  type = 'unit', 
  initialData = null,
  copiedData = null, 
  onSubmit, 
  onCancel,
  onEdit,
  onDelete, 
  loading = false,
  existingData = [], 
  companyId,
  consumptionSiteId
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const canEdit = useMemo(() => {
    const moduleType = type === 'unit' ? 'consumption-units' : 'consumption-charges';
    const action = initialData ? 'UPDATE' : 'CREATE';
    return hasPermission(user, moduleType, action);
  }, [user, type, initialData]);

  // Update generateSK function with better validation
  const generateSK = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      console.error('Invalid date for SK generation:', date);
      return null;
    }
  
    try {
      // Normalize date to first day of month to avoid timezone issues
      const normalizedDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
      const year = normalizedDate.getFullYear();
      
      return `${month}${year}`;
    } catch (error) {
      console.error('Error generating SK:', error);
      throw new Error('Invalid month/year format');
    }
  };

  // Format date for display as "Month YYYY"
  const formatDateForDisplay = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }
    return format(date, 'MMMM yyyy');
  };

  // Generate initial values based on type
  function generateInitialValues(type, data) {
    if (type === 'unit') {
      // For new data, initialize with empty strings for better UX
      const emptyIfNew = (value) => data ? (value ?? '0').toString() : '';
      
      return {
        // C values
        c1: emptyIfNew(data?.c1),
        c2: emptyIfNew(data?.c2),
        c3: emptyIfNew(data?.c3),
        c4: emptyIfNew(data?.c4),
        c5: emptyIfNew(data?.c5)
      };
    }
    
    // For non-unit types, keep the existing behavior
    return Array.from({ length: 10 }, (_, i) => {
      const key = `c${String(i + 1).padStart(3, '0')}`;
      return { [key]: (data?.[key] ?? '0').toString() };
    }).reduce((acc, curr) => ({ ...acc, ...curr }), {});
  }

  // Helper function to get next month's date
  const getNextMonthDate = (currentDate) => {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
  };

  const [formData, setFormData] = useState(() => {
    let initialDate;
    let version = 1;
    let values;

    if (copiedData) {
      // If we're copying data, use next month's date
      initialDate = new Date(copiedData.date);
      initialDate = getNextMonthDate(initialDate);
      values = generateInitialValues(type, copiedData);
    } else if (initialData) {
      // If we're editing existing data
      initialDate = new Date(initialData.date);
      version = initialData.version || 1;
      values = generateInitialValues(type, initialData);
    } else {
      // New data
      initialDate = new Date();
      values = generateInitialValues(type, null);
    }

    return {
      date: initialDate,
      version: version,
      ...values,
    };
  });

  const [errors, setErrors] = useState({});

  const handleDateChange = (newDate) => {
    setFormData(prev => ({
      ...prev,
      date: newDate || new Date()
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const sk = generateSK(formData.date);
      
      const submitData = {
        sk,
        pk: `${companyId}_${consumptionSiteId}`,
        companyId,
        consumptionSiteId,
        date: format(formData.date, 'yyyy-MM-dd'),
        type: type.toUpperCase(),
        version: initialData ? (initialData.version || 0) + 1 : 1
      };

      // Add all c1-c5 fields
      for (let i = 1; i <= 5; i++) {
        const key = `c${i}`;
        submitData[key] = formData[key] ? Number(formData[key]) : 0;
      }

      await onSubmit(submitData);
      enqueueSnackbar('Data saved successfully', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.message || 'Failed to save data', { 
        variant: 'error' 
      });
    }
  };

  const getFields = () => {
    if (type === 'unit') {
      return [
        { id: 'c1', label: 'C1', group: 'consumption' },
        { id: 'c2', label: 'C2', group: 'consumption' },
        { id: 'c3', label: 'C3', group: 'consumption' },
        { id: 'c4', label: 'C4', group: 'consumption' },
        { id: 'c5', label: 'C5', group: 'consumption' }
      ];
    }

    return Array.from({ length: 10 }, (_, i) => ({
      id: `c${String(i + 1).padStart(3, '0')}`,
      label: `C${String(i + 1).padStart(3, '0')}`,
      group: 'other'
    }));
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
      'consumption': {
        title: 'Consumption (kWh)',
        bgColor: '#e3f2fd',
        textColor: '#0d47a1',
        borderColor: '#90caf9'
      },
      'other': {
        title: 'Other Values',
        bgColor: '#f5f5f5',
        textColor: 'text.primary',
        borderColor: 'divider'
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

  // Handle field value changes
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

      setFormData(prev => ({
        ...prev,
        [field]: processedValue
      }));
      
      // Clear any existing error for this field
      if (errors[field]) {
        setErrors(prev => ({
          ...prev,
          [field]: undefined
        }));
      }
    }
  };

  // Render a single field with enhanced styling
  const renderField = (field) => {
    const isReadOnly = field.readOnly || !canEdit;
    const fieldValue = formData[field.id] || '';

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
              fontWeight: 'normal',
            },
          }}
          InputProps={{
            // Removed kWh unit from input adornment
          }}
          error={!!errors[field.id]}
          helperText={errors[field.id]}
          disabled={isReadOnly}
          sx={{
            '& .MuiOutlinedInput-root': {
              ...(isReadOnly && { backgroundColor: 'action.hover' }),
              '&.Mui-focused fieldset': {
                borderWidth: '1px',
              },
            },
            '& .Mui-disabled': {
              backgroundColor: 'action.hover',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'transparent',
              },
            },
            '& .MuiOutlinedInput-root:not(.Mui-disabled):hover fieldset': {
              borderColor: 'primary.main',
            },
          }}
        />
      </Grid>
    );
  };

  const renderTotal = () => {
const total = Object.keys(formData)
.filter(key => key.startsWith('c'))
.reduce((sum, key) => sum + (parseFloat(formData[key]) || 0), 0);

return (
<Grid item xs={12}>
<Box sx={{ 
display: 'flex', 
justifyContent: 'space-between', 
alignItems: 'center',
borderTop: '1px solid',
borderColor: 'divider',
pt: 2,
mt: 2
}}>
<Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
Total
</Typography>
<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
<Typography variant="h6">
{total.toFixed(2)}
</Typography>
{initialData && (
<Box sx={{ display: 'flex', gap: 1 }}>
<Tooltip title="Edit">
<IconButton
size="small"
onClick={() => onEdit(initialData)}
sx={{ 
color: 'primary.main',
'&:hover': {
backgroundColor: 'primary.lighter',
},
}}
>
<EditIcon />
</IconButton>
</Tooltip>
<Tooltip title="Delete">
<IconButton
size="small"
onClick={() => onDelete(initialData)}
sx={{ 
color: 'error.main',
'&:hover': {
backgroundColor: 'error.lighter',
},
}}
>
<DeleteIcon />
</IconButton>
</Tooltip>
</Box>
)}
</Box>
</Box>
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
{type === 'unit' ? 'Consumption Unit Data' : 'Consumption Charge Data'}
</Typography>
<Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
{initialData ? 'Update existing entry' : 'Add new consumption data'}
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

        {/* Add total section */}
        {renderTotal()}

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
              startIcon={<CancelIcon />}
              sx={{
                minWidth: 120,
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
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              sx={{
                minWidth: 140,
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

export default ConsumptionSiteDataForm;