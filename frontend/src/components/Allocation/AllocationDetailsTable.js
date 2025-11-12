import React, { useState, useEffect } from 'react';
import {
    Checkbox,
    FormControlLabel,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Box,
    Typography,
    CircularProgress,
    Button,
    Paper,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Tooltip,
    Alert,
    Grid,
    Tabs,
    Tab
} from '@mui/material';
import { Edit as EditIcon, SaveOutlined } from '@mui/icons-material';
import { getAllocationPeriods, getAllocationTypeColor, ALL_PERIODS } from '../../utils/allocationUtils';

const TabPanel = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`ir-tabpanel-${index}`}
      aria-labelledby={`ir-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const AllocationDetailsTable = ({ allocations = [], bankingAllocations = [], oldBankingAllocations = [], lapseAllocations = [], oldLapseAllocations = [], loading = false, onEdit, onSave, error = null }) => {
    const [editDialog, setEditDialog] = useState(false);
    const [editingAllocation, setEditingAllocation] = useState(null);
    const [editValues, setEditValues] = useState({});
    const [validationError, setValidationError] = useState(null);
    const [tabValue, setTabValue] = useState(0);

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    // Store allocation adjustment history
    const [allocationHistory, setAllocationHistory] = useState([]);

    // Helper to update banking/lapse based on allocation history
    const updateBankingLapseFromHistory = (history) => {
        // This function will simulate the flow of units between periods, tracking fromPeriod → toPeriod
        // We'll use a queue to track banked units and match returned (lapsed) units to their original source
        const banking = [];
        const lapse = [];
        // Map: compositeKey (companyId_prodId_consId) => [{fromPeriod, toPeriod, units, timestamp}]
        const bankedUnitsMap = {};

        history.forEach(item => {
            const compositeKey = `${item.companyId}_${item.productionSiteId}_${item.consumptionSiteId}`;
            // Banking: delta > 0 (units banked from prodPeriod to consPeriod)
            if (item.delta > 0) {
                if (!bankedUnitsMap[compositeKey]) bankedUnitsMap[compositeKey] = [];
                bankedUnitsMap[compositeKey].push({
                    fromPeriod: item.prodPeriod,
                    toPeriod: item.consPeriod,
                    units: item.delta,
                    timestamp: item.timestamp
                });
                banking.push({
                    compositeKey,
                    fromPeriod: item.prodPeriod,
                    toPeriod: item.consPeriod,
                    units: item.delta,
                    timestamp: item.timestamp
                });
            }
            // Lapse: delta < 0 (units returned from consPeriod to prodPeriod)
            else if (item.delta < 0) {
                // Try to match returned units to previously banked units (FIFO)
                let unitsToReturn = -item.delta;
                if (!bankedUnitsMap[compositeKey]) bankedUnitsMap[compositeKey] = [];
                while (unitsToReturn > 0 && bankedUnitsMap[compositeKey].length > 0) {
                    const banked = bankedUnitsMap[compositeKey][0];
                    const matchUnits = Math.min(unitsToReturn, banked.units);
                    lapse.push({
                        compositeKey,
                        fromPeriod: banked.fromPeriod,
                        toPeriod: item.consPeriod, // returned to this period
                        units: matchUnits,
                        timestamp: item.timestamp
                    });
                    banked.units -= matchUnits;
                    unitsToReturn -= matchUnits;
                    if (banked.units === 0) {
                        bankedUnitsMap[compositeKey].shift();
                    }
                }
                // If there are still units to return that weren't matched, treat as direct lapse
                if (unitsToReturn > 0) {
                    lapse.push({
                        compositeKey,
                        fromPeriod: item.prodPeriod,
                        toPeriod: item.consPeriod,
                        units: unitsToReturn,
                        timestamp: item.timestamp
                    });
                }
            }
        });
        return {
            banking,
            lapse
        };
    };

    // When allocationHistory changes, update banking/lapse allocations
    useEffect(() => {
        const { banking, lapse } = updateBankingLapseFromHistory(allocationHistory);
        // Optionally, you can update state or pass these to parent via a callback
        // For now, just display in the history section
        setBankingHistory(banking);
        setLapseHistory(lapse);
    }, [allocationHistory]);

    // State to hold derived banking/lapse from history
    const [bankingHistory, setBankingHistory] = useState([]);
    const [lapseHistory, setLapseHistory] = useState([]);

    // Reset edit values when allocations change
    useEffect(() => {
        if (editingAllocation) {
            const updatedAllocation = [...allocations, ...bankingAllocations, ...lapseAllocations]
                .find(a => a.productionSiteId === editingAllocation.productionSiteId 
                    && (!a.consumptionSiteId || a.consumptionSiteId === editingAllocation.consumptionSiteId));
            
            if (updatedAllocation) {
                setEditValues(updatedAllocation.allocated || {});
            }
        }
    }, [allocations, bankingAllocations, lapseAllocations, editingAllocation]);

    const handleEdit = (allocation, type) => {
        console.log('[AllocationEdit] Starting edit for allocation:', {
            allocation,
            allocated: allocation.allocated,
            irType: allocation.irType,
            injection: allocation.injection,
            reduction: allocation.reduction
        });

        setEditingAllocation({ ...allocation, type });
        
        // Initialize form values with current allocation data
        const initialValues = {
            c1: allocation.allocated?.c1 ?? allocation.c1 ?? 0,
            c2: allocation.allocated?.c2 ?? allocation.c2 ?? 0,
            c3: allocation.allocated?.c3 ?? allocation.c3 ?? 0,
            c4: allocation.allocated?.c4 ?? allocation.c4 ?? 0,
            c5: allocation.allocated?.c5 ?? allocation.c5 ?? 0,
            charge: Boolean(allocation.allocated?.charge ?? allocation.charge ?? false),
            irType: allocation.irType || 'normal',
            injection: { ...(allocation.injection || {}) },
            reduction: { ...(allocation.reduction || {}) }
        };
        
        console.log('[AllocationEdit] Initial form values:', initialValues);
        setEditValues(initialValues);
        setValidationError(null);
        setTabValue(0); // Reset to first tab
        setEditDialog(true);
    };

    const handleEditClose = () => {
        setEditDialog(false);
        setEditingAllocation(null);
        setEditValues({});
        setValidationError(null);
    };

    const handleEditSave = () => {
        if (!editingAllocation) return;

        console.log('[AllocationEdit] Saving allocation with values:', {
            editValues,
            editingAllocation
        });

        // Round all C values to nearest integer and ensure they're numbers
        const roundedEditValues = {
            c1: Math.max(0, Math.round(Number(editValues.c1 || 0))),
            c2: Math.max(0, Math.round(Number(editValues.c2 || 0))),
            c3: Math.max(0, Math.round(Number(editValues.c3 || 0))),
            c4: Math.max(0, Math.round(Number(editValues.c4 || 0))),
            c5: Math.max(0, Math.round(Number(editValues.c5 || 0))),
            charge: Boolean(editValues.charge),
            irType: editValues.irType || 'normal',
            injection: { ...(editValues.injection || {}) },
            reduction: { ...(editValues.reduction || {}) }
        };

        // Clean up injection and reduction objects to remove undefined/zero values
        if (roundedEditValues.injection) {
            Object.keys(roundedEditValues.injection).forEach(key => {
                if (roundedEditValues.injection[key] === 0 || roundedEditValues.injection[key] === undefined) {
                    delete roundedEditValues.injection[key];
                }
            });
        }

        if (roundedEditValues.reduction) {
            Object.keys(roundedEditValues.reduction).forEach(key => {
                if (roundedEditValues.reduction[key] === 0 || roundedEditValues.reduction[key] === undefined) {
                    delete roundedEditValues.reduction[key];
                }
            });
        }

        // Validate that at least one C value has a value greater than 0
        const cValues = {
            c1: roundedEditValues.c1,
            c2: roundedEditValues.c2,
            c3: roundedEditValues.c3,
            c4: roundedEditValues.c4,
            c5: roundedEditValues.c5
        };
        
        const hasValidAllocation = Object.values(cValues).some(val => val > 0);
        if (!hasValidAllocation) {
            setValidationError('At least one period must have a value greater than 0');
            return;
        }

        if (roundedEditValues.charge) {
            // Find if there's another allocation in the same month with charge=true
            const otherChargedAllocation = allocations.find(a => 
                a.pk !== editingAllocation.pk &&
                a.sk === editingAllocation.sk &&
                (a.charge === true || a.charge === 1)
            );
            if (otherChargedAllocation) {
                setValidationError('Only one allocation per month can have charge set to true');
                return;
            }
        }

        // Calculate adjustments for banking/lapse
        const bankingAdjustments = {};
        const lapseAdjustments = {};
        const deltaData = {};

        // Calculate the delta between new and old values
        Object.keys(roundedEditValues).forEach(key => {
            const oldValue = editingAllocation.allocated?.[key] || 0;
            const newValue = roundedEditValues[key] || 0;
            const delta = newValue - oldValue;

            if (delta !== 0) {
                deltaData[key] = delta;
                
                if (delta > 0) {
                    // Positive delta goes to banking
                    bankingAdjustments[key] = delta;
                } else {
                    // Negative delta comes from lapse (absolute value since delta is negative)
                    lapseAdjustments[key] = Math.abs(delta);
                }
            }
        });

        // If we have a valid edit, call the onEdit callback
        if (onEdit) {
            // Ensure we have proper IR data structure
            const irData = {
                irType: roundedEditValues.irType || 'normal',
                injection: roundedEditValues.injection || {},
                reduction: roundedEditValues.reduction || {}
            };

            console.log('[AllocationEdit] Saving allocation with values:', {
                original: {
                    c1: editingAllocation.allocated?.c1,
                    c2: editingAllocation.allocated?.c2,
                    c3: editingAllocation.allocated?.c3,
                    c4: editingAllocation.allocated?.c4,
                    c5: editingAllocation.allocated?.c5,
                    irType: editingAllocation.irType,
                    injection: editingAllocation.injection,
                    reduction: editingAllocation.reduction
                },
                updated: {
                    ...cValues,
                    ...irData
                }
            });

            // Create the updated allocation with values at root level (for backward compatibility)
            // and also in the allocated object (for new format)
            const updatedAllocation = {
                ...editingAllocation,
                // Root level values (for backward compatibility)
                ...cValues,
                ...irData,
                allocated: {
                    ...editingAllocation.allocated,
                    ...cValues,
                    ...irData,
                    charge: roundedEditValues.charge
                },
                version: (editingAllocation.version || 0) + 1,
                updatedAt: new Date().toISOString()
            };

            console.log('[AllocationEdit] Updated allocation object:', updatedAllocation);

            // Log the updated allocation details
            const allocationDetails = {
                ...Object.fromEntries(ALL_PERIODS.map(p => [p, updatedAllocation.allocated?.[p]])),
                charge: updatedAllocation.allocated?.charge,
                irType: updatedAllocation.allocated?.irType,
                hasInjection: !!updatedAllocation.allocated?.injection,
                hasReduction: !!updatedAllocation.allocated?.reduction
            };
            
            console.log('[AllocationEdit] Allocation details:', allocationDetails);
            
            // Ensure we have the required fields for the backend
            if (!updatedAllocation.companyId && updatedAllocation.pk) {
                const [companyId] = updatedAllocation.pk.split('_');
                if (companyId) updatedAllocation.companyId = parseInt(companyId, 10);
            }
            
            if (!updatedAllocation.productionSiteId && updatedAllocation.pk) {
                const [, productionSiteId] = updatedAllocation.pk.split('_');
                if (productionSiteId) updatedAllocation.productionSiteId = productionSiteId;
            }
            
            onEdit(updatedAllocation, editingAllocation.type);
        }

        // Close the dialog
        handleEditClose();
    };

    const calculateTotal = (row) => {
        // Only sum c1-c5 values, excluding charge
        const values = row.allocated || row;
        return ['c1', 'c2', 'c3', 'c4', 'c5']
            .reduce((sum, key) => sum + Math.round(Number(values[key] || 0)), 0);
    };

    // Helper to group and sum allocations by productionSiteId and consumptionSiteId
    const getIntegratedAllocations = (data) => {
        const grouped = {};
        data.forEach(a => {
            const key = `${a.productionSiteId}_${a.consumptionSiteId}`;
            if (!grouped[key]) {
                grouped[key] = {
                    ...a,
                    allocated: { ...a.allocated }
                };
            } else {
                // Sum each period
                Object.keys(a.allocated || {}).forEach(period => {
                    grouped[key].allocated[period] = (grouped[key].allocated[period] || 0) + (a.allocated[period] || 0);
                });
            }
        });
        return Object.values(grouped);
    };

    // Helper to merge new and old data for fallback display (always show all original data, overwrite with adjusted if present)
    const mergeWithFallback = (primary, fallback, keyField = 'productionSiteId') => {
        const map = new Map();
        (fallback || []).forEach(item => map.set(item[keyField], { ...item })); // Start with original
        (primary || []).forEach(item => map.set(item[keyField], { ...item }));  // Overwrite with adjusted if present
        return Array.from(map.values());
    };

    const renderSection = (title, data, type, bgColor) => {
        let uniqueData = (type === 'allocation') ? getIntegratedAllocations(data) : data;
        // For banking/lapse, always merge new and old data for fallback display
        if (type === 'banking') {
            uniqueData = mergeWithFallback(uniqueData, oldBankingAllocations);
        }
        if (type === 'lapse') {
            uniqueData = mergeWithFallback(uniqueData, oldLapseAllocations);
        }
        
        return (
            <Paper variant="outlined" sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1, color: bgColor, fontWeight: 'bold' }}>{title}</Typography>
                    <TableContainer component={Paper}>
                        <Table size="small" sx={{ mt: 1, border: '1px solid black' }}>
                            <TableHead>
                                <TableRow sx={{ background: bgColor }}>
                                    <TableCell sx={{ color: 'white' }}>Production Site</TableCell>
                                    {type === 'allocation' && <TableCell sx={{ color: 'white' }}>Consumption Site</TableCell>}
                                    {getAllocationPeriods().map(period => (
                                        <TableCell key={period.id} align="right" sx={{ color: 'white' }}>{period.label}</TableCell>
                                    ))}
                                    {type === 'allocation' && <TableCell align="center" sx={{ color: 'white' }}>Charge</TableCell>}
                                    <TableCell align="right" sx={{ color: 'white' }}>Total</TableCell>
                                    {type === 'allocation' && <TableCell align="right" sx={{ color: 'white' }}>Actions</TableCell>}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {uniqueData.length > 0 ? uniqueData.map((allocation, idx) => (
                                    <TableRow 
                                        key={`${allocation.productionSiteId}-${allocation.consumptionSiteId || type}-${idx}`}
                                        hover
                                        sx={{
                                            '&:nth-of-type(odd)': { backgroundColor: 'action.hover' },
                                            '&:hover .MuiTableCell-body': {
                                                backgroundColor: 'action.selected',
                                            },
                                        }}
                                    >
                                        <TableCell>
                                            <Box>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Typography>{allocation.productionSite || allocation.siteName}</Typography>
                                                    {allocation.charge && (
                                                        <Tooltip title="This allocation is charged for the month">
                                                            <Box sx={{ 
                                                                width: 12, 
                                                                height: 12, 
                                                                borderRadius: '50%', 
                                                                bgcolor: 'success.main',
                                                                border: '1px solid',
                                                                borderColor: 'success.dark'
                                                            }} />
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                                <Typography variant="caption" color="textSecondary">{allocation.siteType}</Typography>
                                            </Box>
                                        </TableCell>
                                        {type === 'allocation' && (
                                            <TableCell>{allocation.consumptionSite}</TableCell>
                                        )}
                                        {getAllocationPeriods().map(period => {
                                            // Get value from either allocated object or root level
                                            const val = allocation.allocated?.[period.id] ?? allocation[period.id] ?? 0;
                                            return (
                                                <TableCell key={period.id} align="right" 
                                                    sx={{ 
                                                        color: period.isPeak ? 'warning.main' : 'inherit',
                                                        fontWeight: period.isPeak ? 'bold' : 'normal',
                                                        minWidth: 60
                                                    }}
                                                >
                                                    {Math.round(Number(val))}
                                                </TableCell>
                                            );
                                        })}
                                        {type === 'allocation' && (
                                            <TableCell align="center" sx={{ minWidth: 80 }}>
                                                <Box 
                                                    sx={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: 24,
                                                        height: 24,
                                                        borderRadius: '50%',
                                                        bgcolor: (allocation.charge || allocation.allocated?.charge) ? 'success.main' : 'error.main',
                                                        color: 'white',
                                                        fontWeight: 'bold',
                                                        fontSize: '0.75rem',
                                                        border: '1px solid',
                                                        borderColor: (allocation.charge || allocation.allocated?.charge) ? 'success.dark' : 'error.dark',
                                                        cursor: 'default',
                                                        mx: 'auto'
                                                    }}
                                                    title={(allocation.charge || allocation.allocated?.charge) ? 'This allocation is charged for the month' : 'Not charged for this month'}
                                                >
                                                    {(allocation.charge || allocation.allocated?.charge) ? '✓' : '✗'}
                                                </Box>
                                            </TableCell>
                                        )}
                                        <TableCell align="right" sx={{ fontWeight: 'bold', color: getAllocationTypeColor(type) }}>
                                            {calculateTotal(allocation)}
                                        </TableCell>
                                        {type === 'allocation' && (
                                            <TableCell align="right">
                                                <Tooltip title="Edit Allocation">
                                                    <IconButton 
                                                        size="small" 
                                                        onClick={() => handleEdit(allocation, type)}
                                                        aria-label={`Edit allocation for ${allocation.productionSite || allocation.siteName}`}
                                                        sx={{
                                                            opacity: 0,
                                                            transition: 'opacity 0.2s',
                                                            '&:hover, &:focus-visible': {
                                                                opacity: 1,
                                                                color: 'primary.main'
                                                            },
                                                            '&:focus-visible': {
                                                                outline: '2px solid',
                                                                outlineOffset: '2px',
                                                                outlineColor: 'primary.main'
                                                            }
                                                        }}
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        )}
                                    </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={type === 'allocation' ? getAllocationPeriods().length + 4 : getAllocationPeriods().length + 3} align="center">
                                        <Typography color="textSecondary">No {title.toLowerCase()} data available</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    {type === 'lapse' && onSave && (
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', px: 2, pb: 2 }}>
                            <Button 
                                variant="contained" 
                                color="primary" 
                                onClick={onSave} 
                                disabled={loading}
                                startIcon={loading ? <CircularProgress size={20} /> : <SaveOutlined />}
                                sx={{ minWidth: 180 }}
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </Box>
                    )}
                </Box>
            </Paper>
        );
    };

    const renderIRFields = () => {
        return (
            <Box sx={{ mt: 2 }}>
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    aria-label="IR configuration tabs"
                    variant="fullWidth"
                >
                    <Tab label="Allocation" />
                    <Tab label="Injection" />
                    <Tab label="Reduction" />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                    <Grid container spacing={2}>
                        {getAllocationPeriods().map(period => (
                            <Grid item xs={12} sm={6} md={4} key={`alloc-${period.id}`}>
                                <TextField
                                    fullWidth
                                    label={`Period ${period.label}`}
                                    type="number"
                                    value={editValues[period.id] || 0}
                                    onChange={(e) => {
                                        const value = Math.max(0, Math.round(Number(e.target.value) || 0));
                                        setEditValues(prev => ({
                                            ...prev,
                                            [period.id]: value
                                        }));
                                    }}
                                    InputProps={{
                                        inputProps: { min: 0, step: 1 },
                                        sx: { '& input': { textAlign: 'right' } }
                                    }}
                                    variant="outlined"
                                    size="small"
                                />
                            </Grid>
                        ))}
                    </Grid>
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <Typography variant="subtitle2" gutterBottom>
                        Enter injection values for each period (positive values only)
                    </Typography>
                    <Grid container spacing={2}>
                        {getAllocationPeriods().map(period => (
                            <Grid item xs={12} sm={6} md={4} key={`inj-${period.id}`}>
                                <TextField
                                    fullWidth
                                    label={`Injection ${period.label}`}
                                    type="number"
                                    value={editValues.injection?.[period.id] || 0}
                                    onChange={(e) => {
                                        const value = Math.max(0, Math.round(Number(e.target.value) || 0));
                                        setEditValues(prev => ({
                                            ...prev,
                                            injection: {
                                                ...(prev.injection || {}),
                                                [period.id]: value
                                            },
                                            irType: value > 0 ? 'injection' : 'normal'
                                        }));
                                    }}
                                    InputProps={{
                                        inputProps: { min: 0, step: 1 },
                                        sx: { '& input': { textAlign: 'right' } }
                                    }}
                                    variant="outlined"
                                    size="small"
                                />
                            </Grid>
                        ))}
                    </Grid>
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    <Typography variant="subtitle2" gutterBottom>
                        Enter reduction values for each period (positive values only)
                    </Typography>
                    <Grid container spacing={2}>
                        {getAllocationPeriods().map(period => (
                            <Grid item xs={12} sm={6} md={4} key={`red-${period.id}`}>
                                <TextField
                                    fullWidth
                                    label={`Reduction ${period.label}`}
                                    type="number"
                                    value={editValues.reduction?.[period.id] || 0}
                                    onChange={(e) => {
                                        const value = Math.max(0, Math.round(Number(e.target.value) || 0));
                                        setEditValues(prev => ({
                                            ...prev,
                                            reduction: {
                                                ...(prev.reduction || {}),
                                                [period.id]: value
                                            },
                                            irType: value > 0 ? 'reduction' : 'normal'
                                        }));
                                    }}
                                    InputProps={{
                                        inputProps: { min: 0, step: 1 },
                                        sx: { '& input': { textAlign: 'right' } }
                                    }}
                                    variant="outlined"
                                    size="small"
                                />
                            </Grid>
                        ))}
                    </Grid>
                </TabPanel>
            </Box>
        );
    };

    const renderEditDialog = () => (
        <Dialog 
            open={editDialog} 
            onClose={handleEditClose} 
            maxWidth="md"
            fullWidth
            aria-labelledby="edit-allocation-dialog-title"
        >
            <DialogTitle id="edit-allocation-dialog-title">
                Edit Allocation
            </DialogTitle>
            <DialogContent>
                {validationError && (
                    <Alert severity="error" sx={{ mb: 2 }}>{validationError}</Alert>
                )}
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1" gutterBottom>
                            <strong>Production:</strong> {editingAllocation?.productionSite}
                        </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1" gutterBottom>
                            <strong>Consumption:</strong> {editingAllocation?.consumptionSite}
                        </Typography>
                    </Grid>
                    
                    {renderIRFields()}
                    
                    <Grid item xs={12}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={Boolean(editValues.charge)}
                                    onChange={(e) => setEditValues(prev => ({
                                        ...prev,
                                        charge: e.target.checked
                                    }))}
                                    color="primary"
                                />
                            }
                            label="Charge for this month"
                        />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleEditClose} color="primary">
                    Cancel
                </Button>
                <Button 
                    onClick={handleEditSave} 
                    color="primary" 
                    variant="contained"
                    startIcon={<SaveOutlined />}
                >
                    Save Changes
                </Button>
            </DialogActions>
        </Dialog>
    );

    return (
        <Box>
            {renderSection('Allocations', allocations, 'allocation', '#3F51B5')}
            {renderSection('Banking', bankingAllocations, 'banking', '#4CAF50')}
            {renderSection('Lapse', lapseAllocations, 'lapse', '#FF9800')}
            {renderEditDialog()}
        </Box>
    );
};

export default AllocationDetailsTable;