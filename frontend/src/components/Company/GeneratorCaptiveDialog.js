import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';

const GeneratorCaptiveDialog = ({ open, onClose, generatorCompany, shareholderCompanies }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !generatorCompany) {
      setRows([]);
      setError('');
      return;
    }

    const genId = generatorCompany.companyId;
    const genName = generatorCompany.companyName;

    const initialRows = (shareholderCompanies || []).map(sh => ({
      generatorCompanyId: genId,
      generatorCompanyName: genName,
      shareholderCompanyId: sh.companyId,
      shareholderCompanyName: sh.companyName,
      allocationPercentage: 0
    }));

    setRows(initialRows);
    setError('');
  }, [open, generatorCompany, shareholderCompanies]);

  const handleChange = (index, value) => {
    const num = Number(value);
    if (Number.isNaN(num) || num < 0 || num > 100) {
      // Just update text, validation happens on save
    }
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], allocationPercentage: value };
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      if (!rows.length) {
        enqueueSnackbar('No shareholder companies available for allocation', { variant: 'warning' });
        return;
      }

      const updates = rows.map((r) => {
        const pct = Number(r.allocationPercentage || 0);
        if (Number.isNaN(pct) || pct < 0 || pct > 100) {
          throw new Error('Each allocation percentage must be between 0 and 100');
        }
        return {
          generatorCompanyId: r.generatorCompanyId,
          generatorCompanyName: r.generatorCompanyName,
          shareholderCompanyId: r.shareholderCompanyId,
          shareholderCompanyName: r.shareholderCompanyName,
          allocationPercentage: pct,
          allocationStatus: 'active'
        };
      });

      await api.post('/captive/update-bulk', updates);
      enqueueSnackbar('Captive allocations saved successfully', { variant: 'success' });
      if (onClose) {
        onClose();
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to save allocations';
      setError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!generatorCompany) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Captive Allocation for {generatorCompany.companyName} (ID: {generatorCompany.companyId})
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!shareholderCompanies || shareholderCompanies.length === 0 ? (
          <Alert severity="info">No shareholder companies found. Please create shareholder companies first.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Shareholder Company</TableCell>
                  <TableCell align="right">Allocation %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.shareholderCompanyId}>
                    <TableCell>{row.shareholderCompanyName}</TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        value={row.allocationPercentage}
                        onChange={(e) => handleChange(idx, e.target.value)}
                        size="small"
                        inputProps={{ min: 0, max: 100 }}
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {rows.length > 0 && (
          <Box mt={2}>
            <Typography variant="caption" color="textSecondary">
              Percentages are per generator-shareholder pair. You can leave some at 0%.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={saving || !shareholderCompanies || shareholderCompanies.length === 0}
          startIcon={saving ? <CircularProgress size={18} /> : null}
        >
          {saving ? 'Saving...' : 'Save Allocations'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GeneratorCaptiveDialog;
