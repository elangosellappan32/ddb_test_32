import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box, 
  CircularProgress, 
  Alert,
  Button,
  TablePagination,
  TextField,
  useTheme,
  useMediaQuery,
  TableSortLabel
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO, startOfMonth } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import RefreshIcon from '@mui/icons-material/Refresh';
import InboxIcon from '@mui/icons-material/Inbox';
import { enqueueSnackbar } from 'notistack';
import { fetchAndProcessInvoiceData, calculateInvoiceTotals } from '../../utils/invoiceUtils';

// Types for better type safety
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const InvoicePage = () => {
  // Hooks and context
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // State management
  const [invoiceData, setInvoiceData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(startOfMonth(new Date()));
  const [pagination, setPagination] = useState({
    page: 0,
    rowsPerPage: ROWS_PER_PAGE_OPTIONS[0],
    count: 0,
    order: 'asc',
    orderBy: 'productionSiteName',
  });
  const [financialYear, setFinancialYear] = useState('');
  const [month, setMonth] = useState('');

  // Handle date change
  const handleDateChange = (date) => {
    setSelectedDate(date);
    fetchInvoiceData(date);
  };

  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleChangeRowsPerPage = (event) => {
    setPagination(prev => ({
      ...prev,
      page: 0,
      rowsPerPage: parseInt(event.target.value, 10)
    }));
  };

  // Handle sorting
  const handleRequestSort = (property) => {
    const isAsc = pagination.orderBy === property && pagination.order === 'asc';
    setPagination(prev => ({
      ...prev,
      order: isAsc ? 'desc' : 'asc',
      orderBy: property,
    }));
  };

  // Sort data based on current sort configuration
  const getSortedData = useCallback((data) => {
    return [...data].sort((a, b) => {
      if (a[pagination.orderBy] < b[pagination.orderBy]) {
        return pagination.order === 'asc' ? -1 : 1;
      }
      if (a[pagination.orderBy] > b[pagination.orderBy]) {
        return pagination.order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [pagination.order, pagination.orderBy]);

  // Fetch and process invoice data
  const fetchInvoiceData = useCallback(async (date) => {
    if (!isAuthenticated || !user) {
      console.warn('User not authenticated, skipping data fetch');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchAndProcessInvoiceData(user, date);
      
      setInvoiceData(result.data);
      setFinancialYear(result.meta.financialYear);
      setMonth(result.meta.month);
      setPagination(prev => ({
        ...prev,
        count: result.meta.totalCount,
        page: 0 // Reset to first page on new data load
      }));
      
    } catch (error) {
      console.error('Error in fetchInvoiceData:', error);
      setError(error.message || 'Failed to load invoice data');
      enqueueSnackbar(error.message || 'Failed to load invoice data', { 
        variant: 'error',
        autoHideDuration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user, enqueueSnackbar]);

  // Calculate totals and paginated data
  const { totals, paginatedData } = useMemo(() => {
    if (!invoiceData || !Array.isArray(invoiceData)) {
      return { 
        totals: { allocation: 0, cValueCounts: {} }, 
        paginatedData: [] 
      };
    }
    
    // Log raw data for debugging
    console.log('Raw invoice data:', invoiceData);
    
    // Process the data to ensure proper structure
    const processedData = invoiceData.map(item => {
      // Ensure cValues exists and has all C values initialized
      const cValues = {
        C1: Number(item.cValues?.C1) || 0,
        C2: Number(item.cValues?.C2) || 0,
        C3: Number(item.cValues?.C3) || 0,
        C4: Number(item.cValues?.C4) || 0,
        C5: Number(item.cValues?.C5) || 0
      };
      
      // Calculate row total
      const total = Object.values(cValues).reduce((sum, val) => sum + val, 0);
      
      return {
        ...item,
        cValues,
        total
      };
    });
    
    // Calculate totals using the utility function
    const result = calculateInvoiceTotals(processedData);
    
    // Sort data by production site name
    const sortedData = [...(result.data || [])].sort((a, b) => {
      const aName = a.productionSiteName || '';
      const bName = b.productionSiteName || '';
      return aName.localeCompare(bName);
    });
    
    // Log processed data for debugging
    console.log('Processed data:', sortedData);
    console.log('Calculated totals:', { 
      allocation: result.allocation, 
      cValueCounts: result.cValueCounts 
    });
    
    // Apply pagination
    const { page, rowsPerPage } = pagination;
    const paginatedData = sortedData.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
    
    return { 
      totals: { 
        allocation: result.allocation, 
        cValueCounts: result.cValueCounts 
      }, 
      paginatedData 
    };
  }, [invoiceData, pagination, getSortedData]);

  // Handle authentication and initial data loading
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login', { state: { from: location }, replace: true });
    } else if (!authLoading && isAuthenticated) {
      fetchInvoiceData(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, navigate, location]);

  // Show loading state
  if (authLoading || isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert 
          severity="error" 
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => fetchInvoiceData(selectedDate)}
              startIcon={<RefreshIcon />}
              disabled={isLoading}
            >
              Retry
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      </Container>
    );
  }

  // Render sortable table header cell
  const renderSortableHeader = (id, label) => (
    <TableCell
      key={id}
      align="right"
      sortDirection={pagination.orderBy === id ? pagination.order : false}
    >
      <TableSortLabel
        active={pagination.orderBy === id}
        direction={pagination.orderBy === id ? pagination.order : 'asc'}
        onClick={() => handleRequestSort(id)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Box display="flex" flexDirection={isMobile ? 'column' : 'row'} 
               justifyContent="space-between" alignItems={isMobile ? 'stretch' : 'center'} 
               gap={2} mb={3}>
            <Typography variant="h5" component="h1">
              Invoice Details
            </Typography>
            <Box display="flex" gap={2}>
              <DatePicker
                views={['year', 'month']}
                label="Select Month"
                value={selectedDate}
                onChange={handleDateChange}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    size="small" 
                    sx={{ minWidth: isMobile ? '100%' : 200 }}
                  />
                )}
                disableFuture
                disabled={isLoading}
              />
              <Button
                variant="outlined"
                onClick={() => fetchInvoiceData(selectedDate)}
                disabled={isLoading}
                startIcon={<RefreshIcon />}
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </Box>
          </Box>

          {financialYear && month && (
            <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
              <Typography variant="subtitle1" color="textSecondary">
                <strong>Financial Year:</strong> {financialYear}
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                <strong>Month:</strong> {month}
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                <strong>Total Records:</strong> {pagination.count}
              </Typography>
            </Box>
          )}
        </Paper>

        <Paper elevation={3} sx={{ width: '100%', overflow: 'hidden', mb: 3 }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
            <Table stickyHeader size={isMobile ? 'small' : 'medium'}
                   aria-label="invoice data table">
              <TableHead>
                <TableRow>
                  <TableCell>Production Site</TableCell>
                  <TableCell>Consumption Site</TableCell>
                  <TableCell align="center">C1</TableCell>
                  <TableCell align="center">C2</TableCell>
                  <TableCell align="center">C3</TableCell>
                  <TableCell align="center">C4</TableCell>
                  <TableCell align="center">C5</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((row) => {
                  // Calculate row total if not provided
                  const rowTotal = row.total || Object.values(row.cValues || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
                  
                  return (
                    <TableRow key={`${row.productionSiteId}-${row.consumptionSiteId}`} hover>
                      <TableCell>
                        <Box>
                          <div>{row.productionSiteName || `Site ${row.productionSiteId}`}</div>
                          <Typography variant="caption" color="textSecondary">
                            ID: {row.productionSiteId}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <div>{row.consumptionSiteName || `Site ${row.consumptionSiteId}`}</div>
                          <Typography variant="caption" color="textSecondary">
                            ID: {row.consumptionSiteId}
                          </Typography>
                        </Box>
                      </TableCell>
                      {['C1', 'C2', 'C3', 'C4', 'C5'].map((cValue) => {
                        const value = row.cValues?.[cValue] || 0;
                        return (
                          <TableCell 
                            key={cValue}
                            align="center"
                            sx={{
                              backgroundColor: value > 0 ? 'action.selected' : 'inherit',
                              fontWeight: value > 0 ? 'bold' : 'normal'
                            }}
                          >
                            {value > 0 ? value.toLocaleString() : '0'}
                          </TableCell>
                        );
                      })}
                      <TableCell align="right">
                        <strong>{rowTotal.toLocaleString()}</strong>
                      </TableCell>
                    </TableRow>
                  );
                })}
                
                {/* Totals row */}
                <TableRow sx={{ '& > *': { borderTop: '2px solid', borderColor: 'divider' } }}>
                  <TableCell colSpan={2} align="right">
                    <strong>Total:</strong>
                  </TableCell>
                  {['C1', 'C2', 'C3', 'C4', 'C5'].map((cValue) => {
                    // Calculate the sum of this C value across all rows
                    const sum = paginatedData.reduce((total, row) => {
                      return total + (Number(row.cValues?.[cValue]) || 0);
                    }, 0);
                    
                    return (
                      <TableCell 
                        key={`total-${cValue}`}
                        align="center"
                        sx={{ 
                          fontWeight: 'bold',
                          backgroundColor: sum > 0 ? 'action.selected' : 'inherit'
                        }}
                      >
                        {sum > 0 ? sum.toLocaleString() : '0'}
                      </TableCell>
                    );
                  })}
                  <TableCell align="right">
                    <strong>{paginatedData.reduce((sum, row) => {
                      const rowTotal = row.total || Object.values(row.cValues || {}).reduce((s, v) => s + (Number(v) || 0), 0);
                      return sum + rowTotal;
                    }, 0).toLocaleString()}</strong>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            component="div"
            count={pagination.count}
            rowsPerPage={pagination.rowsPerPage}
            page={pagination.page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Rows per page:"
            labelDisplayedRows={({ from, to, count }) => 
              `${from}-${to} of ${count !== -1 ? count : `more than ${to}`}`
            }
            sx={{
              '.MuiTablePagination-toolbar': {
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 1,
              }
            }}
          />
        </Paper>
      </Container>
    </LocalizationProvider>
  );
};

export default InvoicePage;
