/**
 * Utility functions for handling date formats in DynamoDB
 * Primary focus on sort key (sk) format which is MMYYYY (2 digits for month, 4 digits for year)
 */

/**
 * Format a date or month/year combination into DynamoDB sort key format (MMYYYY)
 * @param {Date|string|Object} input - Date object, date string, or {month, year} object
 * @returns {string} Sort key in MMYYYY format
 */
const formatMonthYearKey = (input) => {
    try {
        let month, year;

        if (!input) {
            throw new Error('Month/year input is required');
        }

        if (input instanceof Date) {
            month = input.getMonth() + 1;
            year = input.getFullYear();
        } else if (typeof input === 'string') {
            // Already in MMYYYY format
            if (input.length === 6 && !input.includes('-')) {
                const monthPart = parseInt(input.substring(0, 2));
                const yearPart = parseInt(input.substring(2));
                if (!isNaN(monthPart) && !isNaN(yearPart) && monthPart >= 1 && monthPart <= 12) {
                    return input; // Already in correct format
                }
            }
            // Handle YYYY-MM format
            else if (input.includes('-')) {
                const parts = input.split('-');
                if (parts.length === 2) {
                    const [yearStr, monthStr] = parts;
                    month = parseInt(monthStr);
                    year = parseInt(yearStr);
                } else {
                    // Try parsing as full date string (YYYY-MM-DD)
                    const date = new Date(input);
                    if (!isNaN(date.getTime())) {
                        month = date.getMonth() + 1;
                        year = date.getFullYear();
                    }
                }
            }
            // Try parsing as numeric month (1-12)
            else if (!isNaN(parseInt(input))) {
                month = parseInt(input);
                year = new Date().getFullYear(); // Use current year if only month provided
            }
            // Try parsing as date string
            else {
                const date = new Date(input);
                if (!isNaN(date.getTime())) {
                    month = date.getMonth() + 1;
                    year = date.getFullYear();
                }
            }
        } else if (typeof input === 'object') {
            // Handle both string and number inputs for month/year
            if (typeof input.month === 'undefined' || typeof input.year === 'undefined') {
                throw new Error('Month and year are required when using object format');
            }
            month = parseInt(input.month);
            year = parseInt(input.year);
            
            // If month is 0-based (0-11), convert to 1-based
            if (month >= 0 && month <= 11) {
                month += 1;
            }
        }

        // Validate month and year
        if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
            throw new Error(`Invalid month value: ${month}. Month must be between 1 and 12`);
        }
        if (year < 2000 || year > 2100) {
            throw new Error(`Invalid year value: ${year}. Year must be between 2000 and 2100`);
        }

        return `${String(month).padStart(2, '0')}${year}`;
    } catch (error) {
        console.error('[DateUtils] Format Error:', error);
        throw error;
    }
};

/**
 * Parse a DynamoDB sort key (MMYYYY) into a Date object
 * @param {string} sk - Sort key in MMYYYY format
 * @returns {Date} Date object set to the first day of the month
 */
const parseMonthYearKey = (sk) => {
    if (!sk || typeof sk !== 'string' || sk.length !== 6) {
        throw new Error('Invalid sort key format');
    }

    const month = parseInt(sk.substring(0, 2)) - 1; // JS months are 0-based
    const year = parseInt(sk.substring(2));

    if (isNaN(month) || isNaN(year) || month < 0 || month > 11) {
        throw new Error('Invalid month or year in sort key');
    }

    return new Date(year, month, 1);
};

/**
 * Format a Date object to display format (e.g., "March 2024")
 * @param {Date|string} input - Date object or sort key string
 * @returns {string} Formatted date string
 */
const formatMonthYearDisplay = (input) => {
    try {
        let date;
        if (input instanceof Date) {
            date = input;
        } else if (typeof input === 'string' && input.length === 6) {
            date = parseMonthYearKey(input);
        } else {
            date = new Date(input);
        }

        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }

        return date.toLocaleString('en-US', {
            month: 'long',
            year: 'numeric'
        });
    } catch (error) {
        console.error('[DateUtils] Display Format Error:', error);
        return 'Invalid Date';
    }
};

/**
 * Validate if a string is a valid sort key format (MMYYYY)
 * @param {string} sk - String to validate
 * @returns {boolean} True if valid sort key format
 */
const isValidMonthYearKey = (sk) => {
    if (!sk || typeof sk !== 'string' || sk.length !== 6) {
        return false;
    }

    const month = parseInt(sk.substring(0, 2));
    const year = parseInt(sk.substring(2));

    return !isNaN(month) && !isNaN(year) && 
           month >= 1 && month <= 12 && 
           year >= 2000 && year <= 2100;
};

module.exports = {
    formatMonthYearKey,
    parseMonthYearKey,
    formatMonthYearDisplay,
    isValidMonthYearKey
};