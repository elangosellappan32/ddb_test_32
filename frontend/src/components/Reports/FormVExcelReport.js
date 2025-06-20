import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import { FileDownload as ExcelIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { fetchFormVAData, fetchFormVBData } from '../../services/reportService';
import { createFormVAWorksheet } from './FormVAWorksheet';
import { createFormVBWorksheet } from './FormVBWorksheet.excel';

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
      const formVAResponse = await fetchFormVAData(financialYear);
      if (!formVAResponse) {
        throw new Error('No response received from Form V-A API');
      }

      const formVAData = {
        totalGeneratedUnits: formVAResponse.totalGeneratedUnits,
        auxiliaryConsumption: formVAResponse.auxiliaryConsumption,
        aggregateGeneration: formVAResponse.aggregateGeneration,
        fiftyOnePercentGeneration: formVAResponse.percentage51,
        actualConsumedUnits: formVAResponse.totalAllocatedUnits,
        consumptionPercentage: formVAResponse.percentageConsumed
      };

      const formVACreated = await createFormVAWorksheet(workbook, formVAData, financialYear);
      if (!formVACreated) {
        throw new Error('Failed to create Form V-A worksheet');
      }

      // Handle Form V-B if enabled
      if (isForm5B) {
        const formVBResponse = await fetchFormVBData(financialYear);
        
        if (!formVBResponse?.success || !formVBResponse?.data) {
          throw new Error('Invalid Form V-B response format');
        }

        const formVBData = {
          aggregateGeneration: formVBResponse.data.aggregateGeneration,
          auxiliaryConsumption: formVBResponse.data.auxiliaryConsumption,
          totalGeneratedUnits: formVBResponse.data.totalGeneratedUnits,
          siteMetrics: formVBResponse.data.siteMetrics.map(site => ({
            ...site,
            permittedMinus10: site.permittedConsumption * 0.9,
            permittedPlus10: site.permittedConsumption * 1.1,
            consumptionNormsMet: 
              site.actualConsumption >= (site.permittedConsumption * 0.9) && 
              site.actualConsumption <= (site.permittedConsumption * 1.1)
          }))
        };

        const formVBCreated = await createFormVBWorksheet(workbook, formVBData, financialYear);
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
