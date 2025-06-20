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
import consumptionSiteApi from '../../services/consumptionSiteApi';
import consumptionUnitApi from '../../services/consumptionUnitApi';
import SiteInfoCard from './SiteInfoCard';
import ConsumptionDataTable from './ConsumptionDataTable';
import ConsumptionSiteDataForm from './ConsumptionSiteDataForm';
import { formatSK, formatDisplayDate } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';

const ConsumptionSiteDetails = () => {
  const { companyId, consumptionSiteId } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  
  const [siteData, setSiteData] = useState({
    site: null,
    units: [],
    isLoaded: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState({
    open: false,
    mode: 'create',
    data: null
  });

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      
      const validCompanyId = String(companyId || '1');
      const validConsumptionSiteId = String(consumptionSiteId);

      if (!validConsumptionSiteId) {
        throw new Error('Invalid site ID');
      }
      
      const [siteResponse, unitsResponse] = await Promise.all([
        consumptionSiteApi.fetchOne(validCompanyId, validConsumptionSiteId),
        consumptionUnitApi.fetchAll(validCompanyId, validConsumptionSiteId)
      ]);

      // Format site data with proper validation
      const site = {
        companyId: validCompanyId,
        consumptionSiteId: validConsumptionSiteId,
        name: siteResponse?.data?.name || 'Unnamed Site',
        type: (siteResponse?.data?.type || 'unknown').toLowerCase(),
        location: siteResponse?.data?.location || 'Location not specified',
        annualConsumption: Number(siteResponse?.data?.annualConsumption || 0),
        status: (siteResponse?.data?.status || 'inactive').toLowerCase(),
        description: siteResponse?.data?.description || '',
        version: Number(siteResponse?.data?.version || 1),
        timetolive: Number(siteResponse?.data?.timetolive || 0),
        createdat: siteResponse?.data?.createdat || new Date().toISOString(),
        updatedat: siteResponse?.data?.updatedat || new Date().toISOString()
      };

      // Format units data with proper validation
      const units = (unitsResponse?.data || []).map(unit => ({
        ...unit,
        c1: Number(unit.c1 || 0),
        c2: Number(unit.c2 || 0),
        c3: Number(unit.c3 || 0),
        c4: Number(unit.c4 || 0),
        c5: Number(unit.c5 || 0),
        total: Number(unit.total || 0),
        date: formatDisplayDate(unit.sk),
        version: Number(unit.version || 1)
      }));

      setSiteData({
        site,
        units,
        isLoaded: true
      });
    } catch (error) {
      console.error('[ConsumptionSiteDetails] Fetch error:', error);
      setError(error.message || 'Failed to load site data');
      enqueueSnackbar(error.message || 'Failed to load site data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [companyId, consumptionSiteId, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const permissions = useMemo(() => ({
    create: hasPermission(user, 'consumption-units', 'CREATE'),
    read: hasPermission(user, 'consumption-units', 'READ'),
    update: hasPermission(user, 'consumption-units', 'UPDATE'),
    delete: hasPermission(user, 'consumption-units', 'DELETE')
  }), [user]);

  const checkExistingDate = useCallback((date) => {
    const sk = formatSK(date);
    const pk = `${companyId}_${consumptionSiteId}`;

    const existingEntry = siteData.units.find(item => 
      item.sk === sk && 
      item.pk === pk
    );

    if (existingEntry) {
      return {
        exists: true,
        data: existingEntry,
        displayDate: formatDisplayDate(date)
      };
    }

    return {
      exists: false,
      displayDate: formatDisplayDate(date)
    };
  }, [companyId, consumptionSiteId, siteData.units]);

  const handleAddClick = useCallback(() => {
    if (!permissions.create) {
      enqueueSnackbar('You do not have permission to add new records', { 
        variant: 'error' 
      });
      return;
    }

    setDialog({ open: true, mode: 'create', data: null });
  }, [permissions.create, enqueueSnackbar]);

  const handleEditClick = useCallback((data) => {
    if (!permissions.update) {
      enqueueSnackbar('You do not have permission to edit records', { 
        variant: 'error' 
      });
      return;
    }

    setDialog({ open: true, mode: 'edit', data });
  }, [permissions.update, enqueueSnackbar]);

  const handleDeleteClick = useCallback(async (data) => {
    if (!permissions.delete) {
      enqueueSnackbar('You do not have permission to delete records', { 
        variant: 'error' 
      });
      return;
    }

    if (!window.confirm('Are you sure you want to delete this consumption unit?')) {
      return;
    }

    try {
      await consumptionUnitApi.delete(companyId, consumptionSiteId, data.sk);
      await fetchData();
      enqueueSnackbar('Consumption unit deleted successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  }, [permissions.delete, companyId, consumptionSiteId, enqueueSnackbar, fetchData]);

  const handleSubmit = async (formData) => {
    try {
      const sk = formatSK(formData.date);

      if (dialog.mode === 'create') {
        // Check for existing data on create
        const existingCheck = checkExistingDate(formData.date);
        
        if (existingCheck.exists) {
          const confirmUpdate = await new Promise(resolve => {
            const message = `Unit data already exists for ${existingCheck.displayDate}. Would you like to update the existing record?`;
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
            await consumptionUnitApi.update(companyId, consumptionSiteId, existingCheck.data.sk, {
              ...formData,
              version: existingCheck.data.version,
              type: 'UNIT'
            });
            enqueueSnackbar('Unit updated successfully', { variant: 'success' });
          } else {
            // User chose not to update
            enqueueSnackbar('Operation cancelled', { variant: 'info' });
            return;
          }
        } else {
          // Create new record
          await consumptionUnitApi.create(companyId, consumptionSiteId, {
            ...formData,
            sk,
            type: 'UNIT'
          });
          enqueueSnackbar('Unit created successfully', { variant: 'success' });
        }
      } else {
        // Regular update
        const updatedData = {
          ...formData,
          sk: dialog.data.sk,
          version: (dialog.data.version || 0) + 1,
          type: 'UNIT'
        };
        await consumptionUnitApi.update(companyId, consumptionSiteId, dialog.data.sk, updatedData);
        enqueueSnackbar('Unit updated successfully', { variant: 'success' });
      }

      await fetchData();
      setDialog({ open: false, mode: 'create', data: null });
    } catch (err) {
      console.error('Form submission error:', err);
      enqueueSnackbar(err.message || 'Failed to save record', { 
        variant: 'error',
        autoHideDuration: 5000
      });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/consumption')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="div" sx={{ 
          fontWeight: 'bold',
          color: '#1976d2'
        }}>
          Consumption Site Details
        </Typography>
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
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" component="div">Consumption Units</Typography>
              {permissions.create && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddClick}
                >
                  Add Unit
                </Button>
              )}
            </Box>

            {!siteData.units?.length ? (
              <Alert severity="info">
                No units data available.
                {permissions.create && ' Click the Add button to create new data.'}
              </Alert>
            ) : (
              <ConsumptionDataTable
                data={siteData.units}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                permissions={permissions}
              />
            )}
          </Paper>

          <Dialog
            open={dialog.open}
            onClose={() => setDialog({ open: false, mode: 'create', data: null })}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              {dialog.mode === 'create' ? 'Add' : 'Edit'} Consumption Unit
            </DialogTitle>
            <DialogContent>
              <ConsumptionSiteDataForm
                type="unit"
                initialData={dialog.data}
                onSubmit={handleSubmit}
                onCancel={() => setDialog({ open: false, mode: 'create', data: null })}
                companyId={companyId}
                consumptionSiteId={consumptionSiteId}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </Box>
  );
};

export default ConsumptionSiteDetails;