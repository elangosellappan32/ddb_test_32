import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Button, 
  Paper, 
  Typography, 
  CircularProgress, 
  Dialog, 
  DialogTitle, 
  DialogContent,
  Alert,
  IconButton
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Add as AddIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import productionSiteApi from '../../services/productionSiteApi';
import productionUnitApi from '../../services/productionUnitApi';
import productionChargeApi from '../../services/productionChargeApi';
import SiteInfoCard from './SiteInfoCard';
import ProductionChargeTable from './ProductionChargeTable';
import UnitTable from './UnitTable';
import ProductionSiteDataForm from './ProductionSiteDataForm';
import { formatSK, formatDisplayDate } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';

const ProductionSiteDetails = () => {
  const { companyId, productionSiteId } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  
  // State declarations
  const [siteData, setSiteData] = useState({ site: null, units: [], charges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState({
    open: false,
    type: null,
    mode: 'create',
    data: null,
    isCopy: false
  });

  // Define fetchData first
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      
      const [siteResponse, unitsResponse, chargesResponse] = await Promise.all([
        productionSiteApi.fetchOne(companyId, productionSiteId),
        productionUnitApi.fetchAll(companyId, productionSiteId),
        productionChargeApi.fetchAll(companyId, productionSiteId)
      ]);

      const site = siteResponse?.data;
      const units = unitsResponse?.data || [];
      const charges = chargesResponse?.data || [];

      setSiteData({
        site,
        units,
        charges
      });
    } catch (error) {
      console.error('[ProductionSiteDetails] Fetch error:', error);
      setError(error.message);
      enqueueSnackbar(error.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [companyId, productionSiteId, enqueueSnackbar]);

  // Define permissions using the updated hasPermission function
  const permissions = useMemo(() => ({
    units: {
      create: hasPermission(user, 'production-units', 'CREATE'),
      read: hasPermission(user, 'production-units', 'READ'),
      update: hasPermission(user, 'production-units', 'UPDATE'),
      delete: hasPermission(user, 'production-units', 'DELETE')
    },
    charges: {
      create: hasPermission(user, 'production-charges', 'CREATE'),
      read: hasPermission(user, 'production-charges', 'READ'),
      update: hasPermission(user, 'production-charges', 'UPDATE'),
      delete: hasPermission(user, 'production-charges', 'DELETE')
    }
  }), [user]);

  // Handlers that depend on fetchData
  const handleAddClick = useCallback((type) => {
    const canCreate = type === 'unit' ? 
      permissions.units.create : 
      permissions.charges.create;

    if (!canCreate) {
      enqueueSnackbar('You do not have permission to add new records', { 
        variant: 'error' 
      });
      return;
    }

    setDialog({ open: true, type, mode: 'create', data: null });
  }, [permissions, enqueueSnackbar]);

  const handleEditClick = useCallback((type, data) => {
    const canUpdate = type === 'unit' ? 
      permissions.units.update : 
      permissions.charges.update;

    if (!canUpdate) {
      enqueueSnackbar('You do not have permission to edit records', { 
        variant: 'error' 
      });
      return;
    }

    setDialog({ open: true, type, mode: 'edit', data });
  }, [permissions, enqueueSnackbar]);

  const handleCopyClick = useCallback((type, data) => {
    const canCreate = type === 'unit' ? 
      permissions.units.create : 
      permissions.charges.create;

    if (!canCreate) {
      enqueueSnackbar('You do not have permission to create new records', { 
        variant: 'error' 
      });
      return;
    }

    setDialog({ open: true, type, mode: 'create', data, isCopy: true });
  }, [permissions, enqueueSnackbar]);

  const handleDeleteClick = useCallback(async (type, data) => {
    const canDelete = type === 'unit' ? 
      permissions.units.delete : 
      permissions.charges.delete;

    if (!canDelete) {
      enqueueSnackbar('You do not have permission to delete records', { 
        variant: 'error' 
      });
      return;
    }

    if (!window.confirm('Are you sure you want to delete this record?')) {
      return;
    }

    try {
      const api = type === 'unit' ? productionUnitApi : productionChargeApi;
      await api.delete(companyId, productionSiteId, data.sk);
      await fetchData();
      enqueueSnackbar('Record deleted successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  }, [permissions, companyId, productionSiteId, enqueueSnackbar, fetchData]);

  // Effects
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Render unit table
  const renderUnitTable = useCallback(() => {
    return (
      <Paper sx={{ p: 0, mb: 4, overflow: 'hidden' }}>
        <UnitTable
          data={siteData.units}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onCopy={handleCopyClick}
          onAdd={permissions.units.create ? () => handleAddClick('unit') : null}
          permissions={permissions.units}
          loading={loading}
          error={error}
        />
      </Paper>
    );
  }, [siteData.units, loading, error, permissions.units, handleAddClick, handleEditClick, handleDeleteClick, handleCopyClick]);

  // Render charge table
  const renderChargeTable = useCallback(() => {
    return (
      <Paper sx={{ p: 0, overflow: 'hidden' }}>
        <ProductionChargeTable
          data={siteData.charges}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onCopy={handleCopyClick}
          onAdd={permissions.charges.create ? () => handleAddClick('charge') : null}
          permissions={permissions.charges}
          loading={loading}
          error={error}
        />
      </Paper>
    );
  }, [siteData.charges, loading, error, permissions.charges, handleAddClick, handleEditClick, handleDeleteClick, handleCopyClick]);

  // Move useMemo before any conditional returns
  const existingDates = useMemo(() => {
    const dates = new Map();
    
    // Add safety checks for arrays
    if (Array.isArray(siteData.units)) {
      siteData.units.forEach(item => {
        if (item && item.sk) {
          dates.set(item.sk, {
            type: 'unit',
            data: item
          });
        }
      });
    }
    
    if (Array.isArray(siteData.charges)) {
      siteData.charges.forEach(item => {
        if (item && item.sk) {
          dates.set(item.sk, {
            type: 'charge',
            data: item
          });
        }
      });
    }
    
    return dates;
  }, [siteData.units, siteData.charges]);

  // Update the checkExistingDate function to check by type
  const checkExistingDate = useCallback((date, selectedType) => {
    const sk = formatSK(date);
    const pk = `${companyId}_${productionSiteId}`;

    // Check only in the selected type's data array
    const dataToCheck = selectedType === 'unit' ? siteData.units : siteData.charges;

    const existingEntry = dataToCheck.find(item => 
      item.sk === sk && 
      item.pk === pk
    );

    if (existingEntry) {
      return {
        exists: true,
        type: selectedType,
        data: existingEntry,
        displayDate: formatDisplayDate(date)
      };
    }

    return {
      exists: false,
      displayDate: formatDisplayDate(date)
    };
  }, [companyId, productionSiteId, siteData.units, siteData.charges]);

  // Now we can have conditional returns
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  // Update the handleSubmit function
  const handleSubmit = async (formData) => {
    try {
      const selectedType = dialog.type; // 'unit' or 'charge'
      const api = selectedType === 'unit' ? productionUnitApi : productionChargeApi;
      
      // For create, check if date exists only for the same type
      if (dialog.mode === 'create') {
        const existingCheck = checkExistingDate(formData.date, selectedType);
        
        if (existingCheck.exists) {
          const displayDate = formatDisplayDate(formData.date);
          const typeDisplay = selectedType.charAt(0).toUpperCase() + selectedType.slice(1);
          const confirmUpdate = await new Promise(resolve => {
            const message = `${typeDisplay} data already exists for ${displayDate}. Would you like to update the existing record?`;
            resolve(window.confirm(message));
          });

          if (confirmUpdate) {
            // Switch to update mode
            setDialog(prev => ({
              ...prev,
              mode: 'edit',
              data: existingCheck.data
            }));
            
            // Update existing record
            await api.update(companyId, productionSiteId, existingCheck.data.sk, {
              ...formData,
              version: existingCheck.data.version,
              type: selectedType.toUpperCase()
            });
            enqueueSnackbar('Record updated successfully', { variant: 'success' });
          } else {
            // User chose not to update
            enqueueSnackbar('Operation cancelled', { variant: 'info' });
            return;
          }
        } else {
          // Create new record
          await api.create(companyId, productionSiteId, {
            ...formData,
            type: selectedType.toUpperCase()
          });
          enqueueSnackbar('Record created successfully', { variant: 'success' });
        }
      } else {
        // Regular update
        await api.update(companyId, productionSiteId, dialog.data.sk, {
          ...formData,
          version: dialog.data.version,
          type: selectedType.toUpperCase()
        });
        enqueueSnackbar('Record updated successfully', { variant: 'success' });
      }

      await fetchData();
      setDialog({ open: false, type: null, mode: 'create', data: null });
    } catch (err) {
      console.error('Form submission error:', err);
      enqueueSnackbar(err.message || 'Failed to save record', { 
        variant: 'error',
        autoHideDuration: 5000 
      });
    }
  };

  const handleDelete = async (data, type) => {
    if (!window.confirm('Are you sure you want to delete this record?')) {
      return;
    }

    try {
      const api = type === 'unit' ? productionUnitApi : productionChargeApi;
      await api.delete(companyId, productionSiteId, data.sk);
      await fetchData();
      enqueueSnackbar('Record deleted successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton 
          onClick={() => navigate('/production')}
          sx={{ mr: 2 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" color="primary">Production Site Details</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <SiteInfoCard site={siteData.site} />
          {renderUnitTable()}
          {renderChargeTable()}

          <Dialog
            open={dialog.open}
            onClose={() => setDialog({ open: false, type: null, mode: 'create', data: null })}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              {dialog.mode === 'create' ? 'Add' : 'Edit'} {dialog.type === 'unit' ? 'Unit' : 'Charge'} Data
            </DialogTitle>
            <DialogContent>
              <ProductionSiteDataForm
                type={dialog.type}
                initialData={dialog.mode === 'edit' ? dialog.data : null}
                copiedData={dialog.mode === 'create' && dialog.data ? dialog.data : null}
                onSubmit={handleSubmit}
                onCancel={() => setDialog({ open: false, type: null, mode: 'create', data: null })}
                companyId={companyId}
                productionSiteId={productionSiteId}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </Box>
  );
};

export default ProductionSiteDetails;