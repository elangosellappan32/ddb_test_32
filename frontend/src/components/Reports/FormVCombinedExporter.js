import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import { FileDownload as DownloadIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { fetchFormVAData, fetchFormVBData, fetchConsumptionSites } from '../../services/reportService';

const FormVCombinedExporter = ({
  financialYear,
  showSnackbar,
  downloading,
  setDownloading,
}) => {
  const getCellStyle = (isHeader, isSummary, isTitle = false, customAlign = 'center') => ({
    border: {
      top: { style: isTitle ? 'thick' : (isHeader ? 'medium' : 'thin'), color: { rgb: '000000' } },
      bottom: { style: isTitle ? 'thick' : (isHeader || isSummary ? 'medium' : 'thin'), color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    },
    alignment: {
      wrapText: true,
      vertical: 'center',
      horizontal: customAlign,
    },
    font: {
      name: 'Arial',
      bold: isHeader || isSummary || isTitle,
      sz: isTitle ? 16 : (isHeader ? 12 : 10),
      color: { rgb: '000000' }
    },
    fill: {
      fgColor: { rgb: isTitle ? 'C0C0C0' : (isHeader ? 'D3D3D3' : (isSummary ? 'E8E8E8' : 'FFFFFF')) }, // Light grey for header, lighter for summary
      patternType: 'solid'
    }
  });
  const getFormVBCellStyle = (row, col, { isTitle, isHeader, isSubheader, isTotalRow }) => ({
    font: {
      name: 'Arial',
      sz: isTitle ? 14 : (isHeader || isSubheader ? 12 : 11),
      bold: isTitle || isHeader || isSubheader || isTotalRow,
      color: { rgb: '000000' }
    },
    fill: {
      fgColor: { 
        rgb: isTitle ? 'C0C0C0' : 
             (isHeader ? 'D3D3D3' : 
             (isSubheader ? 'F2F2F2' : 
             (isTotalRow ? 'E8E8E8' : 'FFFFFF')))
      },
      patternType: 'solid'
    },
    alignment: {
      vertical: 'center',
      horizontal: col === 1 ? 'left' : 'center',
      wrapText: true
    },
    border: {
      top: { 
        style: isTitle ? 'thick' : (isHeader || isTotalRow ? 'medium' : 'thin'),
        color: { rgb: '000000' }
      },
      bottom: { 
        style: isTitle ? 'thick' : (isHeader || isTotalRow ? 'medium' : 'thin'),
        color: { rgb: '000000' }
      },
      left: { 
        style: col === 0 || isTitle ? 'medium' : 'thin',
        color: { rgb: '000000' }
      },
      right: { 
        style: col === 13 || isTitle ? 'medium' : 'thin',
        color: { rgb: '000000' }
      }
    }
  });
  const formatValue = (value, decimalPlaces = 2, isPercentage = false) => {
    const num = Number(value);
    if (isNaN(num)) {
      return isPercentage ? '0.00%' : '0.00';
    }
    const formattedNum = num.toFixed(decimalPlaces);
    return isPercentage ? `${formattedNum}%` : formattedNum;
  };
  
  const formatSiteName = (site) => {
    if (!site?.consumptionSite) return 'N/A';

    const {
      companyName,
      name: siteName,
      consumerNumber,
      location,
      state
    } = site.consumptionSite;

    const parts = [];
    if (companyName) parts.push(companyName);
    if (siteName) parts.push(siteName);
    
    const locationParts = [];
    if (location) locationParts.push(location);
    if (state) locationParts.push(state);
    if (locationParts.length > 0) parts.push(locationParts.join(', '));
    
    if (consumerNumber) parts.push(`(HT No: ${consumerNumber})`);

    return parts.join(' - ') || 'N/A';
  };

  const downloadCombinedReport = async () => {
    if (!financialYear) {
      showSnackbar({ message: 'Please select a financial year.', severity: 'warning' });
      return;
    }

    try {
      setDownloading(prev => ({ ...prev, combined: true }));

      // Fetch all required data in parallel
      const [formVAResponse, formVBResponse, consumptionSitesResponse] = await Promise.all([
        fetchFormVAData(financialYear),
        fetchFormVBData(financialYear),
        fetchConsumptionSites() // Add this API call to fetch consumption sites
      ]);

      // Validate responses
      if (!formVAResponse?.data || !formVBResponse?.data?.siteMetrics) {
        throw new Error('Required data is not available');
      }

      // Create a map of consumption sites for quick lookup
      const consumptionSitesMap = new Map(
        consumptionSitesResponse.data.map(site => [site.id, site])
      );

      // Enhance Form V-B data with consumption site details
      const enhancedSiteMetrics = formVBResponse.data.siteMetrics.map(metric => ({
        ...metric,
        consumptionSite: consumptionSitesMap.get(metric.consumptionSiteId)
      }));

      // Update the formVBData with enhanced metrics
      const formVBData = {
        ...formVBResponse.data,
        siteMetrics: enhancedSiteMetrics
      };

      const wb = XLSX.utils.book_new();

      // --- Prepare Form V-A Sheet ---
      const vaData = Array.isArray(formVAResponse.data) ? formVAResponse.data[0] : formVAResponse.data;
      
      // Validate Form V-A data
      if (!vaData) {
        throw new Error('Form V-A data is missing or invalid');
      }

      const formVADataPrepared = [
        { 
          'Sl.No.': 1, 
          'Particulars': 'Total Generated units of a generating plant / Station identified for captive use', 
          'Energy in Units': parseFloat(formatValue(vaData?.totalGeneratedUnits || 0)) 
        },
        { 
          'Sl.No.': 2, 
          'Particulars': 'Less : Auxiliary Consumption in the above in units', 
          'Energy in Units': parseFloat(formatValue(vaData?.auxiliaryConsumption || 0)) 
        },
        { 
          'Sl.No.': 3, 
          'Particulars': 'Net units available for captive consumption (Aggregate generation for captive use)', 
          'Energy in Units': parseFloat(formatValue(vaData?.aggregateGeneration || 0)) 
        },
        { 
          'Sl.No.': 4, 
          'Particulars': '51% of aggregate generation available for captive consumption in units', 
          'Energy in Units': parseFloat(formatValue(vaData?.fiftyOnePercentGeneration || 0)) 
        },
        { 
          'Sl.No.': 5, 
          'Particulars': 'Actual Adjusted / Consumed units by the captive users', 
          'Energy in Units': parseFloat(formatValue(vaData?.actualConsumedUnits || 0)) 
        },
        { 
          'Sl.No.': 6, 
          'Particulars': 'Percentage of actual adjusted / consumed units by the captive users with respect to aggregate generation for captive use', 
          'Energy in Units': formatValue(vaData?.consumptionPercentage || 0, 2, true) 
        }
      ];

      const formVASheet = XLSX.utils.json_to_sheet([]);
      
      // Add title and headers with proper styling
      XLSX.utils.sheet_add_aoa(formVASheet, [['FORM V-A']], { origin: 'A1' });
      XLSX.utils.sheet_add_aoa(formVASheet, [[`Financial Year: ${financialYear}`]], { origin: 'A2' });
      XLSX.utils.sheet_add_aoa(formVASheet, [['Sl.No.', 'Particulars', 'Energy in Units']], { origin: 'A4' });
      XLSX.utils.sheet_add_json(formVASheet, formVADataPrepared, { origin: 'A5', skipHeader: true });

      // Set column widths for better readability
      formVASheet['!cols'] = [
        { wch: 8 },  // Sl.No.
        { wch: 80 }, // Particulars
        { wch: 20 }  // Energy in Units
      ];

      // Define merged cells
      formVASheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // Title
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }  // Financial Year
      ];

      // Apply styles to Form V-A cells
      const vaRange = XLSX.utils.decode_range(formVASheet['!ref']);
      for (let R = vaRange.s.r; R <= vaRange.e.r; R++) {
        for (let C = vaRange.s.c; C <= vaRange.e.c; C++) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          
          if (!formVASheet[cellRef]) {
            formVASheet[cellRef] = { v: '', t: 's' };
          }          // Apply cell styles based on row type
          const isTitle = R === 0;
          const isHeader = R === 3;
          const isDataRow = R >= 4;

          formVASheet[cellRef].s = getCellStyle(
            isHeader,
            false,
            isTitle,
            C === 1 ? 'left' : 'center'
          );

          // Format numeric values in the last column
          if (isDataRow && C === 2) {
            if (R === vaRange.e.r) { // Last row is percentage
              formVASheet[cellRef].t = 's';
            } else {
              formVASheet[cellRef].t = 'n';
              formVASheet[cellRef].z = '#,##0.00';
            }
          }
        }
      }
      XLSX.utils.book_append_sheet(wb, formVASheet, 'Form V-A');

      // --- Prepare Form V-B Sheet ---
      const formVBData = formVBResponse.data;
      
      // Validate Form V-B data
      if (!formVBData?.siteMetrics?.length) {
        throw new Error('No site metrics found for Form V-B');
      }

      // --- Form V-B Sheet Structure ---
      const formVBHeaders = [
        ['FORM V-B'],
        ['Statement showing site-wise consumption details for verification of Captive Status'],
        [`Financial Year: ${financialYear}`],
        [], // Empty row for spacing
        [
          'Sl.\nNo.',
          'Name of the Consumption Site',
          'Equity\nShares',
          'Equity\n(%)',
          'Required\nConsumption\n(%)',
          'Required\nConsumption\n(MUs)',
          'Annual\nGeneration\n(MUs)',
          'Auxiliary\nConsumption\n(%)',
          'Net\nGeneration\n(MUs)',
          'Permitted Consumption Range (MUs)',
          'Minimum\n(-10%)',
          'Maximum\n(+10%)',
          'Actual\nConsumption\n(MUs)',
          'Status'
        ]
      ];

      // Format Form V-B site data
      const formatFormVBSite = (site, index) => {
        if (!site) return null;

        return [
          index + 1,
          formatSiteName(site),
          parseFloat(formatValue(site.equityShares || 0, 0)),
          formatValue(site.ownershipPercentage || 0, 2, true),
          formatValue(site.requiredConsumptionPercentage || 0, 2, true),
          parseFloat(formatValue(site.requiredConsumption || 0, 2)),
          parseFloat(formatValue(site.annualGeneration || 0, 2)),
          formatValue(site.auxiliaryConsumption || 0, 2, true),
          parseFloat(formatValue(site.netGeneration || 0, 2)),
          parseFloat(formatValue(site.basePermittedConsumption || 0, 2)),
          parseFloat(formatValue(site.minPermittedConsumption || 0, 2)),
          parseFloat(formatValue(site.maxPermittedConsumption || 0, 2)),
          parseFloat(formatValue(site.actualConsumption || 0, 2)),
          site.consumptionStatus || 'Not Met'
        ];
      };

      // Process site data and totals
      const formVBDataRows = formVBData.siteMetrics
        .map((site, index) => formatFormVBSite(site, index))
        .filter(Boolean);

      const formVBTotals = formVBData.totals || {};
      const totalsRowVB = [
        'Total',
        '',
        parseFloat(formatValue(formVBTotals.totalEquityShares || 0, 0)),
        formatValue(formVBTotals.totalOwnershipPercentage || 0, 2, true),
        formatValue(formVBTotals.totalRequiredConsumptionPercentage || 0, 2, true),
        parseFloat(formatValue(formVBTotals.totalRequiredConsumption || 0)),
        parseFloat(formatValue(formVBTotals.totalAnnualGeneration || 0)),
        formatValue(formVBTotals.totalAuxiliaryConsumption || 0, 2, true),
        parseFloat(formatValue(formVBTotals.totalNetGeneration || 0)),
        parseFloat(formatValue(formVBTotals.totalBasePermittedConsumption || 0)),
        parseFloat(formatValue(formVBTotals.totalMinPermittedConsumption || 0)),
        parseFloat(formatValue(formVBTotals.totalMaxPermittedConsumption || 0)),
        parseFloat(formatValue(formVBTotals.totalActualConsumption || 0)),
        ''
      ];

      // Create sheet with proper structure
      const formVBSheet = XLSX.utils.aoa_to_sheet([...formVBHeaders, ...formVBDataRows, totalsRowVB]);

      // Set optimal column widths
      formVBSheet['!cols'] = [
        { wch: 6 },     // Sl. No.
        { wch: 60 },    // Name of the Consumption Site
        { wch: 12 },    // Equity Shares
        { wch: 10 },    // Equity (%)
        { wch: 12 },    // Required Consumption (%)
        { wch: 15 },    // Required Consumption (MUs)
        { wch: 12 },    // Annual Generation
        { wch: 12 },    // Auxiliary Consumption
        { wch: 12 },    // Net Generation
        { wch: 15 },    // Base Permitted
        { wch: 12 },    // Minimum
        { wch: 12 },    // Maximum
        { wch: 12 },    // Actual Consumption
        { wch: 12 }     // Status
      ];

      // Apply styles and cell formatting
      const range = XLSX.utils.decode_range(formVBSheet['!ref']);
      
      // Set row heights
      formVBSheet['!rows'] = Array(range.e.r + 1).fill(null).map((_, idx) => ({
        hpt: idx === 0 ? 30 :    // Title row
             idx === 1 ? 40 :    // Subtitle row
             idx === 4 ? 40 :    // Header row
             idx === 5 ? 25 :    // Subheader row
             20                  // Data rows
      }));

      // Apply cell styles and number formatting
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          if (!formVBSheet[cellRef]) formVBSheet[cellRef] = { v: '', t: 's' };

          const isTitle = R === 0;
          const isHeader = R === 4;
          const isSubheader = R === 5;
          const isDataRow = R >= 6 && R < range.e.r;
          const isTotalRow = R === range.e.r;

          // Apply cell styles
          formVBSheet[cellRef].s = getFormVBCellStyle(R, C, { 
            isTitle, 
            isHeader: isHeader || isSubheader, 
            isSubheader, 
            isTotalRow 
          });

          // Apply number formats for data cells
          if (isDataRow || isTotalRow) {
            if ([3, 4, 7].includes(C)) {  // Percentage columns
              formVBSheet[cellRef].z = '0.00%';
              if (formVBSheet[cellRef].v && typeof formVBSheet[cellRef].v === 'string') {
                formVBSheet[cellRef].v = parseFloat(formVBSheet[cellRef].v.replace('%', '')) / 100;
              }
            } else if ([2, 5, 6, 8, 9, 10, 11, 12].includes(C)) {  // Number columns
              formVBSheet[cellRef].z = '#,##0.00';
              if (formVBSheet[cellRef].v && typeof formVBSheet[cellRef].v === 'string') {
                formVBSheet[cellRef].v = parseFloat(formVBSheet[cellRef].v) || 0;
              }
            }
          }
        }
      }

      // Set merged ranges for headers
      formVBSheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },  // Title
        { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },  // Subtitle
        { s: { r: 2, c: 0 }, e: { r: 2, c: 13 } },  // Financial Year
        { s: { r: 4, c: 9 }, e: { r: 4, c: 11 } }   // Permitted Consumption header
      ];

      // Add both sheets to workbook
      XLSX.utils.book_append_sheet(wb, formVASheet, 'Form V-A');
      XLSX.utils.book_append_sheet(wb, formVBSheet, 'Form V-B');

      // Save the workbook
      const filename = `FormV-Combined-${financialYear.replace('/', '-')}.xlsx`;
      XLSX.writeFile(wb, filename);

      showSnackbar({ 
        message: 'Combined Form V Excel file downloaded successfully!', 
        severity: 'success' 
      });

    } catch (error) {
      console.error('Error downloading combined Excel report:', error);
      showSnackbar({ 
        message: `Error: ${error.message || 'Could not download report. Please try again.'}`, 
        severity: 'error' 
      });
    } finally {
      setDownloading(prev => ({ ...prev, combined: false }));
    }
  };

  return (
    <Button
      variant="contained"
      color="primary"
      startIcon={<DownloadIcon />}
      onClick={downloadCombinedReport}
      disabled={downloading?.combined}
      sx={{ ml: 1 }}
    >
      {downloading?.combined ? <CircularProgress size={24} color="inherit" /> : 'Download Combined (A & B)'}
    </Button>
  );
};

export default FormVCombinedExporter;