import React, { useState, useEffect, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Button, 
  Stack, 
  Switch, 
  FormControlLabel,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Slide,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { fetchFormVAData, fetchFormVBData } from '../../services/reportService';
import FormVExcelReport from './FormVExcelReport';
import FormVCsvReport from './FormVCsvReport';

const REFRESH_INTERVAL = 60000; // Refresh every minute

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// Styled Components
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: '12px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
  border: '1px solid rgba(230, 235, 240, 0.8)',
  overflow: 'auto',
  marginTop: theme.spacing(3),
  '& .MuiTable-root': {
    borderCollapse: 'separate',
    borderSpacing: 0,
    minWidth: 1400
  },
  '& .MuiTableCell-root': {
    borderColor: 'rgba(230, 235, 240, 0.8)',
    padding: '12px 16px',
    fontSize: '0.875rem',
    '&.MuiTableCell-head': {
      fontWeight: 600,
      backgroundColor: '#f8fafc',
      borderBottom: '2px solid rgba(230, 235, 240, 0.8)',
      whiteSpace: 'nowrap',
      '&.header-cell': {
        backgroundColor: '#f0f4f8',
        color: theme.palette.primary.dark,
        fontSize: '0.8rem',
        padding: '8px 12px',
      }
    }
  },
  '& .MuiTableRow-root': {
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.01)'
    },
    '&.totals-row': {
      backgroundColor: 'rgba(25, 118, 210, 0.04)',
      '& .MuiTableCell-root': {
        fontWeight: 600,
        borderTop: '2px solid rgba(0, 0, 0, 0.1)',
        borderBottom: '2px solid rgba(0, 0, 0, 0.1)',
        '&:first-of-type, &:last-of-type': {
          borderLeft: '2px solid rgba(0, 0, 0, 0.1)',
          borderRight: '2px solid rgba(0, 0, 0, 0.1)',
        }
      }
    }
  }
}));

const StatusBadge = styled(Box)(({ status }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 8px',
  borderRadius: '12px',
  fontWeight: 500,
  fontSize: '0.75rem',
  backgroundColor: 
    status === 'Yes' ? 'rgba(46, 125, 50, 0.1)' : 
    status === 'No' ? 'rgba(211, 47, 47, 0.1)' : 'rgba(237, 108, 2, 0.1)',
  color: 
    status === 'Yes' ? '#2e7d32' : 
    status === 'No' ? '#d32f2f' : '#ed6c02',
  '& svg': {
    marginRight: 4,
    fontSize: '1rem'
  }
}));

const AllocationReport = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [isForm5B, setIsForm5B] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState({ excel: false, csv: false });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState({
    title: '',
    content: '',
    type: 'download',
    action: null
  });
  const [financialYear, setFinancialYear] = useState('');
  const [financialYears, setFinancialYears] = useState([]);

  // Initialize financial years
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => {
      const year = currentYear - i;
      return `${year}-${year + 1}`;
    });
    setFinancialYears(years);
    setFinancialYear(years[0]);
  }, []);

  // Fetch data when financial year or form type changes
  const fetchData = useCallback(async () => {
    if (!financialYear) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let data;
      if (isForm5B) {
        data = await fetchFormVBData(financialYear);
      } else {
        data = await fetchFormVAData(financialYear);
      }
      
      if (!data) {
        throw new Error('No data available for the selected financial year');
      }

      // For Form V-B, the data is nested under a 'data' property
      console.log('Raw API response:', data);
      const processedData = isForm5B ? data.data : data;
      console.log('Processed data:', processedData);
      
      if (isForm5B) {
        console.log('Form V-B data structure:', {
          hasSiteMetrics: !!processedData?.siteMetrics,
          siteMetricsLength: processedData?.siteMetrics?.length,
          processedDataKeys: processedData ? Object.keys(processedData) : 'No data'
        });
        
        if (!processedData?.siteMetrics || processedData.siteMetrics.length === 0) {
          console.warn('No consumption site data available for Form V-B');
          throw new Error('No consumption site data available for Form V-B');
        }
      }

      setReportData(processedData);
      setError(null);
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError(err.message || 'Failed to fetch report data');
      setReportData(null);
      enqueueSnackbar(err.message || 'Failed to fetch report data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [financialYear, isForm5B, enqueueSnackbar]);

  // Auto-refresh data
  useEffect(() => {
    let mounted = true;
    
    const refreshData = async () => {
      if (!mounted) return;
      await fetchData();
    };

    refreshData();
    const intervalId = setInterval(refreshData, REFRESH_INTERVAL);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [fetchData]);

  // Handle form type switching
  const handleFormTypeChange = useCallback(() => {
    setIsForm5B(prev => !prev);
    setReportData(null);
    setError(null);
  }, []);

  const handleOpenDialog = (config) => {
    setDialogConfig(config);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const showSnackbar = (message, severity = 'success') => {
    enqueueSnackbar(message, { variant: severity });
  };

  const prepareForm5AData = () => {
    if (!reportData) {
      return [
        { 'Sl.No.': 1, 'Particulars': 'Total Generated units of a generating plant / Station identified for captive use', 'Energy in Units': 0 },
        { 'Sl.No.': 2, 'Particulars': 'Less : Auxiliary Consumption in the above in units', 'Energy in Units': 0 },
        { 'Sl.No.': 3, 'Particulars': 'Net units available for captive consumption (Aggregate generation for captive use)', 'Energy in Units': 0 },
        { 'Sl.No.': 4, 'Particulars': '51% of aggregate generation available for captive consumption in units', 'Energy in Units': 0 },
        { 'Sl.No.': 5, 'Particulars': 'Actual Adjusted / Consumed units by the captive users', 'Energy in Units': 0 },
        { 'Sl.No.': 6, 'Particulars': 'Percentage of actual adjusted / consumed units by the captive users with respect to aggregate generation for captive use', 'Energy in Units': '0%' }
      ];
    }
  
    return [
      { 'Sl.No.': 1, 'Particulars': 'Total Generated units of a generating plant / Station identified for captive use', 'Energy in Units': reportData.totalGeneratedUnits || 0 },
      { 'Sl.No.': 2, 'Particulars': 'Less : Auxiliary Consumption in the above in units', 'Energy in Units': reportData.auxiliaryConsumption || 0 },
      { 'Sl.No.': 3, 'Particulars': 'Net units available for captive consumption (Aggregate generation for captive use)', 'Energy in Units': reportData.aggregateGeneration || 0 },
      { 'Sl.No.': 4, 'Particulars': '51% of aggregate generation available for captive consumption in units', 'Energy in Units': reportData.percentage51 || 0 },
      { 'Sl.No.': 5, 'Particulars': 'Actual Adjusted / Consumed units by the captive users', 'Energy in Units': reportData.totalAllocatedUnits || 0 },
      { 'Sl.No.': 6, 'Particulars': 'Percentage of actual adjusted / consumed units by the captive users with respect to aggregate generation for captive use', 'Energy in Units': `${(Number(reportData.percentageAdjusted || 0)).toFixed(2)}%` }
    ];
  };

  const defaultFormVBData = {
    title: 'FORMAT V-B',
    financialYear: '',
    mainColumns: [
      { 
        id: 'slNo', 
        label: 'Sl.\nNo.', 
        width: 60, 
        align: 'center',
        rowSpan: 2 
      },
      { 
        id: 'shareholder', 
        label: 'Name of share\nholder', 
        width: 200, 
        align: 'left',
        rowSpan: 2 
      },
      { 
        id: 'sharesGroup', 
        label: 'No. of equity shares of value Rs. /-', 
        align: 'center',
        colSpan: 2,
        children: [
          { id: 'certificates', label: 'As per share certificates as on 31st March', align: 'right', width: 120 },
          { id: 'ownership', label: '% of ownership through shares in Company/unit of CGP', align: 'center', width: 120 }
        ]
      },
      { 
        id: 'proRata', 
        label: '% to be consumed on pro rata basis by each captive user', 
        align: 'center',
        width: 100,
        rowSpan: 2
      },
      { 
        id: 'generation', 
        label: '100%\nannual\ngeneration in\nMUs\n(x)', 
        width: 100, 
        align: 'right',
        rowSpan: 2
      },
      { 
        id: 'auxiliary', 
        label: 'Annual Auxiliary consumption in MUs (y)', 
        width: 100, 
        align: 'right',
        rowSpan: 2
      },
      { 
        id: 'criteria', 
        label: 'Generation considered to verify consumption criteria in MUs (x-y)*51%', 
        width: 120, 
        align: 'right',
        rowSpan: 2
      },
      {
        id: 'permittedGroup',
        label: 'Permitted consumption as per norms in MUs',
        align: 'center',
        colSpan: 3,
        children: [
          { id: 'withZero', label: 'With 0%', align: 'right', width: 100 },
          { id: 'minus10', label: '-10%', align: 'right', width: 80 },
          { id: 'plus10', label: '+10%', align: 'right', width: 80 }
        ]
      },
      { 
        id: 'actual', 
        label: 'Actual consumption in MUs', 
        width: 100, 
        align: 'right',
        rowSpan: 2
      },
      { 
        id: 'norms', 
        label: 'Whether\nconsumption\nnorms met', 
        width: 100, 
        align: 'center',
        rowSpan: 2
      }
    ]
  };
  // Helper function to safely convert to number
  const toNumber = (value, defaultValue = 0) => {
    if (value === null || value === undefined || value === '') return defaultValue;
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  };

  const prepareForm5BData = () => {
    if (!reportData?.siteMetrics?.length) {
      return {
        ...defaultFormVBData,
        rows: [],
        totals: null,
        summary: {
          totalGeneration: 0,
          auxiliaryConsumption: 0,
          totalCriteria: 0,
          totalPermitted: 0,
          totalPermittedMinus10: 0,
          totalPermittedPlus10: 0,
          totalConsumption: 0
        }
      };
    }


    // Calculate totals
    let totalEquityShares = 0;
    let totalOwnership = 0;
    let totalGeneration = 0;
    let totalAuxiliary = 0;
    let totalCriteria = 0;
    let totalPermittedWithZero = 0;
    let totalPermittedMinus10 = 0;
    let totalPermittedPlus10 = 0;
    let totalActual = 0;
    let totalNormsMet = 0;

    const getSiteName = (site) => {
      if (!site) return 'Unnamed Site';

      // First try to get the siteName directly from the site object or its nested properties
      const name = site.siteName || site.name;
      if (name && typeof name === 'string' && name.trim()) {
        return name.trim();
      }

      // Try from consumption site data next
      if (site.consumptionSite?.name) {
        return site.consumptionSite.name.trim();
      }

      // Look up in the report data using consumptionSiteId
      if (site.consumptionSiteId && reportData.siteNames?.[site.consumptionSiteId]) {
        const mappedName = reportData.siteNames[site.consumptionSiteId];
        if (typeof mappedName === 'string' && mappedName.trim()) {
          return mappedName.trim();
        }
      }

      // Try metadata fields as a last resort before falling back
      const metadataName = site.metadata?.name || site.siteData?.name || site.siteInfo?.name;
      if (metadataName && typeof metadataName === 'string' && metadataName.trim()) {
        return metadataName.trim();
      }

      // Only use site ID based name if we have no other option
      if (site.consumptionSiteId) {
        return `Consumption Site ${site.consumptionSiteId}`;
      }
      
      return 'Unnamed Site';
    };

    const rows = reportData.siteMetrics.map((site, index) => {
      // Convert all numeric values
      const equityShares = toNumber(site.equityShares);
      const ownership = toNumber(site.ownershipPercentage || site.allocationPercentage);
      const generation = toNumber(site.annualGeneration);
      const auxiliary = toNumber(site.auxiliaryConsumption);
      const criteria = (generation - auxiliary) * 0.51;
      const permittedWithZero = toNumber(site.permittedConsumption?.withZero || 0);
      const permittedMinus10 = toNumber(site.permittedConsumption?.minus10 || 0);
      const permittedPlus10 = toNumber(site.permittedConsumption?.plus10 || 0);
      const actual = toNumber(site.actualConsumption);
      const normsMet = site.consumptionNormsMet || site.normsCompliance ? 1 : 0;

      // Add to totals
      totalEquityShares += equityShares;
      totalOwnership += ownership;
      totalGeneration += generation;
      totalAuxiliary += auxiliary;
      totalCriteria += criteria;
      totalPermittedWithZero += permittedWithZero;
      totalPermittedMinus10 += permittedMinus10;
      totalPermittedPlus10 += permittedPlus10;
      totalActual += actual;
      totalNormsMet += normsMet;

      // Get the site name
      const siteNameFormatted = getSiteName(site);

      return {
        slNo: index + 1,
        name: siteNameFormatted,
        shares: {
          certificates: equityShares.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
          ownership: ownership.toFixed(0) + '%'
        },
        proRata: 'minimum 51%', // Fixed value for pro-rata column
        generation: generation.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
        auxiliary: auxiliary.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
        criteria: criteria.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
        permittedConsumption: {
          withZero: permittedWithZero.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
          minus10: permittedMinus10.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
          plus10: permittedPlus10.toLocaleString('en-IN', { maximumFractionDigits: 0 })
        },
        actual: actual.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
        norms: normsMet ? 'Yes' : 'No',
        isTotal: false
      };
    });

    // Calculate average ownership percentage
    const avgOwnership = rows.length > 0 ? totalOwnership / rows.length : 0;
    const allNormsMet = totalNormsMet === rows.length ? 'Yes' : 
                       totalNormsMet === 0 ? 'No' : 'Partial';

    // Create totals row
    const totals = {
      slNo: 'Total',
      name: '',
      shares: {
        certificates: totalEquityShares.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
        ownership: avgOwnership.toFixed(0) + '%'
      },
      proRata: '', // Keep empty for total row
      generation: totalGeneration.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
      auxiliary: totalAuxiliary.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
      criteria: Math.round(totalCriteria).toLocaleString('en-IN', { maximumFractionDigits: 0 }),
      permittedConsumption: {
        withZero: totalPermittedWithZero.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
        minus10: totalPermittedMinus10.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
        plus10: totalPermittedPlus10.toLocaleString('en-IN', { maximumFractionDigits: 0 })
      },
      actual: totalActual.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
      norms: allNormsMet,
      isTotal: true
    };

    return {
      ...defaultFormVBData,
      financialYear: reportData.financialYear || '',
      rows,
      totals,
      summary: {
        totalGeneration: totalGeneration.toFixed(0),
        auxiliaryConsumption: totalAuxiliary.toFixed(0),
        totalCriteria: totalCriteria.toFixed(0),
        totalPermitted: totalPermittedWithZero.toFixed(0),
        totalPermittedMinus10: totalPermittedMinus10.toFixed(0),
        totalPermittedPlus10: totalPermittedPlus10.toFixed(0),
        totalConsumption: totalActual.toFixed(0)
      }
    };
  };

  return (
    <Box 
      sx={{ 
        p: { xs: 2, md: 4 }, 
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)'
      }}
    >
      <Paper 
        elevation={2}
        sx={{ 
          p: { xs: 2, md: 4 }, 
          mb: 4, 
          borderRadius: '16px',
          background: '#ffffff',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(230, 235, 240, 0.5)'
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' }, 
          justifyContent: 'space-between', 
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 3,
          mb: 4 
        }}>
          <Box>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 800,
                fontSize: { xs: '1.75rem', md: '2.25rem' },
                background: 'linear-gradient(135deg, #1976d2 0%, #2196f3 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
                letterSpacing: '-0.02em'
              }}
            >
              {isForm5B ? 'FORMAT V - B' : 'FORMAT V - A'}
            </Typography>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                color: 'text.secondary',
                fontSize: { xs: '0.9rem', md: '1rem' },
                fontWeight: 500,
                opacity: 0.85
              }}
            >
              {isForm5B ? 'Captive Consumption Details' : 'Alternate Details'}
            </Typography>
          </Box>

          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={2} 
            alignItems="center"
            sx={{
              '& .MuiButton-root': {
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                py: 1,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                }
              }
            }}
          >
            <FormControlLabel
              control={
                <Switch 
                  checked={isForm5B}
                  onChange={handleFormTypeChange}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#1976d2'
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#1976d2'
                    }
                  }}
                />
              }
              label={
                <Typography sx={{ fontWeight: 500, color: 'text.primary' }}>
                  {isForm5B ? 'Form V-B' : 'Form V-A'}
                </Typography>
              }
            />
            
            <FormVExcelReport
              downloading={downloading}
              setDownloading={setDownloading}
              isForm5B={isForm5B}
              prepareForm5AData={prepareForm5AData}
              prepareForm5BData={prepareForm5BData}
              financialYear={financialYear}
              showSnackbar={showSnackbar}
              handleOpenDialog={handleOpenDialog}
            />

            <FormVCsvReport
              downloading={downloading}
              setDownloading={setDownloading}
              isForm5B={isForm5B}
              prepareForm5AData={prepareForm5AData}
              prepareForm5BData={prepareForm5BData}
              financialYear={financialYear}
              showSnackbar={showSnackbar}
              handleOpenDialog={handleOpenDialog}
            />

            <Button
              variant="outlined"
              onClick={fetchData}
              startIcon={loading ? 
                <CircularProgress size={20} sx={{ color: 'primary.main' }} /> : 
                <RefreshIcon />
              }
              disabled={loading}
              sx={{
                borderWidth: '2px',
                '&:hover': {
                  borderWidth: '2px'
                }
              }}
            >
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </Stack>
        </Box>

        <FormControl 
          sx={{ 
            mb: 4,
            minWidth: 240,
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'primary.main',
                borderWidth: '2px'
              }
            }
          }}
        >
          <InputLabel sx={{ fontWeight: 500 }}>Financial Year</InputLabel>
          <Select
            value={financialYear}
            onChange={(e) => setFinancialYear(e.target.value)}
            sx={{
              '& .MuiSelect-select': {
                py: 1.5
              }
            }}
          >
            {financialYears.map((year) => (
              <MenuItem 
                key={year} 
                value={year}
                sx={{
                  py: 1,
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'primary.lighter',
                    '&:hover': {
                      backgroundColor: 'primary.light'
                    }
                  }
                }}
              >
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: '8px',
              '& .MuiAlert-icon': {
                fontSize: '1.5rem'
              }
            }}
          >
            {error}
          </Alert>
        )}

        <StyledTableContainer>
          <Table size="small">
            {isForm5B ? (
              <>
                <TableHead>
                  <TableRow>
                    <TableCell rowSpan={2} align="center">Sl.No.</TableCell>
                    <TableCell rowSpan={2} sx={{ minWidth: '200px' }}>Name of share holder</TableCell>
                    <TableCell colSpan={2} align="center" sx={{ backgroundColor: '#f0f4f8' }}>
                      No. of equity shares of value Rs. /-
                    </TableCell>
                    <TableCell rowSpan={2} align="center">% to be consumed on pro rata basis by each captive user</TableCell>
                    <TableCell rowSpan={2} align="center">100% annual generation in MUs (x)</TableCell>
                    <TableCell rowSpan={2} align="center">
                      <Box>Annual Auxiliary</Box>
                      <Box>consumption in MUs (y)</Box>
                    </TableCell>
                    <TableCell rowSpan={2} align="center">
                      <Box>Generation considered to verify</Box>
                      <Box>consumption criteria in MUs (x-y)*51%</Box>
                    </TableCell>
                    <TableCell colSpan={3} align="center" sx={{ backgroundColor: '#f0f4f8' }}>
                      Permitted consumption as per norms in MUs
                    </TableCell>
                    <TableCell rowSpan={2} align="center">
                      <Box>Actual</Box>
                      <Box>consumption in MUs</Box>
                    </TableCell>
                    <TableCell rowSpan={2} align="center">
                      <Box>Whether</Box>
                      <Box>consumption</Box>
                      <Box>norms met</Box>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="header-cell" align="center">As per share certificates as on 31st March</TableCell>
                    <TableCell className="header-cell" align="center">% of ownership through shares in Company/unit of CGP</TableCell>
                    <TableCell className="header-cell" align="center">with 0% variation</TableCell>
                    <TableCell className="header-cell" align="center">-10%</TableCell>
                    <TableCell className="header-cell" align="center">+10%</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {prepareForm5BData()?.rows.map((row, index) => (
                    <TableRow 
                      key={index}
                      hover
                      sx={{
                        '&:hover': {
                          backgroundColor: 'rgba(25, 118, 210, 0.04)'
                        }
                      }}
                    >
                      <TableCell align="center">{row.slNo}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{row.shares.certificates}</TableCell>
                      <TableCell align="center" sx={{ fontFamily: 'monospace' }}>{row.shares.ownership}</TableCell>
                      <TableCell align="center" sx={{ color: 'text.secondary' }}>{row.proRata}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{row.generation}</TableCell>
                      {index === 0 ? (
                        <TableCell 
                          rowSpan={prepareForm5BData()?.rows.length + 1} 
                          align="center" 
                          sx={{ 
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '1.1em',
                            backgroundColor: '#f8f9fa',
                            border: '1px solid #dee2e6',
                            verticalAlign: 'middle'
                          }}
                        >
                          {prepareForm5BData()?.totals.auxiliary}
                        </TableCell>
                      ) : null}
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{row.criteria}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{row.permittedConsumption.withZero}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{row.permittedConsumption.minus10}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{row.permittedConsumption.plus10}</TableCell>
                      <TableCell align="right" sx={{ 
                        fontFamily: 'monospace',
                        fontWeight: 500,
                        color: 'primary.main'
                      }}>
                        {row.actual}
                      </TableCell>
                      <TableCell align="center">
                        <StatusBadge status={row.norms}>
                          {row.norms === 'Yes' ? 
                            <CheckCircleIcon fontSize="inherit" /> : 
                            <ErrorIcon fontSize="inherit" />
                          }
                          {row.norms}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Totals Row */}
                  {prepareForm5BData()?.totals && (
                    <TableRow className="totals-row">
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Total</TableCell>
                      <TableCell></TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {prepareForm5BData().totals.shares.certificates}
                      </TableCell>
                      <TableCell align="center" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {prepareForm5BData().totals.shares.ownership}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {prepareForm5BData().totals.generation}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {prepareForm5BData().totals.auxiliary}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {prepareForm5BData().totals.criteria}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {prepareForm5BData().totals.permittedConsumption.withZero}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {prepareForm5BData().totals.permittedConsumption.minus10}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {prepareForm5BData().totals.permittedConsumption.plus10}
                      </TableCell>
                      <TableCell align="right" sx={{ 
                        fontFamily: 'monospace', 
                        fontWeight: 700,
                        color: 'primary.dark'
                      }}>
                        {prepareForm5BData().totals.actual}
                      </TableCell>
                      <TableCell align="center">
                        <StatusBadge status={prepareForm5BData().totals.norms}>
                          {prepareForm5BData().totals.norms === 'Yes' ? 
                            <CheckCircleIcon fontSize="inherit" /> : 
                            prepareForm5BData().totals.norms === 'No' ?
                            <ErrorIcon fontSize="inherit" /> :
                            <WarningIcon fontSize="inherit" />
                          }
                          {prepareForm5BData().totals.norms}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </>
            ) : (
              <>
                <TableHead>
                  <TableRow>
                    <TableCell>Sl.No.</TableCell>
                    <TableCell>Particulars</TableCell>
                    <TableCell align="right">Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {prepareForm5AData().map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row['Sl.No.']}</TableCell>
                      <TableCell>{row['Particulars']}</TableCell>
                      <TableCell align="right">{row['Energy in Units']}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </>
            )}
          </Table>
        </StyledTableContainer>
      </Paper>

      <Dialog
        open={dialogOpen}
        TransitionComponent={Transition}
        keepMounted
        onClose={handleCloseDialog}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            p: 1
          }
        }}
      >
        <DialogTitle sx={{ 
          py: 2,
          px: 3,
          fontSize: '1.25rem',
          fontWeight: 600
        }}>
          {dialogConfig.title}
        </DialogTitle>
        <DialogContent sx={{ py: 2, px: 3 }}>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            {dialogConfig.content}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={handleCloseDialog} 
            sx={{ 
              fontWeight: 500,
              textTransform: 'none',
              px: 3
            }}
          >
            Cancel
          </Button>
          {dialogConfig.type === 'download' && (
            <Button 
              onClick={() => dialogConfig.action()} 
              variant="contained"
              sx={{ 
                fontWeight: 600,
                textTransform: 'none',
                px: 3,
                borderRadius: '8px'
              }}
            >
              Download
            </Button>
          )}
          {dialogConfig.type === 'error' && (
            <Button 
              onClick={handleCloseDialog} 
              variant="contained"
              color="error"
              sx={{ 
                fontWeight: 600,
                textTransform: 'none',
                px: 3,
                borderRadius: '8px'
              }}
            >
              OK
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AllocationReport;
