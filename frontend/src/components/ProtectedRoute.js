import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * ProtectedRoute component that ensures only superadmin users can access certain routes
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The component to render if authorized
 * @param {string} props.requiredRole - The required role to access this route
 * @returns {React.ReactNode} Either the protected component or a redirect
 */
const ProtectedRoute = ({ children, requiredRole = 'admin' }) => {
    const { user, isAuthenticated, isAdmin, isSuperAdmin } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Check if user has required role
    const hasRequiredRole = () => {
        if (requiredRole === 'superadmin') {
            return isSuperAdmin();
        }
        if (requiredRole === 'admin') {
            return isAdmin() || isSuperAdmin();
        }
        return user?.role?.toUpperCase() === requiredRole.toUpperCase();
    };

    if (!hasRequiredRole()) {
        return (
            <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '100vh',
                backgroundColor: '#f5f5f5'
            }}>
                <Typography variant="h4" sx={{ mb: 2, color: 'error.main' }}>
                    Access Denied
                </Typography>
                <Typography variant="body1" sx={{ color: 'textSecondary' }}>
                    You don't have permission to access this page.
                </Typography>
                <Typography variant="caption" sx={{ mt: 2, color: 'textSecondary' }}>
                    Required role: {requiredRole.toUpperCase()}
                </Typography>
            </Box>
        );
    }

    return children;
};

/**
 * SuperAdminRoute component specifically for superadmin-only routes
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The component to render if authorized
 * @returns {React.ReactNode} Either the protected component or a redirect
 */
export const SuperAdminRoute = ({ children }) => {
    return <ProtectedRoute requiredRole="superadmin">{children}</ProtectedRoute>;
};

/**
 * AdminRoute component for admin and superadmin routes
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The component to render if authorized
 * @returns {React.ReactNode} Either the protected component or a redirect
 */
export const AdminRoute = ({ children }) => {
    return <ProtectedRoute requiredRole="admin">{children}</ProtectedRoute>;
};

export default ProtectedRoute;
