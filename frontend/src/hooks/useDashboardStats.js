import { useState, useEffect } from 'react';
import productionSiteApi from '../services/productionSiteapi';

const useDashboardStats = () => {
    const [stats, setStats] = useState({
        totalSites: 0,
        totalCapacity: 0,
        activeProduction: 0,
        efficiency: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const { data } = await productionSiteApi.fetchAll();
                
                // Calculate statistics
                const totalSites = data.length;
                const totalCapacity = data.reduce((sum, site) => 
                    sum + (parseFloat(site.capacity_MW) || 0), 0);
                const activeSites = data.filter(site => site.status === 'Active');
                const activeProduction = activeSites.reduce((sum, site) => 
                    sum + (parseFloat(site.capacity_MW) || 0), 0);
                const efficiency = totalSites > 0 
                    ? (activeProduction / totalCapacity) * 100 
                    : 0;

                setStats({
                    totalSites,
                    totalCapacity: totalCapacity.toFixed(2),
                    activeProduction: activeProduction.toFixed(2),
                    efficiency: efficiency.toFixed(1)
                });
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    return { stats, loading, error };
};

export default useDashboardStats;