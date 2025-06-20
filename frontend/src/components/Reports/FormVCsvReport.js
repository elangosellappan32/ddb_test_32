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
          'Permitted consumption with 0% variation',
          'Permitted consumption with -10% variation',
          'Permitted consumption with +10% variation',
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
        
        // Add auxiliary consumption as first row
        const auxiliaryRow = [
          '', // Empty for Sl.No.
          'Annual Auxiliary Consumption (MUs)', // Description
          '', '', '', '', // Empty for other columns
          formatNumber(totalAuxiliary, 0), // Auxiliary value
          '', '', '', '', '', '', '' // Empty for remaining columns
        ];
        csvContent += auxiliaryRow.join(',') + '\n\n';

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

          // Add row with proper formatting for pro-rata column (skip auxiliary column)
          const row = [
            index + 1,
            `"${site.siteName || site.name || 'Unnamed Site'}"`,
            formatNumber(equityShares, 0),
            formatPercentage(ownership / 100), // Convert from percentage to decimal
            'minimum 51%', // Fixed text for pro rata basis column
            formatNumber(generation, 0),
            '', // Empty for auxiliary column (shown at top)
            formatNumber(criteria, 0),
            formatNumber(permittedWithZero, 0),
            formatNumber(permittedMinus10, 0),
            formatNumber(permittedPlus10, 0),
            formatNumber(actual, 0),
            `"${normsMet}"`
          ];
          csvContent += row.join(',') + '\n';
        });

        // Add totals row with proper alignment
        const avgOwnership = siteMetrics.length > 0 ? totalOwnership / siteMetrics.length : 0;
        
        const totalRow = [
          'Total',
          '',
          formatNumber(totalEquityShares, 0),
          formatPercentage(avgOwnership / 100), // Show average ownership
          '', // Empty for pro-rata column in total row
          formatNumber(totalGeneration, 0),
          '', // Empty for auxiliary column (shown at top)
          formatNumber(totalCriteria, 0),
          formatNumber(totalPermittedWithZero, 0),
          formatNumber(totalPermittedMinus10, 0),
          formatNumber(totalPermittedPlus10, 0),
          formatNumber(totalActual, 0),
          '' // Empty for norms met column
        ];
        csvContent += totalRow.join(',') + '\n';

      } else {
        // --- Form V-A ---
        csvContent = 'FORMAT V-A\n';
        csvContent += `Financial Year: ${financialYear}\n\n`;
        
        // Headers
        csvContent += 'Sl. No.,Particulars,Energy in Units\n';
        
        // Data rows
        const rows = [
          { 
            id: 1, 
            particulars: 'Total Generated units of a generating plant / Station identified for captive use',
            value: formatNumber(data.totalGeneratedUnits || 0, 0)
          },
          { 
            id: 2, 
            particulars: 'Less : Auxiliary Consumption in the above in units',
            value: formatNumber(data.auxiliaryConsumption || 0, 0)
          },
          { 
            id: 3, 
            particulars: 'Net units available for captive consumption (Aggregate generation for captive use)',
            value: formatNumber(data.aggregateGeneration || 0, 0)
          },
          { 
            id: 4, 
            particulars: '51% of aggregate generation available for captive consumption in units',
            value: formatNumber(data.percentage51 || 0, 0)
          },
          { 
            id: 5, 
            particulars: 'Actual Adjusted / Consumed units by the captive users',
            value: formatNumber(data.totalAllocatedUnits || 0, 0)
          },
          { 
            id: 6, 
            particulars: 'Percentage of actual adjusted / consumed units by the captive users with respect to aggregate generation for captive use',
            value: formatPercentage((data.percentageAdjusted || 0) / 100) // Convert from decimal to percentage
          }
        ];
        
        // Add data rows to CSV
        rows.forEach(row => {
          csvContent += [
            row.id,
            `"${row.particulars}"`,
            row.value
          ].join(',') + '\n';
        });
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
