import React, { useMemo, useCallback } from 'react';
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
  Info as InfoIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

const ConsumptionDataTable = ({ 
  data, 
  onEdit, 
  onDelete, 
  permissions,
  loading 
}) => {
  const [deleteDialog, setDeleteDialog] = React.useState({
    open: false,
    selectedItem: null
  });

  const formatNumber = (value) => {
    return Number(value || 0).toFixed(2);
  };

  const sortedData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return [...data].sort((a, b) => {
      // Sort by SK in descending order (most recent first)
      return b.sk.localeCompare(a.sk);
    });
  }, [data]);

  const calculateRowTotal = useCallback((row) => {
    const total = ['c1', 'c2', 'c3', 'c4', 'c5']
      .reduce((sum, key) => sum + Number(row[key] || 0), 0);
    return total.toFixed(2);
  }, []);

  const formatSKPeriod = useCallback((sk) => {
    if (!sk || sk.length !== 6) return 'N/A';
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

  const handleEditClick = useCallback((row) => {
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

  return (
    <>
      <TableContainer component={Paper} sx={{ mt: 2, boxShadow: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'primary.main' }}>
              <TableCell>
                <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                  Period
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Non-Peak Period">
                  <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                    C1
                    <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', verticalAlign: 'middle' }} />
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Peak Period">
                  <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                    C2
                    <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', verticalAlign: 'middle' }} />
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Peak Period">
                  <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                    C3
                    <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', verticalAlign: 'middle' }} />
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Non-Peak Period">
                  <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                    C4
                    <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', verticalAlign: 'middle' }} />
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Non-Peak Period">
                  <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                    C5
                    <InfoIcon sx={{ ml: 0.5, fontSize: '1rem', verticalAlign: 'middle' }} />
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell align="right">
                <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                  Total
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                  Actions
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedData.map((row) => (
              <TableRow 
                key={row.sk} 
                hover 
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell>
                  <Typography>{formatSKPeriod(row.sk)}</Typography>
                </TableCell>
                <TableCell align="right">{formatNumber(row.c1)}</TableCell>
                <TableCell align="right">{formatNumber(row.c2)}</TableCell>
                <TableCell align="right">{formatNumber(row.c3)}</TableCell>
                <TableCell align="right">{formatNumber(row.c4)}</TableCell>
                <TableCell align="right">{formatNumber(row.c5)}</TableCell>
                <TableCell align="right">
                  <Typography color="primary.main" fontWeight="bold">
                    {calculateRowTotal(row)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    {permissions?.update && (
                      <Tooltip title="Edit Consumption Data">
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
                    {permissions?.delete && (
                      <Tooltip title="Delete Consumption Data">
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
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={deleteDialog.open} onClose={handleDeleteCancel}>
        <DialogTitle sx={{ color: 'error.main' }}>
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the consumption data for{' '}
            {deleteDialog.selectedItem && formatSKPeriod(deleteDialog.selectedItem.sk)}?
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

export default ConsumptionDataTable;