import * as XLSX from 'xlsx';

/**
 * Enhanced getCellStyle with styling options
 */
export function getCellStyle(isHeader, isBold, isTitle, align = 'center', fillColor = null, isItalic = false) {
  const style = {
    font: {
      bold: isTitle || isHeader || isBold,
      sz: isTitle ? 16 : isHeader ? 12 : 11,
      color: isHeader ? { rgb: 'FFFFFF' } : { rgb: '000000' },
      italic: isItalic || false
    },
    alignment: {
      horizontal: align,
      vertical: 'center',
      wrapText: true
    },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    }
  };

  if (fillColor) {
    style.fill = {
      patternType: "solid",
      fgColor: { rgb: fillColor }
    };
  }

  return style;
}

/**
 * Safely parses a numeric value with error handling and logging
 */
const safeParseNumber = (value, fieldName, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') {
    console.warn(`Warning: ${fieldName} is missing or empty, using default: ${defaultValue}`);
    return defaultValue;
  }
  const num = typeof value === 'string'
    ? parseFloat(value.replace(/,/g, ''))
    : Number(value);
  if (isNaN(num)) {
    console.warn(`Warning: ${fieldName} is not a valid number (${value}), using default: ${defaultValue}`);
    return defaultValue;
  }
  return num;
};

/**
 * Helper to create thicker black border styles for all cell edges
 */
const createBorderStyle = () => ({
  top: { style: "medium", color: { rgb: "000000" } },
  bottom: { style: "medium", color: { rgb: "000000" } },
  left: { style: "medium", color: { rgb: "000000" } },
  right: { style: "medium", color: { rgb: "000000" } },
});

export const createFormVAWorksheet = (workbook, apiResponse, financialYear) => {
  console.group('Creating Form V-A Worksheet');
  try {
    if (!apiResponse) {
      throw new Error('No API response received');
    }
    if (!apiResponse.success) {
      throw new Error('API request was not successful');
    }

    const formData = apiResponse.data || {};
    const totalGenerated = safeParseNumber(formData.totalGeneratedUnits, 'totalGeneratedUnits');
    const auxiliaryConsumption = safeParseNumber(formData.auxiliaryConsumption, 'auxiliaryConsumption');
    const aggregateGeneration = safeParseNumber(formData.aggregateGeneration, 'aggregateGeneration');
    const fiftyOnePercent = safeParseNumber(formData.percentage51, 'percentage51');
    const actualConsumed = safeParseNumber(formData.totalAllocatedUnits, 'totalAllocatedUnits');

    const rawPct = formData.percentageAdjusted;
    // Parse, but do NOT treat as percent for "Actual Adjusted / Consumed" row
    // This is just a numeric percentage value to show as a number (e.g., 24.10)
    const consumptionPercentage = typeof rawPct === 'string'
      ? parseFloat(rawPct.replace(/,/g, '')) || 0
      : safeParseNumber(rawPct, 'percentageAdjusted');

    const headers = [
      ['FORM V-A'],
      ['Statement showing compliance to the requirement of minimum 51% consumption for Captive Status'],
      [`Financial Year: ${financialYear}`],
      [],
      ['Sl.No.', 'Particulars', 'Energy in Units (kWh)']
    ];

    const rows = [
      [1, 'Total Generated units of a generating plant / Station identified for captive use', totalGenerated],
      [2, 'Less : Auxiliary Consumption in the above in units', auxiliaryConsumption],
      [3, 'Net units available for captive consumption (Aggregate generation for captive use)', aggregateGeneration],
      [4, '51% of aggregate generation available for captive consumption in units', fiftyOnePercent],
      [5, 'Actual Adjusted / Consumed units by the captive users', actualConsumed], // Integer, no decimals
      [6, 'Percentage of actual adjusted / consumed units by the captive users with respect to aggregate generation for captive use', consumptionPercentage] // Show as numeric value, no percentage symbol or decimal places
    ];

    const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows]);

    ws['!cols'] = [
      { wch: 8 },
      { wch: 90 },
      { wch: 25 }
    ];

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }
    ];

    ws['!rows'] = [
      { hpt: 30 },
      { hpt: 45 },
      { hpt: 30 },
      { hpt: 15 },
      { hpt: 35 },
      ...Array(rows.length).fill({ hpt: 25 })
    ];

    const HEADER_FILL_COLOR = '4472C4'; // Blue header background
    const TITLE_FILL_COLOR = 'D9E1F2';  // Light blue for title and subtitle
    const ALTERNATE_ROW_COLOR = 'F2F2F2'; // Light gray for alternate rows

    const range = XLSX.utils.decode_range(ws['!ref']);

    for (let R = 0; R <= range.e.r; R++) {
      for (let C = 0; C <= range.e.c; C++) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };

        const isTitle = R === 0;
        const isSubtitle = R === 1 || R === 2;
        const isHeader = R === 4;
        const isDataRow = R > 4;
        const isDescription = C === 1;
        const isRightAligned = C === 2 && isDataRow;
        const isConsumptionPercentageRow = isDataRow && R === 4 + rows.length - 1 && C === 2;
        const isActualConsumedRow = isDataRow && R === 4 + rows.length - 2 && C === 2;

        let align = 'center';
        if (isRightAligned) align = 'right';
        else if (isDescription) align = 'left';

        let fillColor = null;
        let isItalic = false;
        let isBold = false;

        if (isTitle || isSubtitle) {
          fillColor = TITLE_FILL_COLOR;
          isBold = true;
          if (isSubtitle) isItalic = true;
        } else if (isHeader) {
          fillColor = HEADER_FILL_COLOR;
          isBold = true;
        } else if (isDataRow) {
          fillColor = (R % 2 === 0) ? null : ALTERNATE_ROW_COLOR;
        }

        let style = getCellStyle(isHeader, isBold, isTitle, align, fillColor, isItalic);

        // Thick border on sheet edges
        const border = {
          top: (R === 0) ? { style: "medium", color: { rgb: "000000" } } : style.border.top,
          bottom: (R === range.e.r) ? { style: "medium", color: { rgb: "000000" } } : style.border.bottom,
          left: (C === 0) ? { style: "medium", color: { rgb: "000000" } } : style.border.left,
          right: (C === range.e.c) ? { style: "medium", color: { rgb: "000000" } } : style.border.right,
        };

        style.border = border;
        ws[cellRef].s = style;

        if (isDataRow && C === 2) {
          if (isConsumptionPercentageRow) {
            // Show as whole number (no % symbol or decimals)
            ws[cellRef].z = '#,##0';
            ws[cellRef].t = 'n';

            if (typeof ws[cellRef].v === 'string') {
              const parsed = parseFloat(ws[cellRef].v.replace(/,/g, ''));
              if (!isNaN(parsed)) ws[cellRef].v = parsed;
            }
          } else if (isActualConsumedRow) {
            // Show Actual Adjusted / Consumed units as integer without decimals
            ws[cellRef].z = '#,##0';
            ws[cellRef].t = 'n';

            if (typeof ws[cellRef].v === 'string') {
              const parsed = parseFloat(ws[cellRef].v.replace(/,/g, ''));
              if (!isNaN(parsed)) ws[cellRef].v = parsed;
            }
          } else {
            // For other numeric cells, show integers
            ws[cellRef].z = '#,##0';
            ws[cellRef].t = 'n';

            if (typeof ws[cellRef].v === 'string') {
              const parsed = parseFloat(ws[cellRef].v.replace(/,/g, ''));
              if (!isNaN(parsed)) ws[cellRef].v = parsed;
            }
          }
        }
      }
    }

    // Protect worksheet to make it read-only
    ws['!protect'] = {
      password: "protected",
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: false,
      insertHyperlinks: false,
      deleteColumns: false,
      deleteRows: false,
      sort: false,
      autoFilter: false,
      pivotTables: false,
      objects: false,
      scenarios: false,
      userInterfaceOnly: false
    };

    const sheetName = 'Form V-A';
    if (workbook.SheetNames.includes(sheetName)) {
      const idx = workbook.SheetNames.indexOf(sheetName);
      workbook.SheetNames.splice(idx, 1);
      delete workbook.Sheets[sheetName];
    }
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);

    console.log('Successfully created Form V-A worksheet');
    console.groupEnd();
    return true;

  } catch (error) {
    console.error('Error creating Form V-A worksheet:', error);
    console.groupEnd();
    return false;
  }
};
