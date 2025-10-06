import React, { useMemo, useState, useEffect } from 'react';
import { useSnackbar } from 'notistack';
import ClearIcon from '@mui/icons-material/Clear';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Grid
} from '@mui/material';
import { Search as SearchIcon, FilterList as FilterListIcon, Close as CloseIcon, Tune as TuneIcon } from '@mui/icons-material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Info as InfoIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { Button } from '@mui/material';
import { formatNumber } from '../../utils/numberFormat';
import { formatDisplayDate } from '../../utils/dateUtils';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
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

// Get financial year range for a given year (April 1 to March 31)
const getFinancialYearRange = (year) => {
  const startDate = new Date(year, 3, 1); // April 1st of the selected year
  const endDate = new Date(year + 1, 2, 31); // March 31st of the next year
  return { startDate, endDate };
};

const UnitTable = ({ 
  data, 
  onEdit, 
  onDelete, 
  onAdd,
  permissions,
  loading,
  error
}) => {
  const { enqueueSnackbar } = useSnackbar();
  // State for search
  const [filters, setFilters] = useState({
    searchTerm: '',
    isFiltered: false  // Track if search is active
  });
  
  const [filteredData, setFilteredData] = useState([]);
  
  // Available unit types (you can modify this based on your data)

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
  
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
      isFiltered: name === 'searchTerm' && value.trim() !== ''
    }));
  };
  
  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      isFiltered: false
    });
  };

  
  const clearSearch = () => {
    handleFilterChange('searchTerm', '');
  };

  const tableData = useMemo(() => {
    if (!filteredData.length) return [];

    return filteredData.map(row => ({
      ...row,
      uniqueId: `${row.sk || ''}_${row.productionSiteId || ''}_unit_${row.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }));
  }, [filteredData]);

  const handleEdit = (e, row) => {
    e.stopPropagation();
    if (permissions.update) {
      onEdit('unit', row);
    } else {
      enqueueSnackbar('You do not have permission to edit units', { variant: 'error' });
    }
  };

  const handleDelete = (e, row) => {
    e.stopPropagation();
    if (permissions.delete) {
      onDelete('unit', row);
    } else {
      enqueueSnackbar('You do not have permission to delete units', { variant: 'error' });
    }
  };

  

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
        Error loading unit data: {error}
      </Alert>
    );
  }

  const renderHeader = () => (
    <Box sx={{ 
      mb: 3,
      backgroundColor: 'background.paper',
      borderRadius: 1,
      p: 2,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: 2,
        pb: 2,
        borderBottom: '2px solid',
        borderColor: 'rgba(0, 0, 0, 0.87)',
        mb: 3
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          minWidth: { sm: '200px' },
          mb: { xs: 1, sm: 0 }
        }}>
          <Typography 
            variant="h6" 
            component="h2"
            sx={{ 
              color: 'primary.main',
              fontWeight: 600,
              fontSize: '1.25rem',
              lineHeight: 1.2
            }}
          >
            Unit Data
          </Typography>
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          gap: 2, 
          alignItems: 'center',
          flex: { sm: 1 },
          justifyContent: 'flex-end',
          flexWrap: 'wrap'
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            width: { xs: '100%', sm: 'auto' },
            maxWidth: { sm: '300px' },
            flex: { xs: '1 1 100%', sm: '0 1 auto' },
            position: 'relative'
          }}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Search by month (e.g., March 2025)"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && filters.searchTerm) {
                  handleFilterChange('isFiltered', true);
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: filters.searchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      onClick={clearSearch}
                      size="small"
                      sx={{
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        },
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  pr: 1,
                  '&.Mui-focused': {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                    },
                  },
                },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'background.paper',
                  paddingRight: '40px',
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'action.active',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '1px',
                  },
                },
                '& .MuiInputBase-input': {
                  paddingRight: '8px',
                },
              }}
            />
          </Box>
          
          {onAdd && permissions?.create && (
            <Button
              variant="contained"
              color="primary"
              onClick={onAdd}
              startIcon={<AddIcon />}
              size="small"
              sx={{ 
                whiteSpace: 'nowrap',
                minWidth: '120px'
              }}
              disabled={loading}
            >
              Add Unit
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );

  if (!filteredData || filteredData.length === 0) {
    const hasSearchTerm = filters.searchTerm && filters.isFiltered;
    
    return (
      <Box sx={{ p: 0 }}>
        {renderHeader()}
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
          {hasSearchTerm ? (
            <>
              <InfoIcon color="action" sx={{ fontSize: 48, mb: 2, color: 'text.secondary' }} />
              <Typography variant="h6" color="text.primary" gutterBottom>
                No Data Found for {filters.searchTerm}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: '500px' }}>
                We couldn't find any unit data for the selected month. 
                Would you like to add data for this period?
              </Typography>
              {onAdd && permissions?.create && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={onAdd}
                  startIcon={<AddIcon />}
                  size="medium"
                >
                  Add Data for {filters.searchTerm}
                </Button>
              )}
            </>
          ) : (
            <>
              <InfoIcon color="action" sx={{ fontSize: 48, mb: 2, color: 'text.secondary' }} />
              <Typography variant="h6" color="text.primary" gutterBottom>
                {data && data.length > 0 
                  ? 'Search for Unit Data'
                  : 'No Unit Data Available'}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {data && data.length > 0
                  ? 'Enter a month and year (e.g., March 2025) to view data'
                  : 'Get started by adding your first unit record.'}
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
                  Add First Unit
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
          {/* Main Header Row */}
          <TableRow sx={{ '& th': { backgroundColor: '#1976d2', color: 'white', fontWeight: 'bold' } }}>
            <TableCell rowSpan={2}>Date</TableCell>
            
            {/* Import C Values Header */}
            <TableCell colSpan="5" align="center" sx={{ backgroundColor: '#bbdefb' }}>Import</TableCell>
            
            {/* Export C Values Header */}
            <TableCell colSpan="5" align="center" sx={{ backgroundColor: '#c8e6c9' }}>Export </TableCell>
            
            {/* Net Export C Values Header */}
            <TableCell colSpan="5" align="center" sx={{ backgroundColor: '#ffe0b2' }}>Net Export </TableCell>
            
            <TableCell rowSpan={2} align="center" sx={{ backgroundColor: '#1976d2' }}>Actions</TableCell>
          </TableRow>
          
          {/* C Value Labels Row */}
          <TableRow sx={{ '& th': { backgroundColor: '#1976d2', color: 'white', fontWeight: 'bold' } }}>
            {/* Import C Labels */}
            {[1, 2, 3, 4, 5].map(num => (
              <TableCell 
                key={`import_header_${num}`} 
                align="center" 
                sx={{ 
                  backgroundColor: '#e3f2fd',
                  color: '#0d47a1',
                  fontWeight: 'bold',
                  borderBottom: '1px solid #90caf9'
                }}
              >
                C{num}
              </TableCell>
            ))}
            
            {/* Export C Labels */}
            {[1, 2, 3, 4, 5].map(num => (
              <TableCell 
                key={`export_header_${num}`} 
                align="center" 
                sx={{ 
                  backgroundColor: '#e8f5e9',
                  color: '#1b5e20',
                  fontWeight: 'bold',
                  borderBottom: '1px solid #a5d6a7'
                }}
              >
                C{num}
              </TableCell>
            ))}
            
            {/* Net Export C Labels */}
            {[1, 2, 3, 4, 5].map(num => (
              <TableCell 
                key={`net_export_header_${num}`} 
                align="center" 
                sx={{ 
                  backgroundColor: '#fff3e0',
                  color: '#e65100',
                  fontWeight: 'bold',
                  borderBottom: '1px solid #ffcc80'
                }}
              >
                C{num}
              </TableCell>
            ))}
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
              
              {/* Import C Values */}
              {[1, 2, 3, 4, 5].map((num) => {
                const field = `import_c${num}`;
                const isPeak = [2, 3].includes(num);
                return (
                  <TableCell 
                    key={`${row.uniqueId}_${field}`}
                    align="right"
                    sx={{ 
                      color: isPeak ? '#d32f2f' : '#7b1fa2',
                      fontWeight: 'medium',
                      backgroundColor: isPeak ? 'rgba(211, 47, 47, 0.08)' : 'rgba(123, 31, 162, 0.08)',
                      '&:hover': {
                        backgroundColor: isPeak ? 'rgba(211, 47, 47, 0.12)' : 'rgba(123, 31, 162, 0.12)'
                      }
                    }}
                  >
                    {formatNumber(row[field] || 0)}
                  </TableCell>
                );
              })}

              {/* Export C Values */}
              {[1, 2, 3, 4, 5].map((num) => {
                const field = `export_c${num}`;
                const isPeak = [2, 3].includes(num);
                return (
                  <TableCell 
                    key={`${row.uniqueId}_${field}`}
                    align="right"
                    sx={{ 
                      color: isPeak ? '#2e7d32' : '#0288d1',
                      fontWeight: 'medium',
                      backgroundColor: isPeak ? 'rgba(46, 125, 50, 0.08)' : 'rgba(2, 136, 209, 0.08)',
                      '&:hover': {
                        backgroundColor: isPeak ? 'rgba(46, 125, 50, 0.12)' : 'rgba(2, 136, 209, 0.12)'
                      }
                    }}
                  >
                    {formatNumber(row[field] || 0)}
                  </TableCell>
                );
              })}

              {/* Net Export C Values */}
              {[1, 2, 3, 4, 5].map((num) => {
                const field = `net_export_c${num}`;
                const isPeak = [2, 3].includes(num);
                const rawValue = row[field] ?? 0;
                const value = rawValue < 0 ? 0 : rawValue; // clamp negatives to zero for display
                const isNegative = rawValue < 0;
                
                return (
                  <TableCell 
                    key={`${row.uniqueId}_${field}`}
                    align="right"
                    sx={{ 
                      color: isNegative ? '#d32f2f' : '#2e7d32',
                      fontWeight: 'medium',
                      backgroundColor: isNegative 
                        ? 'rgba(211, 47, 47, 0.08)' 
                        : isPeak 
                          ? 'rgba(46, 125, 50, 0.08)' 
                          : 'rgba(255, 152, 0, 0.08)',
                      '&:hover': {
                        backgroundColor: isNegative 
                          ? 'rgba(211, 47, 47, 0.12)' 
                          : isPeak 
                            ? 'rgba(46, 125, 50, 0.12)' 
                            : 'rgba(255, 152, 0, 0.12)'
                      }
                    }}
                  >
                    {formatNumber(value)}
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

export default UnitTable;
