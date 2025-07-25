import * as XLSX from 'xlsx';
import { getCellStyle, toNumber } from '../../utils/excelUtils';

export const createFormVAWorksheet = (workbook, formData, financialYear) => {
  try {
    // Validate the data structure
    if (!formData) {
      console.error('No data provided for Form V-A');
      throw new Error('No data available for Form V-A');
    }

    // Process numeric values with proper validation
    const totalGenerated = toNumber(formData.totalGeneratedUnits || 0);
    const auxiliaryConsumption = toNumber(formData.auxiliaryConsumption || 0);
    const aggregateGeneration = toNumber(formData.aggregateGeneration || 0);
    const fiftyOnePercent = toNumber(formData.fiftyOnePercentGeneration || 0);
    const actualConsumed = toNumber(formData.actualConsumedUnits || 0);
    
    // Calculate consumption percentage if not provided
    let consumptionPercentage = toNumber(formData.consumptionPercentage || 0);
    if (consumptionPercentage === 0 && aggregateGeneration > 0) {
      consumptionPercentage = (actualConsumed / aggregateGeneration) * 100;
    }

    // Define headers and data rows
    const headers = [
      ['FORM V-A'],
      ['Statement showing compliance to the requirement of minimum 51% consumption for Captive Status'],
      [`Financial Year: ${financialYear}`],
      [],
      ['Sl.No.', 'Particulars', 'Energy in Units (kWh)']
    ];

    // Format percentage to 2 decimal places for display
    const formattedPercentage = parseFloat(consumptionPercentage.toFixed(2));
    
    // Create rows with the actual data
    const rows = [
      [1, 'Total Generated units of a generating plant / Station identified for captive use', totalGenerated],
      [2, 'Less : Auxiliary Consumption in the above in units', auxiliaryConsumption],
      [3, 'Net units available for captive consumption (Aggregate generation for captive use)', aggregateGeneration],
      [4, '51% of aggregate generation available for captive consumption in units', fiftyOnePercent],
      [5, 'Actual Adjusted / Consumed units by the captive users', actualConsumed],
      [6, 'Percentage of actual adjusted / consumed units by the captive users with respect to aggregate generation for captive use', 
        formattedPercentage / 100] // Convert to decimal for Excel percentage format
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
            if (ws[cell].v !== undefined && ws[cell].v !== '') {
              ws[cell].v = parseFloat(ws[cell].v);
            }
          } else {
            ws[cell].z = '#,##0.00';
            if (ws[cell].v !== undefined && ws[cell].v !== '') {
              ws[cell].v = parseFloat(ws[cell].v);
            }
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
