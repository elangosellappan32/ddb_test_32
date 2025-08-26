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
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [filteredData, setFilteredData] = useState([]);

  // Filter data based on selected financial year
  useEffect(() => {
    if (!data || !Array.isArray(data)) {
      console.log('No data or invalid data format');
      setFilteredData([]);
      return;
    }

    console.log('Raw charge data:', data);
    const { startDate, endDate } = getFinancialYearRange(selectedYear);
    console.log(`Filtering charges for FY ${selectedYear}-${selectedYear + 1} (${startDate.toISOString()} to ${endDate.toISOString()})`);
    
    const filtered = data.filter(item => {
      // Use sk field if available, otherwise use date field
      const dateStr = item.sk || item.date;
      if (!dateStr) return false;
      
      // Parse date in MMYYYY format
      const month = parseInt(dateStr.substring(0, 2)) - 1; // 0-indexed month
      const year = parseInt(dateStr.substring(2));
      const itemDate = new Date(year, month, 1); // First day of the month
      
      const isInRange = itemDate >= startDate && itemDate <= endDate;
      console.log(`Charge date: ${dateStr} (${itemDate.toISOString()}) - In range: ${isInRange}`);
      return isInRange;
    });

    console.log('Filtered charge data count:', filtered.length);
    setFilteredData(filtered);
  }, [data, selectedYear]);

  const tableData = useMemo(() => {
    if (!filteredData.length) return [];

    return filteredData.map(row => ({
      ...row,
      uniqueId: `${row.sk || ''}_${row.productionSiteId || ''}_charge_${row.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }));
  }, [filteredData]);

  const handleYearChange = (event) => {
    setSelectedYear(Number(event.target.value));
  };

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
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      p: 2,
      backgroundColor: 'white',
      borderBottom: '2px solid #000000',
      gap: 2
    }}>
      <Typography variant="h6" component="div" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
        Charge Data
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
            Add Charge
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
        Error loading charge data: {error}
      </Alert>
    );
  }

  if (!filteredData || filteredData.length === 0) {
    return (
      <Box sx={{ p: 0 }}>
        {renderHeader()}
        <Alert severity="info" sx={{ mt: 2, mx: 2, mb: 2 }}>
          {data && data.length > 0 
            ? `No charge data available for financial year ${selectedYear}-${(selectedYear + 1).toString().slice(-2)}`
            : 'No charge data available. Add your first charge record.'}
        </Alert>
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
