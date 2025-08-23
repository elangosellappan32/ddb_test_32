import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
  useTheme,
  useMediaQuery,
  Stack,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { startOfMonth, format, parseISO } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { enqueueSnackbar } from 'notistack';

import AllocationTable from './AllocationTable';
import ProductionChargeTable from './ChargeTable';
import InvoiceTemplate from './InvoiceTemplate';
import invoiceService from '../../services/invoiceService';

import {
  fetchAndProcessInvoiceData,
  fetchProductionChargesForMonth,
} from '../../utils/invoiceUtils';

const PageWrapper = styled(Container)(({ theme }) => ({
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(4),
  minHeight: '80vh',
  width: '100%',
  maxWidth: '98% !important',
  padding: theme.spacing(1),
  [theme.breakpoints.up('xl')]: {
    maxWidth: '98% !important',
  },
}));

const HeaderBox = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
  justifyContent: 'space-between',
  alignItems: 'center',
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: 700,
  marginBottom: theme.spacing(2),
  flexGrow: 1,
  fontSize: '2rem',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const StyledPaper = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  backgroundColor: theme.palette.background.paper,
}));

const LoadingBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 300,
  gap: theme.spacing(2),
}));

const ActionButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

const InvoicePage = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [selectedDate, setSelectedDate] = useState(startOfMonth(new Date()));

  const [invoiceData, setInvoiceData] = useState({
    allocationData: [],
    chargeData: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sortConfig, setSortConfig] = useState({
    order: 'asc',
    orderBy: 'productionSiteName',
  });

  const [invoice, setInvoice] = useState(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const fetchInvoiceData = useCallback(
    async (date) => {
      if (!isAuthenticated || !user) return;

      setLoading(true);
      setError(null);

      try {
        const [allocationResult, chargeResult] = await Promise.all([
          fetchAndProcessInvoiceData(user, date),
          fetchProductionChargesForMonth(user, user.companyId, null, date),
        ]);

        setInvoiceData({
          allocationData: allocationResult.data || [],
          chargeData: (chargeResult && chargeResult.success) ? chargeResult.data : [],
        });

        if (!(chargeResult && chargeResult.success)) {
          enqueueSnackbar('Warning: Issue loading production charges.', { variant: 'warning' });
        }
      } catch (err) {
        const errMsg = err.message || 'Failed to load invoice data.';
        setError(errMsg);
        enqueueSnackbar(errMsg, { variant: 'error' });
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, user, enqueueSnackbar]
  );

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchInvoiceData(selectedDate);
    }
    if (!authLoading && !isAuthenticated) {
      navigate('/login', { state: { from: location }, replace: true });
    }
  }, [authLoading, isAuthenticated, fetchInvoiceData, navigate, location, selectedDate]);

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    fetchInvoiceData(newDate);
  };

  const handleRequestSort = (property, order) => {
    setSortConfig({ order, orderBy: property });
  };

  const handleGenerateInvoice = async () => {
    if (!user || !selectedDate) return;

    setGeneratingInvoice(true);
    
    try {
      const month = format(selectedDate, 'MM');
      const year = format(selectedDate, 'yyyy');
      
      const { data: generatedInvoice, error } = await invoiceService.generateInvoice({
        companyId: user.companyId,
        month,
        year,
        allocations: invoiceData.allocationData,
        charges: invoiceData.chargeData,
      });

      if (error) throw new Error(error);

setInvoice({
        ...generatedInvoice,
        company: {
          name: user.companyName || 'Your Company',
          address: {
            line1: user.companyAddress || '123 Business Street',
            city: user.companyCity || 'City',
            state: user.companyState || 'State',
            pincode: user.companyPincode || '123456',
          },
          gstin: user.companyGSTIN || '22AAAAA0000A1Z5',
          billingContact: user.name || 'Billing Department',
          billingEmail: user.email || 'billing@example.com',
        },
        billingPeriod: format(selectedDate, 'MMMM yyyy'),
        issueDate: new Date().toISOString(),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(),
      });

      enqueueSnackbar('Invoice generated successfully!', { variant: 'success' });
    } catch (error) {
      console.error('Error generating invoice:', error);
      enqueueSnackbar(error.message || 'Failed to generate invoice', { variant: 'error' });
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    // TODO: Implement PDF download functionality
    enqueueSnackbar('PDF download will be implemented here', { variant: 'info' });
  };

  return (
    <PageWrapper maxWidth="lg">
      <HeaderBox>
        <SectionTitle variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon fontSize="large" />
          Invoice Summary
        </SectionTitle>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            views={['year', 'month']}
            label="Select Month"
            value={selectedDate}
            onChange={handleDateChange}
            disableFuture
            renderInput={(params) => (
              <Box sx={{ minWidth: isMobile ? '100%' : 200 }}>{params.input}</Box>
            )}
          />
        </LocalizationProvider>
      </HeaderBox>

      {loading || authLoading ? (
        <LoadingBox>
          <CircularProgress />
          <Typography variant="body1">Loading invoice data...</Typography>
        </LoadingBox>
      ) : error ? (
        <Box>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <ActionButton variant="contained" color="primary" onClick={() => fetchInvoiceData(selectedDate)}>
            Retry
          </ActionButton>
        </Box>
      ) : (!invoiceData.allocationData?.length && !invoiceData.chargeData?.length) ? (
        <Box>
          <Typography variant="h6" gutterBottom>
            No Invoice Data Available
          </Typography>
          <Typography variant="body2" gutterBottom>
            No invoice data found for the selected period.
          </Typography>
          <ActionButton variant="contained" color="primary" onClick={() => fetchInvoiceData(selectedDate)}>
            Refresh
          </ActionButton>
        </Box>
      ) : (
        <>
          <Box sx={{ borderTop: '1px solid black', pt: 2, mb: 4, width: '100%' }}>
            <StyledPaper sx={{ width: '100%', overflow: 'hidden' }}>
              <Typography variant="h5" gutterBottom>
                Allocation Data
              </Typography>
              <Box sx={{ borderBottom: '1px solid black', pb: 2, mb: 2 }} />
              {invoiceData.allocationData.length > 0 ? (
                <AllocationTable data={invoiceData.allocationData} />
              ) : (
                <Typography>No allocation data available.</Typography>
              )}
            </StyledPaper>
          </Box>

          <Box sx={{ mb: 4, width: '100%' }}>
            <StyledPaper sx={{ width: '100%', overflow: 'hidden' }}>
              <Typography variant="h5" gutterBottom>
                Production Charges
              </Typography>
              <Box sx={{ borderBottom: '1px solid black', pb: 2, mb: 2 }} />
              <Box sx={{ width: '100%', overflowX: 'auto' }}>
                {invoiceData.chargeData.length > 0 ? (
                  <ProductionChargeTable
                    data={invoiceData.chargeData}
                    sortConfig={sortConfig}
                    onRequestSort={handleRequestSort}
                  />
                ) : (
                  <Typography>No production charge data available.</Typography>
                )}
              </Box>
            </StyledPaper>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, mb: 4 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={generatingInvoice ? <CircularProgress size={20} color="inherit" /> : <ReceiptIcon />}
              size="large"
              disabled={!invoiceData.chargeData?.length || generatingInvoice}
              onClick={handleGenerateInvoice}
              sx={{ minWidth: 200 }}
            >
              {generatingInvoice ? 'Generating...' : 'Generate Invoice'}
            </Button>
          </Box>

          {invoice && (
            <Box mt={4}>
              <Typography variant="h5" gutterBottom>
                Generated Invoice
              </Typography>
              <InvoiceTemplate 
                invoice={invoice}
                onPrint={handlePrintInvoice}
                onDownload={handleDownloadPdf}
              />
            </Box>
          )}
        </>
      )}
    </PageWrapper>
  );
};

export default InvoicePage;
