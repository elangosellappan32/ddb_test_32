import React from 'react';
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
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Print as PrintIcon, Download as DownloadIcon } from '@mui/icons-material';
import useInvoiceCalculator from './InvoiceCalculator';

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
  onDownload
}) => {
  // Use the invoice calculator hook to get all the data and utilities
  const {
    companyName,
    isLoading,
    windData,
    chargesData,
    windHeaders,
    invoiceNumber,
    formatNumber,
    formatCurrency,
    recalculateInvoice
  } = useInvoiceCalculator(billMonth);

  return (
  <StyledPaper elevation={0}>
    {/* Invoice Meta/Header */}
    <Box mb={2}>
      <Typography variant="h5" fontWeight="bold">
        {isLoading ? 'Loading...' : companyName}
      </Typography>
      <Typography variant="subtitle1">
        CC Bill Month: <b>{billMonth || 'Not Specified'}</b>
      </Typography>
    </Box>

    <Divider sx={{ my: 2 }} />

    {/* Main Allocation Table */}
    <SectionTitle variant="h6">Wind Allocation & Summary</SectionTitle>
    <TableContainer>
      <StyledTable>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Description</TableCell>
            {windHeaders.map((header, idx) => (
              <TableCell key={header} align="right">{header}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {windData.map((row, idx) => (
            <TableRow key={idx}>
              <TableCell>{row.slNo}</TableCell>
              <TableCell>{row.description}</TableCell>
              {row.values.map((val, colIdx) => (
                <TableCell key={colIdx} align="right">{formatNumber(val)}</TableCell>
              ))}
            </TableRow>
          ))}
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
            {windHeaders.map((header, idx) => (
              <TableCell key={header} align="right">{header}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {chargesData.map((row, idx) => (
            <TableRow key={idx}>
              <TableCell>{row.slNo}</TableCell>
              <TableCell>{row.description}</TableCell>
              {row.values.map((val, colIdx) => (
                <TableCell key={colIdx} align="right">{formatNumber(val)}</TableCell>
              ))}
            </TableRow>
          ))}
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
