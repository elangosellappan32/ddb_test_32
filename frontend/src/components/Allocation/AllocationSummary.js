import React from 'react';
import { Box, Grid, Card, CardContent, Typography, Avatar } from '@mui/material';
import { SwapHoriz as AllocationIcon, AccountBalance as BankingIcon, ErrorOutline as LapseIcon, CheckCircle as ProductionIcon, Assignment as ConsumptionIcon } from '@mui/icons-material';
import { calculateTotal } from '../../utils/allocationUtils';

const AllocationSummary = ({ productionData = [], consumptionData = [], allocations = [], bankingAllocations = [], oldBankingAllocations = [], lapseAllocations = [] }) => {
  const totalProduction = productionData.reduce((sum, item) => sum + calculateTotal(item), 0);
  const totalConsumption = consumptionData.reduce((sum, item) => sum + calculateTotal(item), 0);
  const totalDirectBanking = oldBankingAllocations.reduce((sum, item) => sum + calculateTotal(item), 0);
  const totalIndirectBanking = bankingAllocations.reduce((sum, item) => sum + calculateTotal(item.allocated), 0);
  const totalAllocated = allocations.reduce((sum, item) => sum + calculateTotal(item.allocated), 0);
  const totalLapse = lapseAllocations.reduce((sum, item) => sum + calculateTotal(item.allocated), 0);

  const summaryItems = [
    { title: 'Production', value: totalProduction, icon: ProductionIcon, color: 'primary.main' },
    { title: 'Consumption', value: totalConsumption, icon: ConsumptionIcon, color: 'text.secondary' },
    { title: 'Direct Banking', value: totalDirectBanking, icon: BankingIcon, color: 'success.main' },
    { title: 'Indirect Banking', value: totalIndirectBanking, icon: BankingIcon, color: 'success.dark' },
    { title: 'Allocated', value: totalAllocated, icon: AllocationIcon, color: 'secondary.main' },
    { title: 'Lapse', value: totalLapse, icon: LapseIcon, color: 'warning.main' }
  ];

  return (
    <Box mt={4} mb={4}>
      <Grid container spacing={3}>
        {summaryItems.map(({ title, value, icon: Icon, color }, idx) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={idx}>
            <Card sx={{ height: '100%', boxShadow: 1, borderRadius: 2 }}>
              <Box sx={{ p: 2, borderBottom: `3px solid ${color}`, display: 'flex', justifyContent: 'center' }}>
                <Avatar sx={{ bgcolor: color, width: 40, height: 40 }}>
                  <Icon sx={{ color: '#fff', fontSize: 24 }} />
                </Avatar>
              </Box>
              <CardContent sx={{ py: 2, textAlign: 'center' }}>
                <Typography variant="subtitle2" color="textSecondary">
                  {title}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600, mt: 1 }}>
                  {value.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Units
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default AllocationSummary;