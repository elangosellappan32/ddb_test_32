import React, { useMemo, useState, useEffect } from 'react';
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
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
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

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

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
  onCopy,
  onAdd,
  permissions,
  loading,
  error
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [filteredData, setFilteredData] = useState([]);

  // Filter data based on selected financial year
  useEffect(() => {
    if (!data || !Array.isArray(data)) {
      console.log('No data or invalid data format');
      setFilteredData([]);
      return;
    }

    console.log('Raw data:', data);
    const { startDate, endDate } = getFinancialYearRange(selectedYear);
    console.log(`Filtering for FY ${selectedYear}-${selectedYear + 1} (${startDate.toISOString()} to ${endDate.toISOString()})`);
    
    const filtered = data.filter(item => {
      // Use sk field if available, otherwise use date field
      const dateStr = item.sk || item.date;
      if (!dateStr) return false;
      
      // Parse date in MMYYYY format
      const month = parseInt(dateStr.substring(0, 2)) - 1; // 0-indexed month
      const year = parseInt(dateStr.substring(2));
      const itemDate = new Date(year, month, 1); // First day of the month
      
      const isInRange = itemDate >= startDate && itemDate <= endDate;
      console.log(`Item date: ${dateStr} (${itemDate.toISOString()}) - In range: ${isInRange}`);
      return isInRange;
    });

    console.log('Filtered data count:', filtered.length);
    setFilteredData(filtered);
  }, [data, selectedYear]);

  const handleYearChange = (event) => {
    setSelectedYear(Number(event.target.value));
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

  const handleCopy = (e, row) => {
    e.stopPropagation();
    if (permissions.create) {
      onCopy('unit', row);
    } else {
      enqueueSnackbar('You do not have permission to copy units', { variant: 'error' });
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
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      p: 2,
      backgroundColor: 'white',
      borderBottom: '2px solid #000000',
      gap: 2
    }}>
      <Typography variant="h6" component="div" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
        Unit Data
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
            sx={{ ml: 1 }}
          >
            Add Unit
          </Button>
        )}
      </Box>
    </Box>
  );

  if (!filteredData || filteredData.length === 0) {
    return (
      <Box sx={{ p: 0 }}>
        {renderHeader()}
        <Alert severity="info" sx={{ mt: 2, mx: 2, mb: 2 }}>
          {data && data.length > 0 
            ? `No unit data available for financial year ${selectedYear}-${(selectedYear + 1).toString().slice(-2)}`
            : 'No unit data available. Add your first unit record.'}
        </Alert>
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
                const value = row[field] || 0;
                const isNegative = value < 0;
                
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
          
          {/* Summary Row */}
          {tableData.length > 0 && (
            <TableRow sx={{ '& td': { fontWeight: 'bold', backgroundColor: '#f5f5f5' } }}>
              <TableCell>Total</TableCell>
              
              {/* Import Totals */}
              {[1, 2, 3, 4, 5].map(num => {
                const total = tableData.reduce((sum, row) => sum + (row[`import_c${num}`] || 0), 0);
                return (
                  <TableCell key={`import_total_${num}`} align="right" sx={{ color: '#0d47a1' }}>
                    {formatNumber(total)}
                  </TableCell>
                );
              })}
              
              {/* Export Totals */}
              {[1, 2, 3, 4, 5].map(num => {
                const total = tableData.reduce((sum, row) => sum + (row[`export_c${num}`] || 0), 0);
                return (
                  <TableCell key={`export_total_${num}`} align="right" sx={{ color: '#1b5e20' }}>
                    {formatNumber(total)}
                  </TableCell>
                );
              })}
              
              {/* Net Export Totals */}
              {[1, 2, 3, 4, 5].map(num => {
                const total = tableData.reduce((sum, row) => sum + (row[`net_export_c${num}`] || 0), 0);
                const isNegative = total < 0;
                return (
                  <TableCell 
                    key={`net_export_total_${num}`} 
                    align="right" 
                    sx={{ 
                      color: isNegative ? '#d32f2f' : '#1b5e20',
                      backgroundColor: isNegative ? '#ffebee' : '#e8f5e9'
                    }}
                  >
                    {formatNumber(total)}
                  </TableCell>
                );
              })}
              
              <TableCell></TableCell> {/* Empty cell for actions column */}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default UnitTable;
