import * as XLSX from 'xlsx-js-style';

/**
 * Professional cell style generator for Form V-B with comprehensive formatting
 */
const getFormVBCellStyle = ({
  bold = false,
  center = false,
  fill = null,
  vertical = 'center',
  horizontal = 'center',
  fontSize = 11,
  borderStyle = 'thin',
  wrapText = true
} = {}) => {
  const style = {
    font: {
      bold,
      name: 'Arial',
      sz: fontSize,
      color: { rgb: '000000' }
    },
    alignment: {
      vertical,
      horizontal,
      wrapText
    },
    border: {
      top: { style: borderStyle, color: { rgb: '000000' } },
      bottom: { style: borderStyle, color: { rgb: '000000' } },
      left: { style: borderStyle, color: { rgb: '000000' } },
      right: { style: borderStyle, color: { rgb: '000000' } }
    }
  };
  if (fill) {
    style.fill = {
      patternType: 'solid',
      fgColor: { rgb: fill },
      bgColor: { rgb: fill }
    };
  }
  return style;
};

/** Safe number parser */
const num = v => {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

export function createFormVBWorksheet(workbook, data, financialYear) {
  console.group('Creating Professional Form V-B Worksheet');

  try {
    if (!data || !Array.isArray(data.siteMetrics) || !data.siteMetrics.length) {
      throw new Error('No site metrics data.');
    }

    // Pre-headers with proper structure
    const preHeaders = [
      ['FORMAT V-B', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['Statement showing compliance to the requirement of proportionality of consumption for Captive Status', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      [`Financial Year: ${financialYear}`, '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '']
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

    // Data rows — keep Yes/No exactly from API
    const rows = data.siteMetrics.map((site, i) => [
      i + 1,
      site.siteName || site.name || `Site ${i + 1}`,
      num(site.equityShares),
      ((site.ownershipPercentage ?? site.allocationPercentage ?? 0)).toFixed(0) + '%',
      'minimum 51%',
      num(site.annualGeneration),
      '', // Aux placeholder
      Math.round((num(site.annualGeneration) - num(site.auxiliaryConsumption)) * 0.51),
      '', '', '', // permitted placeholders
      num(site.actualConsumption),
      (site.consumptionNormsMet ?? site.normsCompliance) ? 'Yes' : 'No'
    ]);

    // Totals for merged cells (inserted into first data row)
    const totalAuxiliary = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.auxiliaryConsumption), 0));
    const totalPermWithZero = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.permittedConsumption?.withZero), 0));
    const totalPermMinus10 = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.permittedConsumption?.minus10), 0));
    const totalPermPlus10 = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.permittedConsumption?.plus10), 0));

    if (rows.length) {
      rows[0][6] = totalAuxiliary;
      rows[0][8] = totalPermWithZero;
      rows[0][9] = totalPermMinus10;
      rows[0][10] = totalPermPlus10;
    }

    // Numerical totals
    const totalEquityShares = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.equityShares), 0));
    const totalOwnershipAvg = data.siteMetrics.length > 0
      ? data.siteMetrics.reduce((acc, s) => acc + (num(s.ownershipPercentage ?? s.allocationPercentage) || 0), 0) / data.siteMetrics.length
      : 0;
    const totalAnnualGeneration = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.annualGeneration), 0));
    const totalGenerationForConsumption = Math.round(
      data.siteMetrics.reduce((acc, s) => acc + ((num(s.annualGeneration) - num(s.auxiliaryConsumption)) * 0.51), 0)
    );
    const totalActualConsumption = Math.round(data.siteMetrics.reduce((acc, s) => acc + num(s.actualConsumption), 0));

    // Total row compliance logic (Full if ALL Yes, otherwise Partial)
    let allYes = true;
    for (const s of data.siteMetrics) {
      const val = String(s.consumptionNormsMet ?? s.normsCompliance).toLowerCase();
      if (val !== 'yes' && val !== 'true') {
        allYes = false;
        break;
      }
    }
    const totalComplianceText = allYes ? 'Full' : 'Partial';

    // Totals row
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
      totalComplianceText
    ];

    const worksheetData = [...preHeaders, headerRow1, headerRow2, ...rows, totalsRow];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    const firstDataRow = preHeaders.length + 2;
    const lastDataRow = firstDataRow + rows.length - 1;

    // Column widths
    ws['!cols'] = [
      { wch: 7 }, { wch: 32 }, { wch: 18 }, { wch: 15 }, { wch: 19 },
      { wch: 18 }, { wch: 18 }, { wch: 23 }, { wch: 22 }, { wch: 22 },
      { wch: 22 }, { wch: 20 }, { wch: 14 }
    ];

    // Merges
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
      { s: { r: firstDataRow, c: 10 }, e: { r: lastDataRow, c: 10 } }
    ];

    // Row heights
    ws['!rows'] = [
      { hpt: 32 }, { hpt: 24 }, { hpt: 8 }, { hpt: 20 }, { hpt: 8 },
      { hpt: 28 }, { hpt: 28 },
      ...Array(rows.length).fill({ hpt: 22 }),
      { hpt: 28 }
    ];

    const colors = {
      TITLE_BLUE: '1F4E79',
      SUBTITLE_LIGHT: 'E3F2FD',
      HEADER_BLUE: '4472C4',
      ALT_ROW_GRAY: 'F8F9FA',
      TOTALS_GRAY: 'F0F4F8',
      BORDER_DARK: '2F5597',
      FULL_GREEN: '92D050',
      PARTIAL_ORANGE: 'FFC000'
    };

    const range = XLSX.utils.decode_range(ws['!ref']);
    const ownershipColIdx = 3;
    const numericCols = [2, 5, 6, 7, 8, 9, 10, 11];

    // Apply styles and compliance coloring
    for (let R = 0; R <= range.e.r; R++) {
      for (let C = 0; C <= range.e.c; C++) {
        const ref = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[ref]) ws[ref] = { v: '', t: 's' };

        const isHeaderRow = R === 5 || R === 6;
        const isDataRow = R >= firstDataRow && R < range.e.r;
        const isTotalsRow = R === range.e.r;
        const isOwnershipCol = (C === ownershipColIdx);
        const isComplianceCol = (C === range.e.c);

        if (R === 0) {
          ws[ref].s = getFormVBCellStyle({ bold: true, horizontal: 'center', fill: colors.TITLE_BLUE, fontSize: 16, borderStyle: 'thick' });
          ws[ref].s.font.color = { rgb: 'FFFFFF' };
        } else if (R === 1) {
          ws[ref].s = getFormVBCellStyle({ bold: true, horizontal: 'center', fill: colors.SUBTITLE_LIGHT, fontSize: 12, borderStyle: 'medium' });
        } else if (R === 3) {
          ws[ref].s = getFormVBCellStyle({ bold: true, horizontal: 'center', fill: colors.SUBTITLE_LIGHT, fontSize: 11, borderStyle: 'medium' });
        } else if (isHeaderRow) {
          ws[ref].s = getFormVBCellStyle({ bold: true, horizontal: 'center', fill: colors.HEADER_BLUE, borderStyle: 'thick' });
          ws[ref].s.font.color = { rgb: 'FFFFFF' };
        } else if (isTotalsRow) {
          // Right align numeric totals, center for "Total" & compliance, left for any others
          if (numericCols.includes(C)) {
            ws[ref].s = getFormVBCellStyle({
              bold: true,
              horizontal: 'right',
              vertical: 'center',
              fill: colors.TOTALS_GRAY,
              borderStyle: 'medium'
            });
            ws[ref].z = '#,##0';
            if (typeof ws[ref].v === 'number') ws[ref].v = Math.round(ws[ref].v);
          } else if (isOwnershipCol) {
            ws[ref].s = getFormVBCellStyle({
              bold: true,
              horizontal: 'right',
              vertical: 'center',
              fill: colors.TOTALS_GRAY,
              borderStyle: 'medium'
            });
            ws[ref].z = '0%';
            if (typeof ws[ref].v === 'string' && ws[ref].v.includes('%')) {
              ws[ref].v = parseFloat(ws[ref].v.replace('%', '')) / 100;
              ws[ref].t = 'n';
            }
          } else if (isComplianceCol) {
            ws[ref].s = getFormVBCellStyle({
              bold: true,
              horizontal: 'center',
              vertical: 'center',
              fill: colors.TOTALS_GRAY,
              borderStyle: 'medium'
            });
          } else {
            ws[ref].s = getFormVBCellStyle({
              bold: true,
              horizontal: C === 0 ? 'center' : 'left',
              vertical: 'center',
              fill: colors.TOTALS_GRAY,
              borderStyle: 'medium'
            });
          }
        } else if (isDataRow) {
          // Name left, ownership right, numbers right, others center
          if (isOwnershipCol) {
            ws[ref].s = getFormVBCellStyle({
              bold: false,
              horizontal: 'right',
              vertical: 'center',
              borderStyle: 'thin'
            });
            ws[ref].z = '0%';
            if (typeof ws[ref].v === 'string' && ws[ref].v.includes('%')) {
              ws[ref].v = parseFloat(ws[ref].v.replace('%', '')) / 100;
              ws[ref].t = 'n';
            }
          } else if (C === 1) {
            ws[ref].s = getFormVBCellStyle({
              bold: false,
              horizontal: 'left',
              vertical: 'center',
              borderStyle: 'thin'
            });
          } else if (numericCols.includes(C)) {
            ws[ref].s = getFormVBCellStyle({
              bold: false,
              horizontal: 'right',
              vertical: 'center',
              borderStyle: 'thin'
            });
            ws[ref].z = '#,##0';
            if (typeof ws[ref].v === 'number') ws[ref].v = Math.round(ws[ref].v);
          } else {
            ws[ref].s = getFormVBCellStyle({
              horizontal: 'center',
              vertical: 'center',
              borderStyle: 'thin'
            });
          }
        } else {
          ws[ref].s = getFormVBCellStyle({
            borderStyle: 'thin'
          });
        }

        // Color compliance column: Yes = green, No = orange, Full = green, Partial = orange
        if ((isDataRow || isTotalsRow) && isComplianceCol) {
          const val = String(ws[ref].v || '').toLowerCase();
          if ((isTotalsRow && val === 'full') || (!isTotalsRow && val === 'yes')) {
            ws[ref].s.fill = { patternType: 'solid', fgColor: { rgb: colors.FULL_GREEN }, bgColor: { rgb: colors.FULL_GREEN } };
          } else if ((isTotalsRow && val === 'partial') || (!isTotalsRow && val === 'no')) {
            ws[ref].s.fill = { patternType: 'solid', fgColor: { rgb: colors.PARTIAL_ORANGE }, bgColor: { rgb: colors.PARTIAL_ORANGE } };
          }
        }

        // Outer border thick
        if (R === 0 || R === range.e.r || C === 0 || C === range.e.c) {
          if (!ws[ref].s) ws[ref].s = getFormVBCellStyle();
          if (!ws[ref].s.border) ws[ref].s.border = {};
          if (R === 0) ws[ref].s.border.top = { style: 'thick', color: { rgb: colors.BORDER_DARK } };
          if (R === range.e.r) ws[ref].s.border.bottom = { style: 'thick', color: { rgb: colors.BORDER_DARK } };
          if (C === 0) ws[ref].s.border.left = { style: 'thick', color: { rgb: colors.BORDER_DARK } };
          if (C === range.e.c) ws[ref].s.border.right = { style: 'thick', color: { rgb: colors.BORDER_DARK } };
        }
      }
    }

    ws['!views'] = [{ showGridLines: false, showRowColHeaders: true }];
    ws['!margins'] = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };
    ws['!pageSetup'] = { paperSize: 9, orientation: 'landscape', scale: 85, fitToWidth: 1, fitToHeight: 0 };

    XLSX.utils.book_append_sheet(workbook, ws, 'Form V-B');

    console.log('✅ Professional Form V-B worksheet created successfully');
    console.groupEnd();
    return true;

  } catch (error) {
    console.error('❌ Error creating Form V-B worksheet:', error);
    console.groupEnd();
    return false;
  }
}
