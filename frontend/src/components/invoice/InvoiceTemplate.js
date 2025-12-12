import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  CircularProgress,
  Grid
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Print as PrintIcon, Download as DownloadIcon } from '@mui/icons-material';
import useInvoiceCalculator from './InvoiceCalculator';

// Format bill month from YYYY-MM to MMM-YYYY
const formatBillMonth = (billMonth) => {
  if (!billMonth || !billMonth.includes('-')) return billMonth || 'Not Specified';
  
  const [year, month] = billMonth.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = parseInt(month) - 1;
  
  if (monthIndex >= 0 && monthIndex < 12) {
    return `${monthNames[monthIndex]}-${year}`;
  }
  
  return billMonth;
};

// Styled components for consistent visuals
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  margin: theme.spacing(2, 0),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows,
  backgroundColor: theme.palette.background.paper,
  '@media print': {
    boxShadow: 'none',
    padding: theme.spacing(2),
  },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 'bold',
  marginBottom: theme.spacing(2),
}));

const StyledTable = styled(Table)(({ theme }) => ({
  margin: theme.spacing(2, 0),
  '& .MuiTableCell-head': {
    fontWeight: 'bold',
    backgroundColor: theme.palette.grey,
  },
}));

const ActionButtons = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: theme.spacing(2),
  marginTop: theme.spacing(4),
  '@media print': {
    display: 'none',
  },
}));

// Main XLSX-like Invoice Table Component
const InvoiceTemplate = ({
  billMonth,
  onPrint,
  onDownload,
  onProductionSiteChange,
  onConsumptionSiteChange,
  productionSites = [],
  consumptionSites = [],
  selectedProductionSite = '',
  selectedConsumptionSite = '',
  isLoadingSites = false,
  siteError = null,
  invoiceData = {}
}) => {
  const [expandedCharges, setExpandedCharges] = useState(false);
  
  const toggleCharges = () => {
    setExpandedCharges(!expandedCharges);
  };
  // Use the invoice calculator hook to get all the data and utilities
  const {
    companyName,
    isLoading,
    windData = [],
    chargesData = [],
    windHeaders = [],
    invoiceNumber,
    formatNumber = (num) => num?.toLocaleString() || '0',
    formatCurrency = (num) => `₹${num?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    recalculateInvoice,
    productionSiteName = '',
    consumptionSiteName = '',
    siteData = {}
  } = useInvoiceCalculator(billMonth, selectedProductionSite, selectedConsumptionSite);

  // Get the selected production site name
  const getProductionSiteName = () => {
    if (productionSiteName) return productionSiteName;
    const site = productionSites.find(site => site.id === selectedProductionSite);
    return site ? `${site.name} (${site.type || 'N/A'})` : 'No site selected';
  };

  return (
    <StyledPaper elevation={0}>
      {/* Invoice Meta/Header */}
      <Box mb={2}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h5" fontWeight="bold">
              {isLoading ? 'Loading...' : companyName || 'Invoice'}
            </Typography>
            <Typography variant="subtitle1">
              Bill Month: <b>{formatBillMonth(billMonth)}</b>
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth variant="outlined" margin="normal" error={!!siteError}>
              <InputLabel id="production-site-label">Production Site</InputLabel>
              {isLoadingSites ? (
                <Box display="flex" alignItems="center" p={2}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" ml={1}>Loading production sites...</Typography>
                </Box>
              ) : (
                <Select
                  labelId="production-site-label"
                  value={selectedProductionSite || ''}
                  onChange={(e) => onProductionSiteChange?.(e.target.value)}
                  label="Production Site"
                  disabled={isLoadingSites || !productionSites?.length}
                  displayEmpty
                >
                  <MenuItem value="" disabled>
                    <em>Select a production site</em>
                  </MenuItem>
                  {productionSites?.map((site) => (
                    <MenuItem key={site.id} value={site.id}>
                      {site.name} ({site.type || 'N/A'})
                    </MenuItem>
                  ))}
                </Select>
              )}
              {siteError && <FormHelperText>{siteError}</FormHelperText>}
              {!siteError && !isLoadingSites && productionSites?.length === 0 && (
                <FormHelperText>No production sites found</FormHelperText>
              )}
            </FormControl>
          </Grid>
      </Grid>
    </Box>

    <Divider sx={{ my: 2 }} />

    {/* Main Allocation Table */}
    <SectionTitle variant="h6">Allocation & Summary</SectionTitle>
    <TableContainer>
      <StyledTable>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>
              {selectedProductionSite ? 
                getProductionSiteName()
                : 'Production Site'
              }
            </TableCell>
            {consumptionSites.map((site) => (
              <TableCell key={`consume-${site.id}`} align="right">
                {site.name}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={3 + consumptionSites.length} align="center">
                <CircularProgress />
                <Typography>Loading data...</Typography>
              </TableCell>
            </TableRow>
          ) : windData?.length > 0 ? (
            windData.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell>{row.slNo || idx + 1}</TableCell>
                <TableCell>{row.description || 'N/A'}</TableCell>
                {row.values?.map((val, colIdx) => (
                  <TableCell key={colIdx} align="right">
                    {typeof val === 'number' ? formatNumber(val) : (val === '' ? '' : val || '0')}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3 + consumptionSites.length} align="center">
                No data available
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </StyledTable>
    </TableContainer>

    <Divider sx={{ my: 2 }} />

    {/* Charges Section */}
    <SectionTitle variant="h6">Breakdown of Charges</SectionTitle>
    <TableContainer>
      <StyledTable>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>
              {selectedProductionSite ? 
                getProductionSiteName()
                : 'Production Site'
              }
            </TableCell>
            {consumptionSites.map((site) => (
              <TableCell key={`consume-charge-${site.id}`} align="right">
                {site.name}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={3 + consumptionSites.length} align="center">
                <CircularProgress />
                <Typography>Loading charges...</Typography>
              </TableCell>
            </TableRow>
          ) : chargesData?.length > 0 ? (
            <>
              {chargesData.map((row, idx) => (
                <React.Fragment key={`charge-${idx}`}>
                  <TableRow 
                    onClick={row.details ? toggleCharges : undefined}
                    sx={row.details ? { cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } } : {}}
                  >
                    <TableCell>{row.slNo || idx + 1}</TableCell>
                    <TableCell>
                      {row.details ? (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {expandedCharges ? '▼' : '▶'} {row.description}
                        </Box>
                      ) : row.description || 'N/A'}
                    </TableCell>
                    {row.values?.map((val, colIdx) => (
                      <TableCell key={`charge-val-${colIdx}`} align="right">
                        {val !== undefined && val !== null ? formatCurrency(val) : '-'}
                      </TableCell>
                    ))}
                  </TableRow>
                  
                  {/* Detailed breakdown */}
                  {expandedCharges && row.details && row.details.map((detail, detailIdx) => (
                    <TableRow key={`detail-${idx}-${detailIdx}`} sx={{ backgroundColor: 'background.default' }}>
                      <TableCell></TableCell>
                      <TableCell sx={{ pl: 4, fontStyle: 'italic' }}>
                        {detail.code} - {detail.description}
                      </TableCell>
                      <TableCell colSpan={1 + consumptionSites.length} align="right">
                        {formatCurrency(detail.amount || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </>
          ) : (
            <TableRow>
              <TableCell colSpan={3 + consumptionSites.length} align="center">
                No charges data available
              </TableCell>
            </TableRow>
          )}
          
          {/* Total Row */}
          {!isLoading && chargesData?.length > 0 && (
            <TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
              <TableCell colSpan={2} align="right">
                <strong>Total</strong>
              </TableCell>
              {[...Array(1 + consumptionSites.length)].map((_, idx) => (
                <TableCell key={`total-${idx}`} align="right">
                  <strong>
                    {formatCurrency(
                      chargesData.reduce((sum, row) => {
                        const val = row.values?.[idx];
                        return sum + (typeof val === 'number' ? val : 0);
                      }, 0)
                    )}
                  </strong>
                </TableCell>
              ))}
            </TableRow>
          )}
        </TableBody>
      </StyledTable>
    </TableContainer>

    <Divider sx={{ my: 2 }} />

    {/* Invoice Numbers and Totals */}
    <Box mt={3}>
      <Typography variant="body1"><b>Invoice Numbers:</b> {invoiceNumber.join(', ')}</Typography>
    </Box>
    <Box mt={1}>
      <Typography variant="body2" color="textSecondary">
        For full details, see corresponding sheet sections in the original invoice.
      </Typography>
    </Box>

    {/* Actions */}
    <ActionButtons>
      <Button variant="outlined" startIcon={<PrintIcon />} onClick={onPrint || window.print}>
        Print
      </Button>
      <Button variant="contained" color="primary" startIcon={<DownloadIcon />} onClick={onDownload}>
        Download PDF
      </Button>
    </ActionButtons>
  </StyledPaper>
  );
};

export default InvoiceTemplate;
