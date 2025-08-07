import * as XLSX from 'xlsx';

// Safe number parser
const num = v => {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

// Style helper
const getCellStyle = ({ bold = false, center = false, fill = null, vertical = 'center', horizontal = 'center' } = {}) => ({
  font: { bold, name: 'Arial' },
  alignment: {
    vertical,
    horizontal,
    wrapText: true
  },
  fill: fill ? { fgColor: { rgb: fill }, patternType: 'solid' } : undefined,
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  }
});

export function createFormVBWorksheet(workbook, data, financialYear) {
  if (!data || !Array.isArray(data.siteMetrics) || !data.siteMetrics.length) {
    throw new Error('No site metrics data.');
  }

  const preHeaders = [
    ['FORMAT V-B'],
    ['Statement showing compliance to the requirement of proportionality of consumption for Captive Status'],
    [],
    [`Financial Year: ${financialYear}`],
    []
  ];

  const headerRow1 = [
    'Sl. No.',
    'Name of Shareholder',
    'No. of equity shares of value Rs. /-',
    '',
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
    '% of ownership through shares in Company/unit of CGP',
    '',
    '',
    '',
    '',
    'with 0% variation',
    'with -10% variation',
    'with +10% variation',
    '',
    ''
  ];

  // Data rows
  const rows = data.siteMetrics.map((site, i) => [
    i + 1,
    site.siteName || site.name || `Site ${i + 1}`,
    num(site.equityShares),
    ((site.ownershipPercentage ?? site.allocationPercentage ?? 0)).toFixed(0) + '%',
    'minimum 51%',
    num(site.annualGeneration),
    '', // Auxiliary merged cell placeholder
    Math.round((num(site.annualGeneration) - num(site.auxiliaryConsumption)) * 0.51),
    '', '', '', // permitted merged placeholders
    num(site.actualConsumption),
    (site.consumptionNormsMet ?? site.normsCompliance) ? 'Yes' : 'No'
  ]);

  // Calculate totals for auxiliary and permitted consumption columns by summing siteMetrics directly
  const totalAuxiliary = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.auxiliaryConsumption), 0));
  const totalPermWithZero = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.permittedConsumption?.withZero), 0));
  const totalPermMinus10 = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.permittedConsumption?.minus10), 0));
  const totalPermPlus10 = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.permittedConsumption?.plus10), 0));

  // Fill merged cells only at first data row
  if (rows.length) {
    rows[0][6] = totalAuxiliary;
    rows[0][8] = totalPermWithZero;
    rows[0][9] = totalPermMinus10;
    rows[0][10] = totalPermPlus10;
  }

  // Calculate other totals likewise from siteMetrics for accuracy
  const totalEquityShares = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.equityShares), 0));
  const totalOwnershipAvg = data.siteMetrics.length > 0 ? 
        data.siteMetrics.reduce((acc, s) => acc + (num(s.ownershipPercentage ?? s.allocationPercentage) || 0), 0) / data.siteMetrics.length : 0;
  const totalAnnualGeneration = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.annualGeneration), 0));
  const totalGenerationForConsumption = Math.round(data.siteMetrics.reduce((acc, s) => acc + ((num(s.annualGeneration) - num(s.auxiliaryConsumption)) * 0.51), 0));
  const totalActualConsumption = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.actualConsumption), 0));

  // Prepare total row with correct summed values
  const totalsRow = [
    'Total',
    '',
    totalEquityShares,
    totalOwnershipAvg.toFixed(0) + '%',
    '',
    totalAnnualGeneration,
    totalAuxiliary,
    totalGenerationForConsumption,
    totalPermWithZero,
    totalPermMinus10,
    totalPermPlus10,
    totalActualConsumption,
    ''
  ];

  const worksheetData = [...preHeaders, headerRow1, headerRow2, ...rows, totalsRow];
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  const firstDataRow = preHeaders.length + 2;
  const lastDataRow = firstDataRow + rows.length - 1;

  ws['!cols'] = [
    { wch: 7 }, { wch: 32 }, { wch: 18 }, { wch: 15 }, { wch: 19 },
    { wch: 18 }, { wch: 18 }, { wch: 23 }, { wch: 22 }, { wch: 22 },
    { wch: 22 }, { wch: 20 }, { wch: 14 }
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 12 } },

    { s: { r: 5, c: 0 }, e: { r: 6, c: 0 } },
    { s: { r: 5, c: 1 }, e: { r: 6, c: 1 } },
    { s: { r: 5, c: 2 }, e: { r: 5, c: 3 } },
    { s: { r: 5, c: 4 }, e: { r: 6, c: 4 } },
    { s: { r: 5, c: 5 }, e: { r: 6, c: 5 } },
    { s: { r: 5, c: 6 }, e: { r: 6, c: 6 } },
    { s: { r: 5, c: 7 }, e: { r: 6, c: 7 } },
    { s: { r: 5, c: 8 }, e: { r: 5, c: 10 } },
    { s: { r: 5, c: 11 }, e: { r: 6, c: 11 } },
    { s: { r: 5, c: 12 }, e: { r: 6, c: 12 } },

    { s: { r: firstDataRow, c: 6 }, e: { r: lastDataRow, c: 6 } },
    { s: { r: firstDataRow, c: 8 }, e: { r: lastDataRow, c: 8 } },
    { s: { r: firstDataRow, c: 9 }, e: { r: lastDataRow, c: 9 } },
    { s: { r: firstDataRow, c: 10 }, e: { r: lastDataRow, c: 10 } },
  ];

  ws['!rows'] = [
    { hpt: 32 }, { hpt: 24 }, { hpt: 8 }, { hpt: 20 }, { hpt: 8 },
    { hpt: 28 }, { hpt: 28 },
    ...Array(rows.length).fill({ hpt: 22 }),
    { hpt: 28 }
  ];

  const range = XLSX.utils.decode_range(ws['!ref']);
  const ownershipColIdx = 3;
  for (let R = 0; R <= range.e.r; R++) {
    for (let C = 0; C <= range.e.c; C++) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellRef]) continue;

      const isTitleRow = R < preHeaders.length;
      const isHeaderRow = R === 5 || R === 6;
      const isDataRow = R >= firstDataRow && R < range.e.r;
      const isTotalsRow = R === range.e.r;

      if (isTitleRow) {
        ws[cellRef].s = getCellStyle({ bold: true, center: true, fill: 'E3F2FD' });
      } else if (isHeaderRow) {
        ws[cellRef].s = getCellStyle({ bold: true, center: true, fill: 'F0F4F8' });
      } else if (isTotalsRow) {
        // Numeric cells bottom-right in totals row
        const isNumericColumn = [2, 5, 6, 7, 8, 9, 10, 11].includes(C);
        const isOwnershipCol = (C === ownershipColIdx);
        if (isNumericColumn) {
          ws[cellRef].s = getCellStyle({ bold: true, center: false, vertical: 'bottom', horizontal: 'right', fill: 'F8F9FA' });
          ws[cellRef].z = '#,##0';
          if (typeof ws[cellRef].v === 'number') ws[cellRef].v = Math.round(ws[cellRef].v);
        } else if (isOwnershipCol) {
          ws[cellRef].s = getCellStyle({ bold: true, center: false, vertical: 'bottom', horizontal: 'right', fill: 'F8F9FA' });
          ws[cellRef].z = '0%';
          if (typeof ws[cellRef].v === 'string' && ws[cellRef].v.includes('%')) {
            ws[cellRef].v = parseFloat(ws[cellRef].v.replace('%', '')) / 100;
            ws[cellRef].t = 'n';
          }
        } else {
          ws[cellRef].s = getCellStyle({ bold: true, center: C === 0, fill: 'F8F9FA' });
          ws[cellRef].s.alignment.horizontal = C === 1 ? 'left' : (C === 0 ? 'center' : 'left');
          ws[cellRef].s.alignment.vertical = 'bottom';
        }
      } else if (isDataRow) {
        const isNameCol = C === 1;
        const isOwnershipColData = C === ownershipColIdx;
        if (isOwnershipColData) {
          ws[cellRef].s = getCellStyle({ bold: false, center: false, vertical: 'bottom', horizontal: 'right' });
          ws[cellRef].z = '0%';
          if (typeof ws[cellRef].v === 'string' && ws[cellRef].v.includes('%')) {
            ws[cellRef].v = parseFloat(ws[cellRef].v.replace('%', '')) / 100;
            ws[cellRef].t = 'n';
          }
        } else if (isNameCol) {
          ws[cellRef].s = getCellStyle({ bold: false, center: false, vertical: 'bottom', horizontal: 'left' });
        } else {
          ws[cellRef].s = getCellStyle({ bold: false, center: false, vertical: 'bottom', horizontal: 'right' });
          if ([2, 5, 6, 7, 8, 9, 10, 11].includes(C)) {
            ws[cellRef].z = '#,##0';
            if (typeof ws[cellRef].v === 'number') ws[cellRef].v = Math.round(ws[cellRef].v);
          }
        }
      } else {
        ws[cellRef].s = getCellStyle();
      }
    }
  }

  XLSX.utils.book_append_sheet(workbook, ws, 'Form V-B');
  return true;
}
