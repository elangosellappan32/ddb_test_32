const companyDAL = require('./companyDAL');
const logger = require('../utils/logger');

// Create a new company
exports.createCompany = async (req, res) => {
    try {
        const companyData = req.body || {};

        // Basic required-field validation
        if (!companyData.companyName || !companyData.type || !companyData.address) {
            return res.status(400).json({
                success: false,
                message: 'companyName, type and address are required'
            });
        }

        // Convert type to lowercase for case-insensitive comparison
        const companyType = companyData.type?.toLowerCase();
        
        // Validate type is either generator or shareholder (case-insensitive)
        if (!['generator', 'shareholder'].includes(companyType)) {
            return res.status(400).json({
                success: false,
                message: 'type must be either "generator" or "shareholder"'
            });
        }
        
        // Update the type to be lowercase for consistency
        companyData.type = companyType;

        if (companyData.emailId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyData.emailId)) {
            return res.status(400).json({
                success: false,
                message: 'emailId is not a valid email address'
            });
        }

        logger.info('Creating company with data:', companyData);

        const created = await companyDAL.createCompany(companyData);

        return res.status(201).json({
            success: true,
            data: created
        });
    } catch (error) {
        logger.error('Controller error in createCompany:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating company',
            error: error.message
        });
    }
};

// Update an existing company
exports.updateCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const updates = req.body || {};

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId is required in the path'
      });
    }

    // Reject empty update payload
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one field must be provided to update'
      });
    }

    // Disallow attempting to change key fields from the API layer
    const existingCompany = await companyDAL.getCompanyById(companyId);
    if (!existingCompany) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Only block if companyId or companyName are being modified
    if ((updates.companyId !== undefined && updates.companyId !== existingCompany.companyId) ||
        (updates.companyName !== undefined && updates.companyName !== existingCompany.companyName)) {
      return res.status(400).json({
        success: false,
        message: 'companyId and companyName cannot be updated'
      });
    }
    
    // Remove companyId and companyName from updates since they can't be changed
    delete updates.companyId;
    delete updates.companyName;

    if (updates.type) {
      // Convert type to lowercase for case-insensitive comparison
      const companyType = updates.type.toLowerCase();
      
      // Validate type is either generator or shareholder (case-insensitive)
      if (!['generator', 'shareholder'].includes(companyType)) {
        return res.status(400).json({
          success: false,
          message: 'type must be either "generator" or "shareholder"'
        });
      }
      
      // Update the type to be lowercase for consistency
      updates.type = companyType;
    }

    if (updates.emailId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.emailId)) {
      return res.status(400).json({
        success: false,
        message: 'emailId is not a valid email address'
      });
    }

    const updated = await companyDAL.updateCompany(companyId, updates);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    logger.error('Controller error in updateCompany:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating company',
      error: error.message
    });
  }
};

// Delete company by ID
exports.deleteCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const deleted = await companyDAL.deleteCompany(companyId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    logger.error('Controller error in deleteCompany:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting company',
      error: error.message
    });
  }
};
// Get all companies
exports.getAllCompanies = async (req, res) => {
    try {
        const companies = await companyDAL.getAllCompanies();
        res.status(200).json({
            success: true,
            data: companies,
            count: companies.length
        });
    } catch (error) {
        logger.error('Controller error in getAllCompanies:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching companies', 
            error: error.message 
        });
    }
};

// Get company by ID and name
exports.getCompany = async (req, res) => {
    try {
        const { companyId, companyName } = req.params;
        const company = await companyDAL.getCompany(companyId, companyName);
        if (!company) {
            return res.status(404).json({ 
                message: 'Company not found' 
            });
        }
        res.status(200).json(company);
    } catch (error) {
        logger.error('Controller error in getCompany:', error);
        res.status(500).json({ 
            message: 'Error fetching company', 
            error: error.message 
        });
    }
};

// Get company by ID
exports.getCompanyById = async (req, res) => {
    try {
        const { companyId } = req.params;
        const company = await companyDAL.getCompanyById(companyId);
        if (!company) {
            return res.status(404).json({ 
                message: 'Company not found' 
            });
        }
        res.status(200).json(company);
    } catch (error) {
        logger.error('Controller error in getCompanyById:', error);
        res.status(500).json({ 
            message: 'Error fetching company', 
            error: error.message 
        });
    }
};

// Get companies by type
exports.getCompaniesByType = async (req, res) => {
    try {
        const { type } = req.params;
        const companies = await companyDAL.getCompaniesByType(type);
        res.status(200).json(companies);
    } catch (error) {
        logger.error('Controller error in getCompaniesByType:', error);
        res.status(500).json({ 
            message: 'Error fetching companies', 
            error: error.message 
        });
    }
};

// Get generator companies
exports.getGeneratorCompanies = async (req, res) => {
    try {
        const companies = await companyDAL.getGeneratorCompanies();
        res.status(200).json(companies);
    } catch (error) {
        logger.error('Controller error in getGeneratorCompanies:', error);
        res.status(500).json({ 
            message: 'Error fetching generator companies', 
            error: error.message 
        });
    }
};

// Get shareholder companies
exports.getShareholderCompanies = async (req, res) => {
    try {
        const companies = await companyDAL.getShareholderCompanies();
        res.status(200).json(companies);
    } catch (error) {
        logger.error('Controller error in getShareholderCompanies:', error);
        res.status(500).json({ 
            message: 'Error fetching shareholder companies', 
            error: error.message 
        });
    }
};
