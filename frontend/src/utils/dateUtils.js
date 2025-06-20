import { format, parse, isValid } from 'date-fns';

export const formatMonthYear = (sk) => {
  try {
    if (!sk || typeof sk !== 'string' || sk.length !== 6) {
      return 'Invalid Date';
    }

    const month = parseInt(sk.substring(0, 2));
    const year = parseInt('20' + sk.substring(2));
    
    const date = new Date(year, month - 1);
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleString('en-US', {
      month: 'short',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

export const parseMonthYear = (dateStr) => {
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).substring(2);
  return `${month}${year}`;
};

export const formatToSK = (date) => {
  return format(date, 'MMyyyy');
};

export const parseSKToDate = (sk) => {
  if (!sk || sk.length !== 6) return null;
  const month = parseInt(sk.substring(0, 2)) - 1;
  const year = parseInt(sk.substring(2));
  return new Date(year, month);
};

export const formatDisplayDate = (sk) => {
  try {
    if (!sk || typeof sk !== 'string' || sk.length !== 6) {
      return 'Invalid Date';
    }

    const month = parseInt(sk.substring(0, 2)) - 1;
    const year = parseInt(sk.substring(2));
    const date = new Date(year, month);
    
    if (!isValid(date)) {
      return 'Invalid Date';
    }

    return format(date, 'MMM yyyy');
  } catch (error) {
    console.error('Error formatting display date:', error);
    return 'Invalid Date';
  }
};

export const formatSK = (date) => {
  try {
    const parsedDate = new Date(date);
    if (!isValid(parsedDate)) {
      console.error('Invalid date for SK:', date);
      return null;
    }
    return format(parsedDate, 'MMyyyy');
  } catch (error) {
    console.error('Error formatting SK:', error);
    return null;
  }
};

export const parseSK = (sk) => {
  if (!sk) return null;
  try {
    return parse(sk, 'MMyyyy', new Date());
  } catch (error) {
    console.error('Error parsing SK:', error);
    return null;
  }
};

export const parseAPIDate = (dateString) => {
  try {
    const date = parse(dateString, 'yyyy-MM-dd', new Date());
    return isValid(date) ? date : new Date();
  } catch (error) {
    console.error('Error parsing API date:', error);
    return new Date();
  }
};

export const formatDateToMMYYYY = (date) => {
  const d = new Date(date);
  return `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
};

export const formatSKDisplay = (sk) => {
  if (!sk) return '';
  
  // Extract month and year from SK (format: MMYYYY)
  const month = sk.substring(0, 2);
  const year = sk.substring(2);
  
  // Create a date object (using 1st of the month)
  const date = new Date(year, parseInt(month) - 1, 1);
  
  // Format the date to show month and year
  return date.toLocaleDateString('en-US', { 
    month: 'long',
    year: 'numeric'
  });
};