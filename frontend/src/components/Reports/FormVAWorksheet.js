import * as XLSX from 'xlsx';
import { getCellStyle, toNumber } from '../../utils/excelUtils';

export const createFormVAWorksheet = (workbook, data, financialYear) => {
  try {
    if (!data) {
      throw new Error('No data available for Form V-A');
    }

    // Process numeric values with proper validation
    const totalGenerated = toNumber(data.totalGeneratedUnits);
    const auxiliaryConsumption = toNumber(data.auxiliaryConsumption);
    const aggregateGeneration = toNumber(data.aggregateGeneration);
    const fiftyOnePercent = toNumber(data.fiftyOnePercentGeneration);
    const actualConsumed = toNumber(data.actualConsumedUnits);
    const consumptionPercentage = aggregateGeneration > 0 
      ? (actualConsumed / aggregateGeneration) * 100 
      : 0;

    // Define headers and data rows
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
      [5, 'Actual Adjusted / Consumed units by the captive users', actualConsumed],
      [6, 'Percentage of actual adjusted / consumed units by the captive users with respect to aggregate generation for captive use', 
        consumptionPercentage / 100]
    ];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows]);

    // Set column widths and merges
    ws['!cols'] = [
      { wch: 8 },    // Sl.No
      { wch: 80 },   // Particulars
      { wch: 20 }    // Energy in Units
    ];

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
        const isPercentage = R === range.e.r;

        ws[cell].s = getCellStyle(
          isHeader,
          false,
          isTitle,
          C === 1 ? 'left' : 'center'
        );

        if (isData && C === 2) {
          ws[cell].z = isPercentage ? '0.00%' : '#,##0';
          if (ws[cell].v !== undefined) {
            ws[cell].v = isPercentage 
              ? toNumber(ws[cell].v, 0) / 100
              : Math.round(toNumber(ws[cell].v, 0));
          }
        }
      }
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, ws, 'Form V-A');
    return true;
  } catch (error) {
    console.error('Error creating Form V-A worksheet:', error);
    return false;
  }
};
