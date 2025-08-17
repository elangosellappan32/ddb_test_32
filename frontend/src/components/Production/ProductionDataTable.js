import React, { useMemo, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Typography,
  Box,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  ContentCopy as CopyIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { formatNumber } from '../../utils/numberFormat';
import { format } from 'date-fns';

const ProductionDataTable = ({ 
  data, 
  type, 
  onEdit, 
  onDelete, 
  onCopy,
  permissions,
  isProductionPage = false 
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [deleteDialog, setDeleteDialog] = React.useState({
    open: false,
    selectedItem: null
  });

  const tableData = useMemo(() => {
    // Handle both array and object data structures
    const dataArray = Array.isArray(data) ? data : (data?.data || []);
    
    if (!dataArray.length) {

      return [];
    }

    return dataArray.map(row => {
      // Calculate sort key for financial year sorting
      let sortKey = 0;
      try {
        if (row.date) {
          const month = parseInt(row.date.substring(0, 2), 10);
          const year = parseInt(row.date.substring(2), 10);
          // Convert to financial year month (April=1, May=2, ..., March=12)
          const financialMonth = month >= 4 ? month - 3 : month + 9;
          const financialYear = month >= 4 ? year : year - 1;
          sortKey = financialYear * 100 + financialMonth;
        }
      } catch (e) {
        console.error('[ProductionDataTable] Error calculating sort key:', e);
      }
      
      return {
        ...row,
        // Create a truly unique identifier using multiple fields
        uniqueId: `${row.sk || ''}_${row.productionSiteId || ''}_${type}_${row.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        _sortKey: sortKey
      };
    }).sort((a, b) => {
      // Sort by the pre-calculated sort key (oldest first for financial year)
      if (a._sortKey !== b._sortKey) {
        return a._sortKey - b._sortKey;
      }
      
      // If same date, sort by site ID (ascending)
      return (a.productionSiteId || 0) - (b.productionSiteId || 0);
    });
  }, [data, type]);

  const formatDisplayDate = (dateString, row) => {
    if (!dateString) return 'N/A';
    
    try {
      // First check if we have a displayDate field
      if (row && row.displayDate) {
        return row.displayDate;
      }
      
      // Handle both mmyyyy format and month/year format
      let month, year;
      
      if (dateString.includes('/')) {
        // Handle month/year format
        [month, year] = dateString.split('/');
        month = month.padStart(2, '0');
        // Convert to mmyyyy format
        dateString = `${month}${year}`;
      }

      // Parse from mmyyyy format
      month = parseInt(dateString.substring(0, 2)) - 1;
      year = parseInt(`20${dateString.substring(4)}`, 10);
      
      if (isNaN(month) || isNaN(year)) {
        console.warn('[ProductionDataTable] Invalid date values:', { month, year, dateString });
        return 'N/A';
      }

      const dateObj = new Date(year, month);
      return format(dateObj, 'MMMM yyyy');
    } catch (error) {
      console.error('[ProductionDataTable] Date formatting error:', error, { dateString });
      return 'N/A';
    }
  };

  const renderUnitColumns = () => (
    <>
      <TableCell align="right">C1</TableCell>
      <TableCell align="right">C2</TableCell>
      <TableCell align="right">C3</TableCell>
      <TableCell align="right">C4</TableCell>
      <TableCell align="right">C5</TableCell>
    </>
  );

  const renderChargeColumns = () => (
    <>
      <TableCell align="right">C001</TableCell>
      <TableCell align="right">C002</TableCell>
      <TableCell align="right">C003</TableCell>
      <TableCell align="right">C004</TableCell>
      <TableCell align="right">C005</TableCell>
      <TableCell align="right">C006</TableCell>
      <TableCell align="right">C007</TableCell>
      <TableCell align="right">C008</TableCell>
      <TableCell align="right">C009</TableCell>
      <TableCell align="right">C010</TableCell>
    </>
  );

  const renderUnitValues = (row) => (
    <>
      {['c1', 'c2', 'c3', 'c4', 'c5'].map((field) => {
        const isPeak = ['c2', 'c3'].includes(field);
        return (
          <TableCell 
            key={`${row.uniqueId}_${field}`} 
            align="right" 
            sx={{ 
              color: isPeak ? 'warning.dark' : 'success.main',
              fontWeight: 'medium',
              backgroundColor: isPeak ? 'rgba(255, 152, 0, 0.08)' : 'rgba(76, 175, 80, 0.08)',
              '&:hover': {
                backgroundColor: isPeak ? 'rgba(255, 152, 0, 0.12)' : 'rgba(76, 175, 80, 0.12)'
              }
            }}
          >
            {formatNumber(row[field] || 0)}
          </TableCell>
        );
      })}
      <TableCell 
        align="right"
        sx={{
          fontWeight: 'bold',
          color: 'primary.main',
          backgroundColor: 'rgba(25, 118, 210, 0.08)'
        }}
      >
        {formatNumber(
          ['c1', 'c2', 'c3', 'c4', 'c5'].reduce((sum, field) => sum + (row[field] || 0), 0)
        )}
      </TableCell>
    </>
  );  const renderChargeValues = (row) => (
    <>
      {[...Array(10)].map((_, i) => {
        const field = `c${(i + 1).toString().padStart(3, '0')}`;
        return (
          <TableCell 
            key={`${row.uniqueId}_${field}`} 
            align="right" 
            sx={{ 
              color: 'info.dark',
              fontWeight: 'medium',
              backgroundColor: 'rgba(0, 188, 212, 0.08)',
              '&:hover': {
                backgroundColor: 'rgba(0, 188, 212, 0.12)'
              }
            }}
          >
            {formatNumber(row[field] || 0)}
          </TableCell>
        );
      })}
      <TableCell 
        align="right"
        sx={{
          fontWeight: 'bold',
          color: 'primary.main',
          backgroundColor: 'rgba(25, 118, 210, 0.08)'
        }}
      >
        {formatNumber(
          [...Array(10)].reduce((sum, _, i) => {
            const field = `c${(i + 1).toString().padStart(3, '0')}`;
            return sum + (row[field] || 0);
          }, 0)
        )}
      </TableCell>
    </>
        );  const handleEditClick = useCallback((row) => {
    if (onEdit) {
      onEdit(row);
    }
  }, [onEdit]);

  const handleDeleteClick = useCallback((row) => {
    setDeleteDialog({
      open: true,
      selectedItem: row
    });
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (onDelete && deleteDialog.selectedItem) {
      onDelete(deleteDialog.selectedItem);
    }
    setDeleteDialog({ open: false, selectedItem: null });
  }, [onDelete, deleteDialog.selectedItem]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialog({ open: false, selectedItem: null });
  }, []);

  const formatSKPeriod = useCallback((sk) => {
    if (!sk) return 'N/A';
    try {
      const month = parseInt(sk.substring(0, 2)) - 1;
      const year = `${sk.substring(2)}`;
      const date = new Date(year, month);
      return format(date, 'MMMM yyyy');
    } catch (error) {
      console.error('Error formatting SK period:', error);
      return 'N/A';
    }
  }, []);

  const renderTableRow = (row) => (
    <TableRow 
      key={row.uniqueId}
      hover 
      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
    >
      <TableCell>
        <Typography>
          {formatDisplayDate(row.sk || row.date, row)}
          <Typography 
            variant="caption" 
            color="textSecondary" 
            component="span"
            sx={{ ml: 1 }}
          >
            {`(Site ${row.productionSiteId})`}
          </Typography>
        </Typography>
      </TableCell>
      {type === 'unit' ? renderUnitValues(row) : renderChargeValues(row)}
      <TableCell align="right">
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {permissions?.update && onEdit && (
            <Tooltip title="Edit Production Data">
              <IconButton 
                size="small" 
                onClick={() => handleEditClick(row)}
                sx={{
                  color: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'primary.lighter',
                  }
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {permissions?.delete && onDelete && (
            <Tooltip title="Delete Production Data">
              <IconButton 
                size="small" 
                onClick={() => handleDeleteClick(row)}
                sx={{
                  color: 'error.main',
                  '&:hover': {
                    backgroundColor: 'error.lighter',
                  }
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {permissions?.create && onCopy && (
            <Tooltip title="Copy to Next Month">
              <IconButton 
                size="small" 
                onClick={() => onCopy(row)}
                sx={{
                  color: 'success.main',
                  '&:hover': {
                    backgroundColor: 'success.lighter',
                  }
                }}
              >
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );

  if (!tableData.length) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', mt: 2, boxShadow: 2 }}>
        <Typography variant="subtitle1" color="textSecondary">
          No {type} data available
        </Typography>
      </Paper>
    );
  }

  return (
    <>
      <TableContainer component={Paper} sx={{ mt: 2, boxShadow: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'primary.main' }}>
              <TableCell>
                <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                  Month
                </Typography>
              </TableCell>
              {type === 'unit' ? (
                <>
                  {['C1', 'C2', 'C3', 'C4', 'C5'].map((header) => (
                    <TableCell key={`header_${header}`} align="right">
                      <Typography variant="subtitle2" sx={{ 
                        color: ['C2', 'C3'].includes(header) ? 'warning.light' : 'success.light', 
                        fontWeight: 'bold' 
                      }}>
                        {header}
                      </Typography>
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                      Total
                    </Typography>
                  </TableCell>
                </>
              ) : (
                <>
                  {[...Array(10)].map((_, i) => {
                    const header = `C${(i + 1).toString().padStart(3, '0')}`;
                    return (
                      <TableCell key={`header_${header}`} align="right">
                        <Typography variant="subtitle2" sx={{ color: 'info.light', fontWeight: 'bold' }}>
                          {header}
                        </Typography>
                      </TableCell>
                    );
                  })}
                  <TableCell align="right">
                    <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                      Total
                    </Typography>
                  </TableCell>
                </>
              )}
              <TableCell align="right">
                <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                  Actions
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tableData.map(renderTableRow)}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={deleteDialog.open} onClose={handleDeleteCancel}>
        <DialogTitle sx={{ color: 'error.main' }}>
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the production data for{' '}
            {deleteDialog.selectedItem && formatDisplayDate(deleteDialog.selectedItem.sk || deleteDialog.selectedItem.date)}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={handleDeleteCancel}
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Export the validation function to be used in the form component
export const validateProductionData = (newData, existingData) => {
  if (!existingData || !Array.isArray(existingData)) return { isValid: true };

  // Check if data exists for this SK (date) and PK (site) and same type
  const duplicateEntry = existingData.find(item => 
    item.sk === newData.sk && 
    item.pk === `${newData.companyId}_${newData.productionSiteId}` &&
    item.type === newData.type  // Add type check
  );

  if (duplicateEntry) {
    const monthYear = newData.sk.replace(/^(\d{2})(\d{4})$/, '$1/$2');
    return {
      isValid: false,
      error: `${newData.type.toLowerCase()} data already exists for period ${monthYear} in Site ${newData.productionSiteId}`
    };
  }

  return { isValid: true };
};

export default ProductionDataTable;