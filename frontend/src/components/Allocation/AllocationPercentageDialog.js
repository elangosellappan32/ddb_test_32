import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  IconButton,
  Tooltip
} from '@mui/material';
import { Save as SaveIcon, Close as CloseIcon, Edit as EditIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';
import captiveApi from '../../services/captiveApi';
import {
  loadAllocationPercentages,
  saveAllocationPercentages,
  updateAllocationPercentage,
  getAllocationPercentage,
  mergeWithServerData
} from '../../utils/allocationLocalStorage';

const AllocationPercentageDialog = ({ open, onClose, onSave }) => {
  const { user, hasSiteAccess } = useAuth();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [allocations, setAllocations] = useState([]);
  const [generators, setGenerators] = useState([]);
  const [shareholders, setShareholders] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [localAllocations, setLocalAllocations] = useState({});
  const [lockedAllocations, setLockedAllocations] = useState({});
  const { enqueueSnackbar } = useSnackbar();
  const selectedCompanyId = ''; // Removed company selection

  // Fetch allocations data
  const fetchData = useCallback(async () => {
    try {
      setIsProcessing(true);
      setError('');

      // Load saved allocations from local storage
      const savedAllocations = loadAllocationPercentages();
      
      // Fetch allocation data from the backend using the captive API
      const response = await captiveApi.getAll();
      
      if (!response || !Array.isArray(response)) {
        throw new Error('Invalid response format from server');
      }
      
      // Transform the response into the expected format
      const allocationData = { allocations: response };
      
      // Process the allocations
      const allocationsMap = {};
      const generatorsMap = new Map();
      const shareholdersMap = new Map();
      
      // Process each allocation
      allocationData.allocations.forEach(alloc => {
        const key = `${alloc.generatorCompanyId}-${alloc.shareholderCompanyId}`;
        
        // Store allocation data
        allocationsMap[key] = {
          ...alloc,
          allocationPercentage: parseFloat(alloc.allocationPercentage) || 0,
          isLocked: alloc.allocationStatus === 'locked'
        };
        
        // Track unique generators
        if (!generatorsMap.has(alloc.generatorCompanyId)) {
          generatorsMap.set(alloc.generatorCompanyId, {
            id: alloc.generatorCompanyId,
            name: alloc.generatorCompanyName || `Generator ${alloc.generatorCompanyId}`
          });
        }
        
        // Track unique shareholders
        if (!shareholdersMap.has(alloc.shareholderCompanyId)) {
          shareholdersMap.set(alloc.shareholderCompanyId, {
            id: alloc.shareholderCompanyId,
            name: alloc.shareholderCompanyName || `Shareholder ${alloc.shareholderCompanyId}`
          });
        }
      });
      
      // Convert maps to arrays
      const generators = Array.from(generatorsMap.values());
      const shareholders = Array.from(shareholdersMap.values());
      
      // Initialize local allocations with saved values or server values
      const initialLocalAllocations = {};
      const lockedAllocations = {};
      
      // For each generator-shareholder combination, set the allocation percentage
      generators.forEach(gen => {
        shareholders.forEach(sh => {
          const key = `${gen.id}-${sh.id}`;
          const serverAlloc = allocationsMap[key];
          
          if (serverAlloc) {
            initialLocalAllocations[key] = serverAlloc.allocationPercentage;
            if (serverAlloc.isLocked) {
              lockedAllocations[key] = true;
            }
          } else {
            initialLocalAllocations[key] = 0;
          }
        });
      });
      
      // Create the allocations array for display
      const allocationsList = generators.flatMap(gen => 
        shareholders.map(sh => {
          const key = `${gen.id}-${sh.id}`;
          const alloc = allocationsMap[key] || {};
          
          return {
            generatorCompanyId: gen.id,
            generatorCompanyName: gen.name,
            shareholderCompanyId: sh.id,
            shareholderCompanyName: sh.name,
            allocationPercentage: initialLocalAllocations[key] || 0,
            isLocked: !!alloc.isLocked
          };
        })
      );
      
      // Update state
      setGenerators(generators);
      setShareholders(shareholders);
      setAllocations(allocationsList);
      setLocalAllocations(initialLocalAllocations);
      setLockedAllocations(lockedAllocations);
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load allocation data');
      enqueueSnackbar(error.response?.data?.message || 'Failed to load allocation data', { 
        variant: 'error' 
      });
    } finally {
      setIsProcessing(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (open) {
      fetchData();
    } else {
      setAllocations([]);
      setGenerators([]);
      setShareholders([]);
      setError('');
      setEditingCell(null);
      setLocalAllocations({});
    }
  }, [open, fetchData]);

  const handleEditClick = (generatorId, shareholderId, currentValue) => {
    const key = `${generatorId}-${shareholderId}`;
    if (lockedAllocations[key]) {
      enqueueSnackbar('This allocation is locked and cannot be modified', { variant: 'warning' });
      return;
    }
    setEditingCell(key);
    setEditValue(currentValue.toString());
  };

  const handleSaveEdit = (generatorId, shareholderId) => {
    const newPercentage = parseFloat(editValue);
    if (isNaN(newPercentage) || newPercentage < 0 || newPercentage > 100) {
      enqueueSnackbar('Please enter a valid percentage between 0 and 100', { variant: 'error' });
      return;
    }

    const key = `${generatorId}-${shareholderId}`;
    const success = updateAllocationPercentage(generatorId, shareholderId, newPercentage);
    
    if (success) {
      // Update the allocations array to reflect the change
      const updatedAllocationsArray = allocations.map(alloc => {
        if (alloc.generatorCompanyId === generatorId && alloc.shareholderCompanyId === shareholderId) {
          return { ...alloc, allocationPercentage: newPercentage };
        }
        return alloc;
      });
      
      setAllocations(updatedAllocationsArray);
      setLocalAllocations(loadAllocationPercentages()); // Reload from localStorage
      setEditingCell(null);
      
      enqueueSnackbar('Allocation updated locally', { variant: 'success' });
    } else {
      enqueueSnackbar('Failed to update allocation', { variant: 'error' });
    }
  };

  const handleUpdateAllocation = async (generatorId, shareholderId, value) => {
  const key = `${generatorId}-${shareholderId}`;
  
  // Check if the allocation is locked
  if (lockedAllocations[key]) {
    enqueueSnackbar('This allocation is locked and cannot be modified', { variant: 'warning' });
    return false;
  }

  const newPercentage = parseFloat(value);
  if (isNaN(newPercentage) || newPercentage < 0 || newPercentage > 100) {
    enqueueSnackbar('Please enter a valid percentage between 0 and 100', { variant: 'error' });
    return false;
  }

  try {
    setIsProcessing(true);
    
    // Update server first
    await captiveApi.updateAllocationPercentage(generatorId, shareholderId, newPercentage);
    
    // Update local storage
    updateAllocationPercentage(generatorId, shareholderId, newPercentage);
    
    // Update state
    setAllocations(prevAllocations => 
      prevAllocations.map(alloc => 
        alloc.generatorCompanyId === generatorId && 
        alloc.shareholderCompanyId === shareholderId
          ? { ...alloc, allocationPercentage: newPercentage }
          : alloc
      )
    );
    
    setLocalAllocations(prev => ({
      ...prev,
      [key]: newPercentage
    }));
    
    enqueueSnackbar('Allocation updated successfully', { variant: 'success' });
    return true;
  } catch (error) {
    console.error('Error updating allocation:', error);
    enqueueSnackbar(
      error.response?.data?.message || 'Failed to update allocation', 
      { variant: 'error' }
    );
    return false;
  } finally {
    setIsProcessing(false);
  }
};

  const handleSaveAll = async () => {
    try {
      setIsProcessing(true);
      
      // Save current local allocations to localStorage (already done on each change)
      const currentAllocations = loadAllocationPercentages();
      
      // Notify parent component with current local allocations
      if (onSave) onSave(currentAllocations);
      
      // Close the dialog
      onClose();
      
      enqueueSnackbar('All allocation changes saved locally', { variant: 'success' });
      
    } catch (error) {
      console.error('Error saving allocations:', error);
      enqueueSnackbar(
        'Failed to save allocations locally', 
        { variant: 'error' }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const getShareholderAllocation = (generatorId, shareholderId) => {
    const alloc = allocations.find(a => 
      a.generatorCompanyId === generatorId && 
      a.shareholderCompanyId === shareholderId
    );
    return alloc ? alloc.allocationPercentage : 0;
  };
  
  const isCellLocked = (generatorId, shareholderId) => {
    const key = `${generatorId}-${shareholderId}`;
    return !!lockedAllocations[key];
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6">Allocation Percentages</Typography>
            <Tooltip title="Refresh Data">
              <IconButton onClick={fetchData} size="small" disabled={isProcessing}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : isProcessing ? (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ maxHeight: '60vh' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Generator \ Shareholder</TableCell>
                  {shareholders.map(sh => (
                    <TableCell key={sh.id} align="center">
                      {sh.name}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {generators.map(gen => (
                  <TableRow key={gen.id}>
                    <TableCell component="th" scope="row">
                      {gen.name}
                    </TableCell>
                    {shareholders.map(sh => {
                      const cellId = `${gen.id}-${sh.id}`;
                      const allocation = getShareholderAllocation(gen.id, sh.id);
                      
                      return (
                        <TableCell key={cellId} align="center" sx={{ minWidth: 150 }}>
                          {editingCell === cellId ? (
                            <TextField
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => {
                                if (handleUpdateAllocation(gen.id, sh.id, editValue)) {
                                  setEditingCell(null);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Escape') {
                                  if (handleUpdateAllocation(gen.id, sh.id, editValue)) {
                                    setEditingCell(null);
                                  }
                                }
                              }}
                              size="small"
                              autoFocus
                              inputProps={{ 
                                min: 0, 
                                max: 100, 
                                step: 0.1,
                                style: { textAlign: 'right', width: 100 }
                              }}
                              sx={{ mr: 1 }}
                            />
                          ) : (
                            <Box display="flex" alignItems="center" justifyContent="center">
                              <Typography sx={{ mr: 1 }}>{allocation}%</Typography>
                              <Tooltip title={isCellLocked(gen.id, sh.id) ? "This allocation is locked" : "Edit allocation"}>
                                <span>
                                  <IconButton 
                                    size="small"
                                    onClick={() => handleEditClick(gen.id, sh.id, allocation)}
                                    disabled={isCellLocked(gen.id, sh.id)}
                                    sx={{
                                      opacity: isCellLocked(gen.id, sh.id) ? 0.5 : 1,
                                      cursor: isCellLocked(gen.id, sh.id) ? 'not-allowed' : 'pointer'
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Box>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="textSecondary">
            All changes are automatically saved to your browser's local storage
          </Typography>
        </Box>
        <Box>
          <Button 
            onClick={onClose} 
            disabled={isProcessing}
            variant="outlined"
            sx={{ mr: 1 }}
          >
            Close
          </Button>
          <Button
            onClick={handleSaveAll}
            variant="contained"
            color="primary"
            disabled={isProcessing}
            startIcon={isProcessing ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {isProcessing ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default AllocationPercentageDialog;