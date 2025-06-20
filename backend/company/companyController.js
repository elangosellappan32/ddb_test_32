const companyDAL = require('./companyDAL');
const logger = require('../utils/logger');

// Get all companies
exports.getAllCompanies = async (req, res) => {
    try {
        const companies = await companyDAL.getAllCompanies();
        res.status(200).json(companies);
    } catch (error) {
        logger.error('Controller error in getAllCompanies:', error);
        res.status(500).json({ 
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
