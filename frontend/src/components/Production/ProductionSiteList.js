import React from 'react';
import PropTypes from 'prop-types';
import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Button,
  Box,
  Tooltip,
  Paper
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  LocationOn as LocationIcon,
  Power as PowerIcon,
  Speed as CapacityIcon,
  ElectricBolt as VoltageIcon,
  Assignment as AssignmentIcon,
  AccountBalance as BankingIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// Define SiteCard component first
const SiteCard = ({ site, onEdit, onDelete, userRole }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (site?.companyId && site?.productionSiteId) {
      navigate(`/production/${site.companyId}/${site.productionSiteId}`);
    }
  };

  const getBankingStatus = (banking) => {
    return {
      text: banking ? 'Banking Enabled' : 'Banking Disabled',
      color: banking ? 'success.main' : 'text.secondary'
    };
  };

  const bankingStatus = getBankingStatus(site.banking);

  return (
    <Card sx={{ 
      cursor: 'pointer',
      transition: 'transform 0.2s ease-in-out',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: 3
      }
    }}>
      <CardContent onClick={handleClick}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ color: 'primary.main' }}>
            {site.name || 'Unnamed Site'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <LocationIcon sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {site.location || 'Location not specified'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CapacityIcon sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {site.capacity_MW || 0} MW
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <VoltageIcon sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {site.injectionVoltage_KV || 0} kV
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <BankingIcon sx={{ mr: 1, color: bankingStatus.color }} />
            <Typography variant="body2" color={bankingStatus.color}>
              {bankingStatus.text}
            </Typography>
          </Box>
        </Box>
      </CardContent>

      {userRole === 'admin' && (
        <CardActions sx={{ justifyContent: 'flex-end', p: 1.5 }}>
          <Tooltip title="Edit Site">
            <IconButton size="small" onClick={(e) => {
              e.stopPropagation();
              onEdit(site);
            }}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Site">
            <IconButton size="small" color="error" onClick={(e) => {
              e.stopPropagation();
              onDelete(site);
            }}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </CardActions>
      )}
    </Card>
  );
};

// Then define the ProductionSiteList component
const ProductionSiteList = ({ sites, onAdd, onEdit, onDelete, isAdmin }) => {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Production Sites</Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAdd}
          >
            Add Site
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {sites.map((site, index) => {
          const companyId = site.companyId || 1; // Default companyId to 1
          const productionSiteId = site.productionSiteId || `site-${index + 1}`; // Generate productionSiteId if null
          const uniqueKey = `${companyId}_${productionSiteId}`;

          return (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={uniqueKey}
            >
              <SiteCard
                site={{
                  ...site,
                  companyId,
                  productionSiteId,
                  pk: uniqueKey
                }}
                onEdit={onEdit}
                onDelete={onDelete}
                userRole={isAdmin ? 'admin' : 'user'}
              />
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

ProductionSiteList.propTypes = {
  sites: PropTypes.array.isRequired,
  onAdd: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  isAdmin: PropTypes.bool
};

export default ProductionSiteList;