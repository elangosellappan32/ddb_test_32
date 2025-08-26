import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import companyApi from '../../services/companyApi';

// Utility function to format numbers with Indian locale
const formatNumber = (num) => 
  num === null || num === undefined || num === '' ? '' : Number(num).toLocaleString('en-IN');

// Utility function to format currency with Indian Rupee symbol
const formatCurrency = (num) => 
  num === null || num === undefined || num === '' ? '' : `₹${Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const useInvoiceCalculator = (billMonth) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [companyName, setCompanyName] = useState('STRIO KAIZEN HITECH RESEARCH LABS PVT LTD');
  const [invoiceData, setInvoiceData] = useState({
    windData: [],
    chargesData: [],
    windHeaders: [],
    invoiceNumber: ["STR/001/08/2025", "STR/002/08/2025"],
  });

  // Fetch company details
  const fetchCompanyDetails = useCallback(async () => {
    try {
      if (user?.companyName) {
        setCompanyName(user.companyName);
      } else if (user?.company?.name) {
        setCompanyName(user.company.name);
      } else if (user?.metadata?.companyName) {
        setCompanyName(user.metadata.companyName);
      } else if (user?.companyId) {
        const company = await companyApi.getById(user.companyId);
        if (company?.companyName) {
          setCompanyName(company.companyName);
        }
      }
    } catch (error) {
      console.error('Error fetching company details:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Calculate invoice data
  const calculateInvoiceData = useCallback(() => {
    // Example data - replace with actual calculations from your business logic
    const windData = [
      { slNo: 1, description: "Export", values: [147071, '', '', ''] },
      { slNo: 2, description: "Import", values: [258, '', '', ''] },
      { slNo: 3, description: "Total Export", values: [146813, '', '', ''] },
      { slNo: 4, description: "Banking Units", values: [0, '', '', ''] },
      { slNo: 5, description: "Net Export", values: [146813, '', '', ''] },
      { slNo: 6, description: "Total Alloted", values: [146813, 86929, 34127, 25757] },
      { slNo: 7, description: "Less: T&D loss 6.58%", values: [9660.30, 5719.93, 2245.56, 1694.81] },
      { slNo: 8, description: "Net Export", values: [137152.70, 81209.07, 31881.44, 24062.19] },
      { slNo: 9, description: "Adjusted", values: [92840, 81208, 11632, 0] },
      { slNo: 10, description: "Banking", values: [44312.70, 1.07, 20249.44, 24062.19] },
      { slNo: 11, description: "Revenue @ 3.0 per KWH", values: [278520, 243624, 34896, 0] },
      { slNo: 12, description: "Less: TNEB Open Access Charges", values: [138127, 130741, 7386, 0] },
      { slNo: 13, description: "Nett Amount", values: [140393, 112883, 27510, 0] }
    ];

    const chargesData = [
      { slNo: 1, description: "Meter reading charges", values: ['', 445, 0, 0] },
      { slNo: 2, description: "O&M Charges", values: ['', 16144, 0, 0] },
      { slNo: 3, description: "Transmission charges", values: ['', 53973, 0, 0] },
      { slNo: 4, description: "System operating charges", values: ['', 895, 0, 0] },
      { slNo: 5, description: "RKVAH charges", values: ['', 83, 0, 0] },
      { slNo: 6, description: "Import Energy charges", values: ['', 0, 0, 0] },
      { slNo: 7, description: "Scheduling charges", values: ['', 3240, 0, 0] },
      { slNo: 8, description: "Other Charges", values: ['', 0, 0, 0] },
      { slNo: 9, description: "DSM Charges", values: ['', 4405, 0, 0] },
      { slNo: 10, description: "Wheeling Charges", values: ['', 43435, 6222, 0] },
      { slNo: 11, description: "Self Generation Tax", values: ['', 8121, 1164, 0] },
      { slNo: '', description: "SUB TOTAL", values: ['', 130741, 7386, 0] },
    ];

    const windHeaders = ["WIND", "POLYSPIN", "PEL TEXTILES", "RAMAR & SONS"];

    return {
      windData,
      chargesData,
      windHeaders,
      invoiceNumber: [
        `STR/001/${billMonth?.split('-')[1] || '08'}/${billMonth?.split('-')[0] || '2025'}`,
        `STR/002/${billMonth?.split('-')[1] || '08'}/${billMonth?.split('-')[0] || '2025'}`
      ]
    };
  }, [billMonth]);

  // Initialize data
  useEffect(() => {
    fetchCompanyDetails();
    const calculatedData = calculateInvoiceData();
    setInvoiceData(calculatedData);
  }, [fetchCompanyDetails, calculateInvoiceData]);

  // Function to recalculate invoice data when needed
  const recalculateInvoice = useCallback((newData) => {
    // Add any custom recalculation logic here
    // For now, just update with new data
    setInvoiceData(prev => ({
      ...prev,
      ...newData
    }));
  }, []);

  return {
    ...invoiceData,
    companyName,
    isLoading,
    formatNumber,
    formatCurrency,
    recalculateInvoice,
  };
};

export default useInvoiceCalculator;
