import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import { Description as CsvIcon } from '@mui/icons-material';

// Utility: Wrap CSV fields in double quotes, including empty strings
const wrapCsvCell = (val) => `"${val ?? ''}"`;

// Example formatting helpers
const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined) return '0';
  const num = Number(value);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

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
  handleOpenDialog,
  prepareForm5AData,
  prepareForm5BData,
}) => {
  const downloadCSV = async () => {
    try {
      setDownloading((prev) => ({ ...prev, csv: true }));

      let csvContent = '';

      if (isForm5B) {
        // Prepare FORMAT V-B data
        const formVB = prepareForm5BData();
        
        // Log the data being used
        console.log('Form V-B Data:', {
          rows: formVB.rows,
          totals: formVB.totals
        });

        // Verify data structure
        if (!formVB.rows || !Array.isArray(formVB.rows)) {
          throw new Error('Invalid data structure: rows data is missing or invalid');
        }

        const rows = formVB.rows;
        const totals = formVB.totals;

        // Log sample calculations for first row if exists
        if (rows.length > 0) {
          const sampleRow = rows[0];
          console.log('Sample Row Calculations:', {
            name: sampleRow.name,
            annualGeneration: sampleRow.generation,
            auxConsumption: sampleRow.auxiliary,
            generationCriteria: (sampleRow.generation - sampleRow.auxiliary) * 0.51,
            ownership: sampleRow.shares?.ownership,
            certificates: sampleRow.shares?.certificates
          });
        }

        // Log totals calculations
        if (totals) {
          console.log('Totals Calculations:', {
            totalGeneration: totals.generation,
            totalAuxiliary: totals.auxiliary,
            totalCriteria: (totals.generation - totals.auxiliary) * 0.51,
            totalShares: totals.shares?.certificates,
            totalOwnership: totals.shares?.ownership
          });
        }

        // Header rows
        const headerRow1 = [
          'Sl.No.',
          'Name of share holder',
          'No. of equity shares of value Rs. /-',
          '% of ownership through shares in Company/unit of CGP',
          '% to be consumed on pro rata basis by each captive user',
          '100% annual generation in MUs (x)',
          'Annual Auxiliary consumption in MUs (y)',
          'Generation considered to verify consumption criteria in MUs (x-y)*51%',
          'Permitted consumption as per norms in MUs',
          '',
          '',
          'Actual consumption in MUs',
          'Whether consumption norms met'
        ];

        const headerRow2 = [
          '',
          '',
          'As per share certificates as on 31st March',
          '',
          '',
          '',
          '',
          '',
          'with -10% variation',
          'with 0% variation',
          'with +10% variation',
          '',
          ''
        ];

        // Compose CSV content
        csvContent += `"FORMAT V-B"\r\n"Financial Year: ${financialYear}"\r\n\r\n`;
        csvContent += headerRow1.map(wrapCsvCell).join(',') + '\r\n';
        csvContent += headerRow2.map(wrapCsvCell).join(',') + '\r\n';

        // Data rows
        rows.forEach((row, idx) => {
          // Parse numeric values correctly
          const annualGeneration = Math.round(parseFloat(row.generation?.replace(/,/g, '')) || 0);
          const auxConsumption = Math.round(parseFloat(row.auxiliary?.replace(/,/g, '')) || 0);
          const generationCriteria = Math.round((annualGeneration - auxConsumption) * 0.51);
          
          // Format permitted consumption values without decimals
          const permittedMinus10 = formatNumber(Math.round(generationCriteria * 0.9));
          const permittedZero = formatNumber(generationCriteria);
          const permittedPlus10 = formatNumber(Math.round(generationCriteria * 1.1));
          
          const dataRow = [
            row.slNo,
            row.name,
            formatNumber(row.shares?.certificates),
            row.shares?.ownership || '0%',
            row.proRata || 'minimum 51%',
            formatNumber(annualGeneration),
            formatNumber(auxConsumption),
            formatNumber(generationCriteria),
            permittedMinus10,
            permittedZero,
            permittedPlus10,
            formatNumber(Math.round(parseFloat(row.actual?.replace(/,/g, '')) || 0)),
            row.norms || ''
          ];
          csvContent += dataRow.map(wrapCsvCell).join(',') + '\r\n';
        });

        // Total row
        if (totals) {
          const totalGeneration = Math.round(parseFloat(totals.generation?.replace(/,/g, '')) || 0);
          const totalAuxiliary = Math.round(parseFloat(totals.auxiliary?.replace(/,/g, '')) || 0);
          const totalCriteria = Math.round((totalGeneration - totalAuxiliary) * 0.51);
          
          const totalPermittedMinus10 = formatNumber(Math.round(totalCriteria * 0.9));
          const totalPermittedZero = formatNumber(totalCriteria);
          const totalPermittedPlus10 = formatNumber(Math.round(totalCriteria * 1.1));

          const totalRow = [
            totals.slNo || 'Total',
            '',
            formatNumber(totals.shares?.certificates),
            totals.shares?.ownership || '0%',
            '',
            formatNumber(totalGeneration),
            formatNumber(totalAuxiliary),
            formatNumber(totalCriteria),
            totalPermittedMinus10,
            totalPermittedZero,
            totalPermittedPlus10,
            formatNumber(Math.round(parseFloat(totals.actual?.replace(/,/g, '')) || 0)),
            totals.norms || ''
          ];
          csvContent += totalRow.map(wrapCsvCell).join(',') + '\r\n';
        }

        // Log formatted CSV preview
        console.log('CSV Data Preview:', {
          headers: headerRow1,
          firstRow: rows[0],
          calculatedValues: {
            generation: formatNumber(parseFloat(rows[0]?.generation?.replace(/,/g, '')), 2),
            auxiliary: formatNumber(parseFloat(rows[0]?.auxiliary?.replace(/,/g, '')), 2),
            criteria: formatNumber((parseFloat(rows[0]?.generation?.replace(/,/g, '')) - 
                      parseFloat(rows[0]?.auxiliary?.replace(/,/g, '')) * 0.51), 2)
          }
        });
      } else {
        // FORMAT V-A (simple flat structure)
        const formVA = prepareForm5AData();

        // FORMAT V-A data logging
        console.log('Form V-A Data:', formVA);

        const infoRows = [
          ['FORMAT V-A'],
          ['Statement showing compliance to requirement of proportionality of consumption for Captive Status'],
          [],
          [`Financial Year: ${financialYear}`],
          [],
          ['Sl. No.', 'Particulars', 'Energy in Units'],
        ];

        csvContent += infoRows.map(row => row.map(wrapCsvCell).join(',')).join('\r\n') + '\r\n';

        formVA.forEach((row) => {
          const slNo = row['Sl.No.'] ?? '';
          const particulars = row['Particulars'] ?? '';
          const energy = row['Energy in Units'] ?? '';
          const dataRow = [slNo, particulars, energy];
          csvContent += dataRow.map(wrapCsvCell).join(',') + '\r\n';
        });
      }

      // Create and trigger download with BOM for Excel
      const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `Form_V_${isForm5B ? 'B' : 'A'}_${financialYear}_${timestamp}.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSnackbar('CSV file downloaded successfully');
    } catch (error) {
      console.error('Error downloading CSV:', error);
      handleOpenDialog({
        title: 'Download Failed',
        content: `Failed to download CSV file: ${error.message}`,
        type: 'error',
      });
      showSnackbar('Failed to download CSV file', { variant: 'error' });
    } finally {
      setDownloading((prev) => ({ ...prev, csv: false }));
    }
  };

  return (
    <Button
      variant="contained"
      onClick={downloadCSV}
      startIcon={
        downloading.csv ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : <CsvIcon />
      }
      disabled={downloading.csv}
      sx={{
        background: 'linear-gradient(135deg, #0288d1 0%, #03a9f4 100%)',
        '&:hover': {
          background: 'linear-gradient(135deg, #01579b 0%, #0288d1 100%)',
        },
      }}
    >
      {downloading.csv ? 'Downloading...' : 'Export to CSV'}
    </Button>
  );
};

export default FormVCsvReport;