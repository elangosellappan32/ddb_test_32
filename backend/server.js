require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./auth/authRoutes');
const userRoutes = require('./user/userRoutes');
const productionSiteRoutes = require('./productionSite/productionSiteRoutes');
const productionUnitRoutes = require('./productionUnit/productionUnitRoutes');
const productionChargeRoutes = require('./productionCharge/productionChargeRoutes');
const consumptionSiteRoutes = require('./consumptionSite/consumptionSiteRoutes');
const consumptionUnitRoutes = require('./consumptionUnit/consumptionUnitRoutes');
const allocationRoutes = require('./allocation/allocationRoutes');
const healthRoutes = require('./routes/healthRoutes');
const roleRoutes = require('./routes/roleRoutes');
const bankingRoutes = require('./banking/bankingRoutes');
const lapseRoutes = require('./lapse/lapseRoutes');
const captiveRoutes = require('./captive/captiveRoutes');
const companyRoutes = require('./company/companyRoutes');
const siteAccessRoutes = require('./routes/siteAccessRoutes');
const formRoutes = require('./routes/formRoutes');
const graphicalReportRoutes = require('./graphicalReport/graphicalReportRoutes');
const invoiceRoutes = require('./invoice/invoiceRoutes');
const { authenticateToken, checkPermission } = require('./middleware/authorization');
const app = express();
const PORT = process.env.PORT || 3333;

// Security middleware
app.use(helmet());

// CORS configuration for development
const corsOptions = {
    origin: '*', // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
    credentials: true,
    optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Add headers before the routes are defined
app.use(function (req, res, next) {
    // Allow all origins in development
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

// Body parsing middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// API Routes
// Public routes (no auth required)
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);

// Protected routes (require authentication)
app.use('/api/user', authenticateToken, userRoutes);
app.use('/api/production-site', authenticateToken, checkPermission('production', 'READ'), productionSiteRoutes);
app.use('/api/production-unit', authenticateToken, checkPermission('production-units', 'READ'), productionUnitRoutes);
app.use('/api/production-charge', authenticateToken, checkPermission('production-charges', 'READ'), productionChargeRoutes);
app.use('/api/consumption-site', authenticateToken, checkPermission('consumption', 'READ'), consumptionSiteRoutes);
app.use('/api/consumption-unit', authenticateToken, checkPermission('consumption-units', 'READ'), consumptionUnitRoutes);
app.use('/api/allocation', authenticateToken, checkPermission('allocation', 'READ'), allocationRoutes);
app.use('/api/roles', authenticateToken, roleRoutes);
app.use('/api/banking', authenticateToken, checkPermission('banking', 'READ'), bankingRoutes);
app.use('/api/lapse', authenticateToken, checkPermission('lapse', 'READ'), lapseRoutes);
app.use('/api/captive', authenticateToken, checkPermission('captive', 'READ'), captiveRoutes);
app.use('/api/company', authenticateToken, checkPermission('company', 'READ'), companyRoutes);
app.use('/api/site-access', authenticateToken, siteAccessRoutes);
app.use('/api/form', authenticateToken, formRoutes);
app.use('/api/graphical-report', authenticateToken, graphicalReportRoutes);
app.use('/api/invoice', authenticateToken, invoiceRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    logger.warn(`Route not found: ${req.method} ${req.url}`);
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

const startServer = async () => {
    try {
        const server = app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received. Shutting down gracefully...');
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();

module.exports = app;