import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Popover, 
  Typography, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormHelperText 
} from '@mui/material';
import { format, addYears, subYears } from 'date-fns';

const FinancialYearFilter = ({ onFilterChange, defaultYear }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedYear, setSelectedYear] = useState(defaultYear || format(new Date(), 'yyyy'));
  const open = Boolean(anchorEl);

  // Generate financial years (current year - 2 to current year + 2)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleYearChange = (event) => {
    const year = event.target.value;
    setSelectedYear(year);
    onFilterChange(year);
    handleClose();
  };

  return (
    <Box display="flex" alignItems="center">
      <Button
        variant="outlined"
        onClick={handleClick}
        sx={{ 
          ml: 2,
          textTransform: 'none',
          borderColor: 'primary.main',
          color: 'primary.main',
          '&:hover': {
            borderColor: 'primary.dark',
            backgroundColor: 'rgba(25, 118, 210, 0.04)'
          }
        }}
      >
        FY {selectedYear}-{(parseInt(selectedYear) + 1).toString().slice(-2)}
      </Button>
      
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box sx={{ p: 2, minWidth: 200 }}>
          <Typography variant="subtitle2" gutterBottom>
            Select Financial Year
          </Typography>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <Select
              value={selectedYear}
              onChange={handleYearChange}
              displayEmpty
              inputProps={{ 'aria-label': 'Select financial year' }}
            >
              {years.map((year) => (
                <MenuItem key={year} value={year.toString()}>
                  FY {year}-{(year + 1).toString().slice(-2)}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>April {selectedYear} to March {parseInt(selectedYear) + 1}</FormHelperText>
          </FormControl>
        </Box>
      </Popover>
    </Box>
  );
};

export default FinancialYearFilter;
