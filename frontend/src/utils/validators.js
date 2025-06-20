export const validateConsumptionData = (data) => {
  const errors = {};

  if (!data.date) {
    errors.date = 'Date is required';
  }

  ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(field => {
    const value = parseFloat(data[field]);
    if (isNaN(value)) {
      errors[field] = 'Must be a number';
    }
    if (value < 0) {
      errors[field] = 'Must be greater than or equal to 0';
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};