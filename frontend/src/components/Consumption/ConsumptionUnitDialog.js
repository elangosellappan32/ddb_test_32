import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  Grid
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ConsumptionSiteDataForm from './ConsumptionSiteDataForm';

const ConsumptionUnitDialog = ({ 
  open, 
  onClose, 
  onSubmit,
  initialData = null,
  companyId,
  consumptionSiteId,
  type = 'unit',
  loading = false
}) => {
  // State to track form submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = (event, reason) => {
    if (reason === "backdropClick" || isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (formData) => {
    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="consumption-dialog-title"
    >
      <DialogTitle 
        id="consumption-dialog-title"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1
        }}
      >
        <Box component="span" sx={{ fontSize: '1.25rem', fontWeight: 500 }}>
          {initialData ? 'Edit' : 'Add'} {type === 'Consumption Charge'}
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          disabled={isSubmitting}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500]
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ p: 1 }}>
          <ConsumptionSiteDataForm
            type={type}
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={onClose}
            loading={isSubmitting || loading}
            companyId={companyId}
            consumptionSiteId={consumptionSiteId}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ConsumptionUnitDialog;