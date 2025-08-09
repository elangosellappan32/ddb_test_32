import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import { FileDownload as ExcelIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { fetchFormVAData, fetchFormVBData } from '../../services/reportService';
import { createFormVAWorksheet } from './FormVAWorksheet';
import { createFormVBWorksheet } from './FormVBWorksheet';


const FormVExcelReport = ({ 
  downloading,
  setDownloading,
  isForm5B,
  financialYear,
  showSnackbar
}) => {
  const downloadExcel = async () => {
    try {
      if (!financialYear) {
        throw new Error('Please select a financial year');
      }

      setDownloading(prev => ({ ...prev, excel: true }));
      showSnackbar(`Fetching data for ${financialYear}...`, 'info');

      const workbook = XLSX.utils.book_new();

      // Handle Form V-A
      console.group('Fetching Form V-A Data');
      const formVAResponse = await fetchFormVAData(financialYear);
      
      // Log the complete response for debugging
      console.log('Form V-A Response:', JSON.stringify(formVAResponse, null, 2));
      
      // Validate Form V-A response
      if (!formVAResponse) {
        const error = new Error('No response received from Form V-A API');
        console.error(error.message);
        throw error;
      }
      
      if (!formVAResponse.success) {
        const error = new Error('Form V-A API request was not successful');
        console.error(error.message, 'Response:', formVAResponse);
        throw error;
      }
      
      if (!formVAResponse.data) {
        const error = new Error('No data received from Form V-A API');
        console.error(error.message);
        throw error;
      }
      
      // Log the data being passed to the worksheet
      console.log('Data being passed to Form V-A worksheet:', JSON.stringify({
        totalGeneratedUnits: formVAResponse.data.totalGeneratedUnits,
        auxiliaryConsumption: formVAResponse.data.auxiliaryConsumption,
        aggregateGeneration: formVAResponse.data.aggregateGeneration,
        percentage51: formVAResponse.data.percentage51,
        totalAllocatedUnits: formVAResponse.data.totalAllocatedUnits,
        percentageAdjusted: formVAResponse.data.percentageAdjusted,
        hasSiteMetrics: Array.isArray(formVAResponse.data.siteMetrics)
      }, null, 2));
      
      console.groupEnd();

      const requiredFields = [
        'totalGeneratedUnits',
        'auxiliaryConsumption',
        'aggregateGeneration',
        'percentage51',
        'totalAllocatedUnits',
        'percentageAdjusted'
      ];

      const missingFields = requiredFields.filter(field => {
        const value = formVAResponse.data[field];
        return value === undefined || value === null;
      });

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields in Form V-A data: ${missingFields.join(', ')}`);
      }

      // Create Form V-A worksheet with the API response
      console.group('Creating Form V-A Worksheet');
      const formVASuccess = await createFormVAWorksheet(workbook, formVAResponse, financialYear);
      console.groupEnd();
      if (!formVASuccess) {
        const error = new Error('Failed to create Form V-A worksheet');
        console.error(error.message);
        throw error;
      }

      // Handle Form V-B if enabled
      if (isForm5B) {
        const formVBResponse = await fetchFormVBData(financialYear);
        
        if (!formVBResponse?.success || !formVBResponse?.data) {
          throw new Error('Invalid Form V-B response format');
        }

        // Validate Form V-B data
        if (!formVBResponse.data.siteMetrics || !Array.isArray(formVBResponse.data.siteMetrics)) {
          throw new Error('No site metrics data available in Form V-B response');
        }

        console.log('Form V-B data:', formVBResponse.data);

        // Create Form V-B worksheet
        const formVBCreated = await createFormVBWorksheet(workbook, formVBResponse.data, financialYear);
        if (!formVBCreated) {
          throw new Error('Failed to create Form V-B worksheet');
        }
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { 
        bookType: 'xlsx', 
        type: 'array',
        bookSST: true // Optimize for shared strings
      });

      const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);

      // Download file
      const a = document.createElement('a');
      a.href = url;
      a.download = `FormV_Report_${financialYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showSnackbar(`Excel report for ${financialYear} downloaded successfully`, 'success');
    } catch (error) {
      console.error('Error downloading Excel report:', error);
      showSnackbar(`Failed to download Excel report: ${error.message}`, 'error');
    } finally {
      setDownloading(prev => ({ ...prev, excel: false }));
    }
  };

  return (
    <div>
      <Button
        variant="contained"
        color="primary"
        onClick={downloadExcel}
        disabled={downloading.excel}
        startIcon={downloading.excel ? <CircularProgress size={20} /> : <ExcelIcon />}
      >
        {downloading.excel ? 'Downloading...' : 'Download Excel Report'}
      </Button>
    </div>
  );
};

export default FormVExcelReport;
