import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert, IconButton, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import companyApi from '../../services/companyApi';
import GeneratorCaptiveDialog from './GeneratorCaptiveDialog';

const CompanyPage = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCaptiveDialogOpen, setIsCaptiveDialogOpen] = useState(false);
  const [captiveGeneratorCompany, setCaptiveGeneratorCompany] = useState(null);
  const [formValues, setFormValues] = useState({
    companyId: '',
    companyName: '',
    type: '',
    address: '',
    contactPerson: '',
    mobile: '',
    emailId: ''
  });
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoading(true);
        const result = await companyApi.getAll();
        const list = Array.isArray(result?.data) ? result.data : [];
        setCompanies(list);
        setError(null);
      } catch (err) {
        setError('Failed to load companies');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  const handleEdit = (company) => {
    setIsEditMode(true);
    setSelectedCompany(company);
    setFormValues({
      companyId: company.companyId || '',
      companyName: company.companyName || '',
      type: company.type || '',
      address: company.address || '',
      contactPerson: company.contactPerson || '',
      mobile: company.mobile || '',
      emailId: company.emailId || ''
    });
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleDelete = (company) => {
    setSelectedCompany(company);
    setIsDeleteOpen(true);
  };

  const handleOpenCreate = () => {
    setIsEditMode(false);
    setSelectedCompany(null);
    setFormValues({ 
      companyId: '',
      companyName: '', 
      type: '', 
      address: '',
      contactPerson: '',
      mobile: '',
      emailId: ''
    });
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleCloseCreate = () => {
    if (isSubmitting) return;
    setIsCreateOpen(false);
    setIsEditMode(false);
    setSelectedCompany(null);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();

    if (!formValues.companyId || !formValues.companyName || !formValues.type || !formValues.address) {
      setFormError('Please fill all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      if (isEditMode && selectedCompany?.companyId != null) {
        const { companyId, companyName, ...updatePayload } = formValues;
        await companyApi.update(selectedCompany.companyId, updatePayload);
      } else {
        const created = await companyApi.create(formValues);

        const newCompany = created?.data || created;

        if (newCompany && newCompany.type === 'generator') {
          setCaptiveGeneratorCompany(newCompany);
          setIsCaptiveDialogOpen(true);
        }
      }

      const result = await companyApi.getAll();
      const list = Array.isArray(result?.data) ? result.data : [];
      setCompanies(list);
      setIsCreateOpen(false);
      setIsEditMode(false);
      setSelectedCompany(null);
    } catch (err) {
      const backendMessage = err?.response?.data?.message;
      setFormError(
        backendMessage || (isEditMode ? 'Failed to update company' : 'Failed to create company')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDelete = () => {
    if (isSubmitting) return;
    setIsDeleteOpen(false);
    setSelectedCompany(null);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCompany?.companyId) return;

    try {
      setIsSubmitting(true);
      await companyApi.delete(selectedCompany.companyId);

      const result = await companyApi.getAll();
      const list = Array.isArray(result?.data) ? result.data : [];
      setCompanies(list);
    } catch (err) {
      console.error('Failed to delete company', err);
    } finally {
      setIsSubmitting(false);
      setIsDeleteOpen(false);
      setSelectedCompany(null);
    }
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">
          Companies
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
        >
          Create Company
        </Button>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      )}

      {!loading && error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <Paper sx={{ mt: 2 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Company Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Contact Person</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.companyId}>
                    <TableCell>{company.companyName}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{company.type}</TableCell>
                    <TableCell>{company.contactPerson}</TableCell>
                    <TableCell>{company.mobile}</TableCell>
                    <TableCell>{company.address}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <IconButton size="small" color="secondary" onClick={() => handleEdit(company)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(company)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}

                {companies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No companies found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={isCreateOpen} onClose={handleCloseCreate} fullWidth maxWidth="sm">
        <DialogTitle>{isEditMode ? 'Edit Company' : 'Create Company'}</DialogTitle>
        <form onSubmit={handleCreateSubmit}>
          <DialogContent dividers>
            {formError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formError}
              </Alert>
            )}
            {isEditMode ? (
              <TextField
                margin="normal"
                label="Company ID"
                name="companyId"
                value={formValues.companyId}
                fullWidth
                InputProps={{ readOnly: true }}
              />
            ) : (
              <TextField
                margin="normal"
                label="Company ID"
                name="companyId"
                value={formValues.companyId}
                onChange={handleFormChange}
                fullWidth
                required
                type="number"
              />
            )}
            <TextField
              margin="normal"
              label="Company Name"
              name="companyName"
              value={formValues.companyName}
              onChange={handleFormChange}
              fullWidth
              required
              disabled={isEditMode}  // important: cannot change key
            />
            <TextField
              margin="normal"
              label="Type"
              name="type"
              value={formValues.type}
              onChange={handleFormChange}
              select
              fullWidth
              required
            >
              <MenuItem value="generator">Generator</MenuItem>
              <MenuItem value="shareholder">Shareholder</MenuItem>
            </TextField>
            <TextField
              margin="normal"
              label="Address"
              name="address"
              value={formValues.address}
              onChange={handleFormChange}
              fullWidth
              required
              multiline
              minRows={2}
            />
            <TextField
              margin="normal"
              label="Contact Person"
              name="contactPerson"
              value={formValues.contactPerson}
              onChange={handleFormChange}
              fullWidth
            />
            <TextField
              margin="normal"
              label="Mobile"
              name="mobile"
              value={formValues.mobile}
              onChange={handleFormChange}
              fullWidth
            />
            <TextField
              margin="normal"
              label="Email ID"
              name="emailId"
              type="email"
              value={formValues.emailId}
              onChange={handleFormChange}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCreate} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary" disabled={isSubmitting}>
              {isSubmitting
                ? isEditMode
                  ? 'Saving...'
                  : 'Creating...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <GeneratorCaptiveDialog
        open={isCaptiveDialogOpen}
        onClose={() => {
          setIsCaptiveDialogOpen(false);
          setCaptiveGeneratorCompany(null);
        }}
        generatorCompany={captiveGeneratorCompany}
        shareholderCompanies={companies.filter((c) => c.type === 'shareholder')}
      />

      <Dialog open={isDeleteOpen} onClose={handleCloseDelete} fullWidth maxWidth="xs">
        <DialogTitle>Delete Company</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Are you sure you want to delete{' '}
            <strong>{selectedCompany?.companyName}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDelete} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CompanyPage;
