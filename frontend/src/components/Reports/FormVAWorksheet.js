import * as XLSX from 'xlsx';
import { getCellStyle } from '../../utils/excelUtils';

export const createFormVAWorksheet = (workbook, apiResponse, financialYear) => {
  try {
    // Validate the API response structure
    if (!apiResponse || !apiResponse.success || !apiResponse.data) {
      console.error('Invalid API response structure for Form V-A');
      throw new Error('Invalid or empty response from Form V-A API');
    }

    const formData = apiResponse.data;
    // Log incoming data for debugging
    console.log('Incoming Form V-A Data:', formData);

    // Process numeric values with validation
    const totalGenerated = formData.totalGeneratedUnits != null ? parseFloat(formData.totalGeneratedUnits) : null;
    const auxiliaryConsumption = formData.auxiliaryConsumption != null ? parseFloat(formData.auxiliaryConsumption) : null;
    const aggregateGeneration = formData.aggregateGeneration != null ? parseFloat(formData.aggregateGeneration) : null;
    const fiftyOnePercent = formData.percentage51 != null ? parseFloat(formData.percentage51) : null;
    const actualConsumed = formData.totalAllocatedUnits != null ? parseFloat(formData.totalAllocatedUnits) : null;
    const consumptionPercentage = formData.percentageAdjusted != null ? parseFloat(formData.percentageAdjusted) : null;

    // Validate that we have all required data
    const requiredFields = [
      { value: totalGenerated, name: 'totalGeneratedUnits' },
      { value: auxiliaryConsumption, name: 'auxiliaryConsumption' },
      { value: aggregateGeneration, name: 'aggregateGeneration' },
      { value: fiftyOnePercent, name: 'percentage51' },
      { value: actualConsumed, name: 'totalAllocatedUnits' },
      { value: consumptionPercentage, name: 'percentageAdjusted' }
    ];

    for (const field of requiredFields) {
      if (field.value === null || isNaN(field.value)) {
        throw new Error(`Missing or invalid ${field.name} value`);
      }
    }

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

    // No need to format percentage here as it will be handled by Excel formatting
    
    // Create rows with the actual data, ensuring numeric values
    const rows = [
      [1, 'Total Generated units of a generating plant / Station identified for captive use', { v: totalGenerated, t: 'n' }],
      [2, 'Less : Auxiliary Consumption in the above in units', { v: auxiliaryConsumption, t: 'n' }],
      [3, 'Net units available for captive consumption (Aggregate generation for captive use)', { v: aggregateGeneration, t: 'n' }],
      [4, '51% of aggregate generation available for captive consumption in units', { v: fiftyOnePercent, t: 'n' }],
      [5, 'Actual Adjusted / Consumed units by the captive users', { v: actualConsumed, t: 'n' }],
      [6, 'Percentage of actual adjusted / consumed units by the captive users with respect to aggregate generation for captive use', 
        { v: consumptionPercentage / 100, t: 'n', z: '0.00%' }]  // Properly format percentage
    ];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows]);

    // Set column widths
    ws['!cols'] = [
      { wch: 8 },    // Sl.No
      { wch: 80 },   // Particulars
      { wch: 20 }    // Energy in Units
    ];

    // Define merged ranges
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },  // Title
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },  // Subtitle
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }   // Financial Year
    ];

    // Apply styles to cells
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cell]) {
          ws[cell] = { v: '', t: 's' };
        }

        const isTitle = R === 0;
        const isHeader = R === 4;
        const isData = R > 4;
        const isPercentage = isData && R === range.e.r && C === 2;

        // Apply cell styles
        ws[cell].s = getCellStyle(
          isHeader,
          false,
          isTitle,
          C === 1 ? 'left' : 'center'
        );

        // Apply number formats for data cells
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
    XLSX.utils.book_append_sheet(workbook, ws, 'Form V-A');
    console.log('Form V-A worksheet created successfully');
    return true;
  } catch (error) {
    console.error('Error creating Form V-A worksheet:', error);
    return false;
  }
};
