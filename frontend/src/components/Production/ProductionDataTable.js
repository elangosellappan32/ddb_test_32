import React from 'react';
import { useSnackbar } from 'notistack';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Typography,
  Paper
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { formatNumber } from '../../utils/numberFormat';
import { format } from 'date-fns';

const ProductionDataTable = ({ 
  data, 
  type, 
  onEdit, 
  onDelete, 
  permissions,
  isProductionPage = false 
}) => {
  const { enqueueSnackbar } = useSnackbar();

  const tableData = React.useMemo(() => {
    // Handle both array and object data structures
    const dataArray = Array.isArray(data) ? data : (data?.data || []);
    
    if (!dataArray.length) {

      return [];
    }

    return dataArray.map(row => ({
      ...row,
      // Create a truly unique identifier using multiple fields
      uniqueId: `${row.sk || ''}_${row.productionSiteId || ''}_${type}_${row.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    })).sort((a, b) => {
      // Handle cases where date might be undefined
      if (!a.date || !b.date) {
        return !a.date ? 1 : -1;
      }

      // Safe substring operations with validation
      try {
        const yearA = a.date.substring(2);
        const yearB = b.date.substring(2);
        const monthA = a.date.substring(0, 2);
        const monthB = b.date.substring(0, 2);
        
        // Sort by year first
        if (yearA !== yearB) {
          return parseInt(yearB, 10) - parseInt(yearA, 10);
        }
        // Then by month
        if (monthA !== monthB) {
          return parseInt(monthB, 10) - parseInt(monthA, 10);
        }
      } catch (error) {
        console.error('[ProductionDataTable] Sorting error:', error);
      }
      
      // Finally by site ID
      return (b.productionSiteId || 0) - (a.productionSiteId || 0);
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
      {['c1', 'c2', 'c3', 'c4', 'c5'].map((field) => (
        <TableCell 
          key={`${row.uniqueId}_${field}`} 
          align="right" 
          sx={{ 
            color: 'success.main',
            '&:hover': {
              color: 'success.dark'
            }
          }}
        >
          {formatNumber(row[field] || 0)}
        </TableCell>
      ))}
    </>
  );

  const renderChargeValues = (row) => (
    <>
      {[...Array(10)].map((_, i) => {
        const field = `c${(i + 1).toString().padStart(3, '0')}`;
        return (
          <TableCell 
            key={`${row.uniqueId}_${field}`} 
            align="right" 
            sx={{ 
              color: 'warning.dark',
              '&:hover': {
                color: 'warning.main'
              }
            }}
          >
            {formatNumber(row[field] || 0)}
          </TableCell>
        );
      })}
    </>
  );

  // Add function to check if date exists for site
  const checkDateExistsForSite = (dateToCheck, siteId) => {
    if (!data?.data || !Array.isArray(data.data)) return false;
    
    return data.data.some(row => {
      const existingDate = row.sk || row.date;
      // Normalize both dates to mmyyyy format for comparison
      const normalizedExistingDate = existingDate.replace('/', '');
      const normalizedCheckDate = dateToCheck.replace('/', '');
      return normalizedExistingDate === normalizedCheckDate && row.productionSiteId === siteId;
    });
  };

  // Update renderTableRow to show existing data indicator
  const renderTableRow = (row) => (
    <TableRow 
      key={row.uniqueId}
      sx={{
        backgroundColor: row.isExisting ? 'action.hover' : 'inherit'
      }}
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
            {row.isExisting && (
              <Typography 
                component="span" 
                color="error" 
                sx={{ ml: 1 }}
              >
                • Existing Entry
              </Typography>
            )}
          </Typography>
        </Typography>
      </TableCell>
      {type === 'unit' ? renderUnitValues(row) : renderChargeValues(row)}
      {renderActions(row)}
    </TableRow>
  );

  // Add validation before adding/editing data
  const handleDataAction = (action, rowData) => {
    const dateExists = checkDateExistsForSite(
      rowData.sk || rowData.date, 
      rowData.productionSiteId
    );

    if (action === 'add' && dateExists) {
      enqueueSnackbar(
        `Data already exists for ${formatDisplayDate(rowData.sk || rowData.date)} in Site ${rowData.productionSiteId}`, 
        { variant: 'error' }
      );
      return false;
    }

    return true;
  };

  // Render actions only if permissions allow
  const renderActions = (row) => {
    if (!permissions?.update && !permissions?.delete) return null;

    return (
      <TableCell align="right">
        {permissions?.update && onEdit && (
          <IconButton onClick={() => onEdit(row)}>
            <EditIcon />
          </IconButton>
        )}
        {permissions?.delete && onDelete && (
          <IconButton onClick={() => onDelete(row)}>
            <DeleteIcon />
          </IconButton>
        )}
      </TableCell>
    );
  };

  if (!tableData.length) {
    return (
      <Paper sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="textSecondary">
          No {type} data available
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table size="medium">
        <TableHead>
          <TableRow>
            <TableCell>Month</TableCell>
            {type === 'unit' ? (
              <>
                {['C1', 'C2', 'C3', 'C4', 'C5'].map((header) => (
                  <TableCell 
                    key={`header_${header}`}
                    align="right" 
                    sx={{ 
                      color: 'success.main',
                      fontWeight: 'bold'
                    }}
                  >
                    {header}
                  </TableCell>
                ))}
              </>
            ) : (
              <>
                {[...Array(10)].map((_, i) => (
                  <TableCell 
                    key={`header_c${(i + 1).toString().padStart(3, '0')}`}
                    align="right"
                    sx={{ 
                      color: 'warning.dark',
                      fontWeight: 'bold'
                    }}
                  >
                    {`C${(i + 1).toString().padStart(3, '0')}`}
                  </TableCell>
                ))}
              </>
            )}
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tableData.map(renderTableRow)}
        </TableBody>
      </Table>
    </TableContainer>
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