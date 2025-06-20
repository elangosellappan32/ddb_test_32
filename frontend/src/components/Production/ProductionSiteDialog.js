import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  CircularProgress,
  LinearProgress,
  IconButton,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import ProductionSiteForm from './ProductionSiteForm';
import { useSnackbar } from 'notistack';

const ProductionSiteDialog = ({
  open,
  onClose,
  onSubmit,
  initialData,
  loading: externalLoading,
  permissions,
  existingSites = [],
  user,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    location: '',
    capacity_MW: '',
    injectionVoltage_KV: '',
    htscNo: '',
    status: 'Active',
    banking: 0,
    annualProduction_L: '',
  });
  const [loading, setLoading] = useState(false);
  const [updatingAccess, setUpdatingAccess] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (open) {
      if (isEditing && initialData) {
        // When editing, use the initialData and ensure all fields are properly set
        const siteData = {
          name: initialData.name || '',
          type: initialData.type || '',
          location: initialData.location || '',
          capacity_MW: initialData.capacity_MW != null ? initialData.capacity_MW : '',
          injectionVoltage_KV: initialData.injectionVoltage_KV != null ? initialData.injectionVoltage_KV : '',
          htscNo: initialData.htscNo || '',
          annualProduction_L: initialData.annualProduction_L != null ? initialData.annualProduction_L : '',
          status: initialData.status || 'Active',
          banking: initialData.banking || 0,
        };
        console.log('Setting form data for edit:', siteData);
        setFormData(siteData);
      } else {
        // For new site, use default empty values
        const defaultData = {
          name: '',
          type: '',
          location: '',
          capacity_MW: '',
          injectionVoltage_KV: '',
          htscNo: '',
          status: 'Active',
          banking: 0,
          annualProduction_L: '',
        };
        console.log('Setting default form data:', defaultData);
        setFormData(defaultData);
      }
    }
  }, [open, initialData, isEditing]);

  const handleClose = (event, reason) => {
    if (loading || externalLoading || updatingAccess) return;
    if (reason !== 'backdropClick') {
      onClose();
    }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      
      // Call the parent's onSubmit which handles the actual API call
      await onSubmit(values);
      
      // No need to update site access here as it's handled in the parent component
      // Close the dialog after successful submission
      onClose();
    } catch (error) {
      console.error('Error in ProductionSiteDialog handleSubmit:', error);
      
      // Handle specific error cases
      if (error.message.includes('Version conflict')) {
        enqueueSnackbar('This site was modified by someone else. Please refresh and try again.', {
          variant: 'warning',
          autoHideDuration: 8000
        });
      } else if (error.message.includes('Company ID is required')) {
        enqueueSnackbar('Company information is missing. Please log out and log back in.', {
          variant: 'error',
          autoHideDuration: 10000
        });
      } else {
        // Generic error handling
        const errorMessage = error.response?.data?.message || error.message || 'Failed to save production site';
        enqueueSnackbar(errorMessage, {
          variant: 'error',
          autoHideDuration: 8000
        });
      }
    } finally {
      setLoading(false);
      setUpdatingAccess(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={loading || externalLoading || updatingAccess}
    >
      <DialogTitle
        component="div"
        sx={{
          borderBottom: '2px solid #1976d2',
          mb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
        }}
      >
        <Typography variant="h6" component="span">
          {isEditing ? 'Edit Production Site' : 'Add New Production Site'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {!(loading || externalLoading || updatingAccess) && (
            <IconButton
              onClick={handleClose}
              size="small"
              aria-label="close dialog"
            >
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </DialogTitle>

      {(loading || updatingAccess) && <LinearProgress />}

      <DialogContent>
        <Box sx={{ p: 2 }}>
          {loading || externalLoading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <ProductionSiteForm
              initialData={formData}
              onSubmit={handleSubmit}
              onCancel={handleClose}
              loading={loading || externalLoading || updatingAccess}
              site={initialData?.productionSiteId ? initialData : null}
              readOnly={!permissions?.update && !permissions?.create}
            />
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

ProductionSiteDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  loading: PropTypes.bool,
  permissions: PropTypes.shape({
    create: PropTypes.bool,
    update: PropTypes.bool,
    delete: PropTypes.bool
  }),

  user: PropTypes.object.isRequired,
  isEditing: PropTypes.bool
};

export default ProductionSiteDialog;