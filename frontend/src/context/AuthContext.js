import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import authService from '../services/authService';
import userService from '../services/userService';
import { API_MESSAGES } from '../config/api.config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(authService.getCurrentUser());
    const [isInitialized, setIsInitialized] = useState(false);
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        // Check if there's a stored user session
        const storedUser = authService.getCurrentUser();
        if (storedUser) {
            setUser(storedUser);
        }
        setIsInitialized(true);
    }, []);

    const login = async (username, password) => {
        try {
            const data = await authService.login(username, password);
            
            if (data.success && data.user) {
                setUser(data.user);
                enqueueSnackbar(API_MESSAGES.AUTH.LOGIN_SUCCESS, { 
                    variant: 'success',
                    autoHideDuration: 2000
                });
                return true;
            }
            return false;
        } catch (error) {
            enqueueSnackbar(error.message || API_MESSAGES.AUTH.LOGIN_FAILED, {
                variant: 'error',
                autoHideDuration: 3000
            });
            throw error;
        }
    };    const logout = () => {
        authService.logout();
        setUser(null);
        enqueueSnackbar(API_MESSAGES.AUTH.LOGOUT_SUCCESS, { 
            variant: 'info',
            autoHideDuration: 2000
        });
        navigate('/login', { replace: true });
    };

    const checkPermission = (resource, action) => {
        return authService.hasPermission(resource, action);
    };

    const checkAnyPermission = (resource, actions) => {
        return authService.hasAnyPermission(resource, actions);
    };

    // Function to get accessible sites from user metadata
    const getAccessibleSites = useCallback(() => {
        if (!user) return { productionSites: [], consumptionSites: [] };
        
        try {
            const accessibleSites = user?.metadata?.accessibleSites;
            if (!accessibleSites) {
                return { productionSites: [], consumptionSites: [] };
            }

            // Extract production sites
            const productionSites = accessibleSites?.M?.productionSites?.M?.L?.L?.flatMap(siteArray => 
                siteArray.L.map(item => item.M?.S?.S).filter(Boolean)
            ) || [];

            // Extract consumption sites
            const consumptionSites = accessibleSites?.M?.consumptionSites?.M?.L?.L?.flatMap(siteArray => 
                siteArray.L.map(item => item.M?.S?.S).filter(Boolean)
            ) || [];

            return { productionSites, consumptionSites };
        } catch (error) {
            console.error('Error parsing accessible sites:', error);
            return { productionSites: [], consumptionSites: [] };
        }
    }, [user]);

    // Function to refresh accessible sites from the server
    const refreshAccessibleSites = useCallback(async () => {
        try {
            const sites = await userService.getUserAccessibleSites();
            if (sites && user) {
                // Update the user object with the latest accessible sites
                setUser(prevUser => ({
                    ...prevUser,
                    metadata: {
                        ...prevUser.metadata,
                        accessibleSites: {
                            M: {
                                productionSites: {
                                    M: { L: sites.productionSites.map(site => ({ M: { S: { S: site } } })) }
                                },
                                consumptionSites: {
                                    M: { L: sites.consumptionSites.map(site => ({ M: { S: { S: site } } })) }
                                }
                            }
                        }
                    }
                }));
            }
            return sites;
        } catch (error) {
            console.error('Error refreshing accessible sites:', error);
            enqueueSnackbar('Failed to refresh accessible sites', { variant: 'error' });
            throw error;
        }
    }, [user, enqueueSnackbar]);

    // Function to check if user has access to a specific site
    const hasSiteAccess = useCallback((siteId, siteType = 'production') => {
        if (!user) return false;
        if (user.isAdmin) return true;
        
        const sites = getAccessibleSites();
        const siteArray = siteType === 'production' ? sites.productionSites : sites.consumptionSites;
        return siteArray.includes(siteId);
    }, [user, getAccessibleSites]);

    if (!isInitialized) {
        return null; // or a loading spinner
    }
    
    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            isAuthenticated: !!user,
            checkPermission,
            checkAnyPermission,
            isAdmin: () => authService.isAdmin(user),
            hasRole: (role) => user?.role === role,
            hasPermission: authService.hasPermission,
            canCreate: authService.canCreate,
            canRead: authService.canRead,
            canUpdate: authService.canUpdate,
            canDelete: authService.canDelete,
            hasAnyPermission: authService.hasAnyPermission,
            // Accessible sites functionality
            getAccessibleSites,
            refreshAccessibleSites,
            hasSiteAccess
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};