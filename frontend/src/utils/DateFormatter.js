const DateFormatter = {
  toSortKey: (date) => {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}${year}`;
  },

  fromSortKey: (sk) => {
    if (typeof sk !== 'string' || sk.length !== 6) return null;
    const month = parseInt(sk.substring(0, 2)) - 1;
    const year = parseInt(sk.substring(2));
    return new Date(year, month);
  },

  formatMonthYear: (date) => {
    const d = new Date(date);
    return d.toLocaleString('default', {
      month: 'short',
      year: 'numeric'
    });
  }
};

export default DateFormatter;