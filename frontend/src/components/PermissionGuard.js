import React from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * A component that conditionally renders its children based on user permissions
 * @param {Object} props
 * @param {string} props.resource - The resource to check permissions for (e.g., 'production', 'consumption')
 * @param {string|string[]} props.actions - Required action(s) ('CREATE', 'READ', etc). Can be a single action or array of actions.
 * @param {boolean} props.requireAll - If true, user must have ALL specified actions. If false, ANY action is sufficient.
 * @param {React.ReactNode} props.children - The content to render if permissions check passes
 * @param {React.ReactNode} props.fallback - Optional content to render if permissions check fails
 */
const PermissionGuard = ({ 
    resource, 
    actions, 
    requireAll = false, 
    children, 
    fallback = null 
}) => {
    const { checkPermission, checkAnyPermission } = useAuth();

    const hasPermission = React.useMemo(() => {
        if (Array.isArray(actions)) {
            return requireAll
                ? actions.every(action => checkPermission(resource, action))
                : checkAnyPermission(resource, actions);
        }
        return checkPermission(resource, actions);
    }, [resource, actions, requireAll, checkPermission, checkAnyPermission]);

    return hasPermission ? children : fallback;
};

export default PermissionGuard;
