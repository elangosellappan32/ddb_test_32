import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  TableSortLabel,
  TablePagination
} from '@mui/material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';

const GeneratorCaptiveDialog = ({ open, onClose, generatorCompany, shareholderCompanies }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

const fetchExistingAllocations = async (generatorId) => {
  try {
    setLoading(true);
    const response = await api.get(`/captive/generator/${generatorId}`);
    
    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || 'Failed to fetch allocations');
    }
    
    // The API returns { success: true, data: [...], count: number }
    const allocations = Array.isArray(response.data?.data) ? response.data.data : [];
    
    // Log the fetched data for debugging
    console.log('Fetched allocations:', allocations);
    
    return allocations.map(alloc => ({
      ...alloc,
      // Ensure numeric values are properly converted
      generatorCompanyId: Number(alloc.generatorCompanyId),
      shareholderCompanyId: Number(alloc.shareholderCompanyId),
      allocationPercentage: Number(alloc.allocationPercentage) || 0,
      allocationStatus: alloc.allocationStatus || 'inactive'
    }));
  } catch (err) {
    const errorMessage = err.response?.data?.message || err.message || 'Failed to load allocations';
    console.error('Error in fetchExistingAllocations:', errorMessage, err);
    enqueueSnackbar(errorMessage, { variant: 'error' });
    return [];
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    if (!open || !generatorCompany) {
      setRows([]);
      setError('');
      return;
    }

    const initializeRows = async () => {
      try {
        setLoading(true);
        const genId = generatorCompany.companyId;
        const genName = generatorCompany.companyName;
        
        // Fetch existing allocations
        const existingAllocations = await fetchExistingAllocations(genId);
        
        // Create a map of existing allocations for quick lookup
        const allocationMap = new Map(
          existingAllocations.map(alloc => [
            alloc.shareholderCompanyId, 
            {
              ...alloc,
              // Ensure allocationPercentage is a number
              allocationPercentage: Number(alloc.allocationPercentage) || 0,
              // Determine if the allocation is active
              isActive: alloc.allocationStatus === 'active'
            }
          ])
        );
        
        // Create initial rows for all shareholder companies
        const initialRows = (shareholderCompanies || []).map(sh => {
          const existingAlloc = allocationMap.get(sh.companyId);
          
          return {
            generatorCompanyId: genId,
            generatorCompanyName: genName,
            shareholderCompanyId: sh.companyId,
            shareholderCompanyName: sh.companyName,
            allocationPercentage: existingAlloc?.allocationPercentage || 0,
            // Include if there's an active allocation, or if no allocation exists (new shareholder)
            isIncluded: existingAlloc ? existingAlloc.isActive : true,
            id: existingAlloc?.id
          };
        });

        setRows(initialRows);
        setError('');
      } catch (err) {
        const msg = err?.response?.data?.message || 'Failed to load existing allocations';
        setError(msg);
        enqueueSnackbar(msg, { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };

    initializeRows();
  }, [open, generatorCompany, shareholderCompanies]);

  const handleChange = (index, field, value) => {
    setRows(prev => {
      const next = [...prev];
      if (field === 'allocationPercentage') {
        const num = Number(value);
        if (!Number.isNaN(num) && num >= 0 && num <= 100) {
          next[index] = { ...next[index], [field]: value };
        } else if (value === '') {
          next[index] = { ...next[index], [field]: '' };
        }
      } else {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };

  const handleToggleInclude = (index) => {
    setRows(prev => {
      const next = [...prev];
      const isIncluded = !next[index].isIncluded;
      next[index] = { 
        ...next[index], 
        isIncluded,
        // Reset allocation to 0 when excluding
        allocationPercentage: isIncluded ? next[index].allocationPercentage : 0
      };
      return next;
    });
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const includedRows = rows.filter(row => row.isIncluded);
  const excludedRows = rows.filter(row => !row.isIncluded);
  const displayedRows = [...includedRows, ...excludedRows];
  const paginatedRows = displayedRows.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      if (!rows.length) {
        enqueueSnackbar('No shareholder companies available for allocation', { variant: 'warning' });
        return;
      }

      // Prepare all updates including both included and excluded shareholders
      const updates = rows.map((r) => {
        const isIncluded = r.isIncluded;
        const pct = isIncluded ? Number(r.allocationPercentage || 0) : 0;
        
        if (isIncluded && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
          throw new Error(`Invalid percentage for ${r.shareholderCompanyName}. Must be between 0 and 100`);
        }
        
        return {
          generatorCompanyId: generatorCompany.companyId,
          generatorCompanyName: generatorCompany.companyName,
          shareholderCompanyId: r.shareholderCompanyId,
          shareholderCompanyName: r.shareholderCompanyName,
          allocationPercentage: pct,
          allocationStatus: isIncluded ? 'active' : 'inactive'
        };
      });
      
      // Check if at least one shareholder is included
      const includedCount = updates.filter(u => u.allocationStatus === 'active').length;
      if (includedCount === 0) {
        throw new Error('Please include at least one shareholder company');
      }

      // Send all updates in a single batch
      await api.post('/captive/update-bulk', updates);
      
      enqueueSnackbar('Captive allocations saved successfully', { variant: 'success' });
      if (onClose) {
        onClose();
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to save allocations';
      setError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!generatorCompany) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Captive Allocation for {generatorCompany.companyName} (ID: {generatorCompany.companyId})
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : !shareholderCompanies || shareholderCompanies.length === 0 ? (
          <Alert severity="info">No shareholder companies found. Please create shareholder companies first.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Include</TableCell>
                  <TableCell>Shareholder Company</TableCell>
                  <TableCell align="right">Allocation %</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedRows.map((row, idx) => {
                  const originalIndex = rows.findIndex(r => 
                    r.shareholderCompanyId === row.shareholderCompanyId
                  );
                  return (
                    <TableRow 
                      key={row.shareholderCompanyId}
                      sx={{ 
                        opacity: row.isIncluded ? 1 : 0.7,
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <TableCell>
                        <Checkbox
                          checked={row.isIncluded}
                          onChange={() => handleToggleInclude(originalIndex)}
                          color="primary"
                        />
                      </TableCell>
                      <TableCell>{row.shareholderCompanyName}</TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          value={row.allocationPercentage}
                          onChange={(e) => handleChange(originalIndex, 'allocationPercentage', e.target.value)}
                          size="small"
                          inputProps={{ 
                            min: 0, 
                            max: 100,
                            disabled: !row.isIncluded
                          }}
                          sx={{ 
                            width: 120,
                            '& .MuiInputBase-input:disabled': {
                              color: 'text.primary',
                              WebkitTextFillColor: 'text.primary',
                              opacity: row.isIncluded ? 1 : 0.7
                            }
                          }}
                          disabled={!row.isIncluded}
                        />
                      </TableCell>
                      <TableCell>
                        {row.isIncluded ? (
                          <Box component="span" sx={{ color: 'success.main' }}>Included</Box>
                        ) : (
                          <Box component="span" sx={{ color: 'text.secondary' }}>Excluded</Box>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {rows.length > 0 && (
          <Box mt={2}>
            <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
              <strong>Included</strong> shareholders will be part of the captive allocation. 
              <strong> Excluded</strong> shareholders will be removed from the allocation.
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block">
              Set allocation percentages (0-100) for included shareholders.
            </Typography>
          </Box>
        )}
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {includedRows.length} included, {excludedRows.length} excluded
          </Typography>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={saving || !shareholderCompanies || shareholderCompanies.length === 0}
            startIcon={saving ? <CircularProgress size={18} /> : null}
          >
            {saving ? 'Saving...' : 'Save Allocations'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default GeneratorCaptiveDialog;
