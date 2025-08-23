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
import { Print as PrintIcon, Download as DownloadIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  margin: theme.spacing(2, 0),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[3],
  backgroundColor: theme.palette.background.paper,
  '@media print': {
    boxShadow: 'none',
    padding: 0,
  },
}));

const HeaderSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(4),
  '@media print': {
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}));

const CompanyInfo = styled(Box)(({ theme }) => ({
  '& > *': {
    marginBottom: theme.spacing(1),
  },
}));

const InvoiceInfo = styled(Box)(({ theme }) => ({
  textAlign: 'right',
  '& > *': {
    marginBottom: theme.spacing(1),
  },
  '@media print': {
    textAlign: 'left',
  },
}));

const StyledTable = styled(Table)(({ theme }) => ({
  margin: theme.spacing(3, 0),
  '& .MuiTableCell-head': {
    fontWeight: 'bold',
    backgroundColor: theme.palette.grey[100],
  },
  '& .MuiTableCell-body': {
    padding: theme.spacing(1.5, 2),
  },
}));

const TotalSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: theme.spacing(3),
  '& > div': {
    width: '100%',
    maxWidth: 300,
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

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};

const InvoiceTemplate = ({ invoice, onPrint, onDownload }) => {
  if (!invoice) return null;

  const {
    invoiceNumber,
    issueDate,
    dueDate,
    company,
    billingPeriod,
    lineItems = [],
    subtotal,
    taxAmount,
    total,
    status,
  } = invoice;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <StyledPaper elevation={0}>
      <HeaderSection>
        <CompanyInfo>
          <Typography variant="h5" fontWeight="bold">
            {company?.name || 'Company Name'}
          </Typography>
          <Typography>{company?.address?.line1 || '123 Business Street'}</Typography>
          <Typography>{company?.address?.city || 'City'}, {company?.address?.state || 'State'}</Typography>
          <Typography>{company?.address?.pincode || '123456'}</Typography>
          <Typography>GSTIN: {company?.gstin || '22AAAAA0000A1Z5'}</Typography>
        </CompanyInfo>

        <InvoiceInfo>
          <Typography variant="h5" fontWeight="bold">
            INVOICE
          </Typography>
          <Typography># {invoiceNumber || 'INV-2023-001'}</Typography>
          <Typography>
            <strong>Date:</strong> {format(new Date(issueDate), 'dd MMM yyyy')}
          </Typography>
          <Typography>
            <strong>Due Date:</strong> {format(new Date(dueDate), 'dd MMM yyyy')}
          </Typography>
          <Typography>
            <strong>Status:</strong> {status || 'Draft'}
          </Typography>
        </InvoiceInfo>
      </HeaderSection>

      <Divider sx={{ my: 3 }} />

      <Box mb={4}>
        <Typography variant="subtitle1" gutterBottom>
          <strong>Billing Period:</strong> {billingPeriod || 'January 2023'}
        </Typography>
        <Typography variant="subtitle1">
          <strong>Bill To:</strong>
        </Typography>
        <Box pl={2} mt={1}>
          <Typography>{company?.billingContact || 'Billing Contact'}</Typography>
          <Typography>{company?.billingEmail || 'billing@example.com'}</Typography>
        </Box>
      </Box>

      <TableContainer>
        <StyledTable>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Unit Price</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lineItems.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <Typography fontWeight="medium">{item.description}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {item.details}
                  </Typography>
                </TableCell>
                <TableCell align="right">{item.quantity || 1}</TableCell>
                <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                <TableCell align="right">{formatCurrency(item.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </StyledTable>
      </TableContainer>

      <TotalSection>
        <Box>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography>Subtotal:</Typography>
            <Typography>{formatCurrency(subtotal)}</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between" mb={2}>
            <Typography>Tax (18%):</Typography>
            <Typography>{formatCurrency(taxAmount)}</Typography>
          </Box>
          <Divider />
          <Box display="flex" justifyContent="space-between" mt={2}>
            <Typography variant="h6">Total:</Typography>
            <Typography variant="h6">{formatCurrency(total)}</Typography>
          </Box>
        </Box>
      </TotalSection>

      <Box mt={6} py={3} borderTop="1px solid #eee">
        <Typography variant="body2" color="textSecondary" align="center">
          Thank you for your business. Please make payment by the due date.
        </Typography>
        <Typography variant="body2" color="textSecondary" align="center" mt={1}>
          For any queries, please contact accounts@example.com
        </Typography>
      </Box>

      <ActionButtons>
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
        >
          Print Invoice
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<DownloadIcon />}
          onClick={onDownload}
        >
          Download PDF
        </Button>
      </ActionButtons>
    </StyledPaper>
  );
};

export default InvoiceTemplate;
