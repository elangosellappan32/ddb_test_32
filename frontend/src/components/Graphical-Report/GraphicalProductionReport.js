import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  Typography,
  Box,
  Autocomplete,
  TextField,
  Paper,
} from "@mui/material";
import { getAccessibleSiteIds } from "../../utils/siteAccessUtils";
import { useAuth } from "../../context/AuthContext";
import { fetchAllProductionUnits } from "../../utils/siteUnitApi";
import productionSiteApi from "../../services/productionSiteApi";

// Helper: Get months for a financial year (April–March)
const getFinancialYearMonths = (fy) => {
  const [startYear, endYear] = fy.split("-").map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) {
    months.push(`${m < 10 ? "0" : ""}${m}${startYear}`);
  }
  for (let m = 1; m <= 3; m++) {
    months.push(`${m < 10 ? "0" : ""}${m}${endYear}`);
  }
  return months;
};

// Process API unit data to format for the graph
const processUnitData = (units, siteObj, siteKey, months) => {
  const processedUnits = new Map();
  const [companyId, siteId] = siteKey.split("_");

  const siteUnits = units.filter(
    (unit) =>
      String(unit.companyId) === String(companyId) &&
      String(unit.productionSiteId) === String(siteId)
  );

  const validUnits = siteUnits
    .filter((unit) => {
      const monthKey = unit.date || unit.sk || unit.period;
      return monthKey && monthKey.length === 6 && months.includes(monthKey);
    })
    .sort((a, b) => {
      const monthA = a.date || a.sk || a.period;
      const monthB = b.date || b.sk || b.period;
      return monthA.localeCompare(monthB);
    });

  validUnits.forEach((unit) => {
    const monthKey = unit.date || unit.sk || unit.period;
    const c1 = Math.max(0, Number(unit.c1) || 0);
    const c2 = Math.max(0, Number(unit.c2) || 0);
    const c3 = Math.max(0, Number(unit.c3) || 0);
    const c4 = Math.max(0, Number(unit.c4) || 0);
    const c5 = Math.max(0, Number(unit.c5) || 0);
    const total = c1 + c2 + c3 + c4 + c5;
    if (total > 0) {
      processedUnits.set(monthKey, {
        sk: monthKey,
        siteKey: siteKey,
        siteName: siteObj.name,
        companyId: siteObj.companyId,
        period: monthKey,
        month: monthKey.slice(0, 2),
        year: monthKey.slice(2),
        displayMonth: `${monthKey.slice(0, 2)}/${monthKey.slice(2)}`,
        c1, c2, c3, c4, c5, total,
      });
    }
  });

  // Fill missing with zeroes for months with no data
  return months.map((month) => {
    const monthNum = month.slice(0, 2);
    const yearNum = month.slice(2);
    const existingData = processedUnits.get(month);
    if (existingData) return existingData;
    return {
      sk: month,
      siteKey: siteObj.name,
      companyId: siteObj.companyId,
      period: month,
      month: monthNum,
      year: yearNum,
      displayMonth: `${monthNum}/${yearNum}`,
      c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, total: 0,
    };
  });
};

// Format display month for axis
const formatMonthDisplay = (monthKey) => {
  if (!monthKey || monthKey.length !== 6) return monthKey;
  const monthNum = parseInt(monthKey.slice(0, 2), 10);
  const yearNum = monthKey.slice(2);
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const monthIdx = monthNum - 1;
  return `${monthNames[monthIdx]} ${yearNum}`;
};

// Sort months (April..March)
const getSortedFinancialYearMonths = (fy) => {
  const months = getFinancialYearMonths(fy);
  return months.sort((a, b) => {
    const monthA = parseInt(a.slice(0, 2));
    const monthB = parseInt(b.slice(0, 2));
    const yearA = parseInt(a.slice(2));
    const yearB = parseInt(b.slice(2));
    if (yearA !== yearB) return yearA - yearB;
    // Move Jan-Feb-Mar after April-Dec for FY display order
    const adjA = monthA < 4 ? monthA + 12 : monthA;
    const adjB = monthB < 4 ? monthB + 12 : monthB;
    return adjA - adjB;
  });
};

const palette = [
  "#2196F3",
  "#4CAF50",
  "#FFC107",
  "#F44336",
  "#9C27B0",
  "#00BCD4",
  "#8BC34A",
  "#FF9800",
  "#E91E63",
  "#673AB7",
];

const GraphicalProductionReport = () => {
  const currentYear = new Date().getFullYear();
  const defaultFY = `${currentYear}-${currentYear + 1}`;
  const [financialYear, setFinancialYear] = useState(defaultFY);
  const [siteDataMap, setSiteDataMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedSites, setSelectedSites] = useState([]);
  const [availableSites, setAvailableSites] = useState([]);
  const [error, setError] = useState(null);
  const [graphType, setGraphType] = useState("line");
  const { user } = useAuth();

  // Financial year dropdown options
  const fyOptions = [];
  for (let y = 2020; y <= currentYear; y++) {
    fyOptions.push({
      value: `${y}-${y + 1}`,
      label: `April ${y} - March ${y + 1}`,
    });
  }

  // Core data query effect
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      const newSiteDataMap = new Map();
      const availableSitesTemp = new Map();
      try {
        const siteIds = getAccessibleSiteIds(user, "production");
        const months = getFinancialYearMonths(financialYear);

        const allSites = await productionSiteApi.fetchAll().then((res) => res.data || []);

        for (const combinedId of siteIds) {
          const [companyId, siteId] = combinedId.split("_");
          try {
            const unitsResponse = await fetchAllProductionUnits(companyId, siteId);

            if (!unitsResponse?.data) continue;

            const siteObj = allSites.find(
              (s) =>
                String(s.productionSiteId) === String(siteId) &&
                String(s.companyId) === String(companyId)
            );
            if (!siteObj) continue;

            const siteKey = `${siteObj.companyId}_${siteObj.productionSiteId}`;
            if (newSiteDataMap.has(siteKey)) continue;

            const processedUnits = processUnitData(unitsResponse.data, siteObj, siteKey, months);

            if (processedUnits.some((unit) => unit.total > 0)) {
              newSiteDataMap.set(siteKey, processedUnits);
              availableSitesTemp.set(siteKey, {
                key: siteKey,
                name: siteObj.name,
                companyId: siteObj.companyId,
                productionSiteId: siteObj.productionSiteId,
                siteData: siteObj,
              });
            }
          } catch (err) {
            // Log and continue on individual site error
            console.error(`Error processing site ${combinedId}:`, err);
          }
        }

        // Only set site data if there's at least one site with data
        if (newSiteDataMap.size === 0) {
          setSiteDataMap({});
          setAvailableSites([]);
          setSelectedSites([]);
          // Do NOT set error; this triggers "No sites selected" UX
        } else {
          setSiteDataMap(Object.fromEntries(newSiteDataMap));
          const availableSitesList = Array.from(availableSitesTemp.values());
          setAvailableSites(availableSitesList);

          // If user hasn't selected, pick up to 5 by default
          if (selectedSites.length === 0) {
            setSelectedSites(availableSitesList.slice(0, 5));
          } else {
            const validSiteKeys = new Set(availableSitesList.map((site) => site.key));
            const validSelectedSites = selectedSites.filter(
              (site) => validSiteKeys.has(site.key)
            );
            if (validSelectedSites.length !== selectedSites.length) {
              setSelectedSites(validSelectedSites);
            }
          }
        }
      } catch (err) {
        setError("Failed to load production data. Please try again.");
        console.error("Error loading production data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    }
    // eslint-disable-next-line
  }, [user, financialYear]);

  // Preparation for chart rendering
  const sortedMonths = getSortedFinancialYearMonths(financialYear);
  const chartData = sortedMonths.map((month) => {
    const monthData = {
      month: formatMonthDisplay(month),
      monthKey: month,
    };
    selectedSites.forEach((site) => {
      const siteData = siteDataMap[site.key];
      if (siteData) {
        const dataPoint = siteData.find((d) => d.sk === month);
        if (dataPoint) {
          monthData[`${site.name}_c1`] = dataPoint.c1 || 0;
          monthData[`${site.name}_c2`] = dataPoint.c2 || 0;
          monthData[`${site.name}_c3`] = dataPoint.c3 || 0;
          monthData[`${site.name}_c4`] = dataPoint.c4 || 0;
          monthData[`${site.name}_c5`] = dataPoint.c5 || 0;
        } else {
          monthData[`${site.name}_c1`] = 0;
          monthData[`${site.name}_c2`] = 0;
          monthData[`${site.name}_c3`] = 0;
          monthData[`${site.name}_c4`] = 0;
          monthData[`${site.name}_c5`] = 0;
        }
      }
    });
    return monthData;
  });

  return (
    <Paper elevation={3} sx={{ p: 3, m: 2 }}>
      <Typography variant="h5" gutterBottom>
        Production Units Analysis
      </Typography>
      <Box sx={{ mb: 3, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
        <FormControl sx={{ minWidth: 220 }} size="small">
          <InputLabel>Financial Year</InputLabel>
          <Select
            value={financialYear}
            label="Financial Year"
            onChange={(e) => setFinancialYear(e.target.value)}
            disabled={loading}
          >
            {fyOptions.map((fy) => (
              <MenuItem key={fy.value} value={fy.value}>
                {fy.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: "flex", alignItems: "center", ml: 2 }}>
          <Typography sx={{ mr: 1 }}>Bar</Typography>
          <Switch
            checked={graphType === "line"}
            onChange={(e) => setGraphType(e.target.checked ? "line" : "bar")}
            disabled={loading}
          />
          <Typography sx={{ ml: 1 }}>Line</Typography>
        </Box>
        <Autocomplete
          multiple
          id="site-selector"
          options={availableSites}
          value={selectedSites}
          onChange={(_, newValue) => setSelectedSites(newValue)}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.key === value.key}
          renderOption={(props, option) => (
            <li {...props} key={option.key}>{option.name}</li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              label="Select Production Sites"
              size="small"
              sx={{ minWidth: 300 }}
            />
          )}
          sx={{ flexGrow: 1 }}
          ListboxProps={{ style: { maxHeight: "200px" } }}
          disabled={loading}
        />
      </Box>
      <Box sx={{ height: 500 }}>
        {loading ? (
          <Typography>Loading production report...</Typography>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : selectedSites.length === 0 ? (
          <Typography>No sites selected. Please select sites to view data.</Typography>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {graphType === "line" ? (
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 20, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  angle={-45}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                {selectedSites.flatMap((site, siteIndex) =>
                  ["c1", "c2", "c3", "c4", "c5"].map((cKey, cIndex) => (
                    <Line
                      key={`${site.key}_${cKey}`}
                      type="monotone"
                      dataKey={`${site.name}_${cKey}`}
                      name={`${site.name} ${cKey.toUpperCase()}`}
                      stroke={palette[(siteIndex * 5 + cIndex) % palette.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  ))
                )}
              </LineChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 20, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  angle={-45}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                {selectedSites.flatMap((site, siteIndex) =>
                  ["c1", "c2", "c3", "c4", "c5"].map((cKey, cIndex) => (
                    <Bar
                      key={`${site.key}_${cKey}`}
                      dataKey={`${site.name}_${cKey}`}
                      name={`${site.name} ${cKey.toUpperCase()}`}
                      fill={palette[(siteIndex * 5 + cIndex) % palette.length]}
                      radius={[4, 4, 0, 0]}
                      stack={site.key}
                    />
                  ))
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </Box>
    </Paper>
  );
};

export default GraphicalProductionReport;
