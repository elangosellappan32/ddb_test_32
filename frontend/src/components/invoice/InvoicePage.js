import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Paper,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Receipt as ReceiptIcon,
  Print as PrintIcon,
  MoreVert as MoreVertIcon,
  Email as EmailIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { startOfMonth, format, parseISO, isValid } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { saveAs } from 'file-saver';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { enqueueSnackbar } from 'notistack';

import { useAuth } from '../../context/AuthContext';
import invoiceService from '../../services/invoiceService';
import api from '../../services/api';
import { API_CONFIG } from '../../config/api.config';
import InvoiceTemplate from './InvoiceTemplate';
import InvoicePDF from './InvoicePDF';
import useInvoiceCalculator from './InvoiceCalculator';

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

const LoadingBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 300,
  gap: theme.spacing(2),
}));

const InvoicePage = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const invoiceRef = useRef();
  const [anchorEl, setAnchorEl] = useState(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailData, setEmailData] = useState({ email: '', subject: '', message: '' });

  const [selectedDate, setSelectedDate] = useState(startOfMonth(new Date()));
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [siteErrorState, setSiteErrorState] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedConsumptionSite, setSelectedConsumptionSite] = useState(null);
  const [siteType, setSiteType] = useState('wind'); // Default to wind, can be made dynamic if needed

  const {
    productionSites = [],
    consumptionSites = [],
    selectedSite: propSelectedSite,
    selectedConsumptionSite: propSelectedConsumptionSite,
    onProductionSiteChange,
    onConsumptionSiteChange,
    isLoading: sitesLoading,
    siteError,
    invoiceData,
    windData = [],
    chargesData = [],
    invoiceNumber = []
  } = useInvoiceCalculator(
    format(selectedDate, 'yyyy-MM'),
    selectedSite,
    siteType,
    selectedConsumptionSite
  );

  // Update selectedSite when propSelectedSite changes
  useEffect(() => {
    if (propSelectedSite && !selectedSite) {
      setSelectedSite(propSelectedSite);
    }
  }, [propSelectedSite, selectedSite]);

  // Update selectedConsumptionSite when propSelectedConsumptionSite changes
  useEffect(() => {
    if (propSelectedConsumptionSite && !selectedConsumptionSite) {
      setSelectedConsumptionSite(propSelectedConsumptionSite);
    }
  }, [propSelectedConsumptionSite, selectedConsumptionSite]);

  // Handle menu open/close
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Handle email dialog
  const handleEmailDialogOpen = () => {
    setEmailData({
      email: user?.email || '',
      subject: `Invoice for ${format(selectedDate, 'MMMM yyyy')}`,
      message: `Please find attached the invoice for ${format(selectedDate, 'MMMM yyyy')}.\n\nBest regards,\n${user?.companyName || ''}`
    });
    setEmailDialogOpen(true);
    handleMenuClose();
  };

  const handleEmailDialogClose = () => {
    setEmailDialogOpen(false);
  };

  const handleEmailSend = async () => {
    try {
      // Implement email sending logic here
      enqueueSnackbar('Invoice sent successfully!', { variant: 'success' });
      handleEmailDialogClose();
    } catch (error) {
      enqueueSnackbar('Failed to send email: ' + error.message, { variant: 'error' });
    }
  };

  // Handle print
  const handlePrint = useReactToPrint({
    content: () => invoiceRef.current,
    pageStyle: `
      @page { 
        size: A4;
        margin: 10mm 10mm;
      }
      @media print {
        body { 
          -webkit-print-color-adjust: exact; 
        }
        .no-print { 
          display: none !important; 
        }
      }
    `,
  });

  // Handle download as PDF
  const handleDownloadPdf = () => {
    // This will be handled by the PDFDownloadLink component
    handleMenuClose();
  };

  // Fetch invoice data
  const fetchInvoice = useCallback(async (date) => {
    if (!user || !date) return;

    // Use propSelectedSite if available, otherwise use local state
    const currentSite = propSelectedSite || selectedSite;
    if (!currentSite) {
      console.log('No site selected, skipping fetch');
      return;
    }

    // Skip if we're already loading or if the date hasn't changed
    if (loading || (invoice && format(date, 'yyyy-MM') === invoice.billMonth)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const month = format(date, 'MM');
      const year = format(date, 'yyyy');
      
      // Ensure we have a selected site
      const currentSelectedSite = currentSite || (productionSites?.[0]?.id);
      if (!currentSelectedSite) {
        throw new Error('No production site available');
      }

      console.log('Generating invoice with data:', { companyId: user.companyId, month, year });
      
      // Call your invoice service to get the data
      const result = await invoiceService.generateInvoice({
        companyId: user.companyId,
        productionSiteId: currentSelectedSite,
        month,
        year,
      });

      if (result.error) throw new Error(result.error);
      
      const generatedInvoice = result.data;

      // Format the invoice data to match our template's expected format
      const formattedInvoice = {
        ...generatedInvoice,
        billMonth: `${year}-${month.padStart(2, '0')}`,
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
        billingPeriod: format(date, 'MMMM yyyy'),
        issueDate: new Date().toISOString(),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(),
      };

      setInvoice(formattedInvoice);
      enqueueSnackbar('Invoice generated successfully!', { variant: 'success' });
    } catch (err) {
      setError(err.message || 'Failed to generate invoice');
      enqueueSnackbar(err.message || 'Failed to generate invoice', { variant: 'error' });
    } finally {
      setLoading(false);
      setGeneratingInvoice(false);
    }
  }, [user, selectedSite, productionSites, loading, invoice]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login', { state: { from: location } });
    }
  }, [isAuthenticated, authLoading, navigate, location]);

  // Fetch invoice when date or selected site changes
  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated) return;
      
      try {
        const currentSite = propSelectedSite || selectedSite;
        
        if (currentSite) {
          await fetchInvoice(selectedDate);
        } else if (productionSites?.length > 0) {
          // If we have sites but none selected, select the first one
          if (typeof onProductionSiteChange === 'function') {
            onProductionSiteChange(productionSites[0].id);
          } else if (productionSites[0]?.id) {
            // Fallback: Update the selectedSite directly if possible
            setSelectedSite(productionSites[0].id);
          }
        }
      } catch (error) {
        console.error('Error in fetchData:', error);
        enqueueSnackbar('Error loading invoice data', { variant: 'error' });
      }
    };

    fetchData();
  }, [isAuthenticated, selectedDate, propSelectedSite, selectedSite, productionSites, onProductionSiteChange, fetchInvoice]);

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    // Don't fetch here, let the useEffect handle it
  };

  const handleGenerateInvoice = () => {
    setGeneratingInvoice(true);
    fetchInvoice(selectedDate);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <PageWrapper maxWidth={false}>
        <HeaderBox>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ReceiptIcon color="primary" sx={{ fontSize: 40 }} />
            <SectionTitle variant="h4">Invoice Management</SectionTitle>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  views={['year', 'month']}
                  label="Billing Period"
                  minDate={new Date('2023-01-01')}
                  maxDate={new Date()}
                  value={selectedDate}
                  onChange={handleDateChange}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      helperText={null} 
                      sx={{ minWidth: 200 }}
                    />
                  )}
                />
              </LocalizationProvider>
            </Box>
            
            <Button
              variant="contained"
              color="primary"
              onClick={handleGenerateInvoice}
              disabled={generatingInvoice || loading}
              startIcon={generatingInvoice ? <CircularProgress size={20} color="inherit" /> : <ReceiptIcon />}
            >
              {generatingInvoice ? 'Generating...' : 'Generate Invoice'}
            </Button>

            {invoice && (
              <>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleMenuOpen}
                  disabled={loading || generatingInvoice}
                  endIcon={<MoreVertIcon />}
                >
                  More
                </Button>

                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                >
                  <MenuItem onClick={handlePrint}>
                    <PrintIcon sx={{ mr: 1 }} /> Print
                  </MenuItem>
                  <PDFDownloadLink
                    document={<InvoicePDF invoice={invoice} />}
                    fileName={`invoice-${format(selectedDate, 'yyyy-MM')}.pdf`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {({ loading }) => (
                      <MenuItem onClick={handleDownloadPdf} disabled={loading}>
                        <PdfIcon sx={{ mr: 1 }} />
                        {loading ? 'Generating PDF...' : 'Download PDF'}
                      </MenuItem>
                    )}
                  </PDFDownloadLink>
                  <MenuItem onClick={handleEmailDialogOpen}>
                    <EmailIcon sx={{ mr: 1 }} /> Email Invoice
                  </MenuItem>
                </Menu>
              </>
            )}
          </Box>
        </HeaderBox>
        
        {/* Black divider line */}
        <Box sx={{ borderTop: '2px solid #000', my: 3 }} />

        {loading && (
          <LoadingBox>
            <CircularProgress />
            <Typography>Loading invoice data...</Typography>
          </LoadingBox>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <Box ref={invoiceRef}>
            <InvoiceTemplate
              billMonth={format(selectedDate, 'yyyy-MM')}
              onPrint={handlePrint}
              onDownload={handleDownloadPdf}
              invoiceData={invoiceData || invoice}
              onProductionSiteChange={(siteId) => {
                setSelectedSite(siteId);
                if (onProductionSiteChange) onProductionSiteChange(siteId);
              }}
              onConsumptionSiteChange={(siteId) => {
                setSelectedConsumptionSite(siteId);
                if (onConsumptionSiteChange) onConsumptionSiteChange(siteId);
              }}
              productionSites={productionSites}
              consumptionSites={consumptionSites}
              selectedProductionSite={selectedSite || propSelectedSite}
              selectedConsumptionSite={selectedConsumptionSite}
              isLoadingSites={sitesLoading || loading}
              siteError={siteError || error}
              windData={windData}
              chargesData={chargesData}
              invoiceNumber={invoiceNumber}
            />
          </Box>
        )}
        <Dialog open={emailDialogOpen} onClose={handleEmailDialogClose} maxWidth="sm" fullWidth>
          <DialogTitle>Email Invoice</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Email Address"
              type="email"
              fullWidth
              variant="outlined"
              value={emailData.email}
              onChange={(e) => setEmailData({ ...emailData, email: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Subject"
              type="text"
              fullWidth
              variant="outlined"
              value={emailData.subject}
              onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Message"
              multiline
              rows={6}
              fullWidth
              variant="outlined"
              value={emailData.message}
              onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleEmailDialogClose} color="primary">
              Cancel
            </Button>
            <Button onClick={handleEmailSend} color="primary" variant="contained">
              Send Email
            </Button>
          </DialogActions>
        </Dialog>
      </PageWrapper>
    </LocalizationProvider>
  );
};

export default InvoicePage;
