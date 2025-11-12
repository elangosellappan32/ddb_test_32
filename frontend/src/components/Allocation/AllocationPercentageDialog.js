import React, { useState, useEffect, useCallback } from 'react';
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
  Tooltip,
  Grid
} from '@mui/material';
import { Save as SaveIcon, Close as CloseIcon, Edit as EditIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';

const LOCAL_STORAGE_KEY = 'savedAllocationPercentages';

const AllocationPercentageDialog = ({ open, onClose, onSave, companyId }) => {
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

  // Load saved allocations from localStorage
  const loadSavedAllocations = useCallback(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Error loading saved allocations:', error);
      return {};
    }
  }, []);

  // Save allocations to localStorage
  const saveAllocationsToLocal = (allocations) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allocations));
    } catch (error) {
      console.error('Error saving allocations to localStorage:', error);
    }
  };

  const loadData = useCallback(async () => {
    try {
      setIsProcessing(true);
      setError('');

      // Load saved allocations from local storage
      const savedAllocations = loadSavedAllocations();
      
      // Fetch allocation data from the backend
      const response = await api.get(`/captive/allocations/${companyId}`);
      const allocationData = response.data.data;
      
      if (!allocationData || !allocationData.allocations) {
        throw new Error('No allocation data received from server');
      }
      
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
            // Use server value if available
            initialLocalAllocations[key] = serverAlloc.allocationPercentage;
            if (serverAlloc.isLocked) {
              lockedAllocations[key] = true;
            }
          } else if (savedAllocations[key] !== undefined) {
            // Fall back to saved local value
            initialLocalAllocations[key] = parseFloat(savedAllocations[key]) || 0;
          } else {
            // Default to 0
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
  }, [companyId, enqueueSnackbar]);

  useEffect(() => {
    if (open) {
      loadData();
    } else {
      setAllocations([]);
      setGenerators([]);
      setShareholders([]);
      setError('');
      setEditingCell(null);
      setLocalAllocations({});
    }
  }, [open, loadData]);

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
    const updatedAllocations = {
      ...localAllocations,
      [key]: newPercentage
    };
    
    // Update the allocations array to reflect the change
    const updatedAllocationsArray = allocations.map(alloc => {
      if (alloc.generatorCompanyId === generatorId && alloc.shareholderCompanyId === shareholderId) {
        return { ...alloc, allocationPercentage: newPercentage };
      }
      return alloc;
    });
    
    setAllocations(updatedAllocationsArray);
    setLocalAllocations(updatedAllocations);
    saveAllocationsToLocal(updatedAllocations);
    setEditingCell(null);
    
    enqueueSnackbar('Allocation updated', { variant: 'success' });
  };

  const handleUpdateAllocation = (generatorId, shareholderId, value) => {
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

    const updatedAllocations = {
      ...localAllocations,
      [key]: newPercentage
    };
    
    // Update local state and save to localStorage
    setLocalAllocations(updatedAllocations);
    saveAllocationsToLocal(updatedAllocations);
    
    // No need to save to backend anymore
    enqueueSnackbar('Allocation updated locally', { variant: 'info' });
    
    return true;
  };

  const handleSaveAll = async () => {
    try {
      setIsProcessing(true);
      
      // Prepare updates for the backend
      const updates = [];
      
      // Process each generator-shareholder combination
      generators.forEach(gen => {
        shareholders.forEach(sh => {
          const key = `${gen.id}-${sh.id}`;
          // Only include if not locked and value has changed
          if (!lockedAllocations[key] && localAllocations[key] !== undefined) {
            updates.push({
              generatorCompanyId: gen.id,
              shareholderCompanyId: sh.id,
              allocationPercentage: parseFloat(localAllocations[key]) || 0,
              allocationStatus: 'active'
            });
          }
        });
      });
      
      // Save to backend if there are updates
      if (updates.length > 0) {
        await api.post('/captive/update-bulk', updates);
      }
      
      // Save to local storage
      saveAllocationsToLocal(localAllocations);
      
      // Notify parent component
      if (onSave) onSave(localAllocations);
      
      // Close the dialog
      onClose();
      
      enqueueSnackbar('Allocations saved successfully', { variant: 'success' });
      
    } catch (error) {
      console.error('Error saving allocations:', error);
      enqueueSnackbar(
        error.response?.data?.message || 'Failed to save allocations', 
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
          <Box>
            <Typography variant="h6">Allocation Management</Typography>
            <Typography variant="caption" color="textSecondary">
              Changes are saved locally in your browser
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={isProcessing}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
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