import React from 'react';
import PropTypes from 'prop-types';
import { Card, CardActionArea, CardActions, Box, Typography, Tooltip, IconButton, LinearProgress } from '@mui/material';
import { Business as BusinessIcon, Edit as EditIcon, Delete as DeleteIcon, Email as EmailIcon, Phone as PhoneIcon, Person as PersonIcon, LocationOn as LocationIcon, Cached as RefreshIcon, Error as ErrorIcon } from '@mui/icons-material';

const CompanyCard = ({
  company,
  onView,
  onEdit,
  onDelete,
  onRefresh,
  permissions,
  isLoading = false,
  error = null,
  lastUpdated = new Date()
}) => {
  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 2,
        transition: 'all 0.3s ease',
        position: 'relative',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3,
        }
      }}
    >
      <CardActionArea onClick={onView} sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <BusinessIcon color="primary" sx={{ fontSize: 28 }} />
          <Tooltip title={company.companyName}>
            <Typography variant="h6" noWrap sx={{ mr: 1 }}>{company.companyName}</Typography>
          </Tooltip>
          {/* Type Badge */}
          {company.type && (
            <Box
              component="span"
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 4,
                bgcolor:
                  company.type.toLowerCase() === 'generator'
                    ? 'primary.light'
                    : company.type.toLowerCase() === 'shareholder'
                    ? 'success.light'
                    : company.type.toLowerCase() === 'both'
                    ? 'secondary.light'
                    : 'grey.200',
                color:
                  company.type.toLowerCase() === 'generator'
                    ? 'primary.dark'
                    : company.type.toLowerCase() === 'shareholder'
                    ? 'success.dark'
                    : company.type.toLowerCase() === 'both'
                    ? 'secondary.dark'
                    : 'text.secondary',
                fontSize: '0.75rem',
                fontWeight: 'medium',
                textTransform: 'capitalize',
                whiteSpace: 'nowrap',
                display: 'inline-block',
                minWidth: 80,
                textAlign: 'center'
              }}
            >
              {company.type}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">Contact:</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{company.contactPerson || 'N/A'}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmailIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">Email:</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>{company.emailId || 'N/A'}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PhoneIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">Mobile:</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{company.mobile || 'N/A'}</Typography>
          </Box>
          {company.address && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">Address:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>{company.address}</Typography>
            </Box>
          )}
        </Box>
        {/* Type is now shown as a badge above */}
      </CardActionArea>
      <CardActions sx={{ justifyContent: 'flex-end', p: 1.5 }}>
        <Tooltip title="Refresh data">
          <span>
            <IconButton
              size="small"
              onClick={onRefresh}
              disabled={isLoading}
              color="primary"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {permissions?.update && (
          <Tooltip title="Edit Company">
            <IconButton
              size="small"
              color="info"
              onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
        )}
        {permissions?.delete && (
          <Tooltip title="Delete Company">
            <IconButton
              size="small"
              color="error"
              onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>
      {isLoading && (
        <Box sx={{ width: '100%', position: 'absolute', bottom: 0 }}>
          <LinearProgress color="primary" />
        </Box>
      )}
      {error && (
        <Box sx={{ width: '100%', position: 'absolute', top: 0 }}>
          <ErrorIcon color="error" fontSize="small" />
          <Typography variant="caption" color="error.main">{error}</Typography>
        </Box>
      )}
    </Card>
  );
};

CompanyCard.propTypes = {
  company: PropTypes.object.isRequired,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onRefresh: PropTypes.func,
  permissions: PropTypes.object.isRequired,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
  lastUpdated: PropTypes.oneOfType([
    PropTypes.instanceOf(Date),
    PropTypes.string,
    PropTypes.number
  ])
};

export default CompanyCard;
