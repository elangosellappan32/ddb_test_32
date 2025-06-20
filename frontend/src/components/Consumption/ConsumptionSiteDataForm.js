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
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

const ConsumptionSiteDataForm = ({ 
  type = 'unit', 
  initialData = null, 
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

  const [formData, setFormData] = useState(() => ({
    date: initialData?.date ? new Date(initialData.date) : new Date(),
    version: initialData?.version || 1,
    ...generateInitialValues(type, initialData)
  }));

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

  const handleChange = (field, value) => {
    const inputValue = value?.target?.value ?? value;
    setFormData(prev => ({
      ...prev,
      [field]: inputValue
    }));
  };

  const renderField = (field) => (
    <Grid item xs={12} sm={6} key={field.id}>
      <TextField
        fullWidth
        label={field.label}
        name={field.id}
        value={formData[field.id] || ''}
        onChange={(e) => handleChange(field.id, e.target.value)}
        type="number"
        inputProps={{ 
          step: "0.01",
          min: "0"
        }}
        disabled={!canEdit}
      />
    </Grid>
  );

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
                      }
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
                      }
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
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          {/* Change variant to prevent nesting heading elements */}
          <Typography 
            variant="subtitle1" 
            sx={{ 
              fontSize: '1.25rem',
              fontWeight: 500,
              mb: 2 
            }}
          >
            {type === 'unit' ? 'Consumption Unit Data' : 'Consumption Charge Data'}
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <DesktopDatePicker
            label="Period"
            inputFormat="MMMM yyyy"
            views={['year', 'month']}
            value={formData.date}
            onChange={handleDateChange}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                required
                helperText={formatDateForDisplay(formData.date)}
                disabled={!canEdit}
              />
            )}
          />
        </Grid>

        {getFields().map(field => renderField(field))}

        {/* Add total section */}
        {renderTotal()}

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

export default ConsumptionSiteDataForm;