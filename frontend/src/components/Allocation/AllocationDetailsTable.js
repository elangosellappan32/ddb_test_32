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
    Grid
} from '@mui/material';
import { Edit as EditIcon, SaveOutlined } from '@mui/icons-material';
import { getAllocationPeriods, getAllocationTypeColor } from '../../utils/allocationUtils';

const AllocationDetailsTable = ({ 
    allocations = [], 
    bankingAllocations = [], 
    lapseAllocations = [], 
    loading = false, 
    onEdit, 
    onSave, 
    error = null,
    productionSites = [],
    consumptionSites = [],
    consumptionSitePriorityMap = {}
}) => {
    const [editDialog, setEditDialog] = useState(false);
    const [editingAllocation, setEditingAllocation] = useState(null);
    const [editValues, setEditValues] = useState({});
    const [validationError, setValidationError] = useState(null);

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

    const handleEdit = (row, type) => {
        // Convert charge to boolean if it's a number
        const charge = row.charge !== undefined ? 
            (typeof row.charge === 'number' ? row.charge === 1 : Boolean(row.charge)) : 
            false;
            
        setEditingAllocation({ 
            ...row, 
            type,
            charge
        });
        
        setEditValues({
            c1: row.allocated?.c1 || row.c1 || 0,
            c2: row.allocated?.c2 || row.c2 || 0,
            c3: row.allocated?.c3 || row.c3 || 0,
            c4: row.allocated?.c4 || row.c4 || 0,
            c5: row.allocated?.c5 || row.c5 || 0,
            charge: charge
        });
        setValidationError(null);
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

        // Round all C values to nearest integer and ensure they're numbers
        const roundedEditValues = {
            c1: Math.max(0, Math.round(Number(editValues.c1 || 0))),
            c2: Math.max(0, Math.round(Number(editValues.c2 || 0))),
            c3: Math.max(0, Math.round(Number(editValues.c3 || 0))),
            c4: Math.max(0, Math.round(Number(editValues.c4 || 0))),
            c5: Math.max(0, Math.round(Number(editValues.c5 || 0))),
            charge: Boolean(editValues.charge)
        };

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
            // Create the updated allocation with values at root level (for backward compatibility)
            // and also in the allocated object (for new format)
            const updatedAllocation = {
                ...editingAllocation,
                // Root level values (for backward compatibility)
                c1: roundedEditValues.c1,
                c2: roundedEditValues.c2,
                c3: roundedEditValues.c3,
                c4: roundedEditValues.c4,
                c5: roundedEditValues.c5,
                charge: roundedEditValues.charge ? 1 : 0,  // Send as number (1/0) for backend
                
                // New format with allocated object
                allocated: {
                    ...(editingAllocation.allocated || {}),
                    c1: roundedEditValues.c1,
                    c2: roundedEditValues.c2,
                    c3: roundedEditValues.c3,
                    c4: roundedEditValues.c4,
                    c5: roundedEditValues.c5,
                    charge: roundedEditValues.charge ? 1 : 0
                },
                
                // Metadata
                version: (editingAllocation.version || 0) + 1,
                updatedAt: new Date().toISOString(),
                
                // Include adjustments if any
                ...(Object.keys(bankingAdjustments).length > 0 && { bankingAdjustments }),
                ...(Object.keys(lapseAdjustments).length > 0 && { lapseAdjustments }),
                ...(Object.keys(deltaData).length > 0 && { deltaData })
            };
            
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
        if (!row) {
            console.warn('[calculateTotal] Row is null or undefined');
            return 0;
        }
        
        const values = row.allocated || row;
        if (!values) {
            console.warn('[calculateTotal] No values found in row:', row);
            return 0;
        }
        
        const total = ['c1', 'c2', 'c3', 'c4', 'c5']
            .reduce((sum, key) => {
                const val = Number(values[key] || 0);
                if (isNaN(val)) {
                    console.warn(`[calculateTotal] NaN found for key ${key}:`, values[key]);
                    return sum;
                }
                return sum + Math.round(val);
            }, 0);
        
        if (isNaN(total)) {
            console.warn('[calculateTotal] Total is NaN for row:', row);
            return 0;
        }
        
        return total;
    };

    // Sort allocations by production site commission date (newest first) and consumption site priority
    const sortAllocationsByOrder = (data) => {
        if (!Array.isArray(data) || data.length === 0) return data;

        return [...data].sort((a, b) => {
            // First, sort by production site commission date (descending - newest first)
            const aProdSite = productionSites.find(ps => String(ps.productionSiteId) === String(a.productionSiteId));
            const bProdSite = productionSites.find(ps => String(ps.productionSiteId) === String(b.productionSiteId));
            
            const aCommissionDate = new Date(aProdSite?.dateOfCommission || aProdSite?.commissionDate || new Date(0));
            const bCommissionDate = new Date(bProdSite?.dateOfCommission || bProdSite?.commissionDate || new Date(0));
            
            const dateCompare = bCommissionDate.getTime() - aCommissionDate.getTime();
            if (dateCompare !== 0) return dateCompare;
            
            // If same production site, sort by consumption site priority (ascending)
            const aConsId = String(a.consumptionSiteId || a.id || '');
            const bConsId = String(b.consumptionSiteId || b.id || '');
            
            const aPriority = consumptionSitePriorityMap[aConsId] || Number.MAX_VALUE;
            const bPriority = consumptionSitePriorityMap[bConsId] || Number.MAX_VALUE;
            
            if (aPriority !== Number.MAX_VALUE || bPriority !== Number.MAX_VALUE) {
                return aPriority - bPriority;
            }
            
            // Fallback: sort by consumption site name
            const aConsName = a.consumptionSite || '';
            const bConsName = b.consumptionSite || '';
            return aConsName.localeCompare(bConsName);
        });
    };

    // Helper to group and sum allocations by productionSiteId and consumptionSiteId
    const getIntegratedAllocations = (data) => {
        const grouped = {};
        data.forEach(a => {
            const key = `${a.productionSiteId}_${a.consumptionSiteId || ''}`;
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

    // Helper to merge new and old data for fallback display
    // No longer needed - using only current allocations

    const renderSection = (title, data, type, bgColor) => {
        console.log(`[AllocationDetailsTable] Rendering ${type} section with ${data.length} items`, data);
        
        let uniqueData = [];
        
        // Process data based on type
        if (type === 'allocation') {
            uniqueData = getIntegratedAllocations(data);
        } else if (type === 'banking') {
            // Use banking data directly without fallback
            uniqueData = data || [];
        } else if (type === 'lapse') {
            // Use lapse data directly without fallback
            uniqueData = data || [];
        }
        
        // Sort allocations by production site commission date and consumption site priority
        uniqueData = sortAllocationsByOrder(uniqueData);
        
        console.log(`[AllocationDetailsTable] Final ${type} data to display:`, uniqueData);
        
        return (
            <Paper variant="outlined" sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1, color: bgColor, fontWeight: 'bold' }}>
                        {title} ({uniqueData.length} records)
                    </Typography>
                    {uniqueData.length === 0 && (
                        <Alert severity="info">No {title.toLowerCase()} data available</Alert>
                    )}
                    {uniqueData.length > 0 && (
                    <TableContainer component={Paper}>
                        <Table size="small" sx={{ mt: 1, border: '1px solid black' }}>
                            <TableHead>
                                <TableRow sx={{ background: bgColor }}>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Production Site</TableCell>
                                    {type === 'allocation' && (
                                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Consumption Site</TableCell>
                                    )}
                                    {getAllocationPeriods().map(period => (
                                        <TableCell key={period.id} align="right" sx={{ color: 'white', fontWeight: 'bold' }}>
                                            {period.label}
                                        </TableCell>
                                    ))}
                                    {type === 'allocation' && (
                                        <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Charge</TableCell>
                                    )}
                                    <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Total</TableCell>
                                    {type === 'allocation' && (
                                        <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
                                    )}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {uniqueData.map((allocation, index) => {
                                    // Create a unique key using productionSiteId, consumptionSiteId, and a timestamp
                                    const rowKey = `row-${allocation.productionSiteId}-${allocation.consumptionSiteId || type}-${allocation.updatedAt || Date.now()}`;
                                    
                                    return (
                                        <TableRow 
                                            key={rowKey}
                                            hover
                                            sx={{
                                                '&:nth-of-type(odd)': { backgroundColor: 'action.hover' },
                                                '&:hover': {
                                                    backgroundColor: 'action.selected',
                                                },
                                            }}
                                        >
                                            <TableCell>
                                                <Box>
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                            {allocation.productionSite || allocation.siteName || `Site ${allocation.productionSiteId}`}
                                                        </Typography>
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
                                                    {allocation.siteType && (
                                                        <Typography variant="caption" color="textSecondary">{allocation.siteType}</Typography>
                                                    )}
                                                </Box>
                                            </TableCell>
                                            {type === 'allocation' && (
                                                <TableCell>
                                                    <Typography variant="body2">
                                                        {allocation.consumptionSite || `Site ${allocation.consumptionSiteId}`}
                                                    </Typography>
                                                </TableCell>
                                            )}
                                            {getAllocationPeriods().map(period => {
                                                // Get value from either allocated object or root level
                                                const val = allocation.allocated?.[period.id] ?? allocation[period.id] ?? 0;
                                                const cellKey = `${rowKey}-${period.id}`;
                                                
                                                return (
                                                    <TableCell 
                                                        key={cellKey} 
                                                        align="right" 
                                                        sx={{ 
                                                            color: period.isPeak ? 'warning.main' : 'inherit',
                                                            fontWeight: period.isPeak ? 'bold' : 'normal',
                                                            minWidth: 60
                                                        }}
                                                    >
                                                        {val}
                                                    </TableCell>
                                                );
                                            })}
                                            {type === 'allocation' && (
                                                <TableCell align="center">
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
                                                <TableCell align="center">
                                                    <Tooltip title="Edit Allocation">
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => handleEdit(allocation, type)}
                                                            aria-label={`Edit allocation for ${allocation.productionSite || allocation.siteName}`}
                                                            sx={{
                                                                opacity: 0.5,
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
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    )}
                </Box>
            </Paper>
        );
    };

    // Show allocation modification history and derived banking/lapse
    const hasData = allocations.length > 0 || bankingAllocations.length > 0 || lapseAllocations.length > 0;
    
    return (
        <Box>
            {renderSection('Allocations', allocations, 'allocation', '#3F51B5')}
            {renderSection('Banking', bankingAllocations, 'banking', '#4CAF50')}
            {renderSection('Lapse', lapseAllocations, 'lapse', '#FF9800')}
            
            {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            )}
            
            {onSave && hasData && (
                <Box sx={{ 
                    mt: 3, 
                    p: 2,
                    backgroundColor: '#f5f5f5',
                    borderRadius: 2,
                    display: 'flex', 
                    justifyContent: 'flex-end', 
                    gap: 2,
                    border: '1px solid #ddd'
                }}>
                    <Button 
                        variant="contained" 
                        color="success"
                        size="large"
                        onClick={onSave} 
                        disabled={loading || !hasData}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveOutlined />}
                        sx={{
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            padding: '10px 24px',
                            '&:hover': {
                                backgroundColor: '#388e3c'
                            }
                        }}
                    >
                        {loading ? 'Saving Allocations...' : 'Save All Allocations'}
                    </Button>
                </Box>
            )}

            <Dialog 
                open={editDialog} 
                onClose={handleEditClose} 
                maxWidth="sm" 
                fullWidth
                aria-labelledby="edit-allocation-dialog-title"
                aria-describedby="edit-allocation-dialog-description"
                PaperProps={{
                    sx: { 
                        borderRadius: 2,
                        '&:focus': {
                            outline: 'none'
                        }
                    }
                }}
            >
                <DialogTitle 
                    id="edit-allocation-dialog-title"
                    sx={{ 
                        backgroundColor: getAllocationTypeColor(editingAllocation?.type),
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        '&:focus': {
                            boxShadow: '0 0 0 2px #3f51b5',
                            outline: 'none'
                        }
                    }}
                >
                    <EditIcon aria-hidden="true" /> 
                    Edit {editingAllocation?.type || 'Allocation'}
                </DialogTitle>
                <DialogContent id="edit-allocation-dialog-description">
                    <Box sx={{ pt: 2 }}>
                        {validationError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {validationError}
                            </Alert>
                        )}
                        <Grid container spacing={2}>
                            {getAllocationPeriods().map(period => (
                                <Grid item xs={12} sm={6} key={period.id}>
                                    <TextField
                                        fullWidth
                                        label={`Period ${period.label}`}
                                        type="number"
                                        value={editValues[period.id] || 0}
                                        onChange={(e) => {
                                            setValidationError(null);
                                            setEditValues(prev => ({
                                                ...prev,
                                                [period.id]: Number(e.target.value) || 0
                                            }));
                                        }}
                                        InputProps={{
                                            sx: { 
                                                '& input': { textAlign: 'right' },
                                                ...(period.isPeak && {
                                                    '& input': {
                                                        fontWeight: 'bold',
                                                        color: 'warning.main'
                                                    }
                                                })
                                            }
                                        }}
                                    />
                                </Grid>
                            ))}
                            <Grid item xs={12}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={Boolean(editValues.charge)}
                                            onChange={(e) => setEditValues({ ...editValues, charge: e.target.checked })}
                                            disabled={!editValues.charge && allocations.some(a => 
                                                a.pk !== editingAllocation?.pk && 
                                                a.sk === editingAllocation?.sk && 
                                                (a.charge === true || a.charge === 1)
                                            )}
                                            color="primary"
                                        />
                                    }
                                    label="Charge for this month"
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="subtitle1">
                                        Total: <strong>{['c1', 'c2', 'c3', 'c4', 'c5'].reduce((sum, key) => {
                                            const val = Number(editValues[key] || 0);
                                            if (isNaN(val)) return sum;
                                            return sum + Math.round(val);
                                        }, 0)}</strong>
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button onClick={handleEditClose} variant="outlined">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleEditSave} 
                        variant="contained" 
                        color="primary"
                        startIcon={<SaveOutlined />}
                        disabled={!!validationError}
                    >
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AllocationDetailsTable;