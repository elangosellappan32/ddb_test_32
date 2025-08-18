import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Box,
  Grid,
  Typography,
  Alert,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  CardActionArea
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Factory as FactoryIcon,
  PowerSettingsNew as ConsumptionIcon,
  AssignmentTurnedIn as AllocationIcon,
  Assessment as ReportsIcon,
  AssessmentOutlined as AssessmentOutlinedIcon,
  Assessment as AssessmentIcon,
  WbSunny as SolarIcon,
  Air as WindIcon,
  Power as PowerIcon,
  Speed as EfficiencyIcon,
  Pending as PendingIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import productionSiteApi from '../../services/productionSiteApi';
import { useConsumptionStats } from '../../hooks/useConsumptionStats';
import useDashboardData from '../../hooks/useDashboardData';
import { Factory as IndustryIcon, Settings as TextileIcon } from '@mui/icons-material';

const DashboardCard = ({ icon: Icon, title, content, color = 'primary', onClick }) => (
  <Card 
    elevation={0}
    sx={{
      height: '100%',
      minHeight: '120px',
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        borderColor: (theme) => theme.palette[color].main,
        boxShadow: (theme) => `0 2px 12px 0 ${theme.palette[color].light}30`,
        transform: 'translateY(-1px)'
      },
      '&:focus-within': {
        borderColor: (theme) => theme.palette[color].dark,
        boxShadow: (theme) => `0 0 0 1px ${theme.palette[color].light}`,
      },
      overflow: 'hidden',
    }}
  >
    <CardActionArea 
      onClick={onClick} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'stretch',
        p: 0,
      }}
    >
      <Box 
        sx={{
          p: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: (theme) => alpha(theme.palette[color].main, 0.03),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography 
            variant="subtitle2"
            sx={{ 
              fontWeight: 600, 
              color: 'text.primary',
              fontSize: '0.9rem',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              pr: 1,
            }}
          >
            {title}
          </Typography>
          <Box 
            sx={{
              width: 28,
              height: 28,
              minWidth: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: (theme) => alpha(theme.palette[color].main, 0.1),
              color: (theme) => theme.palette[color].main,
              '& svg': {
                fontSize: '1rem',
              }
            }}
          >
            <Icon />
          </Box>
        </Box>
      </Box>
      <CardContent sx={{ 
        flexGrow: 1, 
        p: 1.5,
        '&:last-child': {
          pb: 1.5,
        },
      }}>
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '40px',
        }}>
          {content}
        </Box>
      </CardContent>
    </CardActionArea>
  </Card>
);

const StatCard = ({ value, label, icon: Icon, color = 'primary', size = 'medium' }) => (
  <Box 
    sx={{
      p: 2,
      borderRadius: 2,
      backgroundColor: (theme) => alpha(theme.palette[color].main, 0.05),
      border: '1px solid',
      borderColor: (theme) => alpha(theme.palette[color].main, 0.2),
      height: '100%',
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        backgroundColor: (theme) => alpha(theme.palette[color].main, 0.08),
      },
    }}
  >
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Box>
        <Typography 
          variant={size === 'large' ? 'h5' : 'h6'} 
          sx={{ 
            fontWeight: 700,
            color: 'text.primary',
            lineHeight: 1.2,
            mb: 0.5,
          }}
        >
          {value}
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'text.secondary',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: '0.7rem',
          }}
        >
          {label}
        </Typography>
      </Box>
      {Icon && (
        <Box 
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: (theme) => alpha(theme.palette[color].main, 0.1),
            color: (theme) => theme.palette[color].main,
          }}
        >
          <Icon fontSize="small" />
        </Box>
      )}
    </Box>
  </Box>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    solar: 0,
    wind: 0,
    totalCapacity: 0,
    solarCapacity: 0,
    windCapacity: 0,
    efficiency: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { stats: consumptionStats, loading: consumptionLoading, error: consumptionError } = useConsumptionStats();
  const { user } = useAuth(); // Get the user from the useAuth hook
  const { allocationStats, reportStats, refreshAllocationStats } = useDashboardData(user); // Pass the user to useDashboardData

  const calculateStats = useCallback((response) => {
    try {
      const sites = response?.data || [];
      console.log('[Dashboard] Processing sites:', sites);

      if (!Array.isArray(sites)) {
        throw new Error('Invalid data format received from API');
      }

      const solarSites = sites.filter(site => site.type?.toLowerCase() === 'solar');
      const windSites = sites.filter(site => site.type?.toLowerCase() === 'wind');

      const solarCapacity = solarSites.reduce((sum, site) => sum + (Number(site.capacity_MW) || 0), 0);
      const windCapacity = windSites.reduce((sum, site) => sum + (Number(site.capacity_MW) || 0), 0);
      const totalCapacity = solarCapacity + windCapacity;

      const activeSites = sites.filter(site => site.status?.toLowerCase() === 'active');
      const efficiency = totalCapacity > 0 
        ? (activeSites.reduce((sum, site) => sum + (Number(site.capacity_MW) || 0), 0) / totalCapacity) * 100 
        : 0;

      return {
        total: sites.length,
        solar: solarSites.length,
        wind: windSites.length,
        totalCapacity: totalCapacity.toFixed(2),
        solarCapacity: solarCapacity.toFixed(2),
        windCapacity: windCapacity.toFixed(2),
        efficiency: efficiency.toFixed(1)
      };
    } catch (err) {
      console.error('[Dashboard] Stats calculation error:', err);
      throw err;
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[Dashboard] Fetching sites for stats...');
      const response = await productionSiteApi.fetchAll();
      console.log('[Dashboard] API Response:', response);
      const calculatedStats = calculateStats(response);
      console.log('[Dashboard] Calculated stats:', calculatedStats);
      setStats(calculatedStats);
      setError(null);
    } catch (err) {
      console.error('[Dashboard] Error fetching stats:', err);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

  useEffect(() => {
    fetchStats();
    refreshAllocationStats();
  }, [fetchStats, refreshAllocationStats]);

  const ConsumptionCardContent = () => {
    if (consumptionLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 300 }}>
          <CircularProgress size={32} />
        </Box>
      );
    }

    if (consumptionError) {
      return (
        <Alert severity="error" sx={{ m: 1 }}>
          {consumptionError}
        </Alert>
      );
    }

    const industrialPercentage = Math.round((consumptionStats.industrial / consumptionStats.totalSites) * 100) || 0;
    const textilePercentage = Math.round((consumptionStats.textile / consumptionStats.totalSites) * 100) || 0;
    const otherPercentage = consumptionStats.totalSites > 0 ? 
      Math.round((consumptionStats.other / consumptionStats.totalSites) * 100) : 0;

    return (
      <Box sx={{ '& > * + *': { mt: 2 } }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <StatCard 
              value={consumptionStats.totalConsumption}
              label="Total Consumption"
              sublabel="units"
              icon={ConsumptionIcon}
              color="primary"
              size="large"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Box 
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.04),
                border: '1px solid',
                borderColor: (theme) => alpha(theme.palette.warning.main, 0.2),
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Consumption by Sector</Typography>
              </Box>
              
              <Box sx={{ '& > * + *': { mt: 1.5 } }}>
                {/* Industrial */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <IndustryIcon sx={{ fontSize: 16, color: 'warning.main', mr: 1 }} />
                      <Typography variant="body2">Industrial</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{industrialPercentage}%</Typography>
                  </Box>
                  <Box sx={{ 
                    width: '100%', 
                    height: 4, 
                    bgcolor: 'grey.200',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}>
                    <Box 
                      sx={{ 
                        width: `${industrialPercentage}%`, 
                        height: '100%', 
                        background: (theme) => `linear-gradient(90deg, ${theme.palette.warning.light}, ${theme.palette.warning.main})`,
                        borderRadius: 2,
                      }} 
                    />
                  </Box>
                </Box>
                
                {/* Textile */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <TextileIcon sx={{ fontSize: 16, color: 'info.main', mr: 1 }} />
                      <Typography variant="body2">Textile</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{textilePercentage}%</Typography>
                  </Box>
                  <Box sx={{ 
                    width: '100%', 
                    height: 4, 
                    bgcolor: 'grey.200',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}>
                    <Box 
                      sx={{ 
                        width: `${textilePercentage}%`, 
                        height: '100%', 
                        background: (theme) => `linear-gradient(90deg, ${theme.palette.info.light}, ${theme.palette.info.main})`,
                        borderRadius: 2,
                      }} 
                    />
                  </Box>
                </Box>
                
                {/* Other */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Other Sectors</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{otherPercentage}%</Typography>
                  </Box>
                  <Box sx={{ 
                    width: '100%', 
                    height: 4, 
                    bgcolor: 'grey.200',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}>
                    <Box 
                      sx={{ 
                        width: `${otherPercentage}%`, 
                        height: '100%', 
                        background: (theme) => `linear-gradient(90deg, ${theme.palette.grey[400]}, ${theme.palette.grey[600]})`,
                        borderRadius: 2,
                      }} 
                    />
                  </Box>
                </Box>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <Box 
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor: (theme) => alpha(theme.palette.success.main, 0.04),
                border: '1px solid',
                borderColor: (theme) => alpha(theme.palette.success.main, 0.2),
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Energy Efficiency</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mr: 1 }}>{consumptionStats.efficiency}%</Typography>
                  <EfficiencyIcon sx={{ color: 'success.main', fontSize: 20 }} />
                </Box>
              </Box>
              <Box sx={{ 
                width: '100%', 
                height: 6, 
                bgcolor: 'grey.200',
                borderRadius: 3,
                overflow: 'hidden',
                mb: 1
              }}>
                <Box 
                  sx={{ 
                    width: `${consumptionStats.efficiency}%`, 
                    height: '100%', 
                    background: (theme) => `linear-gradient(90deg, ${theme.palette.success.light}, ${theme.palette.success.main})`,
                    borderRadius: 3,
                    transition: 'width 0.5s ease-in-out',
                  }} 
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {consumptionStats.efficiency > 80 ? 'Excellent' : 
                 consumptionStats.efficiency > 60 ? 'Good' : 
                 consumptionStats.efficiency > 40 ? 'Average' : 'Needs Improvement'}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    );
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%)', minHeight: '100vh' }}>
      <Box 
        sx={{ 
          background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)',
          p: 3,
          mb: 4,
          borderRadius: 2,
          color: 'white',
          boxShadow: 2,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29-22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%23ffffff\' fill-opacity=\'0.1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
            opacity: 0.3,
          },
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Welcome to Energy Dashboard
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
        {/* Production Card */}
        <Grid item xs={12} md={6} lg={3}>
          <DashboardCard
            icon={FactoryIcon}
            title="Production"
            color="primary"
            onClick={() => navigate('/production')}
            content={
              loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 300 }}>
                  <CircularProgress size={32} />
                </Box>
              ) : (
                <Box sx={{ '& > * + *': { mt: 2 } }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <StatCard 
                        value={stats.total} 
                        label="Total Sites" 
                        icon={FactoryIcon} 
                        color="primary"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <StatCard 
                        value={`${stats.totalCapacity} MW`} 
                        label="Total Capacity" 
                        icon={PowerIcon} 
                        color="info"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <StatCard 
                        value={stats.solarCapacity} 
                        label="Solar Capacity" 
                        sublabel={`${stats.solar} sites`}
                        icon={SolarIcon} 
                        color="warning"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <StatCard 
                        value={stats.windCapacity} 
                        label="Wind Capacity" 
                        sublabel={`${stats.wind} sites`}
                        icon={WindIcon} 
                        color="success"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Box 
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: (theme) => alpha(theme.palette.info.main, 0.04),
                          border: '1px solid',
                          borderColor: (theme) => alpha(theme.palette.info.main, 0.2),
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">System Efficiency</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mr: 1 }}>{stats.efficiency}%</Typography>
                            <EfficiencyIcon sx={{ color: 'info.main', fontSize: 20 }} />
                          </Box>
                        </Box>
                        <Box sx={{ 
                          width: '100%', 
                          height: 6, 
                          bgcolor: 'grey.200',
                          borderRadius: 3,
                          overflow: 'hidden',
                          mb: 1
                        }}>
                          <Box 
                            sx={{ 
                              width: `${stats.efficiency}%`, 
                              height: '100%', 
                              bgcolor: 'info.main',
                              borderRadius: 3,
                              transition: 'width 0.5s ease-in-out',
                              background: (theme) => `linear-gradient(90deg, ${theme.palette.info.light}, ${theme.palette.info.main})`,
                            }} 
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {stats.efficiency > 80 ? 'Excellent' : 
                           stats.efficiency > 60 ? 'Good' : 
                           stats.efficiency > 40 ? 'Average' : 'Needs Improvement'}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              )
            }
          />
        </Grid>

        {/* Updated Consumption Card */}
        <Grid item xs={12} md={6} lg={3}>
          <DashboardCard
            icon={ConsumptionIcon}
            title="Consumption"
            color="success"
            onClick={() => navigate('/consumption')}
            content={<ConsumptionCardContent />}
          />
        </Grid>

        {/* Allocation Card */}
        <Grid item xs={12} md={6} lg={3}>
          <DashboardCard
            icon={AllocationIcon}
            title="Allocation"
            color="warning"
            onClick={() => navigate('/allocation')}
            content={
              allocationStats.loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 300 }}>
                  <CircularProgress size={32} />
                </Box>
              ) : allocationStats.error ? (
                <Alert severity="error" sx={{ m: 2 }}>{allocationStats.error}</Alert>
              ) : (
                <Box sx={{ '& > * + *': { mt: 2 } }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <StatCard 
                        value={allocationStats.totalBankingUnits || 0}
                        label="Total Banking Units"
                        sublabel="MW"
                        icon={AllocationIcon}
                        color="info"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <StatCard 
                        value={allocationStats.totalAllocationUnits || 0}
                        label="Total Allocation Units"
                        sublabel="MW"
                        icon={CheckCircleIcon}
                        color="success"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <StatCard 
                        value={allocationStats.totalLapseUnits || 0}
                        label="Total Lapse Units"
                        sublabel="MW"
                        icon={WarningIcon}
                        color="error"
                      />
                    </Grid>
                  </Grid>
                </Box>
              )
            }
          />
        </Grid>

        {/* Reports Card */}
        <Grid item xs={12} md={6} lg={3}>
          <DashboardCard
            icon={ReportsIcon}
            title="invoice"
            color="info"
            onClick={() => navigate('/invoice')}
            content={
              reportStats.loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 300 }}>
                  <CircularProgress size={32} />
                </Box>
              ) : reportStats.error ? (
                <Alert severity="error" sx={{ m: 2 }}>{reportStats.error}</Alert>
              ) : (
                <Box sx={{ '& > * + *': { mt: 2 } }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <StatCard 
                        value={reportStats.dailyReports}
                        label=" tax invoice"
                        icon={AssessmentIcon}
                        color="info"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <StatCard 
                        value={reportStats.monthlyReports}
                        label="montly sales"
                        icon={AssessmentOutlinedIcon}
                        color="primary"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Box 
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: (theme) => alpha(theme.palette.warning.light, 0.08),
                          border: '1px solid',
                          borderColor: (theme) => alpha(theme.palette.warning.light, 0.3),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>monthly expense </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{reportStats.pendingReview}</Typography>
                        </Box>
                        <Box 
                          sx={{ 
                            width: 44, 
                            height: 44, 
                            borderRadius: '50%', 
                            backgroundColor: (theme) => alpha(theme.palette.warning.light, 0.2),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: (theme) => theme.palette.warning.dark,
                          }}
                        >
                          <WarningIcon fontSize="small" />
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <Box 
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: (theme) => alpha(theme.palette.success.main, 0.04),
                          border: '1px solid',
                          borderColor: (theme) => alpha(theme.palette.success.main, 0.2),
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">Compliance Rate</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mr: 1 }}>{reportStats.complianceRate}%</Typography>
                            <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                          </Box>
                        </Box>
                        <Box sx={{ 
                          width: '100%', 
                          height: 6, 
                          bgcolor: 'grey.200',
                          borderRadius: 3,
                          overflow: 'hidden',
                          mb: 1
                        }}>
                          <Box 
                            sx={{ 
                              width: `${reportStats.complianceRate}%`, 
                              height: '100%', 
                              background: (theme) => {
                                if (reportStats.complianceRate > 90) {
                                  return `linear-gradient(90deg, ${theme.palette.success.light}, ${theme.palette.success.main})`;
                                } else if (reportStats.complianceRate > 70) {
                                  return `linear-gradient(90deg, ${theme.palette.info.light}, ${theme.palette.info.main})`;
                                } else if (reportStats.complianceRate > 50) {
                                  return `linear-gradient(90deg, ${theme.palette.warning.light}, ${theme.palette.warning.main})`;
                                } else {
                                  return `linear-gradient(90deg, ${theme.palette.error.light}, ${theme.palette.error.main})`;
                                }
                              },
                              borderRadius: 3,
                              transition: 'width 0.5s ease-in-out',
                            }} 
                          />
                        </Box>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontWeight: 500,
                            color: (theme) => {
                              if (reportStats.complianceRate > 90) return theme.palette.success.main;
                              if (reportStats.complianceRate > 70) return theme.palette.info.main;
                              if (reportStats.complianceRate > 50) return theme.palette.warning.dark;
                              return theme.palette.error.main;
                            }
                          }}
                        >
                          {reportStats.complianceRate > 90 ? 'Fully Compliant' : 
                           reportStats.complianceRate > 70 ? 'Mostly Compliant' : 
                           reportStats.complianceRate > 50 ? 'Partially Compliant' : 'Needs Attention'}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              )
            }
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;