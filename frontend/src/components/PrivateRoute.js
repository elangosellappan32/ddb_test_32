import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '@mui/material';

const PrivateRoute = ({ children, requiredResource, requiredAction }) => {
    const { isAuthenticated, checkPermission } = useAuth();
    const location = useLocation();

    // First check authentication
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If resource and action are specified, check permissions
    if (requiredResource && requiredAction) {
        const hasPermission = checkPermission(requiredResource, requiredAction);
        if (!hasPermission) {
            return (
                <Alert severity="error" sx={{ m: 2 }}>
                    You don't have permission to access this resource.
                </Alert>
            );
        }
    }

    return children;
};

export default PrivateRoute;