import * as XLSX from 'xlsx-js-style';

/**
 * Professional cell style generator with comprehensive formatting options
 * IMPORTANT: This function creates proper style objects for xlsx-js-style
 */
export function getFormVACellStyle(options = {}) {
  const {
    isTitle = false,
    isSubtitle = false,
    isHeader = false,
    isBold = false,
    isItalic = false,
    align = 'center',
    fillColor = null,
    fontSize = 11,
    borderStyle = 'thin',
    wrapText = true
  } = options;

  const style = {
    font: {
      name: 'Arial',
      bold: isTitle || isHeader || isBold,
      sz: isTitle ? 16 : isHeader ? 12 : fontSize,
      color: { rgb: isHeader ? 'FFFFFF' : '000000' },
      italic: isItalic
    },
    alignment: {
      horizontal: align,
      vertical: 'center',
      wrapText: wrapText
    },
    border: {
      top: { style: borderStyle, color: { rgb: '000000' } },
      bottom: { style: borderStyle, color: { rgb: '000000' } },
      left: { style: borderStyle, color: { rgb: '000000' } },
      right: { style: borderStyle, color: { rgb: '000000' } }
    }
  };

  // CRITICAL: Proper fill implementation for xlsx-js-style
  if (fillColor) {
    style.fill = {
      patternType: 'solid',  // This is required
      fgColor: { rgb: fillColor },
      bgColor: { rgb: fillColor }  // Both fgColor and bgColor needed
    };
  }

  return style;
}

/**
 * Safe number parser with formatting
 */
const safeParseNumber = (val, defaultValue = 0) => {
  if (val === null || val === undefined || val === '') return defaultValue;
  const num = typeof val === 'string' 
    ? parseFloat(val.replace(/[,\s]/g, '')) 
    : Number(val);
  return isNaN(num) ? defaultValue : num;
};

/**
 * Create professional Form V-A worksheet with proper header formatting and borders
 */
export const createFormVAWorksheet = (workbook, apiResponse, financialYear) => {
  console.group('Creating Professional Form V-A Worksheet');

  try {
    // Validate API response
    if (!apiResponse || !apiResponse.success) {
      throw new Error('Invalid API response');
    }

    const data = apiResponse.data || {};

    // Parse all numeric values safely
    const totalGenerated = safeParseNumber(data.totalGeneratedUnits);
    const auxiliaryConsumption = safeParseNumber(data.auxiliaryConsumption);
    const aggregateGeneration = safeParseNumber(data.aggregateGeneration);
    const fiftyOnePercent = safeParseNumber(data.percentage51);
    const actualConsumed = safeParseNumber(data.totalAllocatedUnits);
    const consumptionPercentage = safeParseNumber(data.percentageAdjusted);

    // Define worksheet structure with proper headers
    const worksheetData = [
      // Title row
      ['FORM V-A', '', ''],
      // Subtitle with proper wrapping
      ['Statement showing compliance to the requirement of minimum 51% consumption for Captive Status', '', ''],
      // Financial year
      [`Financial Year: ${financialYear}`, '', ''],
      // Empty row for spacing
      ['', '', ''],
      // Table headers
      ['Sl.No.', 'Particulars', 'Energy in Units (kWh)'],
      // Data rows
      [1, 'Total Generated units of a generating plant / Station identified for captive use', totalGenerated],
      [2, 'Less : Auxiliary Consumption in the above in units', auxiliaryConsumption],
      [3, 'Net units available for captive consumption (Aggregate generation for captive use)', aggregateGeneration],
      [4, '51% of aggregate generation available for captive consumption in units', fiftyOnePercent],
      [5, 'Actual Adjusted / Consumed units by the captive users', actualConsumed],
      [6, 'Percentage of actual adjusted / consumed units by the captive users with respect to aggregate generation for captive use', consumptionPercentage]
    ];

    // Create worksheet from array of arrays
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set optimal column widths
    ws['!cols'] = [
      { wch: 8 },   // Serial number column
      { wch: 95 },  // Particulars column (wider for better text wrapping)
      { wch: 30 }   // Energy units column
    ];

    // Get worksheet range
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Configure merged cells for headers
    ws['!merges'] = [
      // Title row merged across all columns
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      // Subtitle merged across all columns
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
      // Financial year merged across all columns
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }
    ];

    // Set row heights for better presentation
    ws['!rows'] = [
      { hpt: 35 },  // Title row
      { hpt: 50 },  // Subtitle row (taller for wrapped text)
      { hpt: 30 },  // Financial year
      { hpt: 15 },  // Empty spacer row
      { hpt: 40 },  // Header row
      { hpt: 30 },  // Data row 1
      { hpt: 30 },  // Data row 2
      { hpt: 35 },  // Data row 3 (slightly taller)
      { hpt: 35 },  // Data row 4
      { hpt: 30 },  // Data row 5
      { hpt: 45 }   // Data row 6 (tallest for long text)
    ];

    // Color scheme for professional appearance
    const colors = {
      TITLE_BLUE: '1F4E79',        // Dark blue for title
      SUBTITLE_LIGHT: 'D9E2F3',    // Light blue for subtitle
      HEADER_BLUE: '4472C4',       // Medium blue for headers
      ALT_ROW_GRAY: 'F8F9FA',      // Very light gray for alternating rows
      BORDER_DARK: '2F5597'        // Dark blue for outer borders
    };

    // CRITICAL: Apply styles to ALL cells in the range
    for (let R = 0; R <= range.e.r; R++) {
      for (let C = 0; C <= range.e.c; C++) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });

        // Initialize cell if it doesn't exist (IMPORTANT for styling)
        if (!ws[cellRef]) {
          ws[cellRef] = { v: '', t: 's' };
        }

        // Determine cell type and styling
        const isTitle = R === 0;
        const isSubtitle = R === 1 || R === 2;
        const isTableHeader = R === 4;
        const isDataRow = R > 4;
        const isParticularsColumn = C === 1;
        const isNumericColumn = C === 2;

        // Determine alignment
        let alignment = 'center';
        if (isParticularsColumn) alignment = 'left';
        if (isNumericColumn && isDataRow) alignment = 'right';

        // Apply specific formatting based on row type
        if (isTitle) {
          ws[cellRef].s = getFormVACellStyle({
            isTitle: true,
            fillColor: colors.TITLE_BLUE,
            fontSize: 16,
            borderStyle: 'thick',
            align: alignment
          });
          // Override font color for title
          ws[cellRef].s.font.color = { rgb: 'FFFFFF' };
        } 
        else if (isSubtitle) {
          ws[cellRef].s = getFormVACellStyle({
            isBold: true,
            isItalic: R === 1, // Only subtitle text is italic
            fillColor: colors.SUBTITLE_LIGHT,
            fontSize: R === 1 ? 12 : 11,
            borderStyle: 'medium',
            align: alignment
          });
        }
        else if (isTableHeader) {
          ws[cellRef].s = getFormVACellStyle({
            isHeader: true,
            fillColor: colors.HEADER_BLUE,
            fontSize: 12,
            borderStyle: 'thick',
            align: alignment
          });
        }
        else if (isDataRow) {
          // Alternating row colors for data
          const fillColor = (R % 2 === 0) ? null : colors.ALT_ROW_GRAY;
          ws[cellRef].s = getFormVACellStyle({
            fillColor: fillColor,
            fontSize: 11,
            borderStyle: 'thin',
            align: alignment
          });

          // Special formatting for numeric cells
          if (isNumericColumn) {
            // Format numbers with thousand separators
            if (R === range.e.r) {
              // Last row contains percentage
              ws[cellRef].z = '#,##0.00"%"';
            } else {
              // Other rows contain whole numbers
              ws[cellRef].z = '#,##0';
            }

            // Ensure numeric type
            ws[cellRef].t = 'n';
            if (typeof ws[cellRef].v === 'string') {
              const parsed = parseFloat(ws[cellRef].v.replace(/[,\s]/g, ''));
              if (!isNaN(parsed)) {
                ws[cellRef].v = parsed;
              }
            }
          }
        }
        else {
          // Empty row styling
          ws[cellRef].s = getFormVACellStyle({
            borderStyle: 'thin',
            align: alignment
          });
        }

        // Apply thick outer borders to the entire table
        if (R === 0 || R === range.e.r || C === 0 || C === range.e.c) {
          if (!ws[cellRef].s) ws[cellRef].s = getFormVACellStyle();
          if (!ws[cellRef].s.border) ws[cellRef].s.border = {};

          if (R === 0) ws[cellRef].s.border.top = { style: 'thick', color: { rgb: colors.BORDER_DARK } };
          if (R === range.e.r) ws[cellRef].s.border.bottom = { style: 'thick', color: { rgb: colors.BORDER_DARK } };
          if (C === 0) ws[cellRef].s.border.left = { style: 'thick', color: { rgb: colors.BORDER_DARK } };
          if (C === range.e.c) ws[cellRef].s.border.right = { style: 'thick', color: { rgb: colors.BORDER_DARK } };
        }
      }
    }

    // Configure worksheet view settings (REMOVE GRIDLINES)
    ws['!views'] = [{
      showGridLines: false,  // This removes gridlines
      showRowColHeaders: true,
      zoomScale: 100
    }];

    // Set print settings for professional output
    ws['!margins'] = {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3
    };

    // Configure page setup
    ws['!pageSetup'] = {
      paperSize: 9, // A4 paper
      orientation: 'portrait',
      scale: 100,
      fitToWidth: 1,
      fitToHeight: 0
    };

    // Add or replace worksheet in workbook
    const sheetName = 'Form V-A';
    const existingIndex = workbook.SheetNames.indexOf(sheetName);

    if (existingIndex !== -1) {
      workbook.SheetNames.splice(existingIndex, 1);
      delete workbook.Sheets[sheetName];
    }

    XLSX.utils.book_append_sheet(workbook, ws, sheetName);

    console.log('✅ Professional Form V-A worksheet created successfully');
    console.log('Features: Merged headers, professional styling, proper borders, no gridlines');
    console.groupEnd();

    return true;

  } catch (error) {
    console.error('❌ Error creating Form V-A worksheet:', error);
    console.groupEnd();
    return false;
  }
};

/**
 * Enhanced workbook creation with professional defaults
 */
export const createProfessionalWorkbook = () => {
  const workbook = XLSX.utils.book_new();

  // Set workbook properties
  workbook.Props = {
    Title: 'Form V-A Compliance Report',
    Subject: 'Captive Power Plant Compliance',
    Author: 'Energy Compliance System',
    CreatedDate: new Date(),
    Company: 'Energy Regulatory Authority'
  };

  return workbook;
};

/**
 * Export workbook with enhanced options
 */
export const exportFormVAWorkbook = (workbook, filename = 'Form_V-A_Report.xlsx') => {
  try {
    // Write workbook with optimal settings for styling
    const workbookOutput = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
      cellStyles: true,      // CRITICAL: Enable cell styles
      sheetStubs: false,
      bookSST: false,
      compression: true
    });

    // Create download blob
    const blob = new Blob([workbookOutput], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    // Trigger download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    console.log(`✅ Form V-A exported successfully as ${filename}`);
    return true;

  } catch (error) {
    console.error('❌ Error exporting Form V-A:', error);
    return false;
  }
};