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
          <TableRow sx={{ '& th': { backgroundColor: '#1976d2', color: 'white', fontWeight: 'bold' } }}>
            <TableCell>Date</TableCell>
            <TableCell align="right">C1</TableCell>
            <TableCell align="right">C2</TableCell>
            <TableCell align="right">C3</TableCell>
            <TableCell align="right">C4</TableCell>
            <TableCell align="right">C5</TableCell>
            <TableCell align="right">Import</TableCell>
            <TableCell align="right">Total</TableCell>
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
              {['c1', 'c2', 'c3', 'c4', 'c5'].map((field) => {
                const isPeak = ['c2', 'c3'].includes(field);
                return (
                  <TableCell 
                    key={`${row.uniqueId}_${field}`} 
                    align="right"
                    sx={{ 
                      color: isPeak ? '#ff9800' : '#4caf50',
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
              <TableCell align="right" sx={{ color: '#9c27b0', fontWeight: 'medium' }}>
                {formatNumber(row.import || 0)}
              </TableCell>
              <TableCell 
                align="right"
                sx={{
                  fontWeight: 'bold',
                  color: '#1976d2',
                  backgroundColor: 'rgba(25, 118, 210, 0.08)'
                }}
              >
                {formatNumber(
                  ['c1', 'c2', 'c3', 'c4', 'c5'].reduce((sum, field) => sum + (parseFloat(row[field]) || 0), 0)
                )}
              </TableCell>
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

export default UnitTable;
