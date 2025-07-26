import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import { Description as CsvIcon } from '@mui/icons-material';
import { fetchFormVAData, fetchFormVBData } from '../../services/reportService';

// Helper function for safer number formatting
const formatNumber = (value, decimalPlaces = 0) => {
  if (value === null || value === undefined) return '0';
  const num = Number(value);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-IN', {
    maximumFractionDigits: decimalPlaces,
    minimumFractionDigits: decimalPlaces
  });
};

// Helper function to format percentage
const formatPercentage = (value) => {
  if (value === null || value === undefined) return '0.00%';
  const num = Number(value);
  if (isNaN(num)) return '0.00%';
  return `${num.toFixed(2)}%`;
};

const FormVCsvReport = ({ 
  downloading, 
  setDownloading, 
  isForm5B, 
  financialYear,
  showSnackbar,
  handleOpenDialog 
}) => {
  const downloadCSV = async () => {
    try {
      setDownloading(prev => ({ ...prev, csv: true }));
      
      // Fetch data directly from API based on form type
      const apiData = isForm5B 
        ? await fetchFormVBData(financialYear)
        : await fetchFormVAData(financialYear);

      if (!apiData || (isForm5B && !apiData.data) || (!isForm5B && !apiData)) {
        throw new Error('No data available for the selected financial year');
      }

      const data = isForm5B ? apiData.data : apiData;
      let csvContent = '';

      if (isForm5B) {
        // --- Form V-B ---
        csvContent = 'FORMAT V-B\n';
        csvContent += `Financial Year: ${financialYear}\n\n`;

        // Main headers with proper column alignment
        const headers = [
          'Sl. No.',
          'Name of share holder',
          'No. of equity shares of value Rs. /-',
          '% of ownership through shares in Company/unit of CGP',
          '% to be consumed on pro rata basis by each captive user',
          '100% annual generation in MUs (x)',
          'Annual Auxiliary consumption in MUs (y)',
          'Generation considered to verify consumption criteria in MUs (x-y)*51%',
          'Permitted consumption as per norms in MUs (with -10% variation)',
          'Permitted consumption as per norms in MUs (with 0% variation)',
          'Permitted consumption as per norms in MUs (with +10% variation)',
          'Actual consumption in MUs',
          'Whether consumption norms met'
        ];
        csvContent += headers.join(',') + '\n';

        // Process site metrics
        const siteMetrics = Array.isArray(data.siteMetrics) ? data.siteMetrics : [];
        let totalEquityShares = 0;
        let totalOwnership = 0;
        let totalGeneration = 0;
        let totalAuxiliary = 0;
        let totalCriteria = 0;
        let totalPermittedWithZero = 0;
        let totalPermittedMinus10 = 0;
        let totalPermittedPlus10 = 0;
        let totalActual = 0;
        let totalNormsMet = 0;

        // Add data rows
        siteMetrics.forEach((site, index) => {
          const equityShares = Number(site.equityShares) || 0;
          const ownership = Number(site.ownershipPercentage) || 0;
          const generation = Number(site.annualGeneration) || 0;
          const auxiliary = Number(site.auxiliaryConsumption) || 0;
          const criteria = (generation - auxiliary) * 0.51;
          const permittedWithZero = Number(site.permittedConsumption?.withZero) || 0;
          const permittedMinus10 = Number(site.permittedConsumption?.minus10) || 0;
          const permittedPlus10 = Number(site.permittedConsumption?.plus10) || 0;
          const actual = Number(site.actualConsumption) || 0;
          const normsMet = site.consumptionNormsMet ? 'Yes' : 'No';

          // Update totals
          totalEquityShares += equityShares;
          totalOwnership += ownership;
          totalGeneration += generation;
          totalAuxiliary += auxiliary;
          totalCriteria += criteria;
          totalPermittedWithZero += permittedWithZero;
          totalPermittedMinus10 += permittedMinus10;
          totalPermittedPlus10 += permittedPlus10;
          totalActual += actual;
          if (site.consumptionNormsMet) totalNormsMet += 1;

          // Add row
          const row = [
            index + 1,
            `"${site.siteName || site.name || 'Unnamed Site'}"`,
            formatNumber(equityShares, 0),
            formatPercentage(ownership), // Already a percentage
            'minimum 51%',
            formatNumber(generation, 0),
            formatNumber(auxiliary, 0),
            formatNumber(criteria, 0),
            formatNumber(permittedMinus10, 0),
            formatNumber(permittedWithZero, 0),
            formatNumber(permittedPlus10, 0),
            formatNumber(actual, 0),
            `"${normsMet}"`
          ];
          csvContent += row.join(',') + '\n';
        });

        // Add totals row with proper alignment
        const avgOwnership = siteMetrics.length > 0 ? totalOwnership / siteMetrics.length : 0;
        let allNormsMet = totalNormsMet === siteMetrics.length ? 'Yes' :
                          totalNormsMet === 0 ? 'No' : 'Partial';

        const totalRow = [
          'Total',
          '',
          formatNumber(totalEquityShares, 0),
          formatPercentage(avgOwnership), // Already a percentage
          '',
          formatNumber(totalGeneration, 0),
          formatNumber(totalAuxiliary, 0),
          formatNumber(totalCriteria, 0),
          formatNumber(totalPermittedWithZero, 0),
          formatNumber(totalPermittedMinus10, 0),
          formatNumber(totalPermittedPlus10, 0),
          formatNumber(totalActual, 0),
          `"${allNormsMet}"`
        ];
        csvContent += totalRow.join(',') + '\n';

      } else {
        // --- Form V-A ---
        // Build headers and subheaders for a structured table
        const headers = [
          ['FORMAT V-A'],
          ['Statement showing compliance to the requirement of proportionality of consumption for Captive Status'],
          [],
          [`Financial Year: ${financialYear}`],
          [],
          [
            'Sl. No.',
            'Particulars',
            'Energy in Units'
          ]
        ];
        // Data rows
        const rows = [
          [1, 'Total Generated units of a generating plant / Station identified for captive use', formatNumber(data.totalGeneratedUnits || 0, 0)],
          [2, 'Less : Auxiliary Consumption in the above in units', formatNumber(data.auxiliaryConsumption || 0, 0)],
          [3, 'Net units available for captive consumption (Aggregate generation for captive use)', formatNumber(data.aggregateGeneration || 0, 0)],
          [4, '51% of aggregate generation available for captive consumption in units', formatNumber(data.percentage51 || 0, 0)],
          [5, 'Actual Adjusted / Consumed units by the captive users', formatNumber(data.totalAllocatedUnits || 0, 0)],
          [6, 'Percentage of actual adjusted / consumed units by the captive users with respect to aggregate generation for captive use', formatPercentage((data.percentageAdjusted || 0) / 100)]
        ];
        // Combine all rows
        const allRows = [...headers, ...rows];
        // Convert to CSV string
        csvContent = allRows.map(row => row.map(cell => `"${cell ?? ''}"`).join(',')).join('\r\n');
      }
  
      // Create and trigger download
      const blob = new Blob([
        '\uFEFF', // UTF-8 BOM for Excel compatibility
        csvContent
      ], { type: 'text/csv;charset=utf-8;' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Form_V_${isForm5B ? 'B' : 'A'}_${financialYear}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showSnackbar('CSV file downloaded successfully');
    } catch (err) {
      console.error('Error downloading CSV:', err);
      handleOpenDialog({
        title: 'Download Failed',
        content: `Failed to download CSV file: ${err.message}`,
        type: 'error'
      });
      showSnackbar('Failed to download CSV file', { variant: 'error' });
    } finally {
      setDownloading(prev => ({ ...prev, csv: false }));
    }
  };

  return (
    <Button
      variant="contained"
      onClick={downloadCSV}
      startIcon={downloading.csv ? 
        <CircularProgress size={20} sx={{ color: '#fff' }} /> : 
        <CsvIcon />
      }
      disabled={downloading.csv}
      sx={{
        background: 'linear-gradient(135deg, #0288d1 0%, #03a9f4 100%)',
        '&:hover': {
          background: 'linear-gradient(135deg, #01579b 0%, #0288d1 100%)'
        }
      }}
    >
      {downloading.csv ? 'Downloading...' : 'Export to CSV'}
    </Button>
  );
};

export default FormVCsvReport;
