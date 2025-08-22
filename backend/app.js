require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const { authenticateToken, checkPermission } = require('./middleware/authorization');

// Import routes
const authRoutes = require('./auth/authRoutes');
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
const siteAccessRoutes = require('./routes/siteAccessRoutes');
const reportRoutes = require('./routes/reportRoutes');
const graphicalReportRoutes = require('./graphicalReport/graphicalReportRoutes');
const invoiceRoutes = require('./invoice/invoiceRoutes');

const app = express();

// Remove auth for site detail endpoints
const removeAuthForDetail = (router) => {
    const wrappedRouter = express.Router();
    router.stack.forEach((layer) => {
        if (layer.route) {
            const path = layer.route.path;
            const methods = layer.route.methods;
            
            // If this is a details endpoint (has :companyId and :siteId params)
            if (path.includes(':companyId') && (path.includes(':productionSiteId') || path.includes(':consumptionSiteId'))) {
                // For GET requests, don't use auth middleware
                if (methods.get) {
                    wrappedRouter.get(path, layer.route.stack
                        .filter(s => !s.name.includes('authenticate') && !s.name.includes('validateSite'))
                        .map(s => s.handle));
                }
                // For other methods, keep all middleware
                Object.keys(methods).forEach(method => {
                    if (method !== 'get') {
                        wrappedRouter[method](path, layer.route.stack.map(s => s.handle));
                    }
                });
            } else {
                // For non-details endpoints, keep all middleware
                Object.keys(methods).forEach(method => {
                    wrappedRouter[method](path, layer.route.stack.map(s => s.handle));
                });
            }
        }
    });
    return wrappedRouter;
};

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://striotestcheck.work.gd',
        'https://striotestcheck.work.gd'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'up', timestamp: new Date().toISOString() });
});

// API Routes
console.log('Mounting API routes...');

// Public routes (no auth required)
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);

// User routes (require authentication)
app.use('/api/user', authenticateToken, require('./routes/userRoutes'));

// Protected routes (require authentication)
app.use('/api/roles', authenticateToken, roleRoutes);

// Protected routes with resource-specific permissions, but details pages are public
app.use('/api/site-access', authenticateToken, siteAccessRoutes);
app.use('/api/production-site', authenticateToken, checkPermission('production', 'READ'), removeAuthForDetail(productionSiteRoutes));
app.use('/api/consumption-site', authenticateToken, checkPermission('consumption', 'READ'), removeAuthForDetail(consumptionSiteRoutes));
app.use('/api/production-unit', authenticateToken,
    checkPermission('production-units', 'READ'),
    removeAuthForDetail(productionUnitRoutes));
    
app.use('/api/production-charge', authenticateToken,
    checkPermission('production-charges', 'READ'),
    removeAuthForDetail(productionChargeRoutes));
    
app.use('/api/consumption-unit', authenticateToken,
    checkPermission('consumption-units', 'READ'),
    consumptionUnitRoutes);
    
app.use('/api/allocation', authenticateToken,
    checkPermission('allocation', 'READ'),
    allocationRoutes);
    
app.use('/api/banking', authenticateToken,
    checkPermission('banking', 'READ'),
    bankingRoutes);
    
app.use('/api/lapse', authenticateToken,
    checkPermission('lapse', 'READ'),
    lapseRoutes);
    
app.use('/api/captive', authenticateToken,
    checkPermission('captive', 'READ'),
    captiveRoutes);
    
// Report routes (require authentication)
app.use('/api/reports', authenticateToken, checkPermission('view_reports'), reportRoutes);
app.use('/api/graphical-report', authenticateToken, checkPermission('view_reports'), graphicalReportRoutes);

console.log('All routes mounted with authorization');

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Error:', err);

    // Axios/network error handling for API proxy or fetch failures
    if (err.isAxiosError || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return res.status(502).json({
            success: false,
            message: 'Failed to connect to backend service or external API',
            detail: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }

    // Specific error handling
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors: err.errors
        });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized'
        });
    }

    if (err.name === 'ConditionalCheckFailedException') {
        return res.status(409).json({
            success: false,
            message: 'Version conflict or item already exists'
        });
    }

    // Default error response
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    logger.warn(`Route not found: ${req.method} ${req.url}`);
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

module.exports = app;