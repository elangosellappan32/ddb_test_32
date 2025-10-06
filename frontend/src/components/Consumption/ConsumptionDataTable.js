import React, { useMemo, useCallback, useState, useEffect } from 'react';
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
  Button,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

const months = [
  { value: 0, label: 'January' },
  { value: 1, label: 'February' },
  { value: 2, label: 'March' },
  { value: 3, label: 'April' },
  { value: 4, label: 'May' },
  { value: 5, label: 'June' },
  { value: 6, label: 'July' },
  { value: 7, label: 'August' },
  { value: 8, label: 'September' },
  { value: 9, label: 'October' },
  { value: 10, label: 'November' },
  { value: 11, label: 'December' }
];

const ConsumptionDataTable = ({ 
  data, 
  onEdit, 
  onDelete,
  onAdd,
  permissions,
  loading,
  error
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [filters, setFilters] = useState({
    searchTerm: '',
    isFiltered: false
  });
  const [filteredData, setFilteredData] = useState([]);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    selectedItem: null
  });

  const formatNumber = (value) => {
    return Number(value || 0).toFixed(2);
  };

  // Filter data based on search
  useEffect(() => {
    if (!data || !Array.isArray(data)) {
      console.log('No data or invalid data format');
      setFilteredData([]);
      return;
    }

    const { searchTerm, isFiltered } = filters;
    
    // If no search term, show no data
    if (!isFiltered || !searchTerm) {
      setFilteredData([]);
      return;
    }
    
    // Parse search term (format: 'Month YYYY' or 'Mon YYYY')
    const searchMatch = searchTerm.match(/^(\w+)\s+(\d{4})$/i);
    if (!searchMatch) {
      setFilteredData([]);
      return;
    }
    
    const [, monthStr, yearStr] = searchMatch;
    const searchMonth = months.find(m => 
      m.label.toLowerCase() === monthStr.toLowerCase() || 
      m.label.toLowerCase().startsWith(monthStr.toLowerCase())
    );
    
    if (!searchMonth) {
      setFilteredData([]);
      return;
    }
    
    const year = parseInt(yearStr);
    const month = searchMonth.value;
    
    // Filter data for the selected month and year
    const filtered = data.filter(item => {
      const dateStr = item.sk || item.date;
      if (!dateStr) return false;
      
      // Parse date in MMYYYY format
      const itemMonth = parseInt(dateStr.substring(0, 2)) - 1; // 0-indexed month
      const itemYear = parseInt(dateStr.substring(2));
      
      return itemMonth === month && itemYear === year;
    });
    
    setFilteredData(filtered);
  }, [data, filters]);

  const sortedData = useMemo(() => {
    if (!Array.isArray(filteredData)) return [];
    
    return filteredData.map(row => {
      // Calculate sort key for financial year sorting
      let sortKey = 0;
      try {
        if (row.sk) {
          const month = parseInt(row.sk.substring(0, 2), 10);
          const year = parseInt(row.sk.substring(2), 10);
          // Convert to financial year month (April=1, May=2, ..., March=12)
          const financialMonth = month >= 4 ? month - 3 : month + 9;
          const financialYear = month >= 4 ? year : year - 1;
          sortKey = financialYear * 100 + financialMonth;
        }
      } catch (e) {
        console.error('[ConsumptionDataTable] Error calculating sort key:', e);
      }
      
      return {
        ...row,
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
  }, [filteredData]);

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

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
      isFiltered: name === 'searchTerm' && value.trim() !== ''
    }));
  };
  
  const clearSearch = () => {
    handleFilterChange('searchTerm', '');
  };

  const renderHeader = () => (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: { xs: 'column', sm: 'row' },
      justifyContent: 'space-between', 
      alignItems: { xs: 'stretch', sm: 'center' },
      p: 2,
      backgroundColor: 'white',
      borderBottom: '2px solid #000000',
      gap: 2
    }}>
      <Typography variant="h6" component="div" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
        Consumption Data
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', width: { xs: '100%', sm: 'auto' } }}>
        <TextField
          size="small"
          placeholder="Search (e.g., Jan 2023)"
          value={filters.searchTerm}
          onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: filters.searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={clearSearch}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
            sx: { minWidth: 250 }
          }}
        />
        {onAdd && (
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={onAdd}
            startIcon={<AddIcon />}
            disabled={loading}
          >
            Add Consumption
          </Button>
        )}
      </Box>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error.message || 'Error loading consumption data'}
      </Alert>
    );
  }

  if (!sortedData.length) {
    return (
      <Box sx={{ p: 0 }}>
        {renderHeader()}
        <Alert severity="info" sx={{ mt: 2, mx: 2, mb: 2 }}>
          {filters.isFiltered
            ? 'No consumption data found matching your search.'
            : 'No consumption data available. Use the search to find specific months or add a new record.'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {renderHeader()}
      <TableContainer component={Paper} sx={{ mt: 0, boxShadow: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'primary.main' }}>
              <TableCell>
                <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                  Month
                </Typography>
              </TableCell>
              {['C1', 'C2', 'C3', 'C4', 'C5'].map((header) => (
                <TableCell key={header} align="right">
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
                {['c1', 'c2', 'c3', 'c4', 'c5'].map((field) => {
                  const isPeak = ['c2', 'c3'].includes(field);
                  return (
                    <TableCell 
                      key={field}
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
                      {formatNumber(row[field])}
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
                  {calculateRowTotal(row)}
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
            Are you sure you want to delete this consumption record?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConsumptionDataTable;