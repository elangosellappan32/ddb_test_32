import React from 'react';
import PropTypes from 'prop-types';
import {
  TextField,
  Grid,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Typography
} from '@mui/material';
import {
  LocationOn,
  Business,
  Category,
  BarChart
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';

const industryTypes = [
  'industrial',
  'textile',
  'other'
];

const ConsumptionSiteForm = ({ initialData, onSubmit, onCancel, loading, readOnly }) => {
  const formik = useFormik({
    initialValues: {
      name: initialData?.name || '',
      location: initialData?.location || '',
      annualConsumption: initialData?.annualConsumption || '',
      industryType: initialData?.industryType?.toLowerCase() || 'industrial',
      type: initialData?.type?.toLowerCase() || 'industrial',
    },
    validationSchema: Yup.object({
      name: Yup.string()
        .required('Name is required')
        .min(3, 'Name must be at least 3 characters')
        .max(100, 'Name must be 100 characters or less'),      location: Yup.string()
        .required('Location is required')
        .min(2, 'Location must be at least 2 characters')
        .max(200, 'Location must be 200 characters or less'),
      annualConsumption: Yup.number()
        .required('Annual consumption is required')
        .min(0, 'Annual consumption must be a non-negative number'),
      industryType: Yup.string()
        .required('Industry type is required')
        .oneOf(['industrial', 'textile', 'other'], 'Invalid industry type'),
      type: Yup.string()
        .required('Type is required')
        .oneOf(['industrial', 'textile', 'other'], 'Invalid type'),
    }),    onSubmit: (values) => {
      onSubmit({
        ...initialData,
        ...values,
        type: values.industryType?.toLowerCase(),
        industryType: values.industryType?.toLowerCase(),
        annualConsumption: parseFloat(values.annualConsumption),
        version: initialData?.version || 1
      });
    }
  });

  return (
    <Paper elevation={3} sx={{ p: 4, backgroundColor: '#ffffff' }}>
      <Typography variant="h5" sx={{ mb: 4, color: '#1976d2', fontWeight: 'bold' }}>
        Consumption Site Details
      </Typography>
      
      <form onSubmit={formik.handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Business sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
              <TextField
                fullWidth
                id="name"
                name="name"
                label="Site Name"
                variant="standard"
                value={formik.values.name}
                onChange={formik.handleChange}
                error={formik.touched.name && Boolean(formik.errors.name)}
                helperText={formik.touched.name && formik.errors.name}
                disabled={loading || readOnly}
                required
                sx={{ '& .MuiInput-underline:before': { borderBottomColor: '#1976d2' } }}
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <LocationOn sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
              <TextField
                fullWidth
                id="location"
                name="location"
                label="Location"
                variant="standard"
                value={formik.values.location}
                onChange={formik.handleChange}
                error={formik.touched.location && Boolean(formik.errors.location)}
                helperText={formik.touched.location && formik.errors.location}
                disabled={loading || readOnly}
                required
                sx={{ '& .MuiInput-underline:before': { borderBottomColor: '#1976d2' } }}
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <BarChart sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
              <TextField
                fullWidth
                id="annualConsumption"
                name="annualConsumption"
                label="Annual Consumption (MWh)"
                type="number"
                variant="standard"
                value={formik.values.annualConsumption}
                onChange={formik.handleChange}
                error={formik.touched.annualConsumption && Boolean(formik.errors.annualConsumption)}
                helperText={formik.touched.annualConsumption && formik.errors.annualConsumption}
                disabled={loading || readOnly}
                inputProps={{ step: "0.1" }}
                required
                sx={{ '& .MuiInput-underline:before': { borderBottomColor: '#1976d2' } }}
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Category sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
              <FormControl fullWidth required variant="standard">
                <InputLabel id="industryType-label">Industry Type</InputLabel>
                <Select
                  labelId="industryType-label"
                  id="industryType"
                  name="industryType"
                  value={formik.values.industryType}
                  onChange={formik.handleChange}
                  error={formik.touched.industryType && Boolean(formik.errors.industryType)}
                  disabled={loading || readOnly}
                  sx={{ '& .MuiInput-underline:before': { borderBottomColor: '#1976d2' } }}
                >                  {industryTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: 2, 
              mt: 4 
            }}>
              <Button
                onClick={onCancel}
                disabled={loading}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  px: 4
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={loading || readOnly}
                sx={{
                  borderRadius: 2,
                  px: 4,
                  backgroundColor: '#1976d2',
                  '&:hover': {
                    backgroundColor: '#1565c0'
                  }
                }}
              >
                {initialData ? 'Update' : 'Create'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
};

ConsumptionSiteForm.propTypes = {
  initialData: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  readOnly: PropTypes.bool
};

export default ConsumptionSiteForm;
