import { useState, useEffect, useCallback } from 'react';
import allocationApi from '../services/allocationapi';

const useDashboardData = () => {
  const [allocationStats, setAllocationStats] = useState({
    totalAllocated: 0,
    unitsAllocated: 0,
    pendingAllocations: 0,
    allocationRate: 0,
    loading: true,
    error: null
  });

  const [reportStats, setReportStats] = useState({
    dailyReports: 0,
    monthlyReports: 0,
    pendingReview: 0,
    complianceRate: 0,
    loading: true,
    error: null
  });

  const fetchAllocationStats = useCallback(async () => {
    try {
      setAllocationStats(prev => ({ ...prev, loading: true, error: null }));
      
      // Fetch all allocations
      const allocations = await allocationApi.fetchAllAllocations();
      
      // Calculate statistics
      const totalAllocated = allocations.reduce((sum, alloc) => {
        const { c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0 } = alloc.allocated || {};
        return sum + (Number(c1) || 0) + (Number(c2) || 0) + (Number(c3) || 0) + 
               (Number(c4) || 0) + (Number(c5) || 0);
      }, 0);

      const unitsAllocated = allocations.length;
      
      // For demo purposes - in a real app, this would come from the API
      const pendingAllocations = Math.max(0, Math.floor(Math.random() * 5));
      const allocationRate = unitsAllocated > 0 
        ? Math.min(100, Math.floor((unitsAllocated / (unitsAllocated + pendingAllocations)) * 100))
        : 0;

      setAllocationStats({
        totalAllocated: totalAllocated.toFixed(2),
        unitsAllocated,
        pendingAllocations,
        allocationRate,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error fetching allocation stats:', error);
      setAllocationStats(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load allocation statistics'
      }));
    }
  }, []);

  const fetchReportStats = useCallback(async () => {
    try {
      setReportStats(prev => ({ ...prev, loading: true, error: null }));
      
      // For demo purposes - in a real app, these would come from actual API calls
      // Example: const reports = await reportService.fetchReportStats();
      
      // Mock data - replace with actual API calls
      const dailyReports = Math.floor(Math.random() * 30) + 10; // 10-40
      const monthlyReports = Math.floor(Math.random() * 5) + 1;  // 1-6
      const pendingReview = Math.floor(Math.random() * 5);       // 0-4
      const complianceRate = 90 + Math.floor(Math.random() * 10); // 90-99%

      setReportStats({
        dailyReports,
        monthlyReports,
        pendingReview,
        complianceRate,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error fetching report stats:', error);
      setReportStats(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load report statistics'
      }));
    }
  }, []);

  useEffect(() => {
    fetchAllocationStats();
    fetchReportStats();
  }, [fetchAllocationStats, fetchReportStats]);

  return {
    allocationStats,
    reportStats,
    refreshAllocationStats: fetchAllocationStats,
    refreshReportStats: fetchReportStats
  };
};

export default useDashboardData;
