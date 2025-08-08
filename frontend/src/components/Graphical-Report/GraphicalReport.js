import React, { useState } from 'react';
import { Box, Paper, Tabs, Tab, Typography } from '@mui/material';
import GraphicalProductionReport from './GraphicalProductionReport';
import GraphicalConsumptionReport from './GraphicalConsumptionReport';
import GraphicalAllocationReport from './GraphicalAllocationReport';
import GraphicalBankingReport from './GraphicalBankingReport';
import GraphicalLapseReport from './GraphicalLapseReport';
import GraphicalCombinedReport from './GraphicalCombinedReport';
import GraphicalTotalReport from './GraphicalTotalReport';

// TabPanel helper function
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Accessibility props for each Tab
function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const GraphicalReport = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Paper elevation={3} sx={{ p: 3, m: 2 }}>
      <Typography variant="h4" gutterBottom>
        Energy Analytics Dashboard
      </Typography>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="energy analytics tabs"
          variant="fullWidth"
        >
          <Tab label="Total" {...a11yProps(0)} />
          <Tab label="Combined Analysis" {...a11yProps(1)} />
          <Tab label="Production Analysis" {...a11yProps(2)} />
          <Tab label="Consumption Analysis" {...a11yProps(3)} />
          <Tab label="Allocation Analysis" {...a11yProps(4)} />
          <Tab label="Banking Analysis" {...a11yProps(5)} />
          <Tab label="Lapse Analysis" {...a11yProps(6)} />
        </Tabs>
      </Box>

      {/* Tab Panels ordered accordingly */}
      <TabPanel value={tabValue} index={0}>
        <GraphicalTotalReport />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <GraphicalCombinedReport />
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        <GraphicalProductionReport />
      </TabPanel>
      <TabPanel value={tabValue} index={3}>
        <GraphicalConsumptionReport />
      </TabPanel>
      <TabPanel value={tabValue} index={4}>
        <GraphicalAllocationReport />
      </TabPanel>
      <TabPanel value={tabValue} index={5}>
        <GraphicalBankingReport />
      </TabPanel>
      <TabPanel value={tabValue} index={6}>
        <GraphicalLapseReport />
      </TabPanel>
    </Paper>
  );
};

export default GraphicalReport;
