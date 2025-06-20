import * as XLSX from 'xlsx';
import { getCellStyle, toNumber } from '../../utils/excelUtils';

export const createFormVBWorksheet = (workbook, data, financialYear) => {
  try {
    if (!data?.siteMetrics?.length) {
      throw new Error('No site metrics data available for Form V-B');
    }    // Define headers
    const headers = [
      ['FORMAT V-B'],
      ['Statement showing compliance to the requirement of proportionality of consumption for Captive Status'],
      [],
      [`Financial Year: ${financialYear}`],
      [],
      // Main header row with merged cells
      [
        'Sl. No.',
        'Name of the Consumption Site',
        'No. of equity shares of value Rs. /-',
        '',
        '% to be consumed on pro rata basis by each captive user',
        '100% annual generation in MUs (x)',
        'Annual Auxiliary\nconsumption in MUs (y)',
        'Generation considered to verify\nconsumption criteria in MUs (x-y)*51%',
        'Permitted consumption as per norms in MUs',
        'Permitted consumption as per norms in MUs',
        'Permitted consumption as per norms in MUs',
        'Actual\nconsumption in MUs',
        'Whether\nconsumption\nnorms met'
      ],
      // Subheader row
      [
        '',
        '',
        'As per share certificates as on 31st March',
        '% of ownership through shares in Company/unit of CGP',
        '',
        '',
        '',
        '',
        'with 0% variation',
        '-10%',
        '+10%',
        '',
        ''
      ]
    ];


    // Process site data
    const siteRows = data.siteMetrics.map((site, index) => [
      index + 1,
      site.siteName || `Site ${index + 1}`,
      site.equityShares || 0,
      site.ownershipPercentage ? toNumber(site.ownershipPercentage) / 100 : 0,
      site.requiredConsumptionPercentage ? toNumber(site.requiredConsumptionPercentage) / 100 : 0,
      toNumber(site.annualGeneration),
      site.auxiliaryConsumption ? toNumber(site.auxiliaryConsumption) / 100 : 0,
      toNumber(site.generationForConsumption),
      toNumber(site.permittedConsumption?.withZero),
      toNumber(site.permittedConsumption?.minus10),
      toNumber(site.permittedConsumption?.plus10),
      toNumber(site.actualConsumption),
      site.consumptionNormsMet ? 'Yes' : 'No'
    ]);

    // Add totals row
    const totalsRow = [
      'Total',
      '',
      toNumber(data.totals?.totalEquityShares),
      data.totals?.totalOwnershipPercentage ? toNumber(data.totals.totalOwnershipPercentage) / 100 : 0,
      data.totals?.totalRequiredConsumptionPercentage ? toNumber(data.totals.totalRequiredConsumptionPercentage) / 100 : 0,
      toNumber(data.totals?.annualGeneration),
      data.totals?.auxiliaryConsumption ? toNumber(data.totals.auxiliaryConsumption) / 100 : 0,
      toNumber(data.totals?.generationForConsumption),
      toNumber(data.totals?.permittedConsumption?.withZero),
      toNumber(data.totals?.permittedConsumption?.minus10),
      toNumber(data.totals?.permittedConsumption?.plus10),
      toNumber(data.totals?.actualConsumption),
      ''
    ];

    // Create worksheet with headers and data
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...siteRows, totalsRow]);

    // Set column widths
    ws['!cols'] = [
      { wch: 8 },     // Sl. No.
      { wch: 40 },    // Name
      { wch: 15 },    // Equity shares
      { wch: 12 },    // Ownership %
      { wch: 12 },    // Required %
      { wch: 15 },    // Annual generation
      { wch: 12 },    // Auxiliary
      { wch: 15 },    // Net generation
      { wch: 15 },    // Base permitted
      { wch: 15 },    // Min permitted
      { wch: 15 },    // Max permitted
      { wch: 15 },    // Actual
      { wch: 12 }     // Norms met
    ];    // Define merged ranges
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },  // Title
      { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },  // Subtitle
      { s: { r: 3, c: 0 }, e: { r: 3, c: 12 } },  // Financial Year
      // Header merges
      { s: { r: 5, c: 0 }, e: { r: 6, c: 0 } },   // Sl. No.
      { s: { r: 5, c: 1 }, e: { r: 6, c: 1 } },   // Name of the Consumption Site
      { s: { r: 5, c: 2 }, e: { r: 5, c: 3 } },   // Equity Pattern
      { s: { r: 5, c: 4 }, e: { r: 6, c: 4 } },   // % of annual generation
      { s: { r: 5, c: 5 }, e: { r: 6, c: 5 } },   // 100% annual generation
      { s: { r: 5, c: 6 }, e: { r: 6, c: 6 } },   // Annual Auxiliary
      { s: { r: 5, c: 7 }, e: { r: 6, c: 7 } },   // Generation considered
      { s: { r: 5, c: 8 }, e: { r: 5, c: 10 } },  // Permitted consumption
      { s: { r: 5, c: 11 }, e: { r: 6, c: 11 } }, // Actual consumption
      { s: { r: 5, c: 12 }, e: { r: 6, c: 12 } }  // Whether norms met
    ];    // Set row heights
    ws['!rows'] = [
      { hpt: 35 },  // Title
      { hpt: 45 },  // Subtitle
      { hpt: 15 },  // Empty row
      { hpt: 30 },  // Financial year
      { hpt: 15 },  // Empty row
      { hpt: 60 },  // Main header row
      { hpt: 45 },  // Subheader row
      ...Array(siteRows.length).fill({ hpt: 25 }), // Data rows
      { hpt: 30 }   // Total row
    ];

    // Set cell alignment and text wrapping for headers
    for (let R = 5; R <= 6; R++) {
      for (let C = 0; C <= 12; C++) {
        const cell = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cell]) continue;

        // Ensure style object exists
        if (!ws[cell].s) ws[cell].s = {};
        
        // Set alignment
        ws[cell].s.alignment = {
          vertical: 'center',
          horizontal: 'center',
          wrapText: true
        };
      }
    }

    // Apply styles and number formats
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cell]) continue;        const isTitle = R === 0 || R === 1;
        const isFinancialYear = R === 3;
        const isMainHeader = R === 5;
        const isSubHeader = R === 6;
        const isData = R > 6 && R < range.e.r;
        const isTotalRow = R === range.e.r;

        // Apply basic style
        ws[cell].s = getCellStyle(
          isMainHeader || isSubHeader || isTitle || isFinancialYear,
          isTotalRow,
          R === 0,
          C === 1 ? 'left' : 'center'
        );

        // Apply special background color for permitted consumption header
        if (isMainHeader && C >= 8 && C <= 10) {
          if (!ws[cell].s.fill) ws[cell].s.fill = {};
          ws[cell].s.fill.fgColor = { rgb: 'F0F4F8' };
          ws[cell].s.fill.patternType = 'solid';
        }

        // Apply number formats for data rows
        if (isData || isTotalRow) {
          if ([3, 4, 6].includes(C)) { // Percentage columns
            ws[cell].z = '0.00%';
          } else if ([2, 5, 7, 8, 9, 10, 11].includes(C)) { // Numeric columns
            ws[cell].z = '#,##0.00';
          }
        }
      }
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, ws, 'Form V-B');
    return true;
  } catch (error) {
    console.error('Error creating Form V-B worksheet:', error);
    return false;
  }
};
