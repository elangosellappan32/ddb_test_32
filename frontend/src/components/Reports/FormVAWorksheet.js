import * as XLSX from 'xlsx';
import { getCellStyle } from '../../utils/excelUtils';

/**
 * Safely parses a numeric value with error handling and logging
 * @param {*} value - The value to parse
 * @param {string} fieldName - Name of the field for error messages
 * @param {number} defaultValue - Default value to return if parsing fails
 * @returns {number} The parsed number or default value
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

export const createFormVAWorksheet = (workbook, apiResponse, financialYear) => {
  console.group('Creating Form V-A Worksheet');
  console.log('Input API Response:', JSON.stringify(apiResponse, null, 2));
  try {
    // Validate the API response structure
    if (!apiResponse) {
      const error = new Error('No API response received');
      console.error('Error:', error.message);
      throw error;
    }

    if (!apiResponse.success) {
      const error = new Error('API request was not successful');
      console.error('Error:', error.message, 'Response:', apiResponse);
      throw error;
    }

    const formData = apiResponse.data || {};
    console.log('Form Data:', formData);

    // Process all numeric fields with validation and proper defaults
    const totalGenerated = safeParseNumber(formData.totalGeneratedUnits, 'totalGeneratedUnits');
    const auxiliaryConsumption = safeParseNumber(formData.auxiliaryConsumption, 'auxiliaryConsumption');
    const aggregateGeneration = safeParseNumber(formData.aggregateGeneration, 'aggregateGeneration');
    const fiftyOnePercent = safeParseNumber(formData.percentage51, 'percentage51');
    const actualConsumed = safeParseNumber(formData.totalAllocatedUnits, 'totalAllocatedUnits');
    const consumptionPercentage = safeParseNumber(formData.percentageAdjusted, 'percentageAdjusted');

    // Log processed values for verification
    console.group('Processed Values:');
    console.table({
      'Total Generated': totalGenerated,
      'Auxiliary Consumption': auxiliaryConsumption,
      'Aggregate Generation': aggregateGeneration,
      '51% Value': fiftyOnePercent,
      'Actual Consumed': actualConsumed,
      'Consumption %': consumptionPercentage
    });
    console.groupEnd();

    // Log processed data for verification
    console.log('Processed Form V-A Data:', {
      totalGenerated,
      auxiliaryConsumption,
      aggregateGeneration,
      fiftyOnePercent,
      actualConsumed,
      consumptionPercentage
    });

    // Define headers and data rows
    const headers = [
      ['FORM V-A'],
      ['Statement showing compliance to the requirement of minimum 51% consumption for Captive Status'],
      [`Financial Year: ${financialYear}`],
      [],
      ['Sl.No.', 'Particulars', 'Energy in Units (kWh)']
    ];

    // Create rows with the actual data, ensuring proper numeric formatting
    const rows = [
      [
        1, 
        'Total Generated units of a generating plant / Station identified for captive use',
        totalGenerated.toLocaleString('en-IN', { maximumFractionDigits: 2 })
      ],
      [
        2, 
        'Less : Auxiliary Consumption in the above in units',
        auxiliaryConsumption.toLocaleString('en-IN', { maximumFractionDigits: 2 })
      ],
      [
        3, 
        'Net units available for captive consumption (Aggregate generation for captive use)',
        aggregateGeneration.toLocaleString('en-IN', { maximumFractionDigits: 2 })
      ],
      [
        4, 
        '51% of aggregate generation available for captive consumption in units',
        fiftyOnePercent.toLocaleString('en-IN', { maximumFractionDigits: 2 })
      ],
      [
        5, 
        'Actual Adjusted / Consumed units by the captive users',
        actualConsumed.toLocaleString('en-IN', { maximumFractionDigits: 2 })
      ],
      [
        6, 
        'Percentage of actual adjusted / consumed units by the captive users with respect to aggregate generation for captive use',
        (consumptionPercentage / 100).toLocaleString('en-IN', { style: 'percent', minimumFractionDigits: 2 })
      ]
    ];

    // Create worksheet with headers and data
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows]);

    // Set column widths for better display
    ws['!cols'] = [
      { wch: 8 },    // Sl.No
      { wch: 90 },   // Particulars (wider for better text fit)
      { wch: 25 }    // Energy in Units (wider for numbers)
    ];
    
    // Set number formats for the data cells
    const dataRows = rows.length;
    for (let i = 0; i < dataRows; i++) {
      const rowNum = headers.length + i; // Account for header rows
      const cellRef = XLSX.utils.encode_cell({ r: rowNum, c: 2 }); // Column C (0-based index 2)
      
      if (!ws[cellRef]) {
        ws[cellRef] = { t: 'n' };
      }
      
      // Apply number format based on row
      if (i < 5) { // First 5 rows are regular numbers
        ws[cellRef].z = '#,##0.00';
      } else { // Last row is percentage
        ws[cellRef].z = '0.00%';
      }
    }

    // Define merged ranges for title and headers
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },  // Title
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },  // Subtitle
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }   // Financial Year
    ];

    // Apply styles and formatting to all cells
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 0; R <= range.e.r; R++) {
      for (let C = 0; C <= range.e.c; C++) {
        const cell = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cell]) {
          ws[cell] = { v: '', t: 's' };
        }

        const isTitle = R === 0;
        const isHeader = R === 4;
        const isData = R > 4;
        const isPercentage = isData && R === 4 + rows.length - 1 && C === 2; // Last data row, third column

        // Apply cell styles
        ws[cell].s = getCellStyle(
          isHeader,
          false,
          isTitle,
          C === 1 ? 'left' : 'center'  // Left align for descriptions, center for numbers
        );

        // Apply number formatting for data cells
        if (isData && C === 2) {
          if (isPercentage) {
            ws[cell].z = '0.00%';
          } else {
            ws[cell].z = '#,##0.00';
          }
          // Ensure the cell type is number for numeric values
          if (ws[cell].v !== undefined && ws[cell].v !== '' && !isNaN(ws[cell].v)) {
            ws[cell].t = 'n';
          }
        }
      }
    }

    // Set row heights for better readability
    ws['!rows'] = [
      { hpt: 30 },  // Title
      { hpt: 45 },  // Subtitle
      { hpt: 30 },  // Financial Year
      { hpt: 15 },  // Empty row
      { hpt: 35 },  // Header row
      ...Array(rows.length).fill({ hpt: 25 }) // Data rows
    ];

    // Add worksheet to workbook
    const sheetName = 'Form V-A';
    if (workbook.SheetNames.includes(sheetName)) {
      // If sheet already exists, remove it first
      const sheetIndex = workbook.SheetNames.indexOf(sheetName);
      workbook.SheetNames.splice(sheetIndex, 1);
      delete workbook.Sheets[sheetName];
    }
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    
    // Log success and final workbook info
    console.log('Successfully created Form V-A worksheet');
    console.log('Workbook Sheet Names:', workbook.SheetNames);
    console.groupEnd();
    
    return true;
  } catch (error) {
    console.error('Error creating Form V-A worksheet:', error);
    console.groupEnd();
    return false;
  }
};
