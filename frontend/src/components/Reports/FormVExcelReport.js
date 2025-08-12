import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import { FileDownload as ExcelIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx-js-style';  // IMPORTANT: Use xlsx-js-style for styling
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

      // Create professional workbook with properties
      const workbook = XLSX.utils.book_new();
      workbook.Props = {
        Title: `Form V Compliance Report - ${financialYear}`,
        Subject: 'Captive Power Plant Compliance',
        Author: 'Energy Compliance System',
        CreatedDate: new Date(),
        Company: 'Energy Regulatory Authority'
      };

      // Handle Form V-A
      console.group('Processing Form V-A Data');

      try {
        const formVAResponse = await fetchFormVAData(financialYear);
        console.log('Form V-A Response:', JSON.stringify(formVAResponse, null, 2));

        // Enhanced validation for Form V-A response
        if (!formVAResponse) {
          throw new Error('No response received from Form V-A API');
        }

        if (!formVAResponse.success) {
          console.error('Form V-A API Error:', formVAResponse);
          throw new Error(`Form V-A API request failed: ${formVAResponse.message || 'Unknown error'}`);
        }

        if (!formVAResponse.data) {
          throw new Error('No data received from Form V-A API');
        }

        // Check required fields
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
          console.warn('Missing fields:', missingFields);
          // Set default values for missing fields
          missingFields.forEach(field => {
            formVAResponse.data[field] = 0;
          });
        }

        console.log('Data being passed to Form V-A worksheet:', {
          totalGeneratedUnits: formVAResponse.data.totalGeneratedUnits,
          auxiliaryConsumption: formVAResponse.data.auxiliaryConsumption,
          aggregateGeneration: formVAResponse.data.aggregateGeneration,
          percentage51: formVAResponse.data.percentage51,
          totalAllocatedUnits: formVAResponse.data.totalAllocatedUnits,
          percentageAdjusted: formVAResponse.data.percentageAdjusted
        });

        // Create Form V-A worksheet
        const formVASuccess = createFormVAWorksheet(workbook, formVAResponse, financialYear);

        if (!formVASuccess) {
          throw new Error('Failed to create Form V-A worksheet');
        }

        console.log('✅ Form V-A worksheet created successfully');

      } catch (formVAError) {
        console.error('Form V-A Error:', formVAError);
        showSnackbar(`Form V-A Error: ${formVAError.message}`, 'warning');

        // Create empty Form V-A with error message
        const emptyFormVAData = {
          success: true,
          data: {
            totalGeneratedUnits: 0,
            auxiliaryConsumption: 0,
            aggregateGeneration: 0,
            percentage51: 0,
            totalAllocatedUnits: 0,
            percentageAdjusted: 0
          }
        };

        createFormVAWorksheet(workbook, emptyFormVAData, financialYear);
        console.log('Created empty Form V-A worksheet due to data error');
      }

      console.groupEnd();

      // Handle Form V-B if enabled
      if (isForm5B) {
        console.group('Processing Form V-B Data');

        try {
          const formVBResponse = await fetchFormVBData(financialYear);
          console.log('Form V-B Response:', JSON.stringify(formVBResponse, null, 2));

          if (!formVBResponse?.success || !formVBResponse?.data) {
            throw new Error('Invalid Form V-B response format');
          }

          // Validate Form V-B data structure
          if (!formVBResponse.data.siteMetrics || !Array.isArray(formVBResponse.data.siteMetrics)) {
            throw new Error('No site metrics data available in Form V-B response');
          }

          if (formVBResponse.data.siteMetrics.length === 0) {
            throw new Error('Site metrics array is empty');
          }

          console.log('Form V-B site metrics count:', formVBResponse.data.siteMetrics.length);

          // Create Form V-B worksheet
          const formVBCreated = createFormVBWorksheet(workbook, formVBResponse.data, financialYear);

          if (!formVBCreated) {
            throw new Error('Failed to create Form V-B worksheet');
          }

          console.log('✅ Form V-B worksheet created successfully');

        } catch (formVBError) {
          console.error('Form V-B Error:', formVBError);
          showSnackbar(`Form V-B Error: ${formVBError.message}`, 'warning');

          // Create empty Form V-B with sample data
          const emptyFormVBData = {
            siteMetrics: [{
              siteName: 'No Data Available',
              equityShares: 0,
              ownershipPercentage: 0,
              annualGeneration: 0,
              auxiliaryConsumption: 0,
              actualConsumption: 0,
              consumptionNormsMet: false,
              permittedConsumption: {
                withZero: 0,
                minus10: 0,
                plus10: 0
              }
            }]
          };

          createFormVBWorksheet(workbook, emptyFormVBData, financialYear);
          console.log('Created empty Form V-B worksheet due to data error');
        }

        console.groupEnd();
      }

      // Generate and download Excel file with proper styling
      console.group('Generating Excel File');

      try {
        const excelBuffer = XLSX.write(workbook, {
          bookType: 'xlsx',
          type: 'array',
          cellStyles: true,  // CRITICAL: Enable styling
          bookSST: true,     // Optimize for shared strings
          compression: true   // Enable compression
        });

        const blob = new Blob([excelBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `FormV_Report_${financialYear}.xlsx`;

        // Ensure link is added to DOM for some browsers
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL
        window.URL.revokeObjectURL(url);

        console.log(`✅ Excel file generated successfully: FormV_Report_${financialYear}.xlsx`);
        showSnackbar(`Excel report for ${financialYear} downloaded successfully`, 'success');

      } catch (fileError) {
        console.error('File generation error:', fileError);
        throw new Error(`Failed to generate Excel file: ${fileError.message}`);
      }

      console.groupEnd();

    } catch (error) {
      console.error('Excel download error:', error);
      showSnackbar(`Failed to download Excel report: ${error.message}`, 'error');
    } finally {
      setDownloading(prev => ({ ...prev, excel: false }));
    }
  };

  return (
    <Button
      variant="contained"
      startIcon={downloading.excel ? <CircularProgress size={20} color="inherit" /> : <ExcelIcon />}
      onClick={downloadExcel}
      disabled={downloading.excel || !financialYear}
      sx={{
        backgroundColor: '#1976d2',
        '&:hover': {
          backgroundColor: '#1565c0',
        },
        '&.Mui-disabled': {
          backgroundColor: '#e0e0e0',
          color: '#9e9e9e',
        }
      }}
    >
      {downloading.excel ? 'Generating Excel...' : 'Download Excel Report'}
    </Button>
  );
};

export default FormVExcelReport;
