const express = require('express');
const companyController = require('./companyController');

const router = express.Router();

// Get all companies
router.get('/', companyController.getAllCompanies);

// Get generator companies
router.get('/generators', companyController.getGeneratorCompanies);

// Get shareholder companies
router.get('/shareholders', companyController.getShareholderCompanies);

// Get companies by type
router.get('/type/:type', companyController.getCompaniesByType);

// Get company by ID
router.get('/id/:companyId', companyController.getCompanyById);

// Get company by ID and name
router.get('/:companyId/:companyName', companyController.getCompany);

module.exports = router;
