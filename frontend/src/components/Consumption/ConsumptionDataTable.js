import React, { useMemo, useCallback, useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

// Get financial year range for a given year (April 1 to March 31)
const getFinancialYearRange = (year) => {
  const startDate = new Date(year, 3, 1); // April 1st of the selected year
  const endDate = new Date(year + 1, 2, 31); // March 31st of the next year
  return { startDate, endDate };
};

const ConsumptionDataTable = ({ 
  data, 
  onEdit, 
  onDelete,
  onCopy, 
  onAdd,
  permissions,
  loading 
}) => {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [filteredData, setFilteredData] = useState([]);
  const [deleteDialog, setDeleteDialog] = React.useState({
    open: false,
    selectedItem: null
  });

  const formatNumber = (value) => {
    return Number(value || 0).toFixed(2);
  };

  // Filter data based on selected financial year
  useEffect(() => {
    if (!data || !Array.isArray(data)) {
      console.log('No data or invalid data format');
      setFilteredData([]);
      return;
    }

    console.log('Raw consumption data:', data);
    const { startDate, endDate } = getFinancialYearRange(selectedYear);
    console.log(`Filtering consumption for FY ${selectedYear}-${selectedYear + 1} (${startDate.toISOString()} to ${endDate.toISOString()})`);
    
    const filtered = data.filter(item => {
      // Use sk field if available, otherwise use date field
      const dateStr = item.sk || item.date;
      if (!dateStr) return false;
      
      // Parse date in MMYYYY format
      const month = parseInt(dateStr.substring(0, 2)) - 1; // 0-indexed month
      const year = parseInt(dateStr.substring(2));
      const itemDate = new Date(year, month, 1); // First day of the month
      
      const isInRange = itemDate >= startDate && itemDate <= endDate;
      console.log(`Consumption date: ${dateStr} (${itemDate.toISOString()}) - In range: ${isInRange}`);
      return isInRange;
    });

    console.log('Filtered consumption data count:', filtered.length);
    setFilteredData(filtered);
  }, [data, selectedYear]);

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

  const handleYearChange = (event) => {
    setSelectedYear(Number(event.target.value));
  };

  const renderHeader = () => (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      p: 2,
      backgroundColor: 'white',
      borderBottom: '2px solid #000000',
      gap: 2
    }}>
      <Typography variant="h6" component="div" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
        Consumption Data
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Financial Year</InputLabel>
          <Select
            value={selectedYear}
            onChange={handleYearChange}
            label="Financial Year"
          >
            {years.map((year) => (
              <MenuItem key={year} value={year}>
                {`FY ${year}-${(year + 1).toString().slice(-2)}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {onAdd && (
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={onAdd}
            startIcon={<AddIcon />}
            disabled={loading}
          >
            Add Unit
          </Button>
        )}
      </Box>
    </Box>
  );

  if (!sortedData.length) {
    return (
      <Box sx={{ p: 0 }}>
        {renderHeader()}
        <Alert severity="info" sx={{ mt: 2, mx: 2, mb: 2 }}>
          {data && data.length > 0 
            ? `No consumption data available for financial year ${selectedYear}-${(selectedYear + 1).toString().slice(-2)}`
            : 'No consumption data available. Add your first consumption record.'}
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