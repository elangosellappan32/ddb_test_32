import { useState, useEffect, useCallback } from 'react';
import consumptionSiteApi from '../services/consumptionSiteApi';
import consumptionUnitApi from '../services/consumptionUnitApi';

export const useConsumptionStats = () => {
    const [stats, setStats] = useState({
        totalSites: 0,
        industrial: 0,
        textile: 0,
        other: 0,
        totalConsumption: 0,
        efficiency: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const calculateStats = useCallback(async () => {
        try {
            setLoading(true);
            
            // Fetch all consumption sites
            const sitesResponse = await consumptionSiteApi.fetchAll();
            const sites = sitesResponse?.data || [];

            // Count sites by type
            const industrial = sites.filter(site => site.type?.toLowerCase() === 'industrial').length;
            const textile = sites.filter(site => site.type?.toLowerCase() === 'textile').length;
            const other = sites.length - industrial - textile;

            // Calculate total consumption from units
            let totalConsumption = 0;
            for (const site of sites) {
                const unitsResponse = await consumptionUnitApi.fetchAll(site.companyId, site.consumptionSiteId);
                const units = unitsResponse?.data || [];
                
                totalConsumption += units.reduce((sum, unit) => 
                    sum + (Number(unit.total) || 0), 0);
            }

            // Calculate efficiency (example: based on target consumption)
            const targetConsumption = 1000; // Example target
            const efficiency = totalConsumption > 0 
                ? ((targetConsumption - totalConsumption) / targetConsumption * 100).toFixed(1)
                : 0;

            setStats({
                totalSites: sites.length,
                industrial,
                textile,
                other,
                totalConsumption: totalConsumption.toFixed(2),
                efficiency
            });

            setError(null);
        } catch (err) {
            console.error('[Dashboard] Consumption stats calculation error:', err);
            setError('Failed to load consumption statistics');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        calculateStats();
    }, [calculateStats]);

    return { stats, loading, error };
};