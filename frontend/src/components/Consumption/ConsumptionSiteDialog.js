import React from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box } from '@mui/material';
import ConsumptionSiteForm from './ConsumptionSiteForm';

const ConsumptionSiteDialog = ({ 
  open = false, 
  onClose, 
  onSubmit, 
  initialData = null, 
  loading = false,
  permissions = {},
  user
}) => {
  const isEditing = !!initialData;

  const handleFormSubmit = (formData) => {
    if (onSubmit) {
      onSubmit(formData);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        {isEditing ? 'Edit Consumption Site' : 'Add New Consumption Site'}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ pt: 1 }}>
          <ConsumptionSiteForm
            initialData={initialData}
            onSubmit={handleFormSubmit}
            onCancel={handleClose}
            loading={loading}
            permissions={permissions}
            isEditing={isEditing}
            companyId={user?.companyId}
            user={user}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
};

ConsumptionSiteDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  loading: PropTypes.bool,
  permissions: PropTypes.object,
  user: PropTypes.object
};

export default ConsumptionSiteDialog;
