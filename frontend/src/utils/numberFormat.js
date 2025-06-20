export const formatNumber = (value) => {
  if (value === null || value === undefined) return '-';
  return Math.round(Number(value)).toLocaleString();
};