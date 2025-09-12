import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';

// Register font if needed
// Font.register({ family: 'Roboto', src: '/fonts/Roboto-Regular.ttf' });

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 10,
  },
  companyInfo: {
    width: '60%',
  },
  invoiceInfo: {
    width: '35%',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 5,
  },
  status: {
    fontSize: 12,
    padding: 5,
    backgroundColor: '#FFE57F',
    color: '#5D4037',
    borderRadius: 3,
    marginBottom: 10,
    textAlign: 'center',
  },
  clientInfo: {
    marginVertical: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 5,
  },
  table: {
    display: 'table',
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginTop: 20,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableCol: {
    borderStyle: 'solid',
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },
  tableHeader: {
    backgroundColor: '#F5F5F5',
    padding: 5,
    fontWeight: 'bold',
  },
  tableCell: {
    padding: 5,
    fontSize: 10,
  },
  summary: {
    marginTop: 20,
    alignSelf: 'flex-end',
    width: '40%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 10,
    color: '#999999',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 10,
  },
});

// Create Document Component
const InvoicePDF = ({ invoice }) => {
  if (!invoice) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return dateString ? format(new Date(dateString), 'dd MMM yyyy') : '';
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Text style={styles.title}>{invoice.company?.name || 'Your Company'}</Text>
            <Text style={styles.subtitle}>{invoice.company?.address?.line1 || '123 Business Street'}</Text>
            <Text style={styles.subtitle}>
              {invoice.company?.address?.city || 'City'}, {invoice.company?.address?.state || 'State'} {invoice.company?.address?.pincode || '123456'}
            </Text>
            <Text style={styles.subtitle}>GSTIN: {invoice.company?.gstin || '22XXXXX0000X1Z5'}</Text>
          </View>
          <View style={styles.invoiceInfo}>
            <Text style={{...styles.title, textAlign: 'right'}}>TAX INVOICE</Text>
            <Text style={styles.status}>PENDING</Text>
            <Text style={styles.subtitle}>Invoice #: {invoice.invoiceNumber || 'INV-2023-001'}</Text>
            <Text style={styles.subtitle}>Date: {formatDate(invoice.issueDate)}</Text>
            <Text style={styles.subtitle}>Due: {formatDate(invoice.dueDate)}</Text>
          </View>
        </View>

        {/* Client Info */}
        <View style={styles.clientInfo}>
          <Text style={{fontWeight: 'bold', marginBottom: 5}}>Bill To:</Text>
          <Text>{invoice.company?.billingContact || 'Client Name'}</Text>
          <Text>{invoice.company?.billingEmail || 'client@example.com'}</Text>
        </View>

        {/* Invoice Items */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={[styles.tableRow, {backgroundColor: '#F5F5F5'}]}>
            <View style={[styles.tableCol, {width: '10%'}, styles.tableHeader]}>
              <Text>#</Text>
            </View>
            <View style={[styles.tableCol, {width: '50%'}, styles.tableHeader]}>
              <Text>Description</Text>
            </View>
            <View style={[styles.tableCol, {width: '20%'}, styles.tableHeader]}>
              <Text>Quantity</Text>
            </View>
            <View style={[styles.tableCol, {width: '20%'}, styles.tableHeader]}>
              <Text>Amount</Text>
            </View>
          </View>

          {/* Table Rows */}
          {invoice.items?.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <View style={[styles.tableCol, {width: '10%'}, styles.tableCell]}>
                <Text>{index + 1}</Text>
              </View>
              <View style={[styles.tableCol, {width: '50%'}, styles.tableCell]}>
                <Text>{item.description || 'Item ' + (index + 1)}</Text>
              </View>
              <View style={[styles.tableCol, {width: '20%'}, styles.tableCell]}>
                <Text>{item.quantity || 1}</Text>
              </View>
              <View style={[styles.tableCol, {width: '20%'}, styles.tableCell]}>
                <Text>{formatCurrency(item.amount || 0)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text>Subtotal:</Text>
            <Text>{formatCurrency(invoice.subtotal || 0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Tax (18%):</Text>
            <Text>{formatCurrency(invoice.tax || 0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Discount:</Text>
            <Text>{formatCurrency(invoice.discount || 0)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Total:</Text>
            <Text>{formatCurrency(invoice.total || 0)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business!</Text>
          <Text>For any questions, please contact: {invoice.company?.billingEmail || 'billing@example.com'}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default InvoicePDF;
