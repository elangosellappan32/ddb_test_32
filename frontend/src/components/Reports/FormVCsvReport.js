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
        const rows = formVB.rows || [];
        const totals = formVB.totals;

        // Header rows with simulated vertical and horizontal merges
        const headerRow1 = [
          'Sl. No.',
          'Name of shareholder',
          'No. of equity shares of value Rs. /-', // spans 2 cols horizontally
          '',
          '% to be consumed on pro rata basis by each captive user',
          '100% annual generation in MUs (x)',
          'Annual Auxiliary consumption in MUs (y)', // vertical merge (rowSpan=2)
          'Generation considered to verify consumption criteria in MUs (x-y)*51%',
          'Permitted consumption as per norms in MUs', '', '',
          'Actual consumption in MUs', // vertical merge (rowSpan=2)
          'Whether consumption norms met', // vertical merge (rowSpan=2)
        ];

        const headerRow2 = [
          '',
          '',
          'As per share certificates as on 31st March',
          '% of ownership through shares in Company/unit of CGP',
          '',
          '',
          '', // empty under vertical merged "Annual Auxiliary consumption in MUs (y)"
          '',
          'With -10% variation',
          'With 0% variation',
          'With +10% variation',
          '',
          '',
        ];

        // Compose CSV content
        csvContent += `"FORMAT V-B"\r\n"Financial Year: ${financialYear}"\r\n\r\n`;
        csvContent += headerRow1.map(wrapCsvCell).join(',') + '\r\n';
        csvContent += headerRow2.map(wrapCsvCell).join(',') + '\r\n';

        // Now write all data rows with correct alignment
        rows.forEach((row, idx) => {
          // Extract and safely format values
          const slNo = row.slNo ?? idx + 1;
          const name = row.name ?? '';
          const certShares = formatNumber(row.shares?.certificates);
          const ownershipPercent = formatNumber(row.shares?.ownership, 2);
          const proRata = row.proRata ?? 'minimum 51%'; // static text or dynamic as needed
          const generation = formatNumber(row.generation);
          const auxiliary = formatNumber(row.auxiliary);
          const criteria = formatNumber(row.criteria, 2);
          const permittedMinus10 = formatNumber(row.permittedConsumption?.minus10);
          const permittedWithZero = formatNumber(row.permittedConsumption?.withZero);
          const permittedPlus10 = formatNumber(row.permittedConsumption?.plus10);
          const actual = formatNumber(row.actual);
          const norms = row.norms ?? '';

          const dataRow = [
            slNo,
            name,
            certShares,
            '', // empty cell to simulate horizontal merge for "No. of equity shares..." spanning two cols
            proRata,
            generation,
            auxiliary,
            criteria,
            permittedMinus10,
            permittedWithZero,
            permittedPlus10,
            actual,
            norms,
          ];

          csvContent += dataRow.map(wrapCsvCell).join(',') + '\r\n';
        });

        // Add totals row, aligned similarly
        if (totals) {
          const totalRow = [
            'Total',
            '',
            formatNumber(totals.shares?.certificates),
            '',
            '', // no total for proRata
            formatNumber(totals.generation),
            formatNumber(totals.auxiliary),
            formatNumber(totals.criteria, 2),
            formatNumber(totals.permittedConsumption?.minus10),
            formatNumber(totals.permittedConsumption?.withZero),
            formatNumber(totals.permittedConsumption?.plus10),
            formatNumber(totals.actual),
            totals.norms ?? '',
          ];
          csvContent += totalRow.map(wrapCsvCell).join(',') + '\r\n';
        }
      } else {
        // FORMAT V-A (simple flat structure)
        const formVA = prepareForm5AData();

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
