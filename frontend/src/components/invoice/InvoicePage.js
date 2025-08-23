import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Typography,
  Box, 
  CircularProgress, 
  Alert,
  Button,
  TextField,
  useTheme,
  useMediaQuery,
  Tooltip,
  IconButton,
  Paper
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { startOfMonth } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import RefreshIcon from '@mui/icons-material/Refresh';
import InboxIcon from '@mui/icons-material/Inbox';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { enqueueSnackbar } from 'notistack';
import { fetchAndProcessInvoiceData, calculateInvoiceTotals } from '../../utils/invoiceUtils';
import AllocationTable from './AllocationTable';

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3, 4, 4, 4), // top, right, bottom, left
  marginBottom: theme.spacing(4),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  '& .MuiTextField-root': {
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  '& .MuiTableContainer-root': {
    marginTop: theme.spacing(3),
  },
}));

const Header = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: theme.spacing(1),
  paddingBottom: theme.spacing(2),
  borderBottom: '2px solid #000000',
  '& .header-content': {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    justifyContent: 'space-between',
    alignItems: 'center',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    marginBottom: theme.spacing(2),
  },
  '& .header-actions': {
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
    [theme.breakpoints.down('sm')]: {
      width: '100%',
      '& > *': {
        width: '100%',
      },
    },
    '& .MuiFormControl-root': {
      minWidth: 200,
    },
  },
}));

const Title = styled(Typography)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  color: theme.palette.primary.main,
  fontWeight: 600,
  '& svg': {
    marginRight: theme.spacing(1),
  },
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 300,
  '& .MuiCircularProgress-root': {
    marginBottom: theme.spacing(2),
  },
}));

const ErrorAlert = styled(Alert)(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

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
  const [sortConfig, setSortConfig] = useState({
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

  // Handle sorting
  const handleRequestSort = (property) => {
    const isAsc = sortConfig.orderBy === property && sortConfig.order === 'asc';
    setSortConfig({
      order: isAsc ? 'desc' : 'asc',
      orderBy: property,
    });
  };

  // Sort data based on current sort configuration
  const getSortedData = useCallback((data) => {
    return [...data].sort((a, b) => {
      if (a[sortConfig.orderBy] < b[sortConfig.orderBy]) {
        return sortConfig.order === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.orderBy] > b[sortConfig.orderBy]) {
        return sortConfig.order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [sortConfig.order, sortConfig.orderBy]);

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

  // Calculate totals and data
  const { totals, data } = useMemo(() => {
    if (!invoiceData || !Array.isArray(invoiceData)) {
      return { 
        totals: { 
          allocation: 0, 
          cValues: { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0 } 
        }, 
        data: [] 
      };
    }
    
    // Calculate totals and process data
    const result = calculateInvoiceTotals(invoiceData);
    
    // Calculate grand totals for each C value
    const grandTotals = result.data.reduce((acc, item) => {
      ['C1', 'C2', 'C3', 'C4', 'C5'].forEach(c => {
        acc[c] = (acc[c] || 0) + (Number(item.cValues?.[c]) || 0);
      });
      return acc;
    }, {});
    
    // Sort data
    const sortedData = getSortedData(result.data || []);
    
    return { 
      totals: { 
        allocation: result.allocation,
        cValues: grandTotals
      }, 
      data: sortedData 
    };
  }, [invoiceData, getSortedData]);

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
        <ErrorAlert 
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => fetchInvoiceData(selectedDate)}>
              Retry
            </Button>
          }
        >
          <Typography variant="subtitle2">Error loading invoice data</Typography>
          <Typography variant="body2">{error}</Typography>
        </ErrorAlert>
      </Container>
    );
  }

  // Show empty state
  if (!data || data.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, px: { xs: 1, sm: 2 } }}>
        <Paper elevation={2} sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: 300, 
          flexDirection: 'column',
          p: 3,
          textAlign: 'center'
        }}>
          <InboxIcon color="disabled" sx={{ fontSize: 48, mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Invoice Data Available
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            No invoice data found for the selected period.
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={() => fetchInvoiceData(selectedDate)}
          >
            Refresh
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <StyledPaper elevation={0}>
        <Header>
          <div className="header-content">
            <Title variant="h5" component="h1">
              <ReceiptIcon fontSize="large" /> Invoice Management
            </Title>
            <div className="header-actions">
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  views={['year', 'month']}
                  label="Financial Year"
                  minDate={new Date('2020-01-01')}
                  maxDate={new Date()}
                  value={selectedDate}
                  onChange={handleDateChange}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      variant="outlined"
                      fullWidth
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  )}
                />
              </LocalizationProvider>
            </div>
          </div>
        </Header>

        <AllocationTable
          data={data}
          sortConfig={sortConfig}
          onRequestSort={handleRequestSort}
          totals={totals}
        />
      </StyledPaper>
    </Container>
  );
};

export default InvoicePage;
