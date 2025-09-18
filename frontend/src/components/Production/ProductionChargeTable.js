import React, { useMemo, useState, useEffect } from 'react';
import { useSnackbar } from 'notistack';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
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
  CircularProgress,
  Alert,
  TextField,
  InputAdornment
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  ContentCopy as ContentCopyIcon,
  Info as InfoIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { Button } from '@mui/material';
import { formatNumber } from '../../utils/numberFormat';
import { formatDisplayDate } from '../../utils/dateUtils';

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

const ChargeTable = ({ 
  data, 
  onEdit, 
  onDelete, 
  onCopy,
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

  // Handle filter changes
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
      isFiltered: name === 'searchTerm' && value.trim() !== ''
    }));
  };

  // Clear search
  const clearSearch = () => {
    handleFilterChange('searchTerm', '');
  };

  // Filter data based on search
  useEffect(() => {
    if (!data || !Array.isArray(data)) {
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
    
    console.log(`Searching for charge data: ${searchMonth.label} ${year}`);
    
    // Filter data for the selected month and year
    const filtered = data.filter(item => {
      const dateStr = item.sk || item.date;
      if (!dateStr) return false;
      
      try {
        // Parse date in MMYYYY format
        const itemMonth = parseInt(dateStr.substring(0, 2)) - 1; // 0-indexed month
        const itemYear = parseInt(dateStr.substring(2));
        
        return itemMonth === month && itemYear === year;
      } catch (error) {
        console.error('Error parsing date:', dateStr, error);
        return false;
      }
    });
    
    console.log(`Found ${filtered.length} matching charge records`);
    setFilteredData(filtered);
  }, [data, filters]);

  const tableData = useMemo(() => {
    if (!filteredData.length) return [];

    return filteredData.map(row => ({
      ...row,
      uniqueId: `${row.sk || ''}_${row.productionSiteId || ''}_charge_${row.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }));
  }, [filteredData]);

  const handleEdit = (e, row) => {
    e.stopPropagation();
    if (permissions.update) {
      onEdit('charge', row);
    } else {
      enqueueSnackbar('You do not have permission to edit charges', { variant: 'error' });
    }
  };

  const handleDelete = (e, row) => {
    e.stopPropagation();
    if (permissions.delete) {
      onDelete('charge', row);
    } else {
      enqueueSnackbar('You do not have permission to delete charges', { variant: 'error' });
    }
  };

  const handleCopy = (e, row) => {
    e.stopPropagation();
    if (permissions.create) {
      onCopy('charge', row);
    } else {
      enqueueSnackbar('You do not have permission to copy charges', { variant: 'error' });
    }
  };

  const renderHeader = () => (
    <Box sx={{ 
      backgroundColor: 'background.paper',
      borderRadius: 1,
      p: 2,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      mb: 3
    }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', md: 'center' },
        gap: 2,
        mb: 2
      }}>
        <Typography variant="h6" component="h2" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
          Production Charges
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, width: { xs: '100%', md: 'auto' } }}>
          {/* Search Box */}
          <Box sx={{ minWidth: 250, flexGrow: 1 }}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Search (e.g., March 2025)"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: filters.searchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={clearSearch}
                      edge="end"
                      sx={{ mr: -1 }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && filters.searchTerm) {
                  e.preventDefault();
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'background.paper',
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'action.active',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                    borderWidth: '1px',
                  },
                },
                '& .MuiOutlinedInput-input': {
                  pr: 1
                }
              }}
              disabled={loading}
            />
          </Box>

          {/* Add Charge Button */}
          {onAdd && permissions?.create && (
            <Button
              variant="contained"
              color="primary"
              onClick={onAdd}
              startIcon={<AddIcon />}
              size="small"
              sx={{ 
                whiteSpace: 'nowrap',
                minWidth: '120px',
                flexShrink: 0
              }}
              disabled={loading}
            >
              Add Charge
            </Button>
          )}
        </Box>
      </Box>
      <Box 
        sx={{
          height: '1.5px',
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          width: '100%',
          margin: '8px 0 16px 0',
          border: 'none',
        }}
      />
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
        {error.message || 'Error loading charge data'}
      </Alert>
    );
  }

  if (!filteredData.length) {
    return (
      <Box>
        {renderHeader()}
        <Alert severity="info" sx={{ mt: 2, mx: 2, mb: 2 }}>
          {filters.isFiltered
            ? 'No charge data found matching your search.'
            : 'No charge data available. Use the search to find specific months or add a new record.'}
        </Alert>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          p: 4,
          textAlign: 'center',
          minHeight: '200px',
          backgroundColor: 'background.paper',
          borderRadius: 1,
          boxShadow: 1
        }}>
          {filters.isFiltered ? (
            <>
              <InfoIcon color="action" sx={{ fontSize: 48, mb: 2, color: 'text.secondary' }} />
              <Typography variant="h6" color="text.primary" gutterBottom>
                No Charges Found for {filters.searchTerm}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: '500px' }}>
                We couldn't find any charge data for the selected month. 
                Would you like to add charges for this period?
              </Typography>
              {onAdd && permissions?.create && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={onAdd}
                  startIcon={<AddIcon />}
                  size="medium"
                >
                  Add Charges for {filters.searchTerm}
                </Button>
              )}
            </>
          ) : (
            <>
              <InfoIcon color="action" sx={{ fontSize: 48, mb: 2, color: 'text.secondary' }} />
              <Typography variant="h6" color="text.primary" gutterBottom>
                {data && data.length > 0 
                  ? 'Search for Charge Data'
                  : 'No Charge Data Available'}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {data && data.length > 0
                  ? 'Enter a month and year (e.g., March 2025) to view data'
                  : 'Get started by adding your first charge record.'}
              </Typography>
              {(!data || data.length === 0) && onAdd && permissions?.create && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={onAdd}
                  startIcon={<AddIcon />}
                  size="medium"
                  sx={{ mt: 2 }}
                >
                  Add First Charge
                </Button>
              )}
            </>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper}>
      {renderHeader()}
      <Table size="small">
        <TableHead>
          <TableRow sx={{ '& th': { backgroundColor: '#1976d2', color: 'white', fontWeight: 'bold' } }}>
            <TableCell>Date</TableCell>
            {[...Array(11)].map((_, i) => (
              <TableCell key={`header-${i}`} align="right">
                C{(i + 1).toString().padStart(3, '0')}
              </TableCell>
            ))}
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tableData.map((row) => (
            <TableRow 
              key={row.uniqueId}
              hover
              sx={{ '&:hover': { cursor: 'pointer' } }}
            >
              <TableCell>{row.sk ? formatDisplayDate(row.sk) : 'N/A'}</TableCell>
              {[...Array(11)].map((_, i) => {
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
              <TableCell align="center">
                <Box display="flex" justifyContent="center" gap={1}>
                  {permissions.update && (
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={(e) => handleEdit(e, row)} sx={{ color: 'primary.main' }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {permissions.create && (
                    <Tooltip title="Copy">
                      <IconButton size="small" onClick={(e) => handleCopy(e, row)} sx={{ color: 'success.main' }}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {permissions.delete && (
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={(e) => handleDelete(e, row)} sx={{ color: 'error.main' }}>
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
  );
};

export default ChargeTable;
