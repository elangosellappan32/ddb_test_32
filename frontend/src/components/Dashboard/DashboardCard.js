import React, { useState, useEffect } from 'react';
import { 
    Card, 
    CardContent, 
    Typography, 
    Box, 
    Grid,
    CircularProgress,
    Divider,
    useTheme
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    ElectricBolt as PowerIcon,
    Speed as EfficiencyIcon,
    TrendingUp as ProductionIcon,
    WbSunny as SolarIcon,
    Air as WindIcon
} from '@mui/icons-material';
import productionSiteApi from '../../services/productionSiteapi';

const DashboardCard = () => {
    const theme = useTheme();
    const [stats, setStats] = useState({
        totalSites: 0,
        totalCapacity: 0,
        solarSites: 0,
        windSites: 0,
        solarCapacity: 0,
        windCapacity: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                console.log('[Dashboard] Fetching site data...');
                const { data } = await productionSiteApi.fetchAll();
                console.log('[Dashboard] Received data:', data);

                // Calculate dashboard statistics
                const totalSites = data.length;
                const totalCapacity = data.reduce((sum, site) => 
                    sum + (parseFloat(site.capacity_MW) || 0), 0);

                // Calculate type-specific stats
                const solarSites = data.filter(site => site.type === 'Solar');
                const windSites = data.filter(site => site.type === 'Wind');

                const solarCapacity = solarSites.reduce((sum, site) => 
                    sum + (parseFloat(site.capacity_MW) || 0), 0);
                const windCapacity = windSites.reduce((sum, site) => 
                    sum + (parseFloat(site.capacity_MW) || 0), 0);

                const stats = {
                    totalSites,
                    totalCapacity: totalCapacity.toFixed(2),
                    solarSites: solarSites.length,
                    windSites: windSites.length,
                    solarCapacity: solarCapacity.toFixed(2),
                    windCapacity: windCapacity.toFixed(2)
                };

                console.log('[Dashboard] Calculated stats:', stats);
                setStats(stats);
            } catch (error) {
                console.error('[Dashboard] Error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const StatItem = ({ icon: Icon, title, value, unit, color }) => (
        <Box 
            sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mb: 2,
                p: 1.5,
                bgcolor: 'background.paper',
                borderRadius: 1,
                boxShadow: 1
            }}
        >
            <Icon sx={{ mr: 2, color: color || theme.palette.primary.main }} />
            <Box>
                <Typography variant="body2" color="text.secondary">
                    {title}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                    {value} {unit}
                </Typography>
            </Box>
        </Box>
    );

    if (loading) {
        return (
            <Card sx={{ minWidth: 275, m: 2 }}>
                <CardContent sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card sx={{ 
            minWidth: 275,
            m: 2,
            transition: '0.3s',
            '&:hover': {
                transform: 'translateY(-5px)',
                boxShadow: 3
            }
        }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <DashboardIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="h5" component="div">
                        Production Overview
                    </Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <StatItem 
                            icon={PowerIcon}
                            title="Total Sites"
                            value={stats.totalSites}
                            unit="sites"
                            color={theme.palette.primary.main}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <StatItem 
                            icon={ProductionIcon}
                            title="Total Capacity"
                            value={stats.totalCapacity}
                            unit="MW"
                            color={theme.palette.success.main}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <StatItem 
                            icon={SolarIcon}
                            title="Solar Sites"
                            value={`${stats.solarSites} (${stats.solarCapacity} MW)`}
                            unit=""
                            color={theme.palette.warning.main}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <StatItem 
                            icon={WindIcon}
                            title="Wind Sites"
                            value={`${stats.windSites} (${stats.windCapacity} MW)`}
                            unit=""
                            color={theme.palette.info.main}
                        />
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};

export default DashboardCard;