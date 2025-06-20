export const getCellStyle = (isHeader = false, isSummary = false, isTitle = false, customAlign = 'center') => ({
  border: {
    top: { 
      style: isTitle ? 'thick' : (isHeader || isSummary ? 'medium' : 'thin'),
      color: { rgb: '000000' }
    },
    bottom: { 
      style: isTitle ? 'thick' : (isHeader || isSummary ? 'medium' : 'thin'),
      color: { rgb: '000000' }
    },
    left: { 
      style: isTitle || isHeader ? 'medium' : 'thin',
      color: { rgb: '000000' }
    },
    right: { 
      style: isTitle || isHeader ? 'medium' : 'thin',
      color: { rgb: '000000' }
    }
  },
  alignment: { 
    wrapText: true, 
    vertical: 'center',
    horizontal: customAlign
  },
  font: {
    name: 'Arial',
    bold: isHeader || isSummary || isTitle,
    sz: isTitle ? 14 : (isHeader ? 12 : 11),
    color: { rgb: '000000' }
  },
  fill: {
    fgColor: { 
      rgb: isTitle ? 'E0E0E0' : (isHeader ? 'F0F0F0' : (isSummary ? 'F8F8F8' : 'FFFFFF'))
    },
    patternType: 'solid'
  },
  numFmt: isHeader ? '@' : '0.00'
});

export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

export const toNumber = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? defaultValue : num;
};
